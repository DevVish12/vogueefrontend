import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCategories } from '../../server/categoryApi';
import { createService, deleteService, getServices, updateService } from '../../server/serviceApi';

const FALLBACK_IMG =
  'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2240%22%20height=%2240%22%20viewBox=%220%200%2040%2040%22%3E%3Crect%20width=%2240%22%20height=%2240%22%20fill=%22%23f3f4f6%22/%3E%3Cpath%20d=%22M12%2026l6-7%204%205%203-3%207%208H12z%22%20fill=%22%239ca3af%22/%3E%3Ccircle%20cx=%2228%22%20cy=%2214%22%20r=%222.5%22%20fill=%22%239ca3af%22/%3E%3C/svg%3E';


export default function ServicesPage() {
  // --- Banner Image & Video Handlers (fix ReferenceError) ---
  const handleBannerImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError((prev) => ({ ...prev, bannerImage: 'Only image files allowed' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError((prev) => ({ ...prev, bannerImage: 'Banner image must be ≤ 5MB' }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      bannerImage: file,
      bannerImagePreview: URL.createObjectURL(file)
    }));
    setFormError((prev) => {
      const { bannerImage, ...rest } = prev;
      return rest;
    });
  };

  const removeBannerImage = () => {
    setFormData((prev) => {
      if (prev.bannerImagePreview) {
        try { URL.revokeObjectURL(prev.bannerImagePreview); } catch {}
      }
      return { ...prev, bannerImage: null, bannerImagePreview: '' };
    });
  };

  const handleVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setFormError((prev) => ({ ...prev, video: 'Only video files allowed' }));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFormError((prev) => ({ ...prev, video: 'Video must be ≤ 20MB' }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      video: file,
      videoPreview: URL.createObjectURL(file)
    }));
    setFormError((prev) => {
      const { video, ...rest } = prev;
      return rest;
    });
  };

  const removeVideo = () => {
    setFormData((prev) => {
      if (prev.videoPreview) {
        try { URL.revokeObjectURL(prev.videoPreview); } catch {}
      }
      return { ...prev, video: null, videoPreview: '' };
    });
  };
  // Services State Management (Frontend Only)
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Form State
  const initialFormState = {
    categoryId: '',
    serviceName: '',
    description: '',
    basePrice: '',
    discountPrice: '',
    commissionType: 'percentage',
    commissionValue: '',
    duration: '',
    variants: [''],
    isMVP: false,
    isFeatured: false,
    badges: [], // { name: string, checked: boolean }
    showQuick: false,
    status: 'Active',
    rating: '',
    reviews: '',
    bannerImage: null, // New: Banner image file
    bannerImagePreview: '',
    images: [], // Multiple images
    video: null, // New: Video file
    videoPreview: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [catRes, svcRes] = await Promise.all([getCategories(), getServices()]);

        setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
        setServices(Array.isArray(svcRes?.data) ? svcRes.data : []);
      } catch (err) {
        setFormError({ api: err || 'Failed to load data' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const categoryNameById = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(Number(c.id), c.name);
    return map;
  }, [categories]);

  // --- Modal Logic ---
  const openAddModal = () => {
    setFormError({});
    setFormData(initialFormState);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (service) => {
    setFormError({});

    const existingImages = Array.isArray(service.imageUrls)
      ? service.imageUrls.map((url, idx) => ({
        existingPath: Array.isArray(service.imagePaths) ? service.imagePaths[idx] : null,
        name: `Image ${idx + 1}`,
        size: 0,
        previewUrl: url
      }))
      : [];

    setFormData({
      categoryId: service.categoryId ? String(service.categoryId) : '',
      serviceName: service.serviceName || '',
      description: service.description || '',
      basePrice: service.basePrice ?? '',
      discountPrice: service.discountPrice ?? '',
      commissionType: service.commissionType || 'percentage',
      commissionValue: (service.commissionValue ?? '') === 0 ? '0' : (service.commissionValue ?? ''),
      duration: service.duration ?? '',
      variants: Array.isArray(service.variants)
        ? service.variants
        : typeof service.variants === 'string' && service.variants.trim()
          ? service.variants.split(',').map(v => v.trim())
          : [''],
      isMVP: Boolean(service.isMVP),
      isFeatured: Boolean(service.isFeatured),
      badges: Array.isArray(service.badges) ? service.badges : [],
      showQuick: Boolean(service.showQuick),
      rating: service.rating ?? '',
      reviews: service.reviews ?? '',
      status: service.status || 'Active',
      images: existingImages,
      bannerImage: null,
      bannerImagePreview: service.bannerImageUrl || '',
      video: null,
      videoPreview: service.videoUrl || ''
    });
    setEditingId(service.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    // Revoke preview URLs to avoid memory leaks
    if (Array.isArray(formData.images)) {
      for (const img of formData.images) {
        if (img && img.previewUrl) {
          // Revoke only blob URLs created by URL.createObjectURL
          if (String(img.previewUrl).startsWith('blob:')) {
            try { URL.revokeObjectURL(img.previewUrl); } catch {}
          }
        }
      }
    }
    setFormData(initialFormState);
    setFormError({});
  };

  const addImages = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const nextErrors = {};
    const valid = [];

    for (const file of files) {
      if (!file) continue;
      if (!file.type || !file.type.startsWith('image/')) {
        nextErrors.images = 'Only image files are allowed';
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        nextErrors.images = 'Each image must be ≤ 5MB';
        continue;
      }
      valid.push({
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file)
      });
    }

    if (Object.keys(nextErrors).length) {
      setFormError((prev) => ({ ...prev, ...nextErrors }));
    }

    if (valid.length === 0) return;

    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), ...valid]
    }));

    setFormError((prev) => {
      const { images, ...rest } = prev;
      return rest;
    });
  };

  const removeImageAt = (index) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.images) ? prev.images : [];
      const item = current[index];
      if (item && item.previewUrl) {
        try { URL.revokeObjectURL(item.previewUrl); } catch {}
      }
      return {
        ...prev,
        images: current.filter((_, i) => i !== index)
      };
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) addImages(e.dataTransfer.files);
  };

  // --- Form Handlers ---
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const validate = () => {
    const error = {};
    if (!String(formData.serviceName || '').trim()) error.serviceName = 'Service name required';
    if (!String(formData.categoryId || '').trim()) error.categoryId = 'Category required';
    if (!String(formData.description || '').trim()) error.description = 'Description required';
    if (formData.basePrice === '' || Number(formData.basePrice) <= 0) error.basePrice = 'Base price required';
    if (formData.duration === '' || Number(formData.duration) <= 0) error.duration = 'Duration required';

    if (!formData.bannerImagePreview && (!formData.images || formData.images.length === 0)) {
      error.images = 'At least one image required';
    }

    const ct = String(formData.commissionType || 'percentage').toLowerCase();
    const cvRaw = formData.commissionValue;
    const cv = cvRaw === '' || cvRaw === null || typeof cvRaw === 'undefined' ? 0 : Number(cvRaw);
    if (!Number.isFinite(cv) || cv < 0) {
      error.commissionValue = 'Commission must be 0 or more';
    }
    if (ct !== 'percentage' && ct !== 'fixed') {
      error.commissionType = 'Invalid commission type';
    }
    if (ct === 'percentage' && cv > 100) {
      error.commissionValue = 'Commission % must be ≤ 100';
    }

    setFormError(error);
    return Object.keys(error).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError({});
    if (!validate()) return;

    const safeDiscount = formData.discountPrice && Number(formData.discountPrice) > 0
      ? Number(formData.discountPrice)
      : null;

    const data = new FormData();
    data.append('categoryId', String(Number(formData.categoryId)));
    data.append('category_id', String(Number(formData.categoryId)));
    data.append('serviceName', String(formData.serviceName).trim());
    data.append('description', String(formData.description).trim());
    data.append('basePrice', String(Number(formData.basePrice)));
    data.append('discountPrice', safeDiscount || '');
    data.append('commissionType', String(formData.commissionType || 'percentage'));
    data.append('commissionValue', String(formData.commissionValue === '' ? 0 : Number(formData.commissionValue || 0)));
    data.append('duration', String(Number(formData.duration)));
    data.append('variants', (Array.isArray(formData.variants) ? formData.variants.filter(Boolean).join(',') : '').trim());
    data.append('isMVP', formData.isMVP ? '1' : '0');
    data.append('isFeatured', formData.isFeatured ? '1' : '0');
    data.append('badges', JSON.stringify((formData.badges || []).filter((b) => b?.checked)));
    data.append('showQuick', formData.showQuick ? '1' : '0');
    data.append('rating', String(formData.rating || ''));
    data.append('reviews', String(formData.reviews || ''));
    data.append('status', String(formData.status));

    // Banner image
    if (formData.bannerImage) {
      data.append('bannerImage', formData.bannerImage);
    } else {
      // DO NOT override existing banner
      data.append('keepBanner', '1');
    }

    // Video
    if (formData.video) {
      data.append('video', formData.video);
    }

    const existingImagePaths = (Array.isArray(formData.images) ? formData.images : [])
      .map((img) => img?.existingPath)
      .filter(Boolean);
    data.append('existingImagePaths', JSON.stringify(existingImagePaths));

    const newFiles = (Array.isArray(formData.images) ? formData.images : [])
      .map((img) => img?.file)
      .filter(Boolean);
    for (const file of newFiles) {
      data.append('images', file);
    }

    try {
      if (editingId) {
        const res = await updateService(editingId, data);
        const updatedRow = res?.data;
        setServices((prev) => prev.map((s) => (s.id === editingId ? updatedRow : s)));
        setSuccessMessage('Service updated successfully');
      } else {
        const res = await createService(data);
        const createdRow = res?.data;
        setServices((prev) => [createdRow, ...prev]);
        setSuccessMessage('Service created successfully');
      }
      setTimeout(() => setSuccessMessage(''), 2500);
      closeModal();
    } catch (err) {
      setFormError({ api: err || 'Request failed' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      setSuccessMessage('Service deleted successfully');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (err) {
      setFormError({ api: err || 'Delete failed' });
    }
  };

  return (
    <div className="flex flex-col overflow-hidden relative">
        <main className="flex-1 overflow-auto p-8 relative">
          <div className="max-w-7xl mx-auto">

            {successMessage && (
              <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {successMessage}
              </div>
            )}
            {formError.api && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {formError.api}
              </div>
            )}

            {/* Header section with button */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Services</h1>
                <p className="mt-2 text-sm text-gray-500">Manage all platform services and offerings here.</p>
              </div>
              <button
                onClick={openAddModal}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white transition-all bg-primary-600 rounded-xl hover:bg-primary-700 shadow-sm"
              >
                + Add Service
              </button>
            </div>

            {/* Services Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price (₹)</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500 text-sm">
                          Loading...
                        </td>
                      </tr>
                    ) : services.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500 text-sm">
                          No services found. Click 'Add Service' to create one.
                        </td>
                      </tr>
                    ) : (
                      services.map((service) => (
                        <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg overflow-hidden relative">
                                {Array.isArray(service.imageUrls) && service.imageUrls[0] ? (
                                  <>
                                    <img
                                      src={service.imageUrls[0]}
                                      alt={service.serviceName}
                                      className="h-10 w-10 object-cover"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = FALLBACK_IMG;
                                      }}
                                    />
                                    {service.imageUrls.length > 1 && (
                                      <span className="absolute -top-1 -right-1 rounded-full bg-gray-900/80 text-white text-[10px] px-1.5 py-0.5">
                                        +{service.imageUrls.length - 1}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <div className="h-10 w-10 flex items-center justify-center text-gray-400">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-semibold text-gray-900">{service.serviceName}</div>
                                <div className="text-xs text-gray-500 truncate w-48">{service.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700">
                              {service.categoryName || categoryNameById.get(Number(service.categoryId)) || 'Uncategorized'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ₹{service.discountPrice || service.basePrice}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {service.duration} mins
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${service.status === 'Active'
                              ? 'bg-green-50 text-green-700'
                              : service.status === 'Paused'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                              }`}>
                              {service.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => openEditModal(service)} className="text-primary-600 hover:text-primary-900 mr-4 transition-colors">Edit</button>
                            <button onClick={() => handleDelete(service.id)} className="text-red-500 hover:text-red-700 transition-colors">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>

        {/* ----------------- ADD/EDIT MODAL ----------------- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-gray-900/50 backdrop-blur-sm px-4 py-6">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-full">

              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingId ? 'Edit Service' : 'Add New Service'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:bg-gray-200 hover:text-gray-600 p-1.5 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                <form id="serviceForm" onSubmit={handleFormSubmit} className="space-y-4">

                  {/* Two-Column Grid Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Service Name <span className="text-red-500">*</span>
                      </label>
                      <input type="text" name="serviceName" required value={formData.serviceName} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm" placeholder="e.g. Deep Cleaning" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Chapter (Category) <span className="text-red-500">*</span>
                      </label>
                      <select name="categoryId" required value={formData.categoryId} onChange={handleInputChange} className={`w-full px-3 py-1.5 border ${formError.categoryId ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm bg-white`}>
                        <option value="" disabled>Select chapter</option>
                        {categories.map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.name}</option>
                        ))}
                      </select>
                      {formError.categoryId && <div className="text-red-500 text-xs mt-1">{formError.categoryId}</div>}
                    </div>
                  </div>

                  {/* Banner Image Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Banner Image <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerImage}
                        className="block text-xs"
                      />
                      {formData.bannerImagePreview && (
                        <div className="relative">
                          <img src={formData.bannerImagePreview} alt="Banner Preview" className="h-14 w-24 object-cover rounded border" />
                          <button type="button" onClick={removeBannerImage} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-red-600 shadow-sm">×</button>
                        </div>
                      )}
                    </div>
                    {formError.bannerImage && <div className="text-red-500 text-xs mt-1">{formError.bannerImage}</div>}
                  </div>

                  {/* Full width text area */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea name="description" rows="2" required value={formData.description} onChange={handleInputChange} className={`w-full px-3 py-1.5 border ${formError.description ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm resize-none`} placeholder="Service description..." />
                    {formError.description && <div className="text-red-500 text-xs mt-1">{formError.description}</div>}
                  </div>

                  {/* Two-column pricing/duration */}
                  {/* ---- Pricing ---- */}
                  <div className="mb-2">
                    <div className="font-semibold text-gray-800 mb-1">---- Pricing ----</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Base Price <span className="text-red-500">*</span>
                        </label>
                        <input type="number" name="basePrice" required value={formData.basePrice} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm" placeholder="Base Price" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Discount Price <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input type="number" name="discountPrice" value={formData.discountPrice} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm" placeholder="Discount Price" />
                      </div>
                    </div>
                  </div>

                  {/* ---- Commission ---- */}
                  <div className="mb-2">
                    <div className="font-semibold text-gray-800 mb-1">---- Commission ----</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                        <select
                          name="commissionType"
                          value={formData.commissionType}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-1.5 border ${formError.commissionType ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm bg-white`}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed (₹)</option>
                        </select>
                        {formError.commissionType && <div className="text-red-500 text-xs mt-1">{formError.commissionType}</div>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Value</label>
                        <input
                          type="number"
                          name="commissionValue"
                          value={formData.commissionValue}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-1.5 border ${formError.commissionValue ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm`}
                          placeholder={String(formData.commissionType || '').toLowerCase() === 'fixed' ? 'e.g. 50' : 'e.g. 10'}
                        />
                        {formError.commissionValue && <div className="text-red-500 text-xs mt-1">{formError.commissionValue}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Duration (Mins) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" name="duration" required value={formData.duration} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm" placeholder="e.g. 45" />
                    {formError.duration && <div className="text-red-500 text-xs mt-1">{formError.duration}</div>}
                  </div>

                  {/* Variants and Status in one row to save vertical space */}
                  <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-3">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Variants / Sub-types <span className="text-gray-400 text-xs">(Optional)</span>
                      </label>
                      {formData.variants.map((variant, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={variant}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData(prev => {
                                const next = [...prev.variants];
                                next[idx] = val;
                                return { ...prev, variants: next };
                              });
                            }}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                            placeholder={idx === 0 ? 'e.g. Basic, Elite' : 'Sub-type'}
                          />
                          {formData.variants.length > 1 && (
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 px-2 py-1 rounded"
                              onClick={() => {
                                setFormData(prev => {
                                  const next = prev.variants.filter((_, i) => i !== idx);
                                  return { ...prev, variants: next.length ? next : [''] };
                                });
                              }}
                              aria-label="Remove variant"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="mt-1 px-3 py-1 text-xs font-semibold rounded bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100"
                        onClick={() => setFormData(prev => ({ ...prev, variants: [...prev.variants, ''] }))}
                      >
                        Add More
                      </button>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                      <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm bg-white">
                        <option value="Active">Active</option>
                        <option value="Paused">Paused</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes Group */}
                  {/* ---- Badges ---- */}
                  <div className="mb-2">
                    <div className="font-semibold text-gray-800 mb-1">---- Badges ---- <span className="text-gray-400 text-xs">(Optional)</span></div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={formData.badgeInput || ''}
                        onChange={e => setFormData(prev => ({ ...prev, badgeInput: e.target.value }))}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                        placeholder="Enter badge name"
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100"
                        onClick={() => {
                          if (!formData.badgeInput || formData.badgeInput.trim() === '') return;
                          setFormData(prev => ({
                            ...prev,
                            badges: [...(prev.badges || []), { name: prev.badgeInput.trim(), checked: true }],
                            badgeInput: ''
                          }));
                        }}
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {Array.isArray(formData.badges) && formData.badges.map((badge, idx) => (
                        <label key={idx} className="flex items-center gap-2 cursor-pointer bg-gray-100 px-2 py-1 rounded">
                          <input
                            type="checkbox"
                            checked={badge.checked}
                            onChange={e => {
                              setFormData(prev => {
                                const next = [...prev.badges];
                                next[idx].checked = e.target.checked;
                                return { ...prev, badges: next };
                              });
                            }}
                          />
                          <span className="text-xs font-medium text-gray-700">{badge.name}</span>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700 px-1"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              badges: prev.badges.filter((_, i) => i !== idx)
                            }))}
                            aria-label="Remove badge"
                          >
                            &times;
                          </button>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Checkboxes Group */}
                  <div className="bg-gray-100/50 rounded-lg p-3 border border-gray-200/60 flex flex-wrap gap-x-5 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="isMVP" checked={formData.isMVP} onChange={handleInputChange} className="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                      <span className="text-[13px] text-gray-700 font-medium">MVP (Minimal Viable Product) <span className="text-gray-400 text-xs">(Optional)</span></span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="isFeatured" checked={formData.isFeatured} onChange={handleInputChange} className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                      <span className="text-[13px] text-blue-700 font-medium">Seasonal Highlights <span className="text-gray-400 text-xs">(Optional)</span></span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="showQuick" checked={formData.showQuick} onChange={handleInputChange} className="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                      <span className="text-[13px] text-gray-700 font-medium">Quick Ritual <span className="text-gray-400 text-xs">(Optional)</span></span>
                    </label>
                  </div>

                  {/* ---- Ratings ---- */}
                  <div className="mb-2">
                    <div className="font-semibold text-gray-800 mb-1">---- Ratings ----</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Rating <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input type="number" name="rating" value={formData.rating} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm" placeholder="e.g. 4.5" min="0" max="5" step="0.1" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Reviews <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input type="number" name="reviews" value={formData.reviews} onChange={handleInputChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm" placeholder="e.g. 120" min="0" />
                      </div>
                    </div>
                  </div>

                  {/* Mock File Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Upload Images <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-400 mb-1">At least 1 image required</p>
                    <div
                      className={`mt-1 rounded-lg border-2 border-dashed px-4 py-4 transition-colors ${
                        isDragging
                          ? 'border-primary-500 bg-primary-50'
                          : formError.images
                            ? 'border-red-400 bg-red-50/30'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                      }}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) addImages(e.target.files);
                          e.target.value = '';
                        }}
                      />

                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="mt-2 flex text-xs justify-center items-center">
                          <span className="text-primary-600 font-medium">Upload images</span>
                          <span className="text-gray-500 ml-1">or drag and drop (multiple)</span>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">PNG/JPG/WebP etc. • max 5MB each</div>
                      </div>

                      {formError.images && <div className="text-red-500 text-xs mt-2 text-center">{formError.images}</div>}

                      {Array.isArray(formData.images) && formData.images.length > 0 && (
                        <div className="mt-4 grid grid-cols-4 gap-3">
                          {formData.images.map((img, idx) => (
                            <div key={img.previewUrl || idx} className="relative">
                              <img
                                src={img.previewUrl}
                                alt={img.name || `Image ${idx + 1}`}
                                className="h-16 w-full rounded-md object-cover border border-gray-200"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FALLBACK_IMG;
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImageAt(idx);
                                }}
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-red-600 shadow-sm"
                                aria-label="Remove image"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Video Upload */}
                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Upload Video (short) <span className="text-gray-400 text-xs">(Optional)</span>
                      </label>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideo}
                        className="block text-xs"
                      />
                      {formData.videoPreview && (
                        <div className="relative mt-2">
                          <video src={formData.videoPreview} controls className="h-20 w-32 rounded border" />
                          <button type="button" onClick={removeVideo} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-red-600 shadow-sm">×</button>
                        </div>
                      )}
                      {formError.video && <div className="text-red-500 text-xs mt-1">{formError.video}</div>}
                    </div>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
                <button type="button" onClick={closeModal} className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none transition-colors shadow-sm">
                  Cancel
                </button>
                <button type="submit" form="serviceForm" className="px-5 py-1.5 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors shadow-sm">
                  {editingId ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
  );
}
