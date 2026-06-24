import React from 'react';
import { NavLink } from 'react-router-dom';
import { ADMIN_PATHS } from '../../routes/adminPaths';

function IconBase({ children, className = '' }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
			{children}
		</svg>
	);
}

function LayoutDashboardIcon(props) {
	return (
		<IconBase {...props}>
			<rect x="3" y="3" width="7" height="7" rx="2" />
			<rect x="14" y="3" width="7" height="4" rx="2" />
			<rect x="14" y="11" width="7" height="10" rx="2" />
			<rect x="3" y="14" width="7" height="7" rx="2" />
		</IconBase>
	);
}

function ImageIcon(props) {
	return (
		<IconBase {...props}>
			<rect x="3" y="4" width="18" height="16" rx="3" />
			<circle cx="8" cy="9" r="1.5" />
			<path d="M21 16l-5.5-5.5a1 1 0 0 0-1.4 0L6 19" />
		</IconBase>
	);
}

function BriefcaseBusinessIcon(props) {
	return (
		<IconBase {...props}>
			<rect x="3" y="7" width="18" height="12" rx="3" />
			<path d="M9 7V6a3 3 0 0 1 6 0v1" />
			<path d="M3 12h18" />
		</IconBase>
	);
}

function CircleDollarSignIcon(props) {
	return (
		<IconBase {...props}>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v10" />
			<path d="M14.5 9.2A2.6 2.6 0 0 0 12 8c-1.7 0-3 1-3 2.4 0 1.3.9 2 2.7 2.4l1.2.3c1.8.4 2.8 1.1 2.8 2.5 0 1.5-1.4 2.4-3.2 2.4-1.3 0-2.4-.4-3.2-1.2" />
		</IconBase>
	);
}

function Layers3Icon(props) {
	return (
		<IconBase {...props}>
			<path d="M12 4 3 8l9 4 9-4-9-4Z" />
			<path d="m3 12 9 4 9-4" />
			<path d="m3 16 9 4 9-4" />
		</IconBase>
	);
}

function UsersIcon(props) {
	return (
		<IconBase {...props}>
			<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
			<circle cx="9.5" cy="8" r="3" />
			<path d="M22 19v-1a3 3 0 0 0-3-3h-1" />
			<path d="M16 5.5a3 3 0 0 1 0 5.9" />
		</IconBase>
	);
}

function CalendarCheckIcon(props) {
	return (
		<IconBase {...props}>
			<rect x="3" y="5" width="18" height="16" rx="3" />
			<path d="M8 3v4" />
			<path d="M16 3v4" />
			<path d="M3 10h18" />
			<path d="m8.5 15 2 2 3.5-4" />
		</IconBase>
	);
}

function ListChecksIcon(props) {
	return (
		<IconBase {...props}>
			<path d="M9 6h11" />
			<path d="M9 12h11" />
			<path d="M9 18h11" />
			<path d="M3.5 6 5 7.5 7.5 5" />
			<path d="M3.5 12 5 13.5 7.5 11" />
			<path d="M3.5 18 5 19.5 7.5 17" />
		</IconBase>
	);
}

function UserCheckIcon(props) {
	return (
		<IconBase {...props}>
			<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
			<circle cx="9.5" cy="8" r="3" />
			<path d="m15 11 1.5 1.5 3-3" />
		</IconBase>
	);
}

function ShieldCheckIcon(props) {
	return (
		<IconBase {...props}>
			<path d="M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3Z" />
			<path d="m9.5 12 1.8 1.8 3.7-4" />
		</IconBase>
	);
}

function WalletIcon(props) {
	return (
		<IconBase {...props}>
			<path d="M4 7h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2V7Z" />
			<path d="M4 7a3 3 0 0 1 3-3h11v4H7" />
			<path d="M16 13h4" />
		</IconBase>
	);
}

function FileClockIcon(props) {
	return (
		<IconBase {...props}>
			<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
			<path d="M14 3v5h5" />
			<circle cx="12" cy="16" r="3" />
			<path d="M12 14.7V16l1 0.8" />
		</IconBase>
	);
}

function TicketPercentIcon(props) {
	return (
		<IconBase {...props}>
			<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Z" />
			<path d="m9 15 6-6" />
			<circle cx="10" cy="9.5" r="1" />
			<circle cx="14" cy="13.5" r="1" />
		</IconBase>
	);
}

function StarIcon(props) {
	return (
		<IconBase {...props}>
			<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" />
		</IconBase>
	);
}

const sections = [
  {
    title: 'Overview',
    items: [
	      { label: 'Dashboard Overview', to: ADMIN_PATHS.DASHBOARD, icon: LayoutDashboardIcon },
	      { label: 'Banner Manage', to: ADMIN_PATHS.BANNER, icon: ImageIcon },
	      { label: 'Services', to: ADMIN_PATHS.SERVICES, icon: BriefcaseBusinessIcon },
					      { label: 'Category', to: ADMIN_PATHS.CATEGORY, icon: Layers3Icon },

    ],
  },
  {
    title: 'Management',
    items: [
	      { label: 'Commission Management', to: ADMIN_PATHS.COMMISSIONS, icon: CircleDollarSignIcon },
	      { label: 'User Manage', to: ADMIN_PATHS.USERS, icon: UsersIcon },
	      { label: 'User Booking Manage', to: ADMIN_PATHS.USER_BOOKINGS, icon: CalendarCheckIcon },
	      { label: 'No Partner Bookings', to: ADMIN_PATHS.NO_PARTNER_BOOKINGS, icon: ListChecksIcon },
	      { label: 'Partner Manage', to: ADMIN_PATHS.PARTNERS, icon: UserCheckIcon },
	      { label: 'Partner KYC', to: ADMIN_PATHS.PARTNER_KYC, icon: ShieldCheckIcon },
    ],
  },
  {
    title: 'Finance',
    items: [
	      { label: 'Payouts', to: ADMIN_PATHS.PAYOUTS, icon: WalletIcon },
	      { label: 'Payout History', to: ADMIN_PATHS.PAYOUT_HISTORY, icon: FileClockIcon },
	      { label: 'Coupons', to: ADMIN_PATHS.COUPONS, icon: TicketPercentIcon },
    ],
  },
  {
    title: 'Quality',
	    items: [{ label: 'Reviews', to: ADMIN_PATHS.REVIEWS, icon: StarIcon }],
  },
];

const navBaseClass =
  'group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium leading-5 transition-all duration-200 ease-out';

const navClassName = ({ isActive }) =>
  `${navBaseClass} ${isActive ? 'border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900'}`;

export default function Sidebar({ admin, handleLogout }) {
	return (
		<div className="fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
			<div className="border-b border-slate-200 px-5 py-5">
				<div className="flex items-center gap-3">
					<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-bold text-white shadow-sm shadow-emerald-500/15">
						V
					</div>
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">VOGUEE</p>
						<p className="text-lg font-semibold tracking-tight text-slate-900">VOGUEE ADMIN</p>
					</div>
				</div>
			
			</div>

			<nav className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
				{sections.map((section) => (
					<div key={section.title} className="space-y-3">
						<p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
							{section.title}
						</p>
						<div className="space-y-1.5">
							{section.items.map((item) => {
								const Icon = item.icon;

								return (
									<NavLink key={item.label} to={item.to} className={navClassName}>
										<Icon className="h-4.5 w-4.5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" />
										<span className="flex-1">{item.label}</span>
										<span className="h-1.5 w-1.5 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-25" />
									</NavLink>
								);
							})}
						</div>
					</div>
				))}
			</nav>

			<div className="border-t border-slate-200 p-4">
				<div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
					<div className="flex items-start gap-3">
						<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-bold text-emerald-700">
							{admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold text-slate-900">{admin?.name || 'Admin'}</p>
							<p className="truncate text-xs text-slate-500">{admin?.email || 'admin@voguee.com'}</p>
							<span className="mt-2 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide text-emerald-700">
								{admin?.role || 'admin'}
							</span>
						</div>
					</div>
					<button
						onClick={handleLogout}
						className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
					>
						Logout
					</button>
				</div>
			</div>
		</div>
	);
}
