import { useInfiniteQuery, QueryFunctionContext } from '@tanstack/react-query';
import { BansosRecipient } from '../types/bansos';
import { api } from '../services/api';

type KpmQueryKey = ['kpm_bansos', { programType: string; status?: string }];

// TODO: TECH DEBT - Pindahkan filter ke backend query params untuk performa jika data bertambah besar
const fetchKpmPage = async ({ pageParam, queryKey }: QueryFunctionContext<KpmQueryKey, any | null>) => {
  const [_key, filters] = queryKey;
  
  // Mendeteksi apakah user adalah Admin atau Warga
  const token = localStorage.getItem('pulau_betung_auth_token');
  const res = token ? await api.getKpmData() : await api.getPublicKpmData();
  
  if (!res.success || !res.data) return { data: [], lastVisible: null };

  let filtered = [...res.data];
  
  // Filtering manual di Frontend (Tech Debt)
  if (filters.programType) {
    filtered = filtered.filter(item => item.programName === filters.programType);
  }
  if (filters.status) {
    filtered = filtered.filter(item => item.status === filters.status);
  }

  return { data: filtered, lastVisible: null };
};

export const useKpmData = (filters: { programType: string; status?: string }) => {
  return useInfiniteQuery({
    queryKey: ['kpm_bansos', filters] as KpmQueryKey,
    queryFn: fetchKpmPage,
    initialPageParam: null as any,
    getNextPageParam: (lastPage) => lastPage.lastVisible || undefined,
  });
};
