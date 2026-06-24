import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getCategories } from '../../server/categoryApi';
import { createCoupon, getCoupons, toggleCoupon, updateCoupon } from '../../server/couponApi';
import { getServices } from '../../server/serviceApi';

function IconBase({ children, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
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

function SearchIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
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

function XIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 6 18 18" />
      <path d="m18 6-12 12" />
    </IconBase>
  );
}

function TicketIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Z" />
      <path d="m9 15 6-6" />
    </IconBase>
  );
}

function BadgeIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3 9.5 5.5 6 5 5 8.5 2 10l2.5 2.5L4 16l3.5 1 1 3.5 3.5-1 3.5 1 1-3.5 3.5-1-1.5-3.5L22 10l-3-1.5-1-3.5-3.5.5L12 3Z" />
      <path d="m10 12 1.2 1.2 2.8-3" />
    </IconBase>
  );
}

const emptyForm = {
  coupon_code: '',
  title: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  max_discount: '',
  min_booking_amount: '',
  service_mode: 'all',
  service_ids: '',
  category_ids: '',
  total_usage_limit: '',
  per_user_limit: '1',
  is_first_booking_only: false,
  is_active: true,
  expiry_date: '',
};

const emptySummary = {
  totalCoupons: 0,
  activeCoupons: 0,
  expiredCoupons: 0,
  totalUsageCount: 0,
  totalDiscountGiven: 0,
};

const formatDateTimeForInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatCurrency = (value) => `₹${Number(value || 0).toFixed(0)}`;

const normalizeIdList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  return [];
};

const getOptionId = (option) => String(option?.id ?? option?._id ?? option?.serviceId ?? option?.categoryId ?? '').trim();

const getOptionLabel = (option, kind) => {
  if (!option) return '';
  if (kind === 'service') return String(option.serviceName || option.name || option.service_name || option.title || '').trim();
  return String(option.name || option.categoryName || option.category_name || option.title || '').trim();
};

function SearchableMultiSelect({ label, placeholder, options, selectedIds, onChange, emptyMessage, loading }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set((Array.isArray(selectedIds) ? selectedIds : []).map((id) => String(id))), [selectedIds]);

  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (Array.isArray(options) ? options : []).filter((option) => {
      const labelText = getOptionLabel(option, label.toLowerCase().includes('service') ? 'service' : 'category').toLowerCase();
      return !q || labelText.includes(q) || String(getOptionId(option)).includes(q);
    });
  }, [label, options, query]);

  const selectedOptions = useMemo(() => {
    return (Array.isArray(options) ? options : []).filter((option) => selectedSet.has(getOptionId(option)));
  }, [options, selectedSet]);

  const toggleOption = (id) => {
    const next = new Set(selectedSet);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  const removeOption = (id) => {
    const next = new Set(selectedSet);
    next.delete(String(id));
    onChange(Array.from(next));
  };

  const kind = label.toLowerCase().includes('service') ? 'service' : 'category';

  return (
    <div className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>

      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
        >
          <div className="min-w-0 flex-1">
            {selectedOptions.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedOptions.slice(0, 2).map((option) => (
                  <span key={getOptionId(option)} className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <span className="max-w-[150px] truncate">{getOptionLabel(option, kind)}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeOption(getOptionId(option)); }} className="text-emerald-700">×</button>
                  </span>
                ))}
                {selectedOptions.length > 2 ? <span className="self-center text-xs font-semibold text-slate-500">+{selectedOptions.length - 2} more</span> : null}
              </div>
            ) : (
              <span className="text-sm text-slate-400">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-xs font-semibold">{selectedOptions.length ? `${selectedOptions.length} selected` : 'Select'}</span>
            <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.942l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
            </svg>
          </div>
        </button>

        {open ? (
          <div className="border-t border-slate-200 bg-slate-50">
            <div className="sticky top-0 border-b border-slate-200 bg-slate-50 p-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {loading ? (
                <div className="px-3 py-4 text-sm text-slate-500">Loading {label.toLowerCase()}...</div>
              ) : visibleOptions.length ? (
                visibleOptions.map((option) => {
                  const id = getOptionId(option);
                  const checked = selectedSet.has(id);
                  const optionLabel = getOptionLabel(option, kind);

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleOption(id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${checked ? 'bg-emerald-50' : 'hover:bg-white'}`}
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                        {checked ? <span className="text-white text-[12px] leading-none">✓</span> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">{optionLabel || `ID ${id}`}</div>
                        <div className="truncate text-xs text-slate-500">ID: {id}</div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-5 text-sm text-slate-500">{emptyMessage}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CouponManagementPage() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const backendOrigin = useMemo(() => String(apiBase || '').replace(/\/api\/?$/, ''), [apiBase]);

  const [coupons, setCoupons] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [servicesList, setServicesList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCoupons();
      // eslint-disable-next-line no-console
      console.log('COUPON API RESPONSE', response?.data);
      const rows = response?.data?.coupons || [];
      const nextSummary = response?.data?.summary || emptySummary;
      setCoupons(Array.isArray(rows) ? rows : []);
      setSummary(nextSummary);
    } catch (err) {
      setError(err?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

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

    const handleBookingCreated = () => {
      loadCoupons();
    };

    socket.on('connect', register);
    register();
    socket.on('bookingCreated', handleBookingCreated);

    return () => {
      socket.off('connect', register);
      socket.off('bookingCreated', handleBookingCreated);
      socket.disconnect();
    };
  }, [backendOrigin, loadCoupons]);

  useEffect(() => {
    const loadOptions = async () => {
      setOptionsLoading(true);
      try {
        const [servicesRes, categoriesRes] = await Promise.all([getServices(), getCategories()]);
        setServicesList(Array.isArray(servicesRes?.data) ? servicesRes.data : []);
        setCategoriesList(Array.isArray(categoriesRes?.data) ? categoriesRes.data : []);
      } catch (err) {
        setError(err?.message || 'Failed to load service and category options');
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, []);

  const serviceOptions = useMemo(
    () => (Array.isArray(servicesList) ? servicesList : []).map((item) => ({ ...item, id: getOptionId(item), label: getOptionLabel(item, 'service') })).filter((item) => item.id),
    [servicesList]
  );

  const categoryOptions = useMemo(
    () => (Array.isArray(categoriesList) ? categoriesList : []).map((item) => ({ ...item, id: getOptionId(item), label: getOptionLabel(item, 'category') })).filter((item) => item.id),
    [categoriesList]
  );

  const filteredCoupons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return coupons.filter((coupon) => {
      const matchesSearch = !query || [coupon.coupon_code, coupon.title, coupon.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const isExpired = coupon.expiry_date ? new Date(coupon.expiry_date).getTime() < Date.now() : false;

      if (filter === 'active' && !coupon.is_active) return false;
      if (filter === 'inactive' && coupon.is_active) return false;
      if (filter === 'expired' && !isExpired) return false;

      return matchesSearch;
    });
  }, [coupons, filter, search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setSelectedServices([]);
    setSelectedCategories([]);
  };

  const openCreateModal = () => {
    resetForm();
    setMessage('');
    setError('');
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    resetForm();
  };

  const openEdit = (coupon) => {
    setEditingId(coupon.id);
    setForm({
      coupon_code: coupon.coupon_code || '',
      title: coupon.title || '',
      description: coupon.description || '',
      discount_type: coupon.discount_type || 'percentage',
      discount_value: coupon.discount_value ?? '',
      max_discount: coupon.max_discount ?? '',
      min_booking_amount: coupon.min_booking_amount ?? '',
      service_mode: coupon.service_mode || 'all',
      service_ids: Array.isArray(coupon.service_ids) ? coupon.service_ids.join(', ') : '',
      category_ids: Array.isArray(coupon.category_ids) ? coupon.category_ids.join(', ') : '',
      total_usage_limit: coupon.total_usage_limit ?? '',
      per_user_limit: coupon.per_user_limit ?? '1',
      is_first_booking_only: Boolean(coupon.is_first_booking_only),
      is_active: Boolean(coupon.is_active),
      expiry_date: formatDateTimeForInput(coupon.expiry_date),
    });
    setSelectedServices(normalizeIdList(coupon.service_ids));
    setSelectedCategories(normalizeIdList(coupon.category_ids));
    setMessage('');
    setError('');
    setIsFormModalOpen(true);
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload = {
      ...form,
      service_ids: selectedServices.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
      category_ids: selectedCategories.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
      coupon_code: String(form.coupon_code || '').trim().toUpperCase(),
      title: String(form.title || '').trim(),
    };

    try {
      if (editingId) {
        await updateCoupon(editingId, payload);
        setMessage('Coupon updated successfully');
      } else {
        await createCoupon(payload);
        setMessage('Coupon created successfully');
      }

      resetForm();
      setIsFormModalOpen(false);
      await loadCoupons();
    } catch (err) {
      setError(err?.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon) => {
    try {
      await toggleCoupon(coupon.id);
      await loadCoupons();
    } catch (err) {
      setError(err?.message || 'Failed to update coupon status');
    }
  };

  const summaryCards = [
    { label: 'Total Coupons', value: summary.totalCoupons },
    { label: 'Active', value: summary.activeCoupons },
    { label: 'Expired', value: summary.expiredCoupons },
    { label: 'Usage Count', value: summary.totalUsageCount },
    { label: 'Total Discount', value: formatCurrency(summary.totalDiscountGiven) },
  ];

  const renderForm = () => (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Basic Details</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Coupon Code</span>
              <input name="coupon_code" value={form.coupon_code} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="WELCOME100" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Title</span>
              <input name="title" value={form.title} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="Festive savings" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Description</span>
              <textarea name="description" value={form.description} onChange={onChange} rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="Short, premium description for the offer" />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Discount Rules</p>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Discount Type</span>
                <select name="discount_type" value={form.discount_type} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10">
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Discount Value</span>
                <input name="discount_value" type="number" min="0" step="0.01" value={form.discount_value} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="100 or 20" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Max Discount</span>
                <input name="max_discount" type="number" min="0" step="0.01" value={form.max_discount} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Min Booking Amount</span>
                <input name="min_booking_amount" type="number" min="0" step="0.01" value={form.min_booking_amount} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="999" />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Usage Rules</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Usage Limit</span>
              <input name="total_usage_limit" type="number" min="0" step="1" value={form.total_usage_limit} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="100" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Per User Limit</span>
              <input name="per_user_limit" type="number" min="1" step="1" value={form.per_user_limit} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="1" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Expiry Date</span>
              <input name="expiry_date" type="datetime-local" value={form.expiry_date} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Applicability</p>
          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Applicable For</span>
              <select name="service_mode" value={form.service_mode} onChange={onChange} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10">
                <option value="all">All</option>
                <option value="home">Home</option>
                <option value="salon">Salon</option>
              </select>
            </label>

            <SearchableMultiSelect
              label="Applicable Services"
              placeholder="Select services"
              options={serviceOptions}
              selectedIds={selectedServices}
              onChange={setSelectedServices}
              emptyMessage={optionsLoading ? 'Loading services...' : 'No services found'}
              loading={optionsLoading}
            />

            <SearchableMultiSelect
              label="Applicable Categories"
              placeholder="Select categories"
              options={categoryOptions}
              selectedIds={selectedCategories}
              onChange={setSelectedCategories}
              emptyMessage={optionsLoading ? 'Loading categories...' : 'No categories found'}
              loading={optionsLoading}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Advanced Settings</p>
          <div className="grid grid-cols-1 gap-4">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-slate-800">First booking only</p>
                <p className="mt-1 text-xs text-slate-500">Limit this coupon to a user’s first booking.</p>
              </div>
              <input type="checkbox" name="is_first_booking_only" checked={form.is_first_booking_only} onChange={onChange} className="h-5 w-5 rounded-full border-slate-300 text-emerald-600 focus:ring-emerald-500/20" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-slate-800">Active coupon</p>
                <p className="mt-1 text-xs text-slate-500">Make this promotion available to customers.</p>
              </div>
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} className="h-5 w-5 rounded-full border-slate-300 text-emerald-600 focus:ring-emerald-500/20" />
            </label>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={closeFormModal} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
          {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="admin-crm-surface px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Promotions</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Coupon Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Manage all offers and promotional campaigns.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <SearchIcon className="h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search coupon code or title" className="min-w-[220px] border-0 p-0 text-sm shadow-none focus:ring-0" />
            </div>

            <div className="relative">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-700 shadow-sm">
                <option value="all">All coupons</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <button type="button" onClick={openCreateModal} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              <PlusIcon className="h-4 w-4" />
              Create Coupon
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
                  ))}
                </div>
              </div>
            ) : filteredCoupons.length ? (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Offer</th>
                    <th className="px-6 py-4">Rules</th>
                    <th className="px-6 py-4">Usage</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoupons.map((coupon) => {
                    const expired = coupon.expiry_date ? new Date(coupon.expiry_date).getTime() < Date.now() : false;
                    return (
                      <tr key={coupon.id}>
                        <td className="px-6 py-5 font-semibold text-slate-900">{coupon.coupon_code}</td>
                        <td className="px-6 py-5">
                          <div className="font-semibold text-slate-900">{coupon.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{coupon.description || 'No description'}</div>
                        </td>
                        <td className="px-6 py-5 text-slate-700">
                          <div>{coupon.discount_type === 'percentage' ? `${coupon.discount_value}% off` : `${formatCurrency(coupon.discount_value)} off`}</div>
                          <div className="mt-1 text-slate-500">Min: {formatCurrency(coupon.min_booking_amount)} • Mode: {coupon.service_mode}</div>
                          <div className="mt-1 text-slate-500">Limit: {coupon.used_count}/{coupon.total_usage_limit || '∞'}</div>
                        </td>
                        <td className="px-6 py-5 text-slate-700">
                          <div>{coupon.total_usage_records || 0} uses</div>
                          <div className="mt-1 text-slate-500">Discount: {formatCurrency(coupon.total_discount_given || 0)}</div>
                          <div className="mt-1 text-slate-500">Expires: {coupon.expiry_date ? new Date(coupon.expiry_date).toLocaleString() : 'No expiry'}</div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${coupon.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {coupon.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {expired ? <div className="mt-2 text-xs font-semibold text-amber-700">Expired</div> : null}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEdit(coupon)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                              Edit
                            </button>
                            <button onClick={() => handleToggle(coupon)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                              {coupon.is_active ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <TicketIcon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No coupons found</h3>
                <p className="mt-2 text-sm text-slate-500">Create a new promotion or adjust the search and filter settings.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isFormModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/40 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Coupon Builder</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{editingId ? 'Edit Coupon' : 'Create New Coupon'}</h2>
                <p className="mt-2 text-sm text-slate-500">Configure discounts and promotional rules.</p>
              </div>
              <button type="button" onClick={closeFormModal} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6 sm:px-8">
              {renderForm()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}