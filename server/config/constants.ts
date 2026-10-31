import path from 'path';

/**
 * KONFIGURASI PUSAT SERVER
 * Keyword: SESSION_SECRET, PRIVATE_UPLOAD, BACKUP
 */

export const SERVER_CONFIG = {
  PORT: 3000,
  BASE_UPLOAD_DIR: path.join(process.cwd(), 'uploads'),
  PUBLIC_UPLOAD_DIR: path.join(process.cwd(), 'uploads', 'public'),
  PRIVATE_UPLOAD_DIR: path.join(process.cwd(), 'uploads', 'private'),
  BACKUP_DIR: path.join(process.cwd(), 'data', 'backups'),
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  VILLAGE_CODE: 'PB-PMY',
  ALLOWED_MIME_TYPES: {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
  } as Record<string, string>
};
