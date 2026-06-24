import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { approveReview, getReviews, rejectReview } from '../../server/reviewApi';

const normalizeStatus = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'approved' || v === 'rejected' || v === 'pending') return v;
  return 'pending';
};

const badge = (value) => {
  const v = normalizeStatus(value);
  if (v === 'approved') return { label: 'Approved', cls: 'bg-green-50 text-green-700 border-green-100' };
  if (v === 'rejected') return { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-100' };
  return { label: 'Pending', cls: 'bg-yellow-50 text-yellow-800 border-yellow-100' };
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

const truncate = (value, max = 90) => {
  const s = String(value || '').trim();
  if (!s) return '-';
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
};

export default function AdminReviewsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [updatingId, setUpdatingId] = useState(null);

  const counts = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const c = { total: list.length, pending: 0, approved: 0, rejected: 0 };
    list.forEach((r) => {
      const s = normalizeStatus(r?.status);
      c[s] += 1;
    });
    return c;
  }, [rows]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getReviews();
      // api.js returns response.data (not axios response), so shape is:
      // { success, message, data: { reviews } }
      const list = Array.isArray(res?.data?.reviews) ? res.data.reviews : [];
      setRows(list);
    } catch (e) {
      setError(String(e || 'Failed to load reviews'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const setStatusLocal = (id, nextStatus) => {
    setRows((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((r) => (Number(r?.id) === Number(id) ? { ...r, status: nextStatus } : r));
    });
  };

  const handleApprove = async (row) => {
    const id = row?.id;
    if (!id) return;

    try {
      setUpdatingId(Number(id));
      await approveReview(id);
      setStatusLocal(id, 'approved');
    } catch (e) {
      alert(String(e || 'Failed to approve'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (row) => {
    const id = row?.id;
    if (!id) return;

    try {
      setUpdatingId(Number(id));
      await rejectReview(id);
      setStatusLocal(id, 'rejected');
    } catch (e) {
      alert(String(e || 'Failed to reject'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">Approve or reject user reviews before they appear on the home screen.</p>
        </div>
        <button
          onClick={fetchAll}
          className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-gray-900">{counts.pending}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-2xl font-bold text-gray-900">{counts.approved}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-gray-900">{counts.rejected}</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-gray-500 font-medium">Loading reviews…</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-gray-500 font-medium">No reviews yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">ID</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">Booking</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">Partner</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">Service</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">Rating</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">Review</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">Created</th>
                  <th className="text-right text-xs font-semibold text-gray-600 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const b = badge(r?.status);
                  const id = r?.id;
                  const isUpdating = Number(updatingId) === Number(id);
                  const s = normalizeStatus(r?.status);

                  return (
                    <tr key={String(id)} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r?.booking_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r?.user_name || r?.user_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r?.partner_name || r?.partner_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r?.service_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{r?.rating || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[340px]">
                        <span title={String(r?.review_text || '')}>{truncate(r?.review_text, 110)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r?.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(r)}
                            disabled={isUpdating || s === 'approved'}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                              s === 'approved'
                                ? 'bg-green-50 text-green-700 border-green-100 cursor-not-allowed'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(r)}
                            disabled={isUpdating || s === 'rejected'}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                              s === 'rejected'
                                ? 'bg-red-50 text-red-700 border-red-100 cursor-not-allowed'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
