import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ADMIN_PATHS } from './adminPaths';

// Redirects to Login if token is NOT present
export default function ProtectedRoute() {
    const token = localStorage.getItem('adminToken');
    
    if (!token) {
        return <Navigate to={ADMIN_PATHS.LOGIN} replace />;
    }

    return <Outlet />;
}
