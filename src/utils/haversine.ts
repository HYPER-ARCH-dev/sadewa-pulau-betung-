import { parseSmartCoordinates, parseSingleCoordinateComponent } from './coordinateParser';

/**
 * Utility Haversine Formula untuk kalkulasi jarak riil antara titik koordinat GPS
 * pada sistem administrasi pertanahan / Sporadik SADEWA.
 */

export interface CoordinatePoint {
  lat: number;
  lng: number;
}

/**
 * Konversi derajat ke radian
 */
export const toRad = (angle: number): number => {
  return (angle * Math.PI) / 180;
};

/**
 * Menghitung jarak riil (dalam meter) antara dua titik koordinat (lat1, lon1) dan (lat2, lon2)
 * dengan radius bumi R = 6,371,000 meter menggunakan formula Haversine.
 *
 * Formula:
 * - dLat = toRad(lat2 - lat1)
 * - dLon = toRad(lon2 - lon1)
 * - a = sin²(dLat/2) + cos(lat1) * cos(lat2) * sin²(dLon/2)
 * - c = 2 * atan2(sqrt(a), sqrt(1-a))
 * - distance = R * c (dibulatkan ke 2 desimal)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius bumi dalam meter

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Dibulatkan ke 2 desimal
  return Math.round(distance * 100) / 100;
}

/**
 * Ekstraksi koordinat valid dari objek batas tanah dengan Smart Coordinate Parser (DMS & Desimal)
 */
export function extractBoundaryCoordinate(boundary: any): CoordinatePoint | null {
  if (!boundary) return null;

  // 1. Cek jika ada coordinateText gabungan (DMS atau Desimal)
  if (boundary.coordinateText && typeof boundary.coordinateText === 'string') {
    const parsed = parseSmartCoordinates(boundary.coordinateText);
    if (parsed && parsed.isValid && (parsed.lat !== 0 || parsed.lng !== 0)) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  }

  let latVal = boundary.lat !== undefined && boundary.lat !== '' ? boundary.lat : boundary.latitude;
  let lngVal = boundary.lng !== undefined && boundary.lng !== '' ? boundary.lng : boundary.longitude;

  // 2. Jika latVal atau lngVal adalah angka numerik langsung
  if (typeof latVal === 'number' && typeof lngVal === 'number') {
    if (!isNaN(latVal) && !isNaN(lngVal) && (latVal !== 0 || lngVal !== 0)) {
      return { lat: latVal, lng: lngVal };
    }
  }

  // 3. Jika latVal / lngVal berupa string (mungkin DMS atau Desimal)
  if (latVal !== undefined && lngVal !== undefined && latVal !== '' && lngVal !== '') {
    const latComp = parseSingleCoordinateComponent(String(latVal));
    const lngComp = parseSingleCoordinateComponent(String(lngVal));

    if (latComp && lngComp) {
      const lat = latComp.value;
      const lng = lngComp.value;
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

/**
 * Logika Pemetaan Array Berkelanjutan (Looping):
 * - Jarak pada item indeks i dihitung dari koordinat index [i] ke koordinat index [i + 1].
 * - Untuk item terakhir (index terakhir), jarak dihitung dari koordinat item terakhir
 *   kembali ke koordinat item pertama (indeks 0) guna menutup siklus poligon bidang tanah.
 *
 * @param list Daftar batas tanah
 * @param forceIndices Indeks spesifik yang wajib dihitung ulang (opsional)
 */
export function recalculateBoundaryLoopDistances<T extends Record<string, any>>(
  list: T[],
  forceIndices?: number[]
): T[] {
  if (!list || list.length < 2) return list;

  const n = list.length;
  const result: any[] = list.map((item) => ({ ...item }));

  for (let i = 0; i < n; i++) {
    // Jika forceIndices dispesifikasikan, hanya proses jika indeks ada dalam daftar
    if (forceIndices && !forceIndices.includes(i)) {
      continue;
    }

    const currentCoord = extractBoundaryCoordinate(result[i]);
    const nextIdx = i === n - 1 ? 0 : i + 1;
    const nextCoord = extractBoundaryCoordinate(result[nextIdx]);

    if (currentCoord && nextCoord) {
      const distance = calculateHaversineDistance(
        currentCoord.lat,
        currentCoord.lng,
        nextCoord.lat,
        nextCoord.lng
      );

      result[i].length = distance.toString();
      result[i].panjang = distance.toString();
      result[i].autoDistance = distance;
      result[i].isManualOverride = false;
    }
  }

  return result as T[];
}
