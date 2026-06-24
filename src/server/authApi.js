import api from './api';

export const loginAdmin = async (credentials) => {
    return await api.post('/admin/login', credentials);
};

export const registerAdmin = async (adminData) => {
    return await api.post('/admin/register', adminData);
};

export const getAdminProfile = async () => {
    return await api.get('/admin/profile');
};

export const forgotPasswordAdmin = async (email) => {
    return await api.post('/admin/forgot-password', { email });
};

export const resetPasswordAdmin = async (token, password, confirmPassword) => {
    return await api.post(`/admin/reset-password/${token}`, { password, confirmPassword });
};

export const logoutAdmin = () => {
    localStorage.removeItem('adminToken');
};
