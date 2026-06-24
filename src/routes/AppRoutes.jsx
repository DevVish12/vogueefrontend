import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminRoutes from './AdminRoutes';
import { ADMIN_PATHS } from './adminPaths';

export default function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Fallback root route */}
                <Route path="/" element={<Navigate to={ADMIN_PATHS.LOGIN} replace />} />
                
                {/* Admin domain routes */}
                <Route path="/*" element={<AdminRoutes />} />
            </Routes>
        </BrowserRouter>
    );
}
