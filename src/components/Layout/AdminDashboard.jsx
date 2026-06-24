import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getAdminDashboardSummary } from '../../server/adminDashboardApi';
import useAdminDashboardSocket from '../../hooks/useAdminDashboardSocket';

const emptyStats = {
  users: { total_users: 0, active_users: 0, new_users_today: 0 },
  partners: { total_partners: 0, verified_partners: 0, pending_kyc: 0, online_partners: 0 },
  bookings: { total_bookings: 0, today_bookings: 0, completed_bookings: 0, cancelled_bookings: 0, searching_bookings: 0, live_bookings: 0 },
  payments: { gross_revenue: 0, today_revenue: 0, coupon_discount_total: 0, platform_commission_total: 0, partner_payout_total: 0, pending_payout_total: 0 },
  services: { total_services: 0, active_services: 0, total_categories: 0 },
  coupons: { total_coupons: 0, active_coupons: 0, coupon_usage_count: 0, coupon_discount_given: 0 },
  reviews: { total_reviews: 0, approved_reviews: 0, average_rating: 0 },
  recent_activity: { latest_bookings: [], latest_partners: [], latest_payouts: [], latest_reviews: [] },
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
};

const formatCount = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0));

const formatDateTime = (value) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const normalizeSummary = (payload = {}) => ({
  users: { ...emptyStats.users, ...(payload.users || {}) },
  partners: { ...emptyStats.partners, ...(payload.partners || {}) },
  bookings: { ...emptyStats.bookings, ...(payload.bookings || {}) },
  payments: { ...emptyStats.payments, ...(payload.payments || {}) },
  services: { ...emptyStats.services, ...(payload.services || {}) },
  coupons: { ...emptyStats.coupons, ...(payload.coupons || {}) },
  reviews: { ...emptyStats.reviews, ...(payload.reviews || {}) },
  recent_activity: {
    latest_bookings: Array.isArray(payload?.latest_bookings)
      ? payload.latest_bookings
      : Array.isArray(payload?.recent_activity?.latest_bookings)
        ? payload.recent_activity.latest_bookings
        : [],
    latest_partners: Array.isArray(payload?.latest_partners)
      ? payload.latest_partners
      : Array.isArray(payload?.recent_activity?.latest_partners)
        ? payload.recent_activity.latest_partners
        : [],
    latest_payouts: Array.isArray(payload?.latest_payouts)
      ? payload.latest_payouts
      : Array.isArray(payload?.recent_activity?.latest_payouts)
        ? payload.recent_activity.latest_payouts
        : [],
    latest_reviews: Array.isArray(payload?.latest_reviews)
      ? payload.latest_reviews
      : Array.isArray(payload?.recent_activity?.latest_reviews)
        ? payload.recent_activity.latest_reviews
        : [],
  },
  generated_at: payload.generated_at || null,
});

const statusTone = (value) => {
  const next = String(value || '').toLowerCase();
  if (['completed', 'approved', 'verified', 'active', 'paid', 'healthy', 'live'].includes(next)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (['pending', 'searching', 'no_partner', 'rejected'].includes(next)) return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (['cancelled', 'canceled', 'failed', 'issues'].includes(next)) return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-slate-50 text-slate-700 ring-slate-200';
};

function StatCard({ title, value, note, accent }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{note}</p>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] animate-pulse">
      <div className="h-3 w-28 rounded-full bg-slate-100" />
      <div className="mt-4 h-10 w-24 rounded-2xl bg-slate-100" />
      <div className="mt-3 h-3 w-36 rounded-full bg-slate-100" />
    </div>
  );
}

function SectionPanel({ title, subtitle, children }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-14 rounded-2xl bg-slate-100" />
      <div className="h-14 rounded-2xl bg-slate-100" />
      <div className="h-14 rounded-2xl bg-slate-100" />
    </div>
  );
}

function EmptyState({ label }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">{label}</div>;
}

export default function AdminDashboard() {
  const outletContext = useOutletContext() || {};
  const admin = outletContext.admin;
  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', []);
  const [summary, setSummary] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(new Date());

  const loadSummary = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getAdminDashboardSummary();
      const payload = response?.data || {};
      setSummary(normalizeSummary(payload));
      setError('');
    } catch (err) {
      setError(String(err || 'Failed to load dashboard summary'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { connected } = useAdminDashboardSocket({ apiBase, onRefresh: () => loadSummary({ silent: true }) });

  const cards = [
    {
      title: 'Total Users',
      value: formatCount(summary.users.total_users),
      note: `+${formatCount(summary.users.new_users_today)} today`,
      accent: 'bg-gradient-to-r from-emerald-500 to-emerald-300',
    },
    {
      title: 'Total Partners',
      value: formatCount(summary.partners.total_partners),
      note: `${formatCount(summary.partners.verified_partners)} verified`,
      accent: 'bg-gradient-to-r from-sky-500 to-cyan-300',
    },
    {
      title: 'Live Bookings',
      value: formatCount(summary.bookings.live_bookings),
      note: `${formatCount(summary.bookings.searching_bookings)} searching`,
      accent: 'bg-gradient-to-r from-blue-500 to-indigo-300',
    },
    {
      title: 'Today Revenue',
      value: formatCurrency(summary.payments.today_revenue),
      note: 'Live updates enabled',
      accent: 'bg-gradient-to-r from-teal-500 to-emerald-300',
    },
    {
      title: 'Platform Earnings',
      value: formatCurrency(summary.payments.platform_commission_total),
      note: 'Commission total',
      accent: 'bg-gradient-to-r from-green-500 to-lime-300',
    },
    {
      title: 'Pending Payouts',
      value: formatCurrency(summary.payments.pending_payout_total),
      note: `${formatCount(summary.partners.online_partners)} partners online`,
      accent: 'bg-gradient-to-r from-amber-500 to-yellow-300',
    },
    {
      title: 'Coupon Usage',
      value: formatCount(summary.coupons.coupon_usage_count),
      note: `${formatCurrency(summary.coupons.coupon_discount_given)} discounted`,
      accent: 'bg-gradient-to-r from-cyan-500 to-sky-300',
    },
    {
      title: 'Pending KYC',
      value: formatCount(summary.partners.pending_kyc),
      note: `${formatCount(summary.services.active_services)} active services`,
      accent: 'bg-gradient-to-r from-rose-500 to-orange-300',
    },
  ];

  const recentBookings = summary.recent_activity.latest_bookings || [];
  const recentPartners = summary.recent_activity.latest_partners || [];
  const recentPayouts = summary.recent_activity.latest_payouts || [];
  const recentReviews = summary.recent_activity.latest_reviews || [];

  return (
    <div className="relative flex flex-col overflow-hidden bg-[linear-gradient(180deg,#f7faf7_0%,#f5f8fb_100%)]">
      <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="absolute top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl" />

      <main className="relative flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {connected ? 'Live system' : 'Reconnecting'}
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  Welcome back, {admin?.name || 'Admin'}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Premium real-time overview of users, partners, bookings, revenue, payouts, coupons, KYC, and reviews.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white shadow-lg shadow-slate-900/15">
                    Platform status: Healthy
                  </span>
                  <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-700 ring-1 ring-sky-100">
                    {refreshing ? 'Refreshing dashboard...' : 'Live updates enabled'}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                    {clock.toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}
                  </span>
                </div>
              </div>

              <div className="grid min-w-[260px] gap-3 rounded-[1.5rem] bg-slate-950 p-4 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Realtime feed</p>
                    <p className="mt-2 text-2xl font-black">{connected ? 'Connected' : 'Syncing'}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${connected ? 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/20' : 'bg-amber-400/15 text-amber-300 ring-amber-400/20'}`}>
                    {connected ? 'Healthy' : 'Pending'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Current role</p>
                    <p className="mt-1 font-semibold capitalize text-white">{admin?.role || 'admin'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Last refresh</p>
                    <p className="mt-1 font-semibold text-white">{summary.generated_at ? formatDateTime(summary.generated_at) : 'Pending'}</p>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {error}
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading ? cards.map((card) => <SkeletonCard key={card.title} />) : cards.map((card) => <StatCard key={card.title} {...card} />)}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <SectionPanel title="Recent Bookings" subtitle="Latest booking activity with live status indicators.">
              {loading ? (
                <SkeletonList />
              ) : recentBookings.length ? (
                <div className="space-y-3">
                  {recentBookings.map((booking) => (
                    <div key={booking.id || booking.booking_id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{booking.service_name || 'Booking'}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(booking.booking_status)}`}>{booking.booking_status || 'pending'}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{booking.user_name || 'Customer'} · {booking.partner_name || 'Unassigned'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatCurrency(booking.final_amount_after_discount ?? booking.amount)}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(booking.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No booking activity yet." />
              )}
            </SectionPanel>

            <SectionPanel title="Recent Partners" subtitle="Newest partner accounts and KYC state.">
              {loading ? (
                <SkeletonList />
              ) : recentPartners.length ? (
                <div className="space-y-3">
                  {recentPartners.map((partner) => (
                    <div key={partner.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{partner.name || `Partner #${partner.id}`}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(partner.kyc_status)}`}>{partner.kyc_status || 'pending'}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{partner.mobile || 'No mobile'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 capitalize">{partner.status || 'active'}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(partner.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No partners found." />
              )}
            </SectionPanel>

            <SectionPanel title="Recent Payouts" subtitle="Latest partner payouts reflected in the platform.">
              {loading ? (
                <SkeletonList />
              ) : recentPayouts.length ? (
                <div className="space-y-3">
                  {recentPayouts.map((payout) => (
                    <div key={payout.payment_id || `${payout.partner_id}-${payout.created_at}`} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{payout.partner_name || `Partner #${payout.partner_id}`}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(payout.partner_payment_status)}`}>{payout.partner_payment_status || 'pending'}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">Booking {payout.booking_id || payout.payment_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatCurrency(payout.amount)}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(payout.paid_at || payout.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No payout history yet." />
              )}
            </SectionPanel>

            <SectionPanel title="Recent Reviews" subtitle="Fresh customer sentiment with approval status.">
              {loading ? (
                <SkeletonList />
              ) : recentReviews.length ? (
                <div className="space-y-3">
                  {recentReviews.map((review) => (
                    <div key={review.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{review.user_name || 'Customer'}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(review.status)}`}>{review.status || 'pending'}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{review.partner_name || 'Partner'} · {review.service_name || 'Service'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{Number(review.rating || 0).toFixed(1)} / 5</p>
                        <p className="text-xs text-slate-500">{formatDateTime(review.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No reviews yet." />
              )}
            </SectionPanel>
          </section>
        </div>
      </main>
    </div>
  );
}
