import api from './api';

export const getUnassignedBookings = async () => {
  return await api.get('/admin/bookings/unassigned');
};

export const assignPartnerToBooking = async (bookingId, partnerId) => {
  return await api.post('/admin/assign-partner', { bookingId, partnerId });
};

export const getAllPartners = async () => {
  return await api.get('/admin/partners');
};
