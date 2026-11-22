import { useState, useEffect, useCallback } from 'react';
import { ServiceRequest, DeletedServiceRequestRecord, User } from '../types';
import { INITIAL_SERVICE_REQUESTS } from '../data/initialData';
import { api } from '../services/api';
import { getTenantAuthToken } from '../utils/tenantStorage';

export const useServiceRequests = (currentUser?: User | null) => {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(INITIAL_SERVICE_REQUESTS);
  const [deletedRequests, setDeletedRequests] = useState<DeletedServiceRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const token = getTenantAuthToken();
  const isAuthorized =
    !!token &&
    !!currentUser &&
    ['super_admin', 'admin_desa', 'operator'].includes(currentUser.role);

  const refreshData = useCallback(async () => {
    if (!isAuthorized) {
      setDeletedRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.getAdminRequests();
      if (res.success && res.data) {
        setServiceRequests(res.data);
      }

      const delRes = await api.getDeletedServiceRequests();
      if (delRes.success && delRes.data) {
        setDeletedRequests(delRes.data);
      }
    } catch (err) {
      console.warn('Gagal memuat data surat dari API:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const findRequestByCode = async (code: string): Promise<ServiceRequest | null> => {
    try {
      const res = await api.trackRequest(code);
      if (res.success && res.data) {
        return res.data as ServiceRequest;
      }
      return null;
    } catch {
      return null;
    }
  };

  const addServiceRequest = async (_req: ServiceRequest) => {
    // Direct UI updates and api.applyService are handled by DataContext
  };

  const updateServiceRequest = async (_id: string, _data: Partial<ServiceRequest>) => {
    // Direct updates are handled by DataContext via api.updateRequestStatus
  };

  const deleteServiceRequest = async (_id: string, _deletedRecord: DeletedServiceRequestRecord) => {
    // Direct deletes are handled by DataContext via api.deleteServiceRequest
  };

  const seedInitialData = async () => {
    // Handled via server-side seeding
  };

  return {
    serviceRequests,
    setServiceRequests,
    deletedRequests,
    setDeletedRequests,
    loading,
    addServiceRequest,
    updateServiceRequest,
    deleteServiceRequest,
    findRequestByCode,
    seedInitialData,
    refreshData
  };
};
