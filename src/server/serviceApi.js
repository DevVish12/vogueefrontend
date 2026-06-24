import api from './api';

export const getServices = async () => {
  return await api.get('/admin/services');
};

export const createService = async (payload) => {
  if (payload instanceof FormData) {
    return await api.post('/admin/services', payload, {
      headers: { /* Let browser set Content-Type for FormData */ }
    });
  }
  return await api.post('/admin/services', payload);
};

export const updateService = async (id, payload) => {
  if (payload instanceof FormData) {
    return await api.put(`/admin/services/${id}`, payload, {
      headers: { /* Let browser set Content-Type for FormData */ }
    });
  }
  return await api.put(`/admin/services/${id}`, payload);
};

export const deleteService = async (id) => {
  return await api.delete(`/admin/services/${id}`);
};

export const updateServiceCommission = async (id, payload) => {
  return await api.patch(`/admin/services/${id}/commission`, payload);
};
