import api from './api';

export const getBanners = async () => {
  return await api.get('/admin/banner');
};

export const uploadBanner = async (formData) => {
  return await api.post('/admin/banner/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteBanner = async (id) => {
  return await api.delete(`/admin/banner/${id}`);
};
