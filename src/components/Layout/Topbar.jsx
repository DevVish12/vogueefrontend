import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_PATHS } from '../../routes/adminPaths';

function IconBase({ children, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function BellIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M15 17H9" />
      <path d="M18 16V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
      <path d="M12 20a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Z" />
    </IconBase>
  );
}

function ChevronDownIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

function CircleCheckBigIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.2 2.2 4.8-5.2" />
    </IconBase>
  );
}

function PlusIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

const titleMap = {
  [ADMIN_PATHS.DASHBOARD]: 'Dashboard Overview',
  [ADMIN_PATHS.BANNER]: 'Banner Manage',
  [ADMIN_PATHS.SERVICES]: 'Services',
  [ADMIN_PATHS.COMMISSIONS]: 'Commission Management',
  [ADMIN_PATHS.CATEGORY]: 'Category',
  [ADMIN_PATHS.USERS]: 'User Manage',
  [ADMIN_PATHS.USER_BOOKINGS]: 'User Booking Manage',
  [ADMIN_PATHS.NO_PARTNER_BOOKINGS]: 'No Partner Bookings',
  [ADMIN_PATHS.PARTNERS]: 'Partner Manage',
  [ADMIN_PATHS.PARTNER_KYC]: 'Partner KYC',
  [ADMIN_PATHS.PAYOUTS]: 'Payouts',
  [ADMIN_PATHS.PAYOUT_HISTORY]: 'Payout History',
  [ADMIN_PATHS.REVIEWS]: 'Reviews',
  [ADMIN_PATHS.COUPONS]: 'Coupons',
  [ADMIN_PATHS.CREATE_ADMIN]: 'Register New Admin',
};

export default function Topbar({ admin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = titleMap[location.pathname] || 'VOGUEE ADMIN';

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] sm:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">VOGUEE ADMIN</p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            <CircleCheckBigIcon className="h-4 w-4" />
            Live system
          </div>

        

          <button
            onClick={() => navigate(ADMIN_PATHS.CREATE_ADMIN)}
            className="hidden sm:inline-flex items-center justify-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <PlusIcon className="h-4 w-4" />
            Register New Admin
          </button>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
              {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold text-slate-900">{admin?.name || 'Admin'}</p>
              <p className="truncate text-xs text-slate-500 capitalize">{admin?.role || 'admin'}</p>
            </div>
            <ChevronDownIcon className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
