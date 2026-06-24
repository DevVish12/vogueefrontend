import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { resetPasswordAdmin } from '../../server/authApi';
import { ADMIN_PATHS } from '../../routes/adminPaths';

export default function AdminResetpassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
    const [status, setStatus] = useState({ type: null, message: '' });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validateForm = () => {
        const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passRegex.test(formData.password)) {
            return "Password must be min 8 chars, 1 uppercase, 1 number, 1 special character.";
        }
        if (formData.password !== formData.confirmPassword) {
            return "Passwords do not match.";
        }
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: null, message: '' });
        
        const validationError = validateForm();
        if(validationError) {
            return setStatus({ type: 'error', message: validationError });
        }

        setLoading(true);

        try {
            const data = await resetPasswordAdmin(token, formData.password, formData.confirmPassword);
            if(data.success) {
                setStatus({ type: 'success', message: 'Password has been successfully reset!' });
                setTimeout(() => navigate(ADMIN_PATHS.LOGIN), 3000);
            } else {
                setStatus({ type: 'error', message: data.message || 'Reset failed' });
            }
        } catch (err) {
            if(Array.isArray(err)) setStatus({ type: 'error', message: err.join(', ') });
            else setStatus({ type: 'error', message: err || 'Token may be invalid or expired.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                   <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                        U
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset Password</h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Enter your new password below.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    {status.type === 'error' && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">
                            {status.message}
                        </div>
                    )}
                    {status.type === 'success' ? (
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm font-medium border border-green-100 text-center">
                            {status.message} <br/> Redirecting to Login...
                        </div>
                    ) : (
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">New Password</label>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                                    onChange={handleChange}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    )}
                    
                    <div className="mt-6 text-center text-sm">
                        <Link to={ADMIN_PATHS.LOGIN} className="font-medium text-primary-600 hover:text-primary-500">
                            Cancel and go back to sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
