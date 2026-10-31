import { useState, useEffect } from 'react';
import { ServiceRequest, DeletedServiceRequestRecord } from '../types';
import { INITIAL_SERVICE_REQUESTS } from '../data/initialData';
import { api } from '../services/api';

export const useServiceRequests = () => {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(INITIAL_SERVICE_REQUESTS);
  const [deletedRequests, setDeletedRequests] = useState<DeletedServiceRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('pulau_betung_auth_token');
    setIsAuthed(!!token);
  }, []);

  const refreshData = async () => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }

    try {
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
  };

  useEffect(() => {
    refreshData();
  }, [isAuthed]);

  const findRequestByCode = async (code: string): Promise<ServiceRequest | null> => {
    try {
      const res = await api.trackRequest(code);
      if (res.success && res.data) {
        return res.data as ServiceRequest;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const addServiceRequest = async (req: ServiceRequest) => {
    // Note: DataContext handles direct UI updates and calls api.applyService
    // This is kept for compatibility with existing code calling this hook
  };

  const updateServiceRequest = async (id: string, data: Partial<ServiceRequest>) => {
    // Note: DataContext handles this via api.updateRequestStatus
  };

  const deleteServiceRequest = async (id: string, deletedRecord: DeletedServiceRequestRecord) => {
    // Note: DataContext handles this via api.deleteServiceRequest
  };

  const seedInitialData = async () => {
    // Not needed in Express/Postgres setup as seeding is handled via scripts
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
