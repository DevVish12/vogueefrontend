import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ADMIN_PATHS } from './adminPaths';

// Prevents authenticated admins from accessing login/register pages
export default function RequireLogin() {
    const token = localStorage.getItem('adminToken');

    if (token) {
        return <Navigate to={ADMIN_PATHS.DASHBOARD} replace />;
    }

    return <Outlet />;
}
