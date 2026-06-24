import api from './api';

export const getReviews = async () => {
  return await api.get('/admin/reviews');
};

export const approveReview = async (id) => {
  return await api.put(`/admin/reviews/${id}/approve`);
};

export const rejectReview = async (id) => {
  return await api.put(`/admin/reviews/${id}/reject`);
};
