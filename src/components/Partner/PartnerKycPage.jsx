import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { fetchPartnerKycFile, getPartnerKycs, updatePartnerKycStatus } from '../../server/partnerKycApi';

const getApiBase = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
};

const getBackendOrigin = (apiBase) => {
  return apiBase.endsWith('/api') ? apiBase.slice(0, -'/api'.length) : apiBase;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const normalizeKycStatus = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'verified' || v === 'rejected' || v === 'pending') return v;
  return 'pending';
};

const kycBadge = (value) => {
  const v = normalizeKycStatus(value);
  if (v === 'verified') return { label: 'Verified', cls: 'bg-green-50 text-green-700' };
  if (v === 'rejected') return { label: 'Rejected', cls: 'bg-red-50 text-red-700' };
  return { label: 'Pending', cls: 'bg-yellow-50 text-yellow-700' };
};

const partnerTypeBadge = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'partner_salon_owner') return { label: 'Salon Owner', cls: 'bg-indigo-50 text-indigo-700' };
  return { label: 'Freelancer', cls: 'bg-slate-50 text-slate-700' };
};

const partnerTypeLabel = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'partner_salon_owner') return 'Salon Owner';
  return 'Freelancer';
};

const parseSkills = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
};

const parseGallery = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const joinUrl = (origin, relPath) => {
  const o = String(origin || '').replace(/\/+$/, '');
  const p = String(relPath || '').replace(/^\/+/, '');
  if (!o || !p) return '';
  return `${o}/${p}`;
};

const buildDocLabel = (docType) => {
  if (docType === 'aadhaar') return 'Aadhaar';
  if (docType === 'pan') return 'PAN';
  if (docType === 'selfie') return 'Selfie';
  return 'Certificate';
};

const guessIsImage = (filename = '') => {
  const n = String(filename).toLowerCase();
  return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.includes('image');
};

const mapDocUrl = (origin, relPath) => joinUrl(origin, relPath);

const mapsUrl = (lat, lng) => {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return '';
  return `https://www.google.com/maps?q=${la},${lo}`;
};

const normalizeImageSource = (origin, value) => {
  if (!value) return '';
  if (typeof value === 'string' && value.startsWith('blob:')) return value;
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  return joinUrl(origin, value);
};

export default function PartnerKycPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [updatingId, setUpdatingId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [filePreviews, setFilePreviews] = useState({}); // { docType: objectUrl }

  const apiBase = useMemo(() => getApiBase(), []);
  const backendOrigin = useMemo(() => getBackendOrigin(apiBase), [apiBase]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getPartnerKycs();
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setRows(list);
    } catch (e) {
      setError(String(e || 'Failed to load KYC'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const socket = io(backendOrigin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      autoConnect: true,
    });

    const handleSubmitted = (data) => {
      // If payload missing, fallback to refresh
      if (!data || (!data.id && !data.partner_id)) {
        fetchAll();
        return;
      }

      // Best-effort prepend a new record
      setRows((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const existingIdx = list.findIndex((r) => Number(r.id) === Number(data.id));
        if (existingIdx !== -1) return list;

        const injected = {
          id: data.id,
          partner_id: data.partner_id,
          full_name: data.full_name,
          mobile: data.mobile,
          kyc_status: data.kyc_status || 'pending',
          created_at: data.created_at || new Date().toISOString(),
        };
        return [injected, ...list];
      });

      // Silent refresh to populate full details for modal (urls, skills, etc.)
      fetchAll();
    };

    const handleUpdated = (data) => {
      if (!data || !data.id) return;
      setRows((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((r) => (Number(r.id) === Number(data.id) ? { ...r, kyc_status: data.kyc_status } : r));
      });

      setSelected((prev) => {
        if (!prev) return prev;
        if (Number(prev.id) !== Number(data.id)) return prev;
        return { ...prev, kyc_status: data.kyc_status };
      });
    };

    socket.on('partner:kyc_submitted', handleSubmitted);
    socket.on('partner:kyc_updated', handleUpdated);

    return () => {
      socket.off('partner:kyc_submitted', handleSubmitted);
      socket.off('partner:kyc_updated', handleUpdated);
      socket.disconnect();
    };
  }, [backendOrigin, fetchAll]);

  const openModal = async (row) => {
    setSelected(row);
    setIsModalOpen(true);

    // Clear previous previews
    setFilePreviews((prev) => {
      for (const k of Object.keys(prev || {})) {
        try { URL.revokeObjectURL(prev[k]); } catch {}
      }
      return {};
    });

    // Auto-load selfie preview (required) if possible
    if (row?.id) {
      try {
        const selfieBlobRes = await fetchPartnerKycFile(row.id, 'selfie');
        const blob = selfieBlobRes;
        // api.js response interceptor returns response.data directly; for blob it should already be Blob
        const url = URL.createObjectURL(blob);
        setFilePreviews((p) => ({ ...(p || {}), selfie: url }));
      } catch {
        // ignore
      }

      if (String(row?.partner_type || '').trim().toLowerCase() === 'partner_salon_owner') {
        try {
          const logoBlobRes = await fetchPartnerKycFile(row.id, 'salon_logo');
          const logoBlob = logoBlobRes;
          const logoUrl = URL.createObjectURL(logoBlob);
          setFilePreviews((p) => ({ ...(p || {}), salonLogo: logoUrl }));
        } catch {
          // ignore
        }

        try {
          const galleryItems = parseGallery(row?.salon_gallery);
          const galleryUrls = [];

          for (let index = 0; index < Math.min(galleryItems.length, 5); index += 1) {
            try {
              const galleryBlobRes = await fetchPartnerKycFile(row.id, 'salon_gallery', { index });
              const galleryBlob = galleryBlobRes;
              galleryUrls.push(URL.createObjectURL(galleryBlob));
            } catch {
              galleryUrls.push('');
            }
          }

          setFilePreviews((p) => ({ ...(p || {}), salonGallery: galleryUrls }));
        } catch {
          // ignore
        }
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelected(null), 150);
    setFilePreviews((prev) => {
      for (const k of Object.keys(prev || {})) {
        try { URL.revokeObjectURL(prev[k]); } catch {}
      }
      return {};
    });
  };

  const handleStatus = async (id, nextStatus) => {
    try {
      setUpdatingId(Number(id));
      const res = await updatePartnerKycStatus(id, nextStatus);
      const updated = res?.data || res;
      setRows((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((r) => (Number(r.id) === Number(id) ? { ...r, kyc_status: updated?.kyc_status || nextStatus } : r));
      });
      setSelected((prev) => (prev && Number(prev.id) === Number(id) ? { ...prev, kyc_status: updated?.kyc_status || nextStatus } : prev));
    } catch (e) {
      alert(String(e || 'Failed to update status'));
    } finally {
      setUpdatingId(null);
    }
  };

  const viewOrDownload = async (docType, mode) => {
    if (!selected?.id) return;
    try {
      const blob = await fetchPartnerKycFile(selected.id, docType);
      const url = URL.createObjectURL(blob);

      if (mode === 'view') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${buildDocLabel(docType)}-${selected.id}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      // Keep around briefly if user wants to re-open, then cleanup
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
      }, 4000);
    } catch (e) {
      alert(String(e || 'Could not fetch document'));
    }
  };

  const details = selected || null;
  const skills = parseSkills(details?.skills);
  const hasCertificate = Boolean(details?.certificate_url);
  const salonGallery = parseGallery(details?.salon_gallery);
  const salonType = String(details?.partner_type || '').trim().toLowerCase();
  const isSalonOwner = salonType === 'partner_salon_owner';
  const salonMapLink = mapsUrl(details?.salon_latitude, details?.salon_longitude);
  const salonLogoUrl = filePreviews.salonLogo || normalizeImageSource(backendOrigin, details?.salon_logo);
  const salonGalleryUrls = Array.isArray(filePreviews.salonGallery)
    ? filePreviews.salonGallery.filter(Boolean)
    : parseGallery(details?.salon_gallery).map((item) => normalizeImageSource(backendOrigin, item)).filter(Boolean);

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Partner KYC</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <p className="text-gray-500 font-medium">Loading KYC records...</p>
              </div>
            ) : error ? (
              <div className="py-16 flex items-center justify-center">
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 flex items-center justify-center">
                <p className="text-gray-500 font-medium">No KYC records found</p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 sm:hidden">
                  {rows.map((r) => (
                    <div key={r.id} className="border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">#{r.id} · {r.full_name || '-'}</p>
                          <p className="text-sm text-gray-600 mt-1">{r.mobile || '-'}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatDate(r.created_at)}</p>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mt-2 ${partnerTypeBadge(r.partner_type).cls}`}>
                            {partnerTypeBadge(r.partner_type).label}
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${kycBadge(r.kyc_status).cls}`}>
                          {kycBadge(r.kyc_status).label}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleStatus(r.id, 'verified')}
                          disabled={Number(updatingId) === Number(r.id)}
                          className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
                        >
                          {Number(updatingId) === Number(r.id) ? 'Updating...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleStatus(r.id, 'rejected')}
                          disabled={Number(updatingId) === Number(r.id)}
                          className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
                        >
                          {Number(updatingId) === Number(r.id) ? 'Updating...' : 'Reject'}
                        </button>
                        <button
                          onClick={() => openModal(r)}
                          disabled={Number(updatingId) === Number(r.id)}
                          className="px-3 py-2 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 text-sm font-semibold"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto hidden sm:block">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b border-gray-200">
                        <th className="py-3 px-3 font-semibold">ID</th>
                        <th className="py-3 px-3 font-semibold">Name</th>
                        <th className="py-3 px-3 font-semibold">Mobile</th>
                        <th className="py-3 px-3 font-semibold">Type</th>
                        <th className="py-3 px-3 font-semibold">Status</th>
                        <th className="py-3 px-3 font-semibold">Date</th>
                        <th className="py-3 px-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.id} className="text-gray-800">
                          <td className="py-3 px-3 whitespace-nowrap">{r.id}</td>
                          <td className="py-3 px-3 whitespace-nowrap">{r.full_name || '-'}</td>
                          <td className="py-3 px-3 whitespace-nowrap">{r.mobile || '-'}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${partnerTypeBadge(r.partner_type).cls}`}>
                              {partnerTypeBadge(r.partner_type).label}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${kycBadge(r.kyc_status).cls}`}>
                              {kycBadge(r.kyc_status).label}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">{formatDate(r.created_at)}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStatus(r.id, 'verified')}
                                disabled={Number(updatingId) === Number(r.id)}
                                className={`px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors ${Number(updatingId) === Number(r.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                {Number(updatingId) === Number(r.id) ? 'Updating...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleStatus(r.id, 'rejected')}
                                disabled={Number(updatingId) === Number(r.id)}
                                className={`px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors ${Number(updatingId) === Number(r.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                {Number(updatingId) === Number(r.id) ? 'Updating...' : 'Reject'}
                              </button>
                              <button
                                onClick={() => openModal(r)}
                                disabled={Number(updatingId) === Number(r.id)}
                                className={`px-3 py-1.5 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 font-semibold transition-colors ${Number(updatingId) === Number(r.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal (View Details) */}
      <div className={`fixed inset-0 z-50 ${isModalOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isModalOpen}>
        <div onClick={closeModal} className={`absolute inset-0 bg-black/40 transition-opacity duration-150 ${isModalOpen ? 'opacity-100' : 'opacity-0'}`} />

        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-xl border border-gray-200 transform transition-all duration-150 flex flex-col ${isModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">KYC Details</h2>
                {details ? (
                  <p className="text-xs text-gray-500 mt-1">Record #{details.id} · {formatDate(details.created_at)}</p>
                ) : null}
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              {details ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Full Name</p>
                      <p className="text-sm font-medium text-gray-900">{details.full_name || '-'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${kycBadge(details.kyc_status).cls}`}>
                      {kycBadge(details.kyc_status).label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Mobile</p>
                      <p className="text-sm font-medium text-gray-900">{details.mobile || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Experience</p>
                      <p className="text-sm font-medium text-gray-900">{details.experience || '-'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-gray-500">Service Area</p>
                      <p className="text-sm font-medium text-gray-900">{details.service_area || '-'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-gray-500">Skills</p>
                      {skills.length ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {skills.map((s, idx) => (
                            <span key={`${s}-${idx}`} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-gray-900">-</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-bold text-gray-900 mb-3">Partner Type</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-gray-500">Partner Type</p>
                        <p className="text-sm font-medium text-gray-900">
                          {partnerTypeLabel(details?.partner_type)}
                        </p>
                      </div>
                    </div>

                    {isSalonOwner ? (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Salon Name</p>
                          <p className="text-sm font-medium text-gray-900">{details.salon_name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Opening Time</p>
                          <p className="text-sm font-medium text-gray-900">{details.opening_time || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Closing Time</p>
                          <p className="text-sm font-medium text-gray-900">{details.closing_time || '-'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold text-gray-500">Salon Address</p>
                          <p className="text-sm font-medium text-gray-900">{details.salon_address || '-'}</p>
                          {details.salon_latitude || details.salon_longitude ? (
                            <p className="text-xs text-gray-500 mt-1">
                              GPS: {details.salon_latitude || '-'}, {details.salon_longitude || '-'}
                            </p>
                          ) : null}
                          {salonMapLink ? (
                            <a
                              href={salonMapLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center mt-2 px-3 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold"
                            >
                              Open in Google Maps
                            </a>
                          ) : null}
                        </div>

                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold text-gray-500">Salon Logo / Banner</p>
                          {salonLogoUrl ? (
                            <a href={salonLogoUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                              <img
                                src={salonLogoUrl}
                                alt="Salon logo"
                                className="w-full max-h-72 object-contain rounded-xl border border-gray-100 bg-gray-50"
                              />
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-gray-900 mt-2">-</p>
                          )}
                        </div>

                        {salonGalleryUrls.length ? (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold text-gray-500">Salon Gallery</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                              {salonGalleryUrls.slice(0, 5).map((fullUrl, idx) => {
                                return (
                                  <a
                                    key={`${fullUrl}-${idx}`}
                                    href={fullUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={fullUrl}
                                      alt={`Salon gallery ${idx + 1}`}
                                      className="w-full h-28 object-cover rounded-xl border border-gray-100 bg-gray-50"
                                      loading="lazy"
                                    />
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-bold text-gray-900 mb-3">Documents</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['aadhaar', 'pan', ...(hasCertificate ? ['certificate'] : [])].map((docType) => (
                        <div key={docType} className="border border-gray-200 rounded-xl p-4">
                          <p className="text-sm font-semibold text-gray-900">{buildDocLabel(docType)}</p>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => viewOrDownload(docType, 'view')}
                              className="px-3 py-2 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 text-sm font-semibold"
                            >
                              View
                            </button>
                            <button
                              onClick={() => viewOrDownload(docType, 'download')}
                              className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-semibold"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="border border-gray-200 rounded-xl p-4 sm:col-span-2">
                        <p className="text-sm font-semibold text-gray-900">Selfie</p>
                        <div className="mt-3">
                          {filePreviews.selfie ? (
                            <img
                              src={filePreviews.selfie}
                              alt="Selfie"
                              className="w-full max-h-72 object-contain rounded-xl border border-gray-100 bg-gray-50"
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-gray-600">Preview unavailable</p>
                              <button
                                onClick={() => viewOrDownload('selfie', 'view')}
                                className="px-3 py-2 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 text-sm font-semibold"
                              >
                                View
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleStatus(details.id, 'verified')}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatus(details.id, 'rejected')}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No details</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
