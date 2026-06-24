import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBanners, uploadBanner, deleteBanner } from '../../server/bannerApi';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const FALLBACK_IMG =
  'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2240%22%20height=%2240%22%20viewBox=%220%200%2040%2040%22%3E%3Crect%20width=%2240%22%20height=%2240%22%20fill=%22%23f3f4f6%22/%3E%3Cpath%20d=%22M12%2026l6-7%204%205%203-3%207%208H12z%22%20fill=%22%239ca3af%22/%3E%3Ccircle%20cx=%2228%22%20cy=%2214%22%20r=%222.5%22%20fill=%22%239ca3af%22/%3E%3C/svg%3E';

export default function BannerPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState([]); // { file, previewUrl }
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  const selectedCount = selected.length;

  const selectedFilesLabel = useMemo(() => {
    if (selectedCount === 0) return 'No files selected';
    if (selectedCount === 1) return '1 file selected';
    return `${selectedCount} files selected`;
  }, [selectedCount]);

  const revokeSelectedPreviews = () => {
    for (const item of selected) {
      if (item?.previewUrl && String(item.previewUrl).startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch {
          // ignore
        }
      }
    }
  };

  const fetchBanners = async () => {
    setApiError('');
    try {
      const list = await getBanners();
      setBanners(Array.isArray(list?.data) ? list.data : []);
    } catch (err) {
      setApiError(err || 'Failed to fetch banners');
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchBanners();
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = () => {
    setFormError('');
    setSelected([]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError('');
    revokeSelectedPreviews();
    setSelected([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateFiles = (files) => {
    if (!files || files.length === 0) return { ok: false, message: 'Please select at least one image' };
    if (files.length > MAX_FILES) return { ok: false, message: `Maximum ${MAX_FILES} images allowed` };

    for (const file of files) {
      if (!file?.type || !file.type.startsWith('image/')) {
        return { ok: false, message: 'Only image files are allowed' };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { ok: false, message: 'Each image must be ≤ 5MB' };
      }
    }

    return { ok: true, message: '' };
  };

  const onChooseFiles = (e) => {
    setFormError('');
    const files = Array.from(e.target.files || []);
    const result = validateFiles(files);
    if (!result.ok) {
      setSelected([]);
      setFormError(result.message);
      return;
    }

    revokeSelectedPreviews();
    const next = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setSelected(next);
  };

  const removeSelectedAt = (index) => {
    setSelected((prev) => {
      const item = prev[index];
      if (item?.previewUrl && String(item.previewUrl).startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch {
          // ignore
        }
      }
      const next = prev.filter((_, i) => i !== index);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return next;
    });
  };

  const uploadBanners = async () => {
    setFormError('');
    setApiError('');

    const files = selected.map((s) => s?.file).filter(Boolean);
    const result = validateFiles(files);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    const data = new FormData();
    for (const file of files) data.append('images', file);

    try {
      setUploading(true);
      await uploadBanner(data);
      setSuccessMessage('Banner uploaded successfully');
      setTimeout(() => setSuccessMessage(''), 2500);
      closeModal();
      await fetchBanners();
    } catch (err) {
      setFormError(err || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm('Delete this banner image?')) return;
    setApiError('');
    try {
      await deleteBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      setSuccessMessage('Banner deleted successfully');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (err) {
      setApiError(err || 'Delete failed');
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
          {apiError && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {apiError}
            </div>
          )}

          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Banner Management</h1>
              <p className="mt-2 text-sm text-gray-500">Upload and manage banner images shown in the app.</p>
            </div>
            <button
              onClick={openModal}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white transition-all bg-primary-600 rounded-xl hover:bg-primary-700 shadow-sm"
            >
              Upload Banner
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6">
              {loading ? (
                <div className="py-10 text-center text-sm text-gray-500">Loading banners...</div>
              ) : banners.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">No banners uploaded yet.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {banners.map((b) => (
                    <div key={b.id} className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={b.imageUrl || b.image_url || FALLBACK_IMG}
                        alt="Banner"
                        className="h-28 w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_IMG;
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteBanner(b.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 border border-gray-200 text-red-600 hover:bg-red-50 px-2 py-1 text-xs font-semibold rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-gray-900/50 backdrop-blur-sm px-4 py-6">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900">Upload Banner</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:bg-gray-200 hover:text-gray-600 p-1.5 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Images</label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onChooseFiles}
                      className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    <div className="text-xs text-gray-500 whitespace-nowrap">{selectedFilesLabel}</div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Max {MAX_FILES} images, max 5MB each.
                  </div>
                  {formError && <div className="text-red-500 text-xs mt-2">{formError}</div>}
                </div>

                {selected.length > 0 && (
                  <div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {selected.map((item, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                          <img
                            src={item.previewUrl}
                            alt="Preview"
                            className="h-24 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeSelectedAt(idx)}
                            className="absolute top-2 right-2 bg-white/95 border border-gray-200 text-gray-700 hover:bg-gray-100 px-2 py-1 text-xs font-semibold rounded-lg"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none transition-colors shadow-sm"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={uploadBanners}
                className="px-5 py-1.5 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors shadow-sm disabled:opacity-60"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
