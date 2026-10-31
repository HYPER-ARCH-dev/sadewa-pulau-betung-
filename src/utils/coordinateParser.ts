/**
 * Smart Coordinate Parser untuk Sistem Administrasi Desa Pulau Betung (SADEWA).
 * 
 * Mendeteksi dan mengonversi format koordinat secara otomatis:
 * 1. Format Desimal Murni (contoh: -1.642100, 103.385100)
 * 2. Format Degrees Minutes Seconds (DMS) (contoh: 1°38'31.56"S, 103°23'06.36"E)
 * 3. Format Degrees Decimal Minutes (DDM) (contoh: 1° 38.526' S, 103° 23.106' E)
 * 4. Arah mata angin Internasional (N, S, E, W) & Indonesia (LU, LS, BT, BB)
 * 5. Berbagai variasi simbol derajat, menit, detik (° º ˚ ' ’ ′ " ” ″)
 * 6. Tahan crash (anti-NaN) dengan fallback aman.
 */

export interface ParsedCoordinateResult {
  lat: number;
  lng: number;
  isValid: boolean;
  isDmsOrConverted: boolean;
  originalText: string;
  formattedDecimal: string;
}

/**
 * Normalisasi karakter simbol pada string koordinat
 */
export function normalizeCoordinateCharacters(raw: string): string {
  if (!raw) return '';
  let normalized = raw
    // Derajat
    .replace(/[º˚^]/g, '°')
    // Menit
    .replace(/[’′`]/g, "'")
    // Detik
    .replace(/[”″]|''/g, '"')
    // Bersihkan karakter non-standar tak terlihat
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  // Konversi koma desimal pada detik / menit (contoh: 31,56" menjadi 31.56")
  normalized = normalized.replace(
    /(\d+),(\d+)(?=\s*["']|\s*[NSEWnsew]|\s*(?:LS|LU|BT|BB))/gi,
    (_, p1, p2) => `${p1}.${p2}`
  );

  return normalized;
}

/**
 * Parsing satu komponen koordinat (Latitude atau Longitude)
 * Mengonversi Desimal murni atau DMS/DDM ke format desimal murni (float).
 */
export function parseSingleCoordinateComponent(rawComponent: string): {
  value: number;
  direction?: 'N' | 'S' | 'E' | 'W';
  isDms: boolean;
} | null {
  if (!rawComponent) return null;

  const text = normalizeCoordinateCharacters(rawComponent).trim();
  if (!text) return null;

  // Deteksi arah mata angin
  let direction: 'N' | 'S' | 'E' | 'W' | undefined;
  let isNegative = false;

  // Cek jika diawali tanda minus
  if (text.startsWith('-')) {
    isNegative = true;
  }

  // Bersihkan tanda kutip atau derajat di ujung saat cek regex arah
  const cleanEnds = text.replace(/["'°\s]/g, '');

  // Deteksi Lintang Selatan (S / LS) atau Bujur Barat (W / BB)
  if (
    /\b(LS|SELATAN|SOUTH)\b/i.test(text) ||
    /[S]$/i.test(cleanEnds) ||
    /^[S]/i.test(cleanEnds) ||
    /LS$/i.test(cleanEnds)
  ) {
    direction = 'S';
    isNegative = true;
  } else if (
    /\b(LU|UTARA|NORTH)\b/i.test(text) ||
    /[N]$/i.test(cleanEnds) ||
    /^[N]/i.test(cleanEnds) ||
    /LU$/i.test(cleanEnds)
  ) {
    direction = 'N';
    isNegative = false;
  } else if (
    /\b(BB|BARAT|WEST)\b/i.test(text) ||
    /[W]$/i.test(cleanEnds) ||
    /^[W]/i.test(cleanEnds) ||
    /BB$/i.test(cleanEnds)
  ) {
    direction = 'W';
    isNegative = true;
  } else if (
    /\b(BT|TIMUR|EAST)\b/i.test(text) ||
    /[E]$/i.test(cleanEnds) ||
    /^[E]/i.test(cleanEnds) ||
    /BT$/i.test(cleanEnds)
  ) {
    direction = 'E';
    isNegative = false;
  }

  // 1. KASUS DESIMAL MURNI:
  // Cek apakah string hanya berisi sebuah angka desimal (dengan atau tanpa penanda arah)
  // Contoh: "-1.642100" atau "103.385100" atau "1.6421 S" atau "E 103.3851"
  const isPureDecimalCandidate =
    /^[+-]?\d+(\.\d+)?\s*(?:[NSEW]|LS|LU|BT|BB)?$/i.test(text) ||
    /^(?:[NSEW]|LS|LU|BT|BB)?\s*[+-]?\d+(\.\d+)?$/i.test(text);

  if (isPureDecimalCandidate && !text.includes('°') && !text.includes("'") && !text.includes('"')) {
    const numMatch = text.match(/[+-]?\d+(?:\.\d+)?/);
    if (numMatch) {
      const num = parseFloat(numMatch[0]);
      if (!isNaN(num) && isFinite(num)) {
        const finalVal = isNegative ? -Math.abs(num) : num;
        return {
          value: Number(finalVal.toFixed(7)),
          direction,
          isDms: false
        };
      }
    }
  }

  // 2. KASUS DMS / DDM (Degrees Minutes Seconds / Degrees Decimal Minutes)
  // Bersihkan penanda arah dari teks untuk mengekstrak angka Derajat, Menit, Detik
  const textWithoutWords = text
    .replace(/\b(LS|LU|BT|BB|SELATAN|UTARA|TIMUR|BARAT|SOUTH|NORTH|EAST|WEST)\b/gi, ' ')
    .replace(/[NSEWnsew°'"]/g, ' ');

  // Cari semua blok angka (integer atau float)
  const numbers = textWithoutWords.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) {
    return null;
  }

  let deg = 0;
  let min = 0;
  let sec = 0;
  let isDms = false;

  if (numbers.length === 1) {
    deg = parseFloat(numbers[0]);
  } else if (numbers.length === 2) {
    // Format DDM (Derajat + Menit Desimal), contoh: 1° 38.526'
    deg = parseFloat(numbers[0]);
    min = parseFloat(numbers[1]);
    isDms = true;
  } else if (numbers.length >= 3) {
    // Format DMS (Derajat + Menit + Detik), contoh: 1° 38' 31.56"
    deg = parseFloat(numbers[0]);
    min = parseFloat(numbers[1]);
    sec = parseFloat(numbers[2]);
    isDms = true;
  }

  if (isNaN(deg) || isNaN(min) || isNaN(sec)) {
    return null;
  }

  let decimalVal = Math.abs(deg) + (min / 60) + (sec / 3600);
  if (isNegative) {
    decimalVal = -decimalVal;
  }

  if (isNaN(decimalVal) || !isFinite(decimalVal)) {
    return null;
  }

  return {
    value: Number(decimalVal.toFixed(7)),
    direction,
    isDms: isDms || text.includes('°') || text.includes("'") || text.includes('"')
  };
}

/**
 * Memecah string gabungan koordinat menjadi bagian Latitude dan Longitude
 */
export function splitCoordinatePair(raw: string): [string, string] | null {
  const text = normalizeCoordinateCharacters(raw).trim();
  if (!text) return null;

  // 1. Pemisah Eksplisit (koma, titik koma, garis miring)
  if (text.includes(',') || text.includes(';') || text.includes('/')) {
    // Perhatikan: jika ada pemisah koma atau titik koma
    const sep = text.includes(';') ? ';' : (text.includes(',') ? ',' : '/');
    const parts = text.split(sep);
    if (parts.length >= 2) {
      const part1 = parts[0].trim();
      const part2 = parts.slice(1).join(sep).trim();
      if (part1 && part2) return [part1, part2];
    }
  }

  // 2. Pemisah Spasi dengan penanda arah mata angin di tengah
  // Contoh: 1°38'31.56"S 103°23'6.36"E atau 1°38'31.56"LS 103°23'6.36"BT
  const directionalSplit = text.match(/^(.+?(?:[NSEW]|LS|LU|BT|BB))\s+(.+)$/i);
  if (directionalSplit && directionalSplit[1] && directionalSplit[2]) {
    return [directionalSplit[1].trim(), directionalSplit[2].trim()];
  }

  // 3. Pemisah Spasi untuk dua angka desimal (contoh: -1.642100 103.385100)
  const decimalSpaceSplit = text.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)$/);
  if (decimalSpaceSplit && decimalSpaceSplit[1] && decimalSpaceSplit[2]) {
    return [decimalSpaceSplit[1].trim(), decimalSpaceSplit[2].trim()];
  }

  return null;
}

/**
 * Smart Coordinate Parser Utama:
 * Mengambil string koordinat dari input form user dalam format apapun,
 * dan menghasilkan koordinat valid { lat, lng } dengan proteksi anti-crash (NaN).
 */
export function parseSmartCoordinates(input: string | undefined | null): ParsedCoordinateResult | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const pair = splitCoordinatePair(trimmed);
  if (!pair) {
    return null;
  }

  const comp1 = parseSingleCoordinateComponent(pair[0]);
  const comp2 = parseSingleCoordinateComponent(pair[1]);

  if (!comp1 || !comp2) {
    return null;
  }

  let lat = comp1.value;
  let lng = comp2.value;
  let isDms = comp1.isDms || comp2.isDms;

  // Koreksi posisi jika user memasukkan Bujur (E/W) terlebih dahulu baru Lintang (N/S)
  if ((comp1.direction === 'E' || comp1.direction === 'W') && (comp2.direction === 'N' || comp2.direction === 'S')) {
    lat = comp2.value;
    lng = comp1.value;
  } else if (Math.abs(comp1.value) > 90 && Math.abs(comp2.value) <= 90) {
    // Nilai Lintang bumi tidak mungkin > 90 derajat, jadi jika comp1 > 90 kemungkinan itu Longitude
    lat = comp2.value;
    lng = comp1.value;
  }

  // Validasi batas geografis bumi
  // Latitude: -90 hingga 90
  // Longitude: -180 hingga 180
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return {
    lat: Number(lat.toFixed(7)),
    lng: Number(lng.toFixed(7)),
    isValid: true,
    isDmsOrConverted: isDms,
    originalText: trimmed,
    formattedDecimal: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  };
}

/**
 * Helper format aman untuk menampilkan koordinat desimal
 * Jika gagal di-parse, kembalikan teks asli atau string kosong tanpa crash
 */
export function safeFormatCoordinate(input: any): string {
  if (!input) return '';
  if (typeof input === 'object' && input.lat !== undefined && input.lng !== undefined) {
    return `${Number(input.lat).toFixed(6)}, ${Number(input.lng).toFixed(6)}`;
  }
  const parsed = parseSmartCoordinates(String(input));
  if (parsed && parsed.isValid) {
    return parsed.formattedDecimal;
  }
  return String(input).trim();
}
