import { useState, useEffect, useCallback } from 'react';
import { ToddlerRecord } from '../types/posyandu';
import { api } from '../services/api';

export const useToddlers = () => {
  const [toddlers, setToddlers] = useState<ToddlerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  // Auth check via JWT Token
  useEffect(() => {
    const token = localStorage.getItem('pulau_betung_auth_token');
    setIsAuthed(!!token);
  }, []);

  const fetchToddlers = useCallback(async () => {
    if (!isAuthed) {
      setLoading(false);
      setToddlers([]);
      return;
    }

    try {
      setLoading(true);
      const res = await api.getToddlers();
      if (res.success && res.data) {
        setToddlers(res.data as ToddlerRecord[]);
        setError(null);
      } else {
        setError(res.error || 'Gagal memuat data balita.');
      }
    } catch (err) {
      console.error('Error fetching toddlers:', err);
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    fetchToddlers();
  }, [fetchToddlers]);

  const addToddler = async (toddler: any) => {
    const res = await api.addToddler(toddler);
    if (res.success) await fetchToddlers();
    return res;
  };

  const updateToddler = async (toddler: any) => {
    if (!toddler.id) return { success: false, error: 'ID balita diperlukan' };
    const res = await api.updateToddler(toddler.id, toddler);
    if (res.success) await fetchToddlers();
    return res;
  };

  const deleteToddler = async (id: string) => {
    const res = await api.deleteToddler(id);
    if (res.success) await fetchToddlers();
    return res;
  };

  return { 
    toddlers, 
    loading, 
    error,
    refreshToddlers: fetchToddlers,
    seedInitialData: fetchToddlers,
    addToddler, 
    updateToddler, 
    deleteToddler 
  };
};
