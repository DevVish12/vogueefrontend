import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import AdminLogin from '../components/AdminAuth/AdminLogin';
import AdminRegistration from '../components/AdminAuth/AdminRegistration';
import AdminForgetPassword from '../components/AdminAuth/AdminForgetPassword';
import AdminResetpassword from '../components/AdminAuth/AdminResetpassword';
import AdminDashboard from '../components/Layout/AdminDashboard';
import ServicesPage from '../components/Services/ServicesPage';
import CommissionManagementPage from '../components/Commission/CommissionManagementPage';
import CategoryPage from '../components/Category/CategoryPage';
import BannerPage from '../components/Banner/BannerPage';
import UserManagePage from '../components/User/UserManagePage';
import UserBookingManagePage from '../components/User/UserBookingManagePage';
import UserBookingManage from '../components/User/UserBookingManage.jsx';
import PartnerManagePage from '../components/Partner/PartnerManagePage';
import PartnerKycPage from '../components/Partner/PartnerKycPage';
import PartnerPayoutsPage from '../components/Partner/PartnerPayoutsPage';
import PartnerPayoutHistoryPage from '../components/Partner/PartnerPayoutHistoryPage';
import AdminReviewsPage from '../components/Reviews/AdminReviewsPage';
import CouponManagementPage from '../components/Coupon/CouponManagementPage';
import AdminLayout from '../components/Layout/AdminLayout';
import { ADMIN_PATHS } from './adminPaths';

import ProtectedRoute from './ProtectedRoute';
import RequireLogin from './RequireLogin';

function LegacyResetPasswordRedirect() {
    const { token } = useParams();

    if (!token) {
        return <Navigate to={ADMIN_PATHS.LOGIN} replace />;
    }

    return <Navigate to={ADMIN_PATHS.RESET_PASSWORD.replace(':token', token)} replace />;
}

export default function AdminRoutes() {
    const legacyRedirects = [
        ['/admin/login', ADMIN_PATHS.LOGIN],
        ['/admin/register', ADMIN_PATHS.REGISTER],
        ['/admin/forgot-password', ADMIN_PATHS.FORGOT_PASSWORD],
        ['/admin/dashboard', ADMIN_PATHS.DASHBOARD],
        ['/admin/services', ADMIN_PATHS.SERVICES],
        ['/admin/commissions', ADMIN_PATHS.COMMISSIONS],
        ['/admin/category', ADMIN_PATHS.CATEGORY],
        ['/admin/banner', ADMIN_PATHS.BANNER],
        ['/admin/reviews', ADMIN_PATHS.REVIEWS],
        ['/admin/users', ADMIN_PATHS.USERS],
        ['/admin/user-bookings', ADMIN_PATHS.USER_BOOKINGS],
        ['/admin/no-partner-bookings', ADMIN_PATHS.NO_PARTNER_BOOKINGS],
        ['/admin/partners', ADMIN_PATHS.PARTNERS],
        ['/admin/partner-kyc', ADMIN_PATHS.PARTNER_KYC],
        ['/admin/payouts', ADMIN_PATHS.PAYOUTS],
        ['/admin/payout-history', ADMIN_PATHS.PAYOUT_HISTORY],
        ['/admin/coupons', ADMIN_PATHS.COUPONS],
        ['/admin/create-admin', ADMIN_PATHS.CREATE_ADMIN]
    ];

    return (
        <Routes>
            {/* Redirect /admin root to login */}
            <Route path="/" element={<Navigate to={ADMIN_PATHS.LOGIN} replace />} />

            {legacyRedirects.map(([path, target]) => (
                <Route key={path} path={path} element={<Navigate to={target} replace />} />
            ))}

            <Route path="/admin/reset-password/:token" element={<LegacyResetPasswordRedirect />} />

            {/* Public admin registration route */}
            <Route path={ADMIN_PATHS.REGISTER} element={<AdminRegistration />} />

            {/* Guest Routes (Only accessible if NOT logged in) */}
            <Route element={<RequireLogin />}>
                <Route path={ADMIN_PATHS.LOGIN} element={<AdminLogin />} />
                <Route path={ADMIN_PATHS.FORGOT_PASSWORD} element={<AdminForgetPassword />} />
                <Route path={ADMIN_PATHS.RESET_PASSWORD} element={<AdminResetpassword />} />
            </Route>

            {/* Protected Routes (Only accessible if logged in) */}
            <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                    <Route path={ADMIN_PATHS.DASHBOARD} element={<AdminDashboard />} />
                    <Route path={ADMIN_PATHS.BANNER} element={<BannerPage />} />
                    <Route path={ADMIN_PATHS.SERVICES} element={<ServicesPage />} />
                    <Route path={ADMIN_PATHS.COMMISSIONS} element={<CommissionManagementPage />} />
                    <Route path={ADMIN_PATHS.USERS} element={<UserManagePage />} />
                    <Route path={ADMIN_PATHS.USER_BOOKINGS} element={<UserBookingManagePage />} />
                    <Route path={ADMIN_PATHS.NO_PARTNER_BOOKINGS} element={<UserBookingManage />} />
                    <Route path={ADMIN_PATHS.PARTNERS} element={<PartnerManagePage />} />
                    <Route path={ADMIN_PATHS.PARTNER_KYC} element={<PartnerKycPage />} />
                    <Route path={ADMIN_PATHS.PAYOUTS} element={<PartnerPayoutsPage />} />
                    <Route path={ADMIN_PATHS.PAYOUT_HISTORY} element={<PartnerPayoutHistoryPage />} />
                    <Route path={ADMIN_PATHS.REVIEWS} element={<AdminReviewsPage />} />
                    <Route path={ADMIN_PATHS.COUPONS} element={<CouponManagementPage />} />
                    <Route path={ADMIN_PATHS.CREATE_ADMIN} element={<AdminRegistration />} />
                    <Route path={ADMIN_PATHS.CATEGORY} element={<CategoryPage />} />
                </Route>
            </Route>
        </Routes>
    );
}
