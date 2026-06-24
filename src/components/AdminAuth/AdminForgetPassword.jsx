import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordAdmin } from '../../server/authApi';
import { ADMIN_PATHS } from '../../routes/adminPaths';

export default function AdminForgetPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: null, message: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: null, message: '' });
        setLoading(true);

        try {
            const data = await forgotPasswordAdmin(email);
            if(data.success) {
                setStatus({ type: 'success', message: 'Password reset link sent to your email! Please check your inbox.' });
            } else {
                setStatus({ type: 'error', message: data.message || 'Failed to send reset link.' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err || 'Something went wrong. Ensure SMTP is properly configured.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center text-primary-600">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                        U
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Forgot Password</h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Enter your email to receive a reset link.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    {status.type === 'error' && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">
                            {status.message}
                        </div>
                    )}
                    {status.type === 'success' && (
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm font-medium border border-green-100">
                            {status.message}
                        </div>
                    )}
                    
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email address</label>
                            <div className="mt-1">
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    value={email}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </div>
                    </form>
                    
                    <div className="mt-6 text-center text-sm">
                        <Link to={ADMIN_PATHS.LOGIN} className="font-medium text-primary-600 hover:text-primary-500">
                            Back to sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
