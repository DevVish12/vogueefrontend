import api from './api';

export const getCategories = async () => {
  return await api.get('/admin/categories');
};

export const createCategory = async (formData) => {
  return await api.post('/admin/categories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const updateCategory = async (id, formData) => {
  return await api.put(`/admin/categories/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteCategory = async (id) => {
  return await api.delete(`/admin/categories/${id}`);
};
