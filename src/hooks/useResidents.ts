import { useState, useEffect, useCallback } from 'react';
import { Resident } from '../types/resident';
import { cleanCitizenName, cleanCitizenNik } from '../utils/formatting';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export const useResidents = () => {
  const { currentUser, isLoading: isAppLoading } = useApp();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResidents = useCallback(async () => {
    const token = localStorage.getItem('pulau_betung_auth_token');
    const isAuthorized = !!token && !!currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'admin_desa' || currentUser.role === 'operator');

    if (!isAuthorized) {
      setLoading(false);
      setResidents([]);
      return;
    }

    if (isAppLoading) return;

    try {
      setLoading(true);
      const res = await api.getResidents();
      if (res.success && res.data) {
        // Map backend data to local Resident structure
        const mapped = res.data.map((r: any) => {
          let cleanStatus = r.status || 'Hidup';
          if (cleanStatus.toUpperCase() === 'HIDUP') cleanStatus = 'Hidup';
          else if (cleanStatus.toUpperCase() === 'MENINGGAL') cleanStatus = 'Meninggal';
          else if (cleanStatus.toUpperCase() === 'PINDAH') cleanStatus = 'Pindah';

          const dusunName = typeof r.dusun === 'object' && r.dusun?.name ? r.dusun.name : (typeof r.dusun === 'string' ? r.dusun : (r.address || ''));
          const rwName = typeof r.rw === 'object' && r.rw?.name ? r.rw.name : (typeof r.rw === 'string' ? r.rw : (r.rwId || '01'));
          const rtName = typeof r.rt === 'object' && r.rt?.name ? r.rt.name : (typeof r.rt === 'string' ? r.rt : (r.rtId || '01'));

          return {
            ...r,
            name: cleanCitizenName(r.fullName || r.name || ''),
            nik: cleanCitizenNik(r.nik || ''),
            kk: r.kkNumber || r.kk || '',
            status: cleanStatus,
            dusun: dusunName,
            dusunId: r.dusunId || (typeof r.dusun === 'object' ? r.dusun?.id : ''),
            rw: rwName,
            rwId: r.rwId || (typeof r.rw === 'object' ? r.rw?.id : ''),
            rt: rtName,
            rtId: r.rtId || (typeof r.rt === 'object' ? r.rt?.id : '')
          };
        }) as Resident[];
        
        setResidents(mapped);
        setError(null);
      } else {
        setError(res.error || 'Gagal memuat data penduduk.');
      }
    } catch (err) {
      console.error('Error fetching residents:', err);
      setError('Terjadi kesalahan koneksi saat mengambil data penduduk.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, isAppLoading]);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  const addResident = async (resident: any) => {
    const sanitized = {
      ...resident,
      fullName: cleanCitizenName(resident.fullName || resident.name || ''),
      nik: cleanCitizenNik(resident.nik || ''),
      kkNumber: resident.kkNumber || resident.kk || ''
    };
    
    const res = await api.addResident(sanitized);
    if (!res.success) {
      throw new Error(res.error || 'Gagal menambah data penduduk.');
    }
    await fetchResidents();
    return res;
  };

  const updateResident = async (resident: any) => {
    const id = resident.id;
    if (!id) throw new Error('ID penduduk diperlukan');

    const sanitized = {
      ...resident,
      fullName: cleanCitizenName(resident.fullName || resident.name || ''),
      nik: cleanCitizenNik(resident.nik || ''),
      kkNumber: resident.kkNumber || resident.kk || ''
    };
    
    const res = await api.updateResident(id, sanitized);
    if (!res.success) {
      throw new Error(res.error || 'Gagal memperbarui data penduduk.');
    }
    await fetchResidents();
    return res;
  };

  const deleteResident = async (id: string) => {
    const res = await api.deleteResident(id);
    if (!res.success) {
      throw new Error(res.error || 'Gagal menghapus data penduduk.');
    }
    await fetchResidents();
    return res;
  };

  return { 
    residents, 
    loading, 
    error,
    refreshResidents: fetchResidents,
    addResident, 
    updateResident, 
    deleteResident 
  };
};
