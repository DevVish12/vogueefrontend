import api from './api';

export const getPartnerKycs = async () => {
  return await api.get('/admin/partner-kyc');
};

export const updatePartnerKycStatus = async (id, kyc_status) => {
  return await api.patch(`/admin/partner-kyc/${id}/status`, { kyc_status });
};

export const fetchPartnerKycFile = async (id, docType, options = {}) => {
  // Must be blob to allow viewing/downloading with auth
  return await api.get(`/admin/partner-kyc/${id}/file/${docType}`, {
    responseType: 'blob',
    params: options,
  });
};
