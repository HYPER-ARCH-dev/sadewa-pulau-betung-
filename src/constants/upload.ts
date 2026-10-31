/**
 * KONSTANTA BATAS DAN FORMAT UPLOAD BERKAS
 * Keyword: PRIVATE_UPLOAD, UPLOAD_CONFIG
 */

export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf'],
  ALLOWED_ALL_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
  HELPER_TEXT: 'Maksimal 5MB (Format: JPG, PNG, WEBP, atau PDF)'
} as const;
