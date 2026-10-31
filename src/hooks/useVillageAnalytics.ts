import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useResidents } from './useResidents';
import { aggregateVillageData } from '../utils/analyticsEngine';

export const useVillageAnalytics = () => {
  const { serviceRequests, umkm, webGisData, territories } = useApp();
  const { residents } = useResidents();

  return useMemo(() => 
    aggregateVillageData(serviceRequests, umkm, webGisData, territories, residents),
    [serviceRequests, umkm, webGisData, territories, residents]
  );
};
