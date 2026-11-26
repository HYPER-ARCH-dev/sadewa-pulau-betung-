/**
 * ============================================================================
 * OPEN LOCATION CODE (PLUS CODE) DECODER & VALIDATOR
 * ============================================================================
 * Implementasi matematis standar terbuka Open Location Code (Apache 2.0)
 * untuk mengonversi Plus Code penuh maupun pendek (dengan koordinat acuan
 * tenant aktif) menjadi koordinat [lat, lng] tanpa memanggil API berbayar.
 */

const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PADDING_CHARACTER = '0';
const PAIR_CODE_LENGTH = 10;
const GRID_COLUMNS = 4;
const GRID_ROWS = 5;

export interface DecodedPlusCode {
  fullCode: string;
  latitude: number;
  longitude: number;
}

function encode4CharPrefix(lat: number, lng: number): string {
  let aLat = Math.min(90, Math.max(-90, lat)) + 90;
  let aLng = lng + 180;
  let code = '';

  const latDigit1 = Math.min(19, Math.max(0, Math.floor(aLat / 20)));
  const lngDigit1 = Math.min(19, Math.max(0, Math.floor(aLng / 20)));
  code += CODE_ALPHABET[latDigit1] + CODE_ALPHABET[lngDigit1];

  aLat -= latDigit1 * 20;
  aLng -= lngDigit1 * 20;

  const latDigit2 = Math.min(19, Math.max(0, Math.floor(aLat)));
  const lngDigit2 = Math.min(19, Math.max(0, Math.floor(aLng)));
  code += CODE_ALPHABET[latDigit2] + CODE_ALPHABET[lngDigit2];

  return code;
}

export function isValidPlusCodeFormat(rawCode: string): boolean {
  const clean = rawCode.trim().toUpperCase().split(/\s+/)[0] || '';
  if (!clean.includes(SEPARATOR)) return false;
  const parts = clean.split(SEPARATOR);
  if (parts.length !== 2) return false;
  const [before, after] = parts;
  if (before.length < 2 || before.length > SEPARATOR_POSITION || before.length % 2 !== 0) {
    return false;
  }
  if (after.length < 2 || after.length > 5) {
    return false;
  }
  const combined = before + after;
  for (const ch of combined) {
    if (ch !== PADDING_CHARACTER && !CODE_ALPHABET.includes(ch)) {
      return false;
    }
  }
  return true;
}

function decodeFullPlusCode(fullCode: string): { latCenter: number; lngCenter: number } {
  const clean = fullCode.replace(SEPARATOR, '').replace(/0+$/, '').toUpperCase();
  let lat = -90.0;
  let lng = -180.0;
  let latPlace = 400.0;
  let lngPlace = 400.0;

  const pairLen = Math.min(clean.length, PAIR_CODE_LENGTH);
  for (let i = 0; i < pairLen; i += 2) {
    latPlace /= 20;
    lngPlace /= 20;
    const latIdx = CODE_ALPHABET.indexOf(clean[i]);
    const lngIdx = CODE_ALPHABET.indexOf(clean[i + 1]);
    if (latIdx === -1 || lngIdx === -1) {
      throw new Error(`Karakter Plus Code tidak valid pada "${fullCode}".`);
    }
    lat += latIdx * latPlace;
    lng += lngIdx * lngPlace;
  }

  let latHeight = latPlace;
  let lngWidth = lngPlace;

  for (let i = PAIR_CODE_LENGTH; i < clean.length; i++) {
    const val = CODE_ALPHABET.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Karakter grid Plus Code tidak valid pada "${fullCode}".`);
    }
    const row = Math.floor(val / GRID_COLUMNS);
    const col = val % GRID_COLUMNS;
    latHeight /= GRID_ROWS;
    lngWidth /= GRID_COLUMNS;
    lat += row * latHeight;
    lng += col * lngWidth;
  }

  return {
    latCenter: lat + latHeight / 2,
    lngCenter: lng + lngWidth / 2
  };
}

/**
 * Mengonversi Plus Code penuh (contoh: 6PC5CCQJ+P7R) atau Plus Code pendek
 * (contoh: CCQJ+P7R dengan acuan koordinat desa aktif) menjadi [lat, lng].
 */
export function decodePlusCodeToLatLng(
  rawCode: string,
  referenceLat?: number | null,
  referenceLng?: number | null
): DecodedPlusCode {
  const token = rawCode.trim().toUpperCase().split(/\s+/)[0] || '';
  if (!isValidPlusCodeFormat(token)) {
    throw new Error('Format Plus Code tidak valid (contoh: CCQJ+P7R atau 6PC5CCQJ+P7R).');
  }

  const plusIdx = token.indexOf(SEPARATOR);
  // Sudah kode penuh (8 karakter sebelum tanda +)
  if (plusIdx === SEPARATOR_POSITION) {
    const decoded = decodeFullPlusCode(token);
    return {
      fullCode: token,
      latitude: Number(decoded.latCenter.toFixed(6)),
      longitude: Number(decoded.lngCenter.toFixed(6))
    };
  }

  // Kode pendek (missing prefix): wajib punya referensi wilayah tenant aktif
  if (
    typeof referenceLat !== 'number' ||
    typeof referenceLng !== 'number' ||
    !Number.isFinite(referenceLat) ||
    !Number.isFinite(referenceLng)
  ) {
    throw new Error(
      'Plus Code pendek memerlukan koordinat acuan desa aktif atau gunakan Plus Code penuh 11 karakter.'
    );
  }

  const missingChars = SEPARATOR_POSITION - plusIdx;
  if (missingChars !== 4) {
    throw new Error('Saat ini hanya mendukung Plus Code pendek 4-prefix (contoh: CCQJ+P7R) atau Plus Code penuh.');
  }

  const initialPrefix = encode4CharPrefix(referenceLat, referenceLng);
  const candidate = `${initialPrefix}${token}`;
  const decoded = decodeFullPlusCode(candidate);

  let lat = decoded.latCenter;
  let lng = decoded.lngCenter;
  const resolution = 1.0;
  const halfResolution = resolution / 2;

  if (referenceLat + halfResolution < lat) lat -= resolution;
  else if (referenceLat - halfResolution > lat) lat += resolution;

  if (referenceLng + halfResolution < lng) lng -= resolution;
  else if (referenceLng - halfResolution > lng) lng += resolution;

  const adjustedPrefix = encode4CharPrefix(lat, lng);
  const finalFullCode = `${adjustedPrefix}${token}`;
  const finalDecoded = decodeFullPlusCode(finalFullCode);

  return {
    fullCode: finalFullCode,
    latitude: Number(finalDecoded.latCenter.toFixed(6)),
    longitude: Number(finalDecoded.lngCenter.toFixed(6))
  };
}
