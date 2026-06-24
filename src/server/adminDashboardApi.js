import api from './api';

export const getAdminDashboardSummary = async () => {
  return await api.get('/admin/dashboard-summary');
};