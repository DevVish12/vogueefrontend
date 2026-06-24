import api from './api';

export const getCoupons = async () => {
  return await api.get('/admin/coupons');
};

export const createCoupon = async (payload) => {
  return await api.post('/admin/coupons/create', payload);
};

export const updateCoupon = async (id, payload) => {
  return await api.put(`/admin/coupons/${id}`, payload);
};

export const toggleCoupon = async (id) => {
  return await api.patch(`/admin/coupons/${id}/toggle`);
};