import { calculateHaversineDistance, toRad } from './haversine';

export interface Point2D {
  lat: number;
  lng: number;
}

export interface PolygonAreaResult {
  areaSqM: number;
  areaHectares: number;
  perimeterMeters: number;
  formattedAreaSqM: string;
  formattedAreaHectares: string;
  stepByStepDetails: {
    pointIndex: number;
    coord: Point2D;
    xMeters: number;
    yMeters: number;
    segmentLength: number;
  }[];
}

/**
 * ============================================================================
 * KALKULATOR GEOMETRI SPASIAL DESA (ALGORITMA SHOELACE & HAVERSINE)
 * ============================================================================
 * Menghitung luas permukaan tanah (m² & Ha) secara presisi menggunakan
 * Algoritma Shoelace berbasis proyeksi lokal / Geodesik dan menghitung
 * keliling/jarak batas saksi menggunakan Formula Haversine.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Menghitung luas poligon tanah berbasis Algoritma Shoelace (Gauss Area Formula)
 * @param coordinates Array titik koordinat GPS [lat, lng]
 */
export function calculatePolygonAreaShoelace(coordinates: [number, number][]): PolygonAreaResult {
  if (!coordinates || coordinates.length < 3) {
    return {
      areaSqM: 0,
      areaHectares: 0,
      perimeterMeters: 0,
      formattedAreaSqM: '0 m²',
      formattedAreaHectares: '0 Ha',
      stepByStepDetails: []
    };
  }

  // 1. Tentukan titik pusat (origin) proyeksi planar lokal
  const centerLat = coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length;
  const centerLng = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  const radCenterLat = toRad(centerLat);

  // 2. Proyeksikan koordinat GPS (lat, lng) ke Kartesian planar lokal (x, y dalam meter)
  const planarPoints: { x: number; y: number; lat: number; lng: number }[] = coordinates.map((coord) => {
    const lat = coord[0];
    const lng = coord[1];
    const x = toRad(lng - centerLng) * EARTH_RADIUS_METERS * Math.cos(radCenterLat);
    const y = toRad(lat - centerLat) * EARTH_RADIUS_METERS;
    return { x, y, lat, lng };
  });

  // 3. Terapkan Algoritma Shoelace
  let shoelaceSum = 0;
  let totalPerimeter = 0;
  const stepByStepDetails: PolygonAreaResult['stepByStepDetails'] = [];

  const n = planarPoints.length;
  for (let i = 0; i < n; i++) {
    const current = planarPoints[i];
    const nextIdx = (i + 1) % n;
    const next = planarPoints[nextIdx];

    // Shoelace cross product: (X_i * Y_i+1) - (X_i+1 * Y_i)
    const crossProduct = current.x * next.y - next.x * current.y;
    shoelaceSum += crossProduct;

    // Hitung panjang segmen batas menggunakan Haversine
    const segLength = calculateHaversineDistance(current.lat, current.lng, next.lat, next.lng);
    totalPerimeter += segLength;

    stepByStepDetails.push({
      pointIndex: i + 1,
      coord: { lat: current.lat, lng: current.lng },
      xMeters: Math.round(current.x * 100) / 100,
      yMeters: Math.round(current.y * 100) / 100,
      segmentLength: Math.round(segLength * 100) / 100
    });
  }

  const rawAreaSqM = Math.abs(shoelaceSum) / 2;
  const areaSqM = Math.round(rawAreaSqM * 100) / 100; // Pembulatan 2 desimal
  const areaHectares = Math.round((areaSqM / 10000) * 10000) / 10000;
  const perimeterMeters = Math.round(totalPerimeter * 100) / 100;

  return {
    areaSqM,
    areaHectares,
    perimeterMeters,
    formattedAreaSqM: `${areaSqM.toLocaleString('id-ID')} m²`,
    formattedAreaHectares: `${areaHectares.toLocaleString('id-ID')} Ha`,
    stepByStepDetails
  };
}

/**
 * Menentukan arah mata angin segmen batas tanah (Utara, Selatan, Timur, Barat)
 * berdasarkan sudut azimuth/bearing dari dua titik koordinat
 */
export function getBoundaryDirection(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): 'UTARA' | 'SELATAN' | 'TIMUR' | 'BARAT' {
  const dLng = toRad(endLng - startLng);
  const lat1 = toRad(startLat);
  const lat2 = toRad(endLat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360; // Normalize to 0-360

  if (bearing >= 315 || bearing < 45) {
    return 'UTARA';
  } else if (bearing >= 45 && bearing < 135) {
    return 'TIMUR';
  } else if (bearing >= 135 && bearing < 225) {
    return 'SELATAN';
  } else {
    return 'BARAT';
  }
}

/**
 * Menentukan arah mata angin 8 penjuru angin (Utara, Timur Laut, Timur, Tenggara, dll)
 * berbasis Azimuth Geodesik
 */
export function getBoundary8Direction(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): 'Utara' | 'Timur Laut' | 'Timur' | 'Tenggara' | 'Selatan' | 'Barat Daya' | 'Barat' | 'Barat Laut' {
  const dLng = toRad(endLng - startLng);
  const lat1 = toRad(startLat);
  const lat2 = toRad(endLat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360; // Normalize to 0-360

  if (bearing >= 337.5 || bearing < 22.5) return 'Utara';
  if (bearing >= 22.5 && bearing < 67.5) return 'Timur Laut';
  if (bearing >= 67.5 && bearing < 112.5) return 'Timur';
  if (bearing >= 112.5 && bearing < 157.5) return 'Tenggara';
  if (bearing >= 157.5 && bearing < 202.5) return 'Selatan';
  if (bearing >= 202.5 && bearing < 247.5) return 'Barat Daya';
  if (bearing >= 247.5 && bearing < 292.5) return 'Barat';
  return 'Barat Laut';
}

/**
 * Menghitung Tagihan PBB-P2 (Pajak Bumi dan Bangunan Perdesaan & Perkotaan)
 * Berdasarkan UU HKPD / Regulasi Pajak Daerah Kabupaten Batang Hari
 */
export interface PbbTaxCalculation {
  njopLandTotal: number;
  njopBuildingTotal: number;
  njopTotal: number;
  njoptkp: number; // NJOP Tidak Kena Pajak (Standard Rp 10.000.000)
  njopKenaPajak: number;
  taxRatePercent: number; // 0.1% untuk NJOP < Rp 1M, 0.2% untuk >= Rp 1M
  taxAmount: number;
}

export function calculatePbbTax(
  landAreaSqM: number,
  njopLandPerSqM: number,
  buildingAreaSqM: number = 0,
  njopBuildingPerSqM: number = 0,
  njoptkp: number = 10000000
): PbbTaxCalculation {
  const njopLandTotal = Math.round(landAreaSqM * njopLandPerSqM);
  const njopBuildingTotal = Math.round(buildingAreaSqM * njopBuildingPerSqM);
  const njopTotal = njopLandTotal + njopBuildingTotal;

  const njopKenaPajak = Math.max(0, njopTotal - njoptkp);
  const taxRatePercent = njopKenaPajak >= 1000000000 ? 0.2 : 0.1;
  const taxAmount = Math.round((njopKenaPajak * taxRatePercent) / 100);

  return {
    njopLandTotal,
    njopBuildingTotal,
    njopTotal,
    njoptkp,
    njopKenaPajak,
    taxRatePercent,
    taxAmount
  };
}
