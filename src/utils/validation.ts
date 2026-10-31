/**
 * UTILITY VALIDATION
 * Validasi format data kependudukan, nomor tracking, dan ukuran berkas.
 * Keyword: VALIDATION, TRACKING_CODE, PRIVATE_UPLOAD
 */

import { UPLOAD_CONFIG } from '../constants/upload';

/**
 * Validasi NIK 16 digit angka
 */
export function isValidNik(nik: string): boolean {
  const clean = nik.replace(/\D/g, '');
  return clean.length === 16;
}

/**
 * Validasi format kode resi / nomor tracking
 * Format: REQ-PB-YYYY-XXX atau ADU-PB-YYYY-XXX
 * Keyword: TRACKING_CODE
 */
export function isValidTrackingCode(code: string): boolean {
  if (!code) return false;
  const regex = /^(REQ|ADU)-PB-\d{4}-\w+$/i;
  return regex.test(code.trim());
}

/**
 * Validasi batas ukuran berkas upload
 * Keyword: PRIVATE_UPLOAD
 */
export function isValidFileSize(sizeInBytes: number): boolean {
  return sizeInBytes <= UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES;
}

/**
 * Validasi tipe berkas MIME upload yang diperbolehkan
 * Keyword: PRIVATE_UPLOAD
 */
export function isValidFileType(mimeType: string): boolean {
  return (UPLOAD_CONFIG.ALLOWED_ALL_TYPES as readonly string[]).includes(mimeType);
}
