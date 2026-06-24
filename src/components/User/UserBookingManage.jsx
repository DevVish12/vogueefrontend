import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getUnassignedBookings, assignPartnerToBooking, getAllPartners } from '../../server/bookingApi';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatText = (value) => {
  if (value == null) return '-';
  const s = String(value).trim();
  return s ? s : '-';
};

const getBookingKey = (row) => {
  const key = row?.booking_id ?? row?.bookingId ?? row?.id;
  return key == null ? '' : String(key);
};

export default function UserBookingManage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);

  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState('');

  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const bookingCount = useMemo(() => rows.length, [rows]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getUnassignedBookings();
      const list = Array.isArray(data?.bookings) ? data.bookings : [];
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(typeof e === 'string' ? e : (e?.message || 'Failed to fetch bookings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openAssignModal = async (booking) => {
    setIsModalOpen(true);
    setActiveBooking(booking);
    setSelectedPartnerId('');
    setSubmitError('');

    try {
      setPartnersLoading(true);
      setPartnersError('');
      const data = await getAllPartners();
      setPartners(Array.isArray(data?.partners) ? data.partners : []);
    } catch (e) {
      setPartners([]);
      setPartnersError(typeof e === 'string' ? e : (e?.message || 'Failed to load partners'));
    } finally {
      setPartnersLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setActiveBooking(null);
      setPartners([]);
      setSelectedPartnerId('');
      setPartnersError('');
      setSubmitError('');
      setSubmitting(false);
    }, 150);
  };

  const submitAssign = async () => {
    if (!activeBooking) return;
    if (!selectedPartnerId) {
      setSubmitError('Please select a partner');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');

      // Use payment numeric id when available; backend also supports booking_id.
      const bookingId = activeBooking?.id ?? activeBooking?.booking_id;
      await assignPartnerToBooking(bookingId, Number(selectedPartnerId));
      closeModal();
      fetchRows();
    } catch (e) {
      setSubmitError(typeof e === 'string' ? e : (e?.message || 'Failed to assign partner'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">No Partner Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">Showing bookings with status: no_partner ({bookingCount})</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <p className="text-gray-500 font-medium">Loading bookings...</p>
              </div>
            ) : error ? (
              <div className="py-16 flex items-center justify-center">
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 flex items-center justify-center">
                <p className="text-gray-500 font-medium">No unassigned bookings found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b border-gray-200">
                      <th className="py-3 px-3 font-semibold">Booking ID</th>
                      <th className="py-3 px-3 font-semibold">Service</th>
                      <th className="py-3 px-3 font-semibold">Address</th>
                      <th className="py-3 px-3 font-semibold">Status</th>
                      <th className="py-3 px-3 font-semibold">Created</th>
                      <th className="py-3 px-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="text-gray-800">
                        <td className="py-3 px-3 whitespace-nowrap">{formatText(getBookingKey(r))}</td>
                        <td className="py-3 px-3 max-w-[260px] break-words" title={formatText(r.service_name)}>
                          {formatText(r.service_name)}
                        </td>
                        <td className="py-3 px-3 max-w-[360px] break-words" title={formatText(r.address)}>
                          {formatText(r.address)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700">
                            {formatText(r.booking_status)}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            onClick={() => openAssignModal(r)}
                            className="px-3 py-1.5 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 font-semibold transition-colors"
                          >
                            Assign Partner
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 ${isModalOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!isModalOpen}
      >
        <div
          onClick={closeModal}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-150 ${isModalOpen ? 'opacity-100' : 'opacity-0'}`}
        />

        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 transform transition-all duration-150 ${isModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Assign Partner</h2>
                <p className="text-xs text-gray-500 mt-1">Booking: {formatText(getBookingKey(activeBooking))}</p>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-6">
              {partnersLoading ? (
                <div className="py-10 flex items-center justify-center">
                  <p className="text-gray-500 font-medium">Loading partners...</p>
                </div>
              ) : partnersError ? (
                <div className="py-10 flex items-center justify-center">
                  <p className="text-red-600 font-medium">{partnersError}</p>
                </div>
              ) : partners.length === 0 ? (
                <div className="py-10 flex items-center justify-center">
                  <p className="text-gray-500 font-medium">No partners found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-800">Select a partner</p>
                  <div className="max-h-[320px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {partners.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="partner"
                          value={String(p.id)}
                          checked={String(selectedPartnerId) === String(p.id)}
                          onChange={(e) => setSelectedPartnerId(e.target.value)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{formatText(p.name)}</p>
                          <p className="text-xs text-gray-500 truncate">{formatText(p.mobile)} • KYC: {formatText(p.kyc_status)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {submitError ? (
                <p className="text-sm text-red-600 font-medium mt-4">{submitError}</p>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={submitAssign}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors disabled:opacity-60"
                disabled={submitting || partnersLoading}
              >
                {submitting ? 'Assigning...' : 'Assign Partner'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
