import axios from 'axios';
import { ADMIN_PATHS } from '../routes/adminPaths';

const extractErrorMessage = (error) => {
    // Network / CORS / server down
    if (!error?.response) {
        return error?.message || 'Network error. Is the backend running?';
    }

    const data = error.response.data;

    // Standard API shape: { success:false, message, errors }
    if (data && typeof data === 'object') {
        if (typeof data.message === 'string' && data.message.trim()) return data.message;
        if (Array.isArray(data.errors) && data.errors.length) return data.errors.join(', ');
        if (typeof data.error === 'string' && data.error.trim()) return data.error;
        try {
            return JSON.stringify(data);
        } catch {
            return 'Request failed';
        }
    }

    // Some middleware (or 404s) may send plain text/HTML
    if (typeof data === 'string' && data.trim()) return data;

    return error?.message || 'Something went wrong';
};

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', // Backend base URL
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor to inject token to protected routes
api.interceptors.request.use((config) => {
    // If we're sending FormData, let the browser set the correct multipart boundary.
    // Otherwise, a forced JSON Content-Type can cause multer to see no files.
    const isFormData =
        typeof FormData !== 'undefined' &&
        config?.data &&
        config.data instanceof FormData;

    if (isFormData && config.headers) {
        try {
            // Axios v1 may use AxiosHeaders
            if (typeof config.headers.delete === 'function') {
                config.headers.delete('Content-Type');
                config.headers.delete('content-type');
            } else {
                delete config.headers['Content-Type'];
                delete config.headers['content-type'];
            }
        } catch {
            // ignore
        }
    }

    const token = localStorage.getItem('adminToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor to handle global api errors smoothly
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error?.response?.status === 401) {
            localStorage.removeItem('adminToken');
            if (typeof window !== 'undefined') {
                if (!sessionStorage.getItem('adminRedirecting')) {
                    sessionStorage.setItem('adminRedirecting', '1');
                    setTimeout(() => {
                        sessionStorage.removeItem('adminRedirecting');
                    }, 5000);
                    if (window.location.pathname !== ADMIN_PATHS.LOGIN) {
                        window.location.replace(ADMIN_PATHS.LOGIN);
                    }
                }
            }
        }
        return Promise.reject(extractErrorMessage(error));
    }
);

export default api;
