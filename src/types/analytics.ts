export interface GrowthData {
  period: string; // YYYY-MM
  births: number;
  deaths: number;
  incoming: number;
  outgoing: number;
  marriages: number;
  businessNew: number;
  povertyRequests: number;
}

export interface SectorAnalytics {
  demography: {
    totalBirths: number;
    totalDeaths: number;
    totalIncoming: number;
    totalOutgoing: number;
    growthRate: number;
    totalPopulation: number;
    totalFamilies: number;
  };
  economy: {
    totalSKU: number;
    totalSKTM: number;
    totalUMKM: number;
    verifiedUMKM: number;
  };
  social: {
    totalNikah: number;
    totalCerai: number;
  };
  health: {
    stuntingCases: number;
    posyanduVisits: number;
  };
  land: {
    totalSporadik: number;
    totalLandArea: number;
  };
}

export interface VillageAnalytics {
  summary: SectorAnalytics;
  monthlyGrowth: GrowthData[];
  territoryStats: {
    dusunName: string;
    populationEstimate: number;
    familyCount: number;
    requestCount: number;
  }[];
}
