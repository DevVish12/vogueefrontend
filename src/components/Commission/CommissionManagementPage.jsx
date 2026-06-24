import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../../server/api';
import { getServices, updateServiceCommission } from '../../server/serviceApi';
import { SOCKET_EVENTS } from '../../constants/socketEvents';

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const currency = (n) => `₹${toNumber(n, 0).toFixed(0)}`;

const computeCommission = ({ price, commissionType, commissionValue, commissionEnabled }) => {
  const gross = Math.max(0, toNumber(price, 0));
  if (!commissionEnabled) {
    return { gross, adminCommission: 0, partnerGets: gross };
  }

  const type = String(commissionType || 'percentage').toLowerCase() === 'fixed' ? 'fixed' : 'percentage';
  const value = Math.max(0, toNumber(commissionValue, 0));

  let adminCommission = 0;
  if (type === 'fixed') adminCommission = value;
  else adminCommission = (gross * value) / 100;

  if (!Number.isFinite(adminCommission)) adminCommission = 0;
  adminCommission = Math.max(0, Math.min(gross, adminCommission));
  const partnerGets = Math.max(0, gross - adminCommission);

  return { gross, adminCommission, partnerGets };
};

export default function CommissionManagementPage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [query, setQuery] = useState('');

  const apiBase = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', []);
  const backendOrigin = useMemo(() => String(apiBase || '').replace(/\/api\/?$/i, ''), [apiBase]);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    commissionEnabled: true,
    commissionType: 'percentage',
    commissionValue: 0
  });

  const load = async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        getServices(),
        api.get('/admin/commission-analytics')
      ]);

      const list = Array.isArray(res?.data) ? res.data : [];
      setServices(list);
      setAnalytics(statsRes?.data || null);
    } catch (e) {
      // api wrapper throws a string
      alert(String(e || 'Failed to load services'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const socket = io(backendOrigin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      autoConnect: true,
    });

    const token = localStorage.getItem('adminToken');
    const register = () => {
      if (token) socket.emit('registerAdminDashboard', { token });
    };

    const handleCommissionUpdated = (payload) => {
      const serviceId = Number(payload?.serviceId);
      if (!Number.isFinite(serviceId) || serviceId <= 0) {
        // Fallback: safest possible
        load();
        return;
      }

      setServices((prev) =>
        (Array.isArray(prev) ? prev : []).map((svc) => {
          if (Number(svc?.id) !== serviceId) return svc;
          return {
            ...svc,
            commissionEnabled: payload?.commissionEnabled !== false,
            commissionType: payload?.commissionType || svc?.commissionType || 'percentage',
            commissionValue: toNumber(payload?.commissionValue, toNumber(svc?.commissionValue, 0)),
            updatedAt: payload?.updatedAt || svc?.updatedAt,
          };
        })
      );
    };

    const handleAnalyticsUpdated = async () => {
      try {
        const statsRes = await api.get('/admin/commission-analytics');
        setAnalytics(statsRes || null);
      } catch {
        // ignore
      }
    };

    socket.on('connect', register);
    register();

    socket.on(SOCKET_EVENTS.COMMISSION_UPDATED, handleCommissionUpdated);
    socket.on(SOCKET_EVENTS.ADMIN_ANALYTICS_UPDATED, handleAnalyticsUpdated);

    return () => {
      socket.off('connect', register);
      socket.off(SOCKET_EVENTS.COMMISSION_UPDATED, handleCommissionUpdated);
      socket.off(SOCKET_EVENTS.ADMIN_ANALYTICS_UPDATED, handleAnalyticsUpdated);
      socket.disconnect();
    };
  }, [backendOrigin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return services.filter((s) => {
      const name = String(s?.serviceName || '').toLowerCase();
      const cat = String(s?.categoryName || '').toLowerCase();

      const matchesQuery = !q || name.includes(q) || cat.includes(q);
      if (!matchesQuery) return false;
      return true;
    });
  }, [services, query]);

  const editingService = useMemo(() => {
    if (!editingId) return null;
    return services.find((s) => s?.id === editingId) || null;
  }, [editingId, services]);

  const startEdit = (svc) => {
    setEditingId(svc.id);
    setDraft({
      commissionEnabled: svc?.commissionEnabled !== false,
      commissionType: svc?.commissionType || 'percentage',
      commissionValue: toNumber(svc?.commissionValue, 0)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ commissionEnabled: true, commissionType: 'percentage', commissionValue: 0 });
  };

  const saveEdit = async (svc) => {
    const price = toNumber(svc?.discountPrice || svc?.basePrice, 0);
    const type = String(draft.commissionType || 'percentage').toLowerCase() === 'fixed' ? 'fixed' : 'percentage';
    const value = Math.max(0, toNumber(draft.commissionValue, 0));

    if (type === 'percentage' && value > 100) {
      alert('Commission % must be <= 100');
      return;
    }
    if (type === 'fixed' && value > price) {
      alert('Fixed commission must be <= service price');
      return;
    }

    try {
      const res = await updateServiceCommission(svc.id, {
        commissionEnabled: !!draft.commissionEnabled,
        commissionType: type,
        commissionValue: value
      });

      const updated = res?.data;
      setServices((prev) => prev.map((p) => (p.id === svc.id ? updated : p)));
      cancelEdit();
    } catch (e) {
      alert(String(e || 'Failed to update commission'));
    }
  };

  const quickToggleEnabled = async (svc) => {
    try {
      const res = await updateServiceCommission(svc.id, {
        commissionEnabled: !(svc?.commissionEnabled !== false),
        commissionType: svc?.commissionType || 'percentage',
        commissionValue: toNumber(svc?.commissionValue, 0)
      });
      const updated = res?.data;
      setServices((prev) => prev.map((p) => (p.id === svc.id ? updated : p)));
    } catch (e) {
      alert(String(e || 'Failed to update'));
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Management</h1>
          <p className="text-sm text-gray-500 mt-1">Edit commission rules per service (new bookings only).</p>
        </div>

        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search service or category"
            className="w-full md:w-96 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="text-sm font-bold text-gray-900">Total Customer Payments</div>
          <div className="text-xs text-gray-500 mt-0.5">Money received from customers</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">{currency(analytics?.total_customer_paid || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Total payments: {Number(analytics?.total_payments || 0)}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="text-sm font-bold text-gray-900">Admin Earnings</div>
          <div className="text-xs text-gray-500 mt-0.5">Total commission earned by admin</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">{currency(analytics?.total_admin_commission || 0)}</div>
          <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Commission income
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="text-sm font-bold text-gray-900">Partner Earnings</div>
          <div className="text-xs text-gray-500 mt-0.5">Amount partners will receive</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">{currency(analytics?.total_partner_earned || 0)}</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2">
              <div className="text-[11px] font-bold text-green-700">Paid to Partners</div>
              <div className="text-sm font-extrabold text-green-900 mt-0.5">{currency(analytics?.total_partner_paid || 0)}</div>
            </div>
            <div className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
              <div className="text-[11px] font-bold text-orange-700">Pending Payout</div>
              <div className="text-sm font-extrabold text-orange-900 mt-0.5">{currency(analytics?.total_partner_remaining || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {editingService ? (() => {
        const price = toNumber(editingService?.discountPrice || editingService?.basePrice, 0);
        const { gross, adminCommission, partnerGets } = computeCommission({
          price,
          commissionEnabled: !!draft.commissionEnabled,
          commissionType: draft.commissionType,
          commissionValue: draft.commissionValue
        });

        return (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-extrabold text-gray-900">Commission Preview</div>
                <div className="text-xs text-gray-500 mt-0.5">Live preview for: <span className="font-semibold text-gray-700">{editingService?.serviceName || 'Service'}</span></div>
              </div>
              <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${draft.commissionEnabled ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                {draft.commissionEnabled ? 'Commission ON' : 'Commission OFF'}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-[11px] font-bold text-gray-600">Customer Pays</div>
                <div className="text-lg font-extrabold text-gray-900 mt-0.5">{currency(gross)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-[11px] font-bold text-gray-600">Admin Commission</div>
                <div className="text-lg font-extrabold text-gray-900 mt-0.5">{currency(adminCommission)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-[11px] font-bold text-gray-600">Partner Receives</div>
                <div className="text-lg font-extrabold text-gray-900 mt-0.5">{currency(partnerGets)}</div>
              </div>
            </div>
          </div>
        );
      })() : null}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Service</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Category</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Service Price</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Commission Status</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Type</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Value</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Admin Gets</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Partner Receives</th>
                <th className="text-left text-xs font-bold text-gray-600 px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-600" colSpan={9}>Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-600" colSpan={9}>No services found.</td>
                </tr>
              ) : (
                filtered.map((svc) => {
                  const price = toNumber(svc?.discountPrice || svc?.basePrice, 0);

                  const isEditing = editingId === svc.id;
                  const enabled = isEditing ? !!draft.commissionEnabled : svc?.commissionEnabled !== false;
                  const type = isEditing ? draft.commissionType : svc?.commissionType;
                  const value = isEditing ? draft.commissionValue : svc?.commissionValue;

                  const { adminCommission, partnerGets } = computeCommission({
                    price,
                    commissionEnabled: enabled,
                    commissionType: type,
                    commissionValue: value
                  });

                  const typeLabel = String(type || 'percentage').toLowerCase() === 'fixed'
                    ? `${currency(toNumber(value, 0))} fixed`
                    : `${toNumber(value, 0)}% commission`;

                  return (
                    <tr key={svc.id} className="border-b border-gray-100 hover:bg-gray-50/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{svc?.serviceName}</div>
                        <div className="text-xs text-gray-500">#{svc?.id}</div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold bg-gray-50 text-gray-700 border-gray-200">
                            {typeLabel}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold bg-gray-50 text-gray-700 border-gray-200">
                            Admin: {currency(adminCommission)}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold bg-gray-50 text-gray-700 border-gray-200">
                            Partner: {currency(partnerGets)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{svc?.categoryName || '-'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{currency(price)}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={!!draft.commissionEnabled}
                            onChange={(e) => setDraft((d) => ({ ...d, commissionEnabled: e.target.checked }))}
                          />
                        ) : (
                          <button
                            onClick={() => quickToggleEnabled(svc)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${svc?.commissionEnabled !== false
                              ? 'bg-green-50 text-green-700 border-green-100'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                          >
                            {svc?.commissionEnabled !== false ? 'Enabled' : 'Disabled'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={draft.commissionType}
                            onChange={(e) => setDraft((d) => ({ ...d, commissionType: e.target.value }))}
                            className="px-3 py-2 rounded-lg border border-gray-200"
                          >
                            <option value="percentage">Percentage</option>
                            <option value="fixed">Fixed</option>
                          </select>
                        ) : (
                          <span className="text-sm text-gray-700">{String(svc?.commissionType || 'percentage')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={draft.commissionValue}
                            onChange={(e) => setDraft((d) => ({ ...d, commissionValue: e.target.value }))}
                            className="w-28 px-3 py-2 rounded-lg border border-gray-200"
                            type="number"
                            min={0}
                            step="0.01"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{toNumber(svc?.commissionValue, 0)}{String(svc?.commissionType || 'percentage') === 'percentage' ? '%' : ''}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{currency(adminCommission)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{currency(partnerGets)}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(svc)}
                              className="px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(svc)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
