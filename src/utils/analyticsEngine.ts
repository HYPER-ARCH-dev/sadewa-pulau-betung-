import { ServiceRequest, UmkmItem, DusunRecord } from '../types';
import { LandParcel } from '../types/webgis';
import { VillageAnalytics, GrowthData } from '../types/analytics';
import { Resident } from '../types/resident';

export const aggregateVillageData = (
  requests: ServiceRequest[],
  umkm: UmkmItem[],
  parcels: LandParcel[],
  territories: DusunRecord[],
  residents: Resident[]
): VillageAnalytics => {
  const approvedRequests = requests.filter(r => ['selesai', 'disetujui', 'dicetak'].includes(r.status.toLowerCase()));
  
  // 1. Sectoral Aggregation
  const livingResidents = residents.filter(r => (r.status || '').toLowerCase() === 'hidup');
  const demography = {
    totalBirths: approvedRequests.filter(r => r.serviceId === 'srv-5' || r.serviceName.includes('Kelahiran')).length,
    totalDeaths: approvedRequests.filter(r => r.serviceName.includes('Kematian')).length,
    totalIncoming: approvedRequests.filter(r => r.serviceId === 'srv-2' && (r.formData as Record<string, any>)?.purpose?.toLowerCase().includes('pindah masuk')).length,
    totalOutgoing: approvedRequests.filter(r => r.serviceId === 'srv-pindah-domisili').length,
    growthRate: 0,
    totalPopulation: livingResidents.length,
    totalFamilies: new Set(livingResidents.map(r => r.kk).filter(Boolean)).size
  };
  demography.growthRate = ((demography.totalBirths + demography.totalIncoming) - (demography.totalDeaths + demography.totalOutgoing));

  const economy = {
    totalSKU: approvedRequests.filter(r => r.serviceId === 'srv-1').length,
    totalSKTM: approvedRequests.filter(r => r.serviceId === 'srv-4').length,
    totalUMKM: umkm.length,
    verifiedUMKM: umkm.filter(u => u.isVerified || u.verified).length
  };

  const social = {
    totalNikah: approvedRequests.filter(r => r.serviceId === 'srv-6').length,
    totalCerai: approvedRequests.filter(r => r.serviceId === 'srv-janda-duda').length
  };

  const health = {
    stuntingCases: 0, // Placeholder as posyandu data might be in different state
    posyanduVisits: 0 
  };

  const land = {
    totalSporadik: approvedRequests.filter(r => r.serviceId === 'srv-sporadik').length,
    totalLandArea: parcels.reduce((acc, p) => acc + (p.landAreaHectares || 0), 0)
  };

  // 2. Monthly Growth (Memoized logic candidate)
  const monthlyMap: Record<string, GrowthData> = {};
  
  approvedRequests.forEach(req => {
    const date = req.completedAt || req.requestDate;
    if (!date) return;
    const period = date.substring(0, 7); // YYYY-MM
    
    if (!monthlyMap[period]) {
      monthlyMap[period] = {
        period,
        births: 0,
        deaths: 0,
        incoming: 0,
        outgoing: 0,
        marriages: 0,
        businessNew: 0,
        povertyRequests: 0
      };
    }

    const m = monthlyMap[period];
    if (req.serviceId === 'srv-5' || req.serviceName.includes('Kelahiran')) m.births++;
    else if (req.serviceName.includes('Kematian')) m.deaths++;
    else if (req.serviceId === 'srv-pindah-domisili') m.outgoing++;
    else if (req.serviceId === 'srv-6') m.marriages++;
    else if (req.serviceId === 'srv-1') m.businessNew++;
    else if (req.serviceId === 'srv-4') m.povertyRequests++;
  });

  const monthlyGrowth = Object.values(monthlyMap).sort((a, b) => a.period.localeCompare(b.period));

  // 3. Territory Stats
  const territoryStats = territories.map(d => {
    const dusunResidents = livingResidents.filter(r => (r.dusun === d.name || r.dusunId === d.id));
    return {
      dusunName: d.name,
      populationEstimate: dusunResidents.length,
      familyCount: new Set(dusunResidents.map(r => r.kk).filter(Boolean)).size,
      requestCount: requests.filter(r => r.addressDusun?.includes(d.name) || r.addressDusun?.includes(d.customName || '')).length
    };
  });

  return {
    summary: { demography, economy, social, health, land },
    monthlyGrowth,
    territoryStats
  };
};
