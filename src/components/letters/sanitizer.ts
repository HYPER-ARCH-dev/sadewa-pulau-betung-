import { ServiceRequest } from '../../types';

/**
 * Sanitizes input text from citizen or database to guarantee that:
 * 1. Internal metadata, requirement lists, helper text, and JSON structures never leak.
 * 2. Raw executable HTML tags (<script>, <iframe>, etc.) are stripped while text brackets/characters are safely preserved.
 * 3. Leaked placeholder patterns like Date<...> or [pelengkap syarat...] are eliminated.
 * 
 * Keyword: OFFICIAL_LETTER, SANITIZER, VALIDATION
 */
export function sanitizeText(val: any, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    // Never render raw objects or JSON
    return fallback;
  }
  let str = String(val).trim();

  // Strip JSON structures like [Data: {...}] or raw JSON objects
  str = str.replace(/\[Data:\s*\{[\s\S]*?\}\]/gi, '');
  str = str.replace(/\{"[\s\S]*?"\s*:\s*[\s\S]*?\}/gi, '');

  // Strip leaked internal artifact / debug strings like Date<mijik"> or Date<...>
  str = str.replace(/Date\s*<[^>]*>/gi, '');
  str = str.replace(/<mijik"[^>]*>/gi, '');

  // Strip leaked helper/requirement tags like [pelengkap syarat...] or [syarat...]
  str = str.replace(/\[\s*pelengkap\s+syarat[^\]]*\]/gi, '');
  str = str.replace(/\[\s*syarat\s+[^\]]*\]/gi, '');
  str = str.replace(/\[\s*Data\s*\]/gi, '');
  str = str.replace(/\[object Object\]/gi, '');

  // Strip known form helper text prefixes if citizen or system copied the placeholder
  if (str.toLowerCase().startsWith('contoh:')) {
    return fallback;
  }

  // Strip dangerous HTML/executable markup tags
  str = str.replace(/<\/?(script|style|iframe|object|embed|applet|meta|link|base|form|input|button)[^>]*>/gi, '');

  // Normalize quotes and duplicate whitespace
  str = str.replace(/\s+/g, ' ').trim();

  return str || fallback;
}

/**
 * Extracts pure, authentic citizen purpose for the letter.
 * Guarantees that neither requirements lists, helper texts, JSON objects,
 * nor internal IDs leak into the official letter.
 * 
 * Keyword: OFFICIAL_LETTER, CITIZEN_PURPOSE
 */
export function getCleanPurpose(
  request: ServiceRequest,
  defaultPurpose: string
): string {
  const rawNotes = request.notes || '';
  const formPurpose = request.formData?.purpose || request.formData?.police_target || '';

  const cleanedNotes = sanitizeText(rawNotes);
  const cleanedFormPurpose = sanitizeText(formPurpose);

  let candidate = '';
  if (cleanedNotes && !cleanedNotes.toLowerCase().startsWith('contoh:')) {
    candidate = cleanedNotes;
  } else if (cleanedFormPurpose && !cleanedFormPurpose.toLowerCase().startsWith('contoh:')) {
    candidate = cleanedFormPurpose;
  }

  // Verify candidate is meaningful (not purely leftover brackets/punctuation/quotes)
  if (!candidate || candidate.length === 0 || /^[[\]{}()<>"'\s,.-]+$/.test(candidate)) {
    return defaultPurpose;
  }

  // Constrain maximum length to prevent page overflow on A4 paper
  if (candidate.length > 280) {
    candidate = candidate.substring(0, 280).trim() + '...';
  }

  return candidate;
}

/**
 * Mengembalikan NIK warga secara utuh 16 digit angka TANPA SENSOR BINTANG (*)
 * untuk keperluan naskah dokumen surat dinas/fisik privat yang diajukan ke instansi birokrasi lain.
 * FIX 4: Hapus rekonstruksi NIK (jangan mengisi digit tengah dengan '120590').
 * Jika NIK 16 digit utuh tidak tersedia, kembalikan string kosong.
 * 
 * Keyword: OFFICIAL_LETTER, UNMASKED_NIK, PDP_COMPLIANCE
 */
export function getUnmaskedOfficialNik(request: Partial<ServiceRequest>): string {
  // 1. Cek properti citizenNik jika sudah 16 digit utuh tanpa tanda bintang
  if (request.citizenNik && !request.citizenNik.includes('*') && request.citizenNik.replace(/[^0-9]/g, '').length >= 16) {
    return request.citizenNik.replace(/[^0-9]/g, '').slice(0, 16);
  }

  // 2. Cek di formData
  const formNik = request.formData?.nik || request.formData?.citizen_nik;
  if (formNik && typeof formNik === 'string' && !formNik.includes('*') && formNik.replace(/[^0-9]/g, '').length >= 16) {
    return formNik.replace(/[^0-9]/g, '').slice(0, 16);
  }

  // 3. Jika citizenNik ada tapi bertanda bintang, atau hanya ada citizenNikMasked
  // FIX 4: JANGAN REKONSTRUKSI. Kembalikan string kosong agar modal cetak memberikan peringatan.
  const rawCandidate = request.citizenNik || request.citizenNikMasked || '';
  if (rawCandidate) {
    const clean = rawCandidate.trim();
    if (clean.includes('*')) {
      return '';
    }
    const digitsOnly = clean.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 16) return digitsOnly.slice(0, 16);
  }

  return '';
}
