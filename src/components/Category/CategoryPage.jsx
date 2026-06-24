import React, { useEffect, useRef, useState } from 'react';
import { createCategory, deleteCategory, getCategories, updateCategory } from '../../server/categoryApi';

// Helper to build image URL
function getImageUrl(imageUrl) {
  if (!imageUrl) return null;
  // If already absolute (http/https), return as is
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  // Otherwise, assume relative to backend origin
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const backendOrigin = apiBase.replace(/\/api\/?$/, '');
  return `${backendOrigin}/${imageUrl.replace(/^\/+/, '')}`;
}

const FALLBACK_IMAGE_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      '<rect width="96" height="96" rx="12" fill="#F3F4F6"/>' +
      '<path d="M26 62l10-12 10 12 10-14 14 18H26z" fill="#D1D5DB"/>' +
      '<circle cx="38" cy="38" r="6" fill="#D1D5DB"/>' +
    '</svg>'
  );

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const initialForm = { name: '', image: null };

export default function CategoryPage() {
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCategories();
        setCategories(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        // api interceptor returns message string
        setFormError({ api: err || 'Failed to load categories' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Modal open for add/edit
  const openModal = (index = null) => {
    setFormError({});
    setEditIndex(index);
    if (index !== null) {
      const cat = categories[index];
      setForm({ name: cat.name, image: null });
      setImagePreview(getImageUrl(cat.imageUrl));
    } else {
      setForm(initialForm);
      setImagePreview(null);
    }
    setModalOpen(true);
  };

  // Modal close
  const closeModal = () => {
    setModalOpen(false);
    setForm(initialForm);
    setImagePreview(null);
    setEditIndex(null);
    setFormError({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handle image upload
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let error = {};
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      error.image = 'Only JPG or PNG allowed';
    } else if (file.size > 5 * 1024 * 1024) {
      error.image = 'Max file size is 5MB';
    }
    setFormError(error);
    if (Object.keys(error).length) {
      setForm((prev) => ({ ...prev, image: null }));
      setImagePreview(null);
      return;
    }
    setForm((prev) => ({ ...prev, image: file }));
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Validate form
  const validate = () => {
    let error = {};
    if (!form.name.trim()) error.name = 'Category name required';
    if (editIndex === null && !form.image) error.image = 'Image required';
    if (form.image && !['image/jpeg', 'image/png'].includes(form.image.type)) error.image = 'Only JPG or PNG allowed';
    if (form.image && form.image.size > 5 * 1024 * 1024) error.image = 'Max file size is 5MB';
    setFormError(error);
    return Object.keys(error).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const data = new FormData();
      data.append('name', form.name.trim());
      if (form.image) data.append('image', form.image);

      if (editIndex !== null) {
        const id = categories[editIndex]?.id;
        const res = await updateCategory(id, data);
        const updatedRow = res?.data;
        setCategories((prev) => prev.map((c, i) => (i === editIndex ? updatedRow : c)));
        setSuccessMessage('Category updated successfully');
      } else {
        const res = await createCategory(data);
        const createdRow = res?.data;
        setCategories((prev) => [createdRow, ...prev]);
        setSuccessMessage('Category created successfully');
      }

      setTimeout(() => setSuccessMessage(''), 2500);
      closeModal();
    } catch (err) {
      setFormError({ api: err || 'Request failed' });
    }
  };

  // Edit category
  const handleEdit = (idx) => openModal(idx);

  // Delete category
  const handleDelete = async (idx) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const id = categories[idx]?.id;
      await deleteCategory(id);
      setCategories((prev) => prev.filter((_, i) => i !== idx));
      setSuccessMessage('Category deleted successfully');
      setTimeout(() => setSuccessMessage(''), 2500);
    } catch (err) {
      setFormError({ api: err || 'Delete failed' });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
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

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Category Management</h1>
        <button
          onClick={() => openModal()}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg shadow transition-all focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          Add Category
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-400">Loading...</td>
              </tr>
            )}
            {!loading && categories.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-400">No categories yet.</td>
              </tr>
            )}
            {categories.map((cat, idx) => {
              const resolvedImageUrl = getImageUrl(cat.imageUrl);
              return (
              <tr key={idx}>
                <td className="px-6 py-4">
                  {resolvedImageUrl ? (
                    <img
                      src={resolvedImageUrl}
                      alt={cat.name}
                      className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_IMAGE_DATA_URI;
                      }}
                    />
                  ) : (
                    <span className="inline-block w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400">No Image</span>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-gray-800">{cat.name}</td>
                <td className="px-6 py-4 text-gray-500">{formatDate(cat.created_at || cat.created)}</td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleEdit(idx)}
                    className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded transition-colors"
                  >Edit</button>
                  <button
                    onClick={() => handleDelete(idx)}
                    className="text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded transition-colors ml-2"
                  >Delete</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-7 relative animate-fadeIn">
            <h2 className="text-xl font-bold mb-6 text-gray-800">{editIndex !== null ? 'Edit Category' : 'Add Category'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border ${formError.name ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200`}
                  placeholder="Enter category name"
                  autoFocus
                />
                {formError.name && <div className="text-red-500 text-xs mt-1">{formError.name}</div>}
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Image</label>
                <div
                  className={`flex flex-col items-center justify-center border-2 ${formError.image ? 'border-red-400' : 'border-dashed border-gray-300'} rounded-lg p-4 bg-gray-50 cursor-pointer transition-all`}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded mb-2 border border-gray-200"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_IMAGE_DATA_URI;
                      }}
                    />
                  ) : (
                    <span className="text-gray-400">Click to upload JPG/PNG (max 5MB)</span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleImage}
                  />
                </div>
                {formError.image && <div className="text-red-500 text-xs mt-1">{formError.image}</div>}
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                >Cancel</button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow transition-colors"
                >{editIndex !== null ? 'Update' : 'Create'}</button>
              </div>
            </form>
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl font-bold focus:outline-none"
              onClick={closeModal}
              aria-label="Close"
            >&times;</button>
          </div>
        </div>
      )}
      <style>{`
        .animate-fadeIn {
          animation: fadeIn .25s cubic-bezier(.4,0,.2,1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
