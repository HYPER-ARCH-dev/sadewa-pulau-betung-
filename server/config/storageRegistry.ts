import path from 'path';

export type StorageVisibility = 'public' | 'private';

export type StorageModuleKey =
  | 'village-profile'
  | 'posyandu-kia'
  | 'news'
  | 'officials'
  | 'projects'
  | 'media-public'
  | 'complaints'
  | 'citizen-letters'
  | 'attendance-selfie'
  | 'general';

export interface StorageModuleDefinition {
  key: StorageModuleKey;
  label: string;
  visibility: StorageVisibility;
  subfolder: string;
  description: string;
}

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const RUNTIME_STORAGE_ROOT = isServerless ? path.join('/tmp', 'sadewa') : process.cwd();

export const STORAGE_PATHS = {
  IS_SERVERLESS: isServerless,
  RUNTIME_ROOT: RUNTIME_STORAGE_ROOT,
  DATA_DIR: path.join(RUNTIME_STORAGE_ROOT, 'data'),
  JSON_DB_FILE: path.join(RUNTIME_STORAGE_ROOT, 'data', 'pulau_betung_db.json'),
  BACKUP_DIR: path.join(RUNTIME_STORAGE_ROOT, 'data', 'backups'),
  SYNC_HASH_FILE: path.join(RUNTIME_STORAGE_ROOT, 'data', 'sync-hashes.json'),
  SYNC_FAILURES_FILE: path.join(RUNTIME_STORAGE_ROOT, 'data', 'sync-failures.json'),
  LOGS_DIR: path.join(RUNTIME_STORAGE_ROOT, 'logs'),
  FAIL_LOG_FILE: path.join(RUNTIME_STORAGE_ROOT, 'logs', 'dual-write-failures.log'),
  PUBLIC_UPLOADS_DIR: isServerless
    ? path.join(RUNTIME_STORAGE_ROOT, 'public-uploads')
    : path.join(process.cwd(), 'public', 'uploads'),
  LEGACY_PUBLIC_UPLOAD_DIR: path.join(RUNTIME_STORAGE_ROOT, 'uploads', 'public'),
  PRIVATE_UPLOADS_DIR: path.join(RUNTIME_STORAGE_ROOT, 'uploads', 'private'),
  SUPABASE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'sadewa-uploads',
} as const;

export const STORAGE_MODULES: Record<StorageModuleKey, StorageModuleDefinition> = {
  'village-profile': {
    key: 'village-profile',
    label: 'Profil Desa & Branding',
    visibility: 'public',
    subfolder: 'profil-desa',
    description: 'Logo desa, lambang kabupaten, foto Kepala Desa, tanda tangan resmi, banner hero, dan branding portal.'
  },
  'posyandu-kia': {
    key: 'posyandu-kia',
    label: 'Posyandu & Kartu KIA',
    visibility: 'public',
    subfolder: 'posyandu-kia',
    description: 'Aset visual Posyandu dan logo khusus Kartu Identitas Anak (KIA).'
  },
  news: {
    key: 'news',
    label: 'Berita & Artikel Desa',
    visibility: 'public',
    subfolder: 'berita',
    description: 'Gambar sampul dan foto dokumentasi berita desa.'
  },
  officials: {
    key: 'officials',
    label: 'Aparatur & Perangkat Desa',
    visibility: 'public',
    subfolder: 'aparatur',
    description: 'Foto profil resmi Kepala Desa, perangkat, dan BPD.'
  },
  projects: {
    key: 'projects',
    label: 'Pembangunan Desa',
    visibility: 'public',
    subfolder: 'pembangunan',
    description: 'Dokumentasi foto progres 0%, 50%, dan 100% proyek infrastruktur.'
  },
  'media-public': {
    key: 'media-public',
    label: 'Galeri, UMKM, Potensi & Peta',
    visibility: 'public',
    subfolder: 'galeri-umkm',
    description: 'Foto produk UMKM, potensi alam, fasilitas desa, dan galeri kegiatan.'
  },
  complaints: {
    key: 'complaints',
    label: 'Pengaduan Masyarakat',
    visibility: 'public',
    subfolder: 'aduan',
    description: 'Lampiran aduan warga dan foto bukti penyelesaian tindak lanjut.'
  },
  'citizen-letters': {
    key: 'citizen-letters',
    label: 'Dokumen Rahasia Warga & Surat',
    visibility: 'private',
    subfolder: 'dokumen-warga',
    description: 'KTP, Kartu Keluarga, Akta Kematian, Buku Nikah, dan persyaratan permohonan surat (terproteksi).'
  },
  'attendance-selfie': {
    key: 'attendance-selfie',
    label: 'Selfie Absensi Perangkat',
    visibility: 'private',
    subfolder: 'absensi-selfie',
    description: 'Foto selfie verifikasi kehadiran perangkat desa (terproteksi).'
  },
  general: {
    key: 'general',
    label: 'Unggahan Umum',
    visibility: 'public',
    subfolder: 'umum',
    description: 'Berkas umum yang tidak termasuk kategori khusus.'
  }
};

const PRIVATE_FIELD_NAMES = new Set([
  'ktp',
  'selfie',
  'dokumen-surat',
  'dokumen',
  'persyaratan',
  'berkas-rahasia'
]);

const ALLOWED_SUBFOLDERS = new Set<string>(
  Object.values(STORAGE_MODULES).map((m) => m.subfolder)
);

export function normalizeStorageModuleKey(rawModule?: string | null): StorageModuleKey {
  if (!rawModule) return 'general';
  const normalized = String(rawModule).trim().toLowerCase() as StorageModuleKey;
  return Object.prototype.hasOwnProperty.call(STORAGE_MODULES, normalized) ? normalized : 'general';
}

export function isAllowedPrivateSubfolder(subfolder: string): boolean {
  return ALLOWED_SUBFOLDERS.has(subfolder);
}

export interface ResolvedStorageTarget {
  moduleKey: StorageModuleKey;
  visibility: StorageVisibility;
  isPrivate: boolean;
  subfolder: string;
  relativeObjectPath: string; // e.g. 'dokumen-warga/private-123.jpg'
  cloudObjectPath: string;    // e.g. 'private/dokumen-warga/private-123.jpg'
  localBaseDir: string;
  localTargetDir: string;
  localPublicUrl: string;     // e.g. '/uploads/berita/upload-123.jpg' or '/api/upload/private/dokumen-warga/private-123.jpg'
}

/**
 * Menentukan target folder lokal dan cloud berdasarkan modul & konteks server.
 * Privasi selalu ditentukan di sisi server (tidak dapat diturunkan ke public oleh payload client).
 */
export function resolveStorageTarget(params: {
  moduleKey?: string | null;
  fieldName?: string | null;
  reqPath?: string | null;
  fileName: string;
}): ResolvedStorageTarget {
  const requestedModule = normalizeStorageModuleKey(params.moduleKey);
  const moduleDef = STORAGE_MODULES[requestedModule];
  const fieldLower = String(params.fieldName || '').trim().toLowerCase();
  const pathLower = String(params.reqPath || '').trim().toLowerCase();

  const forcePrivateFromFieldOrPath =
    pathLower.includes('/ktp') ||
    pathLower.includes('/private') ||
    PRIVATE_FIELD_NAMES.has(fieldLower);

  let effectiveModule = moduleDef;
  if (forcePrivateFromFieldOrPath && moduleDef.visibility !== 'private') {
    effectiveModule =
      fieldLower === 'selfie'
        ? STORAGE_MODULES['attendance-selfie']
        : STORAGE_MODULES['citizen-letters'];
  }

  const isPrivate = effectiveModule.visibility === 'private';
  const visibility: StorageVisibility = isPrivate ? 'private' : 'public';
  const subfolder = effectiveModule.subfolder;
  const safeName = path.basename(params.fileName);
  const relativeObjectPath = `${subfolder}/${safeName}`;
  const cloudObjectPath = `${visibility}/${relativeObjectPath}`;
  const localBaseDir = isPrivate ? STORAGE_PATHS.PRIVATE_UPLOADS_DIR : STORAGE_PATHS.PUBLIC_UPLOADS_DIR;
  const localTargetDir = path.join(localBaseDir, subfolder);
  const localPublicUrl = isPrivate
    ? `/api/upload/private/${relativeObjectPath}`
    : `/uploads/${relativeObjectPath}`;

  return {
    moduleKey: effectiveModule.key,
    visibility,
    isPrivate,
    subfolder,
    relativeObjectPath,
    cloudObjectPath,
    localBaseDir,
    localTargetDir,
    localPublicUrl
  };
}

export function getStorageArchitectureSummary() {
  return {
    runtimeMode: STORAGE_PATHS.IS_SERVERLESS ? 'serverless (/tmp/sadewa)' : 'node (workspace)',
    supabaseBucket: STORAGE_PATHS.SUPABASE_BUCKET,
    systemDataZones: {
      jsonFallbackDb: 'data/pulau_betung_db.json',
      backups: 'data/backups/*.json',
      syncQueue: ['data/sync-hashes.json', 'data/sync-failures.json'],
      logs: 'logs/dual-write-failures.log',
      browserPreferences: [
        'localStorage:sadewa_dark_mode',
        'localStorage:sadewa_font_size',
        'localStorage:sadewa_attendance_device_id',
        'localStorage:pulau_betung_auth_token',
        'localStorage:pulau_betung_current_user',
        'localStorage:pulau_betung_user_liked_items'
      ]
    },
    uploadModules: Object.values(STORAGE_MODULES).map((m) => ({
      module: m.key,
      label: m.label,
      visibility: m.visibility,
      storagePrefix: `${m.visibility}/${m.subfolder}/`,
      urlPattern: m.visibility === 'private' ? `/api/upload/private/${m.subfolder}/<file>` : `/uploads/${m.subfolder}/<file>`,
      description: m.description
    }))
  };
}

/**
 * Menyelesaikan target penyimpanan yang terisolasi per tenant (`tenants/<tenantId>/...`)
 * sembari menjaga kompatibilitas penuh dengan struktur single-tenant eksisting.
 */
export function resolveTenantStorageTarget(params: {
  moduleKey?: string | null;
  fieldName?: string | null;
  reqPath?: string | null;
  fileName: string;
  tenantId?: string | null;
  useTenantPrefix?: boolean;
}): ResolvedStorageTarget & { tenantId: string | null } {
  const base = resolveStorageTarget(params);
  const cleanTenant = params.tenantId?.trim() || null;
  const shouldPrefix = Boolean(cleanTenant && params.useTenantPrefix !== false);

  if (!shouldPrefix || !cleanTenant) {
    return {
      ...base,
      tenantId: cleanTenant
    };
  }

  return {
    ...base,
    tenantId: cleanTenant,
    cloudObjectPath: `tenants/${cleanTenant}/${base.cloudObjectPath}`,
    localTargetDir: path.join(base.localBaseDir, 'tenants', cleanTenant, base.subfolder),
    localPublicUrl: base.isPrivate
      ? `/api/upload/private/tenants/${cleanTenant}/${base.relativeObjectPath}`
      : `/uploads/tenants/${cleanTenant}/${base.relativeObjectPath}`
  };
}

/**
 * Mengembalikan kandidat path (urut prioritas) agar berkas historis Desa Pulau Betung
 * di path lama (`/uploads/...` / `public/...`) maupun path baru (`tenants/<tenantId>/...`)
 * tetap dapat dibaca tanpa memutus tautan dokumen arsip.
 */
export function resolveLegacyCompatibleStorageCandidates(
  relativeOrStoredPath: string,
  tenantId?: string | null
): string[] {
  const normalized = String(relativeOrStoredPath || '').trim().replace(/^\/+/, '');
  if (!normalized) return [];

  const candidates: string[] = [];
  const cleanTenant = tenantId?.trim();

  if (cleanTenant && !normalized.startsWith(`tenants/${cleanTenant}/`)) {
    candidates.push(`tenants/${cleanTenant}/${normalized}`);
  }

  candidates.push(normalized);

  // Jika path diawali prefix tenant, sediakan juga fallback ke path legacy tanpa prefix
  const tenantPrefixMatch = normalized.match(/^tenants\/[^/]+\/(.+)$/);
  if (tenantPrefixMatch?.[1]) {
    candidates.push(tenantPrefixMatch[1]);
  }

  return [...new Set(candidates)];
}

