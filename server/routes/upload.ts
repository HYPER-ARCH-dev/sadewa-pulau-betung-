/**
 * UPLOAD SERVICE (SERVER-SIDE)
 * Menangani upload berkas dan gambar seluruh modul SADEWA menggunakan Multer memoryStorage.
 * Setiap unggahan diarahkan otomatis ke subfolder modul yang sesuai (Publik vs Privat)
 * di penyimpanan lokal maupun Supabase Storage Bucket.
 */

import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import {
  STORAGE_PATHS,
  STORAGE_MODULES,
  resolveTenantStorageTarget,
  resolveLegacyCompatibleStorageCandidates,
  isAllowedPrivateSubfolder,
  getStorageArchitectureSummary
} from '../config/storageRegistry';
import { getCurrentTenantContext, isMultiTenantRoutingEnabled } from '../db/tenantContext';
import { getControlPlanePrisma } from '../db/prisma-helpers';
import { decryptTenantSecret } from '../security/credentialVault';
import { sanitizeDiagnosticMessage } from '../db/connection-diagnostic';

const router = Router();

const PUBLIC_UPLOADS_DIR = STORAGE_PATHS.PUBLIC_UPLOADS_DIR;
const PRIVATE_UPLOAD_DIR = STORAGE_PATHS.PRIVATE_UPLOADS_DIR;

function ensureUploadDir(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.warn('⚠️ [Upload] Tidak dapat membuat direktori upload lokal:', err);
  }
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

/**
 * Konfigurasi Storage Multer ke memoryStorage
 */
const storage = multer.memoryStorage();

/**
 * Filter Berkas: Validasi MIME DAN Ekstensi secara ketat (AND)
 */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  const isAllowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'].includes(mime);
  const isAllowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext);

  if (isAllowedMime && isAllowedExt) {
    cb(null, true);
  } else {
    cb(new Error('Format berkas tidak didukung atau ekstensi tidak sesuai.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Maksimum 10 MB
  },
  fileFilter
});

/**
 * Middleware menerima field: 'file', 'ktp', 'dokumen', atau 'selfie'
 */
const uploadSingleMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const uploadHandler = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'ktp', maxCount: 1 },
    { name: 'dokumen', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
  ]);

  uploadHandler(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Ukuran berkas melebihi batas maksimum 10 MB. Harap perkecil atau kompres berkas Anda.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Kesalahan sistem saat mengunggah berkas.'
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: 'Gagal memproses berkas unggahan. Pastikan format sesuai.'
      });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      req.file =
        files['file']?.[0] ||
        files['ktp']?.[0] ||
        files['dokumen']?.[0] ||
        files['selfie']?.[0];
    }

    next();
  });
};

/**
 * Validasi Magic Bytes (File Content Sniffing) untuk Gambar & PDF
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  const mime = mimeType.toLowerCase();

  if (mime === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mime === 'application/pdf') {
    return buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }

  return false;
}

export interface ResolvedSupabaseStorageCredentials {
  supabaseUrl: string;
  serviceKey: string;
  bucketName: string;
  isDedicatedBucket: boolean;
}

/**
 * Menyelesaikan kredensial Supabase Storage secara dinamis:
 * - Mode DEDICATED (jika desa memiliki Supabase Project & Service Key sendiri): dekripsi in-memory dari vault terenkripsi.
 * - Mode SHARED / Legacy: gunakan project & bucket terpusat platform dengan isolasi prefix `tenants/<tenantId>/`.
 */
export async function resolveActiveSupabaseStorageCredentials(): Promise<ResolvedSupabaseStorageCredentials | null> {
  const ctx = getCurrentTenantContext();
  if (ctx?.tenantId && ctx.tenancyMode === 'DEDICATED') {
    try {
      const dbConfig = await (getControlPlanePrisma() as any).tenantDatabaseConfig.findUnique({
        where: { tenantId: ctx.tenantId },
        select: {
          encryptedSupabaseUrl: true,
          encryptedServiceKey: true,
          storageBucket: true
        }
      });

      if (dbConfig?.encryptedSupabaseUrl && dbConfig?.encryptedServiceKey) {
        const supabaseUrl = decryptTenantSecret(dbConfig.encryptedSupabaseUrl, { tenantId: ctx.tenantId });
        const serviceKey = decryptTenantSecret(dbConfig.encryptedServiceKey, { tenantId: ctx.tenantId });
        const bucketName = dbConfig.storageBucket?.trim() || STORAGE_PATHS.SUPABASE_BUCKET;
        return {
          supabaseUrl,
          serviceKey,
          bucketName,
          isDedicatedBucket: true
        };
      }
    } catch (err: any) {
      console.warn('⚠️ [Upload] Gagal mendekripsi kredensial Dedicated Storage:', sanitizeDiagnosticMessage(err?.message || String(err)));
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  return {
    supabaseUrl,
    serviceKey,
    bucketName: STORAGE_PATHS.SUPABASE_BUCKET,
    isDedicatedBucket: false
  };
}

/**
 * Membangun header autentikasi Supabase Storage yang kompatibel untuk:
 * - New Secret Keys (`sb_secret_...` non-JWT): cukup kirim via header `apikey`
 * - Legacy Service Role JWT (`eyJ...`): kirim via `Authorization: Bearer` dan `apikey`
 */
function buildSupabaseStorageHeaders(
  supabaseKey: string,
  extraHeaders: Record<string, string> = {}
): Record<string, string> {
  const trimmed = supabaseKey.trim();
  if (trimmed.startsWith('sb_secret_')) {
    return {
      apikey: trimmed,
      ...extraHeaders
    };
  }
  return {
    Authorization: `Bearer ${trimmed}`,
    apikey: trimmed,
    ...extraHeaders
  };
}

/**
 * Helper untuk membuat Signed URL terproteksi (TTL 15 menit / 900 detik)
 */
export async function generateSignedUrl(relativeOrCloudPath: string, expiresInSeconds: number = 900): Promise<string | null> {
  const storageCreds = await resolveActiveSupabaseStorageCredentials();
  if (!storageCreds) return null;

  const { supabaseUrl, serviceKey: supabaseKey, bucketName } = storageCreds;

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const normalized = relativeOrCloudPath.replace(/^\/+/, '');
    const uploadPath =
      normalized.startsWith('tenants/') || normalized.startsWith('private/')
        ? normalized
        : `private/${normalized}`;
    const targetUrl = `${cleanUrl}/storage/v1/object/sign/${bucketName}/${uploadPath}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: buildSupabaseStorageHeaders(supabaseKey, {
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({ expiresIn: expiresInSeconds })
    });

    if (response.ok) {
      const data = await response.json();
      return `${cleanUrl}/storage/v1${data.signedURL}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Helper untuk mengunggah berkas ke Supabase Storage sesuai struktur modul (public/<subfolder>/ atau private/<subfolder>/)
 */
async function uploadToCloudStorage(
  buffer: Buffer,
  cloudObjectPath: string,
  mimeType: string,
  isPrivate: boolean,
  localFallbackPrivateUrl: string
): Promise<{ publicCdnUrl?: string; signedUrl?: string } | null> {
  const storageCreds = await resolveActiveSupabaseStorageCredentials();
  if (!storageCreds) {
    return null;
  }

  const { supabaseUrl, serviceKey: supabaseKey, bucketName } = storageCreds;

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const targetUrl = `${cleanUrl}/storage/v1/object/${bucketName}/${cloudObjectPath}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: buildSupabaseStorageHeaders(supabaseKey, {
        'Content-Type': mimeType,
        'x-upsert': 'true'
      }),
      body: buffer
    });

    if (response.ok) {
      if (isPrivate) {
        const signedUrl = await generateSignedUrl(cloudObjectPath, 900);
        return { signedUrl: signedUrl || localFallbackPrivateUrl };
      }
      const publicCdnUrl = `${cleanUrl}/storage/v1/object/public/${bucketName}/${cloudObjectPath}`;
      return { publicCdnUrl };
    }

    const errText = await response.text();
    console.warn(`⚠️ Supabase Storage upload error (${response.status}): ${errText}. Menggunakan fallback lokal.`);
    return null;
  } catch (err) {
    console.warn('⚠️ Gagal terhubung ke Cloud Storage:', err);
    return null;
  }
}

/**
 * Helper untuk menghapus seluruh objek (termasuk subfolder per modul) di bucket Supabase Storage.
 * Pada mode multi-tenant, penghapusan wajib dibatasi ke prefix `tenants/<tenantId>/...` dan ditolak jika dipanggil global.
 */
export async function clearSupabaseStorageBucket(tenantPrefix?: string): Promise<boolean> {
  const cleanExplicitPrefix = tenantPrefix ? tenantPrefix.replace(/^\/+|\/+$/g, '') : '';
  let effectivePrefix: string | null = cleanExplicitPrefix || null;

  if (!effectivePrefix) {
    const { assertSafeUnscopedMutation } = await import('../db/tenantContext');
    const scope = assertSafeUnscopedMutation('clearSupabaseStorageBucket');
    if (scope.tenantId) {
      effectivePrefix = `tenants/${scope.tenantId}`;
    }
  }

  const storageCreds = await resolveActiveSupabaseStorageCredentials();
  if (!storageCreds) {
    console.warn('⚠️ Supabase credentials tidak ditemukan. Melewati pembersihan storage bucket.');
    return false;
  }
  const { supabaseUrl, serviceKey: supabaseKey, bucketName } = storageCreds;

  const basePrefixes = [
    'public',
    'private',
    ...Object.values(STORAGE_MODULES).map((m) => `${m.visibility}/${m.subfolder}`)
  ];
  const prefixes = effectivePrefix
    ? basePrefixes.map((p) => `${effectivePrefix}/${p}`)
    : basePrefixes;

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    for (const prefix of [...new Set(prefixes)]) {
      let hasMore = true;
      let totalDeleted = 0;

      while (hasMore) {
        const listRes = await fetch(`${cleanUrl}/storage/v1/object/list/${bucketName}`, {
          method: 'POST',
          headers: buildSupabaseStorageHeaders(supabaseKey, {
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ prefix, limit: 1000, offset: 0 })
        });

        if (!listRes.ok) {
          hasMore = false;
          break;
        }

        const items: any[] = await listRes.json();
        const files = Array.isArray(items) ? items.filter((item) => item?.id !== null && item?.name) : [];
        if (files.length === 0) {
          hasMore = false;
          break;
        }

        const prefixesToDelete = files.map((f) => `${prefix}/${f.name}`);
        const delRes = await fetch(`${cleanUrl}/storage/v1/object/${bucketName}`, {
          method: 'DELETE',
          headers: buildSupabaseStorageHeaders(supabaseKey, {
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ prefixes: prefixesToDelete })
        });

        if (delRes.ok) {
          totalDeleted += files.length;
          if (files.length < 1000) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      if (totalDeleted > 0) {
        console.log(`🧹 Folder '${prefix}/' Supabase Storage berhasil dibersihkan (${totalDeleted} berkas terhapus).`);
      }
    }
    return true;
  } catch (err: any) {
    console.warn('⚠️ Gagal membersihkan bucket Supabase Storage:', err?.message || err);
    return false;
  }
}

/**
 * POST /api/upload, POST /api/upload/file, POST /api/upload/ktp
 */
const handleUploadRequest = async (req: Request, res: Response) => {
  try {
    const requestedModule = (req.body?.module || req.query?.module || '') as string;
    const fieldName = (req.file?.fieldname || req.body?.fieldname || '').toLowerCase();

    // 1. Tangani unggahan Multer (multipart/form-data)
    if (req.file) {
      const fileBuffer = req.file.buffer;
      const mimeType = (req.file.mimetype || '').toLowerCase();

      if (!validateMagicBytes(fileBuffer, mimeType)) {
        return res.status(400).json({
          success: false,
          message: 'Integritas berkas ditolak: Konten biner tidak sesuai format.'
        });
      }

      const extension = ALLOWED_MIME_TYPES[mimeType] || '.jpg';
      const safeHash = crypto.randomBytes(12).toString('hex');
      const provisionalName = `file-${Date.now()}-${safeHash}${extension}`;

      const activeCtx = getCurrentTenantContext();
      const useTenantPrefix = isMultiTenantRoutingEnabled() && Boolean(activeCtx?.tenantId);
      const target = resolveTenantStorageTarget({
        moduleKey: requestedModule,
        fieldName,
        reqPath: req.path,
        fileName: provisionalName,
        tenantId: activeCtx?.tenantId,
        useTenantPrefix
      });

      const safeFileName = `${target.isPrivate ? 'private' : 'upload'}-${Date.now()}-${safeHash}${extension}`;
      const finalTarget = resolveTenantStorageTarget({
        moduleKey: target.moduleKey,
        fieldName,
        reqPath: req.path,
        fileName: safeFileName,
        tenantId: activeCtx?.tenantId,
        useTenantPrefix
      });

      const cloudResult = await uploadToCloudStorage(
        fileBuffer,
        finalTarget.cloudObjectPath,
        mimeType,
        finalTarget.isPrivate,
        finalTarget.localPublicUrl
      );

      let finalUrl = '';
      if (cloudResult?.signedUrl || cloudResult?.publicCdnUrl) {
        finalUrl = (cloudResult.signedUrl || cloudResult.publicCdnUrl) as string;
      } else {
        ensureUploadDir(finalTarget.localTargetDir);
        const targetPath = path.join(finalTarget.localTargetDir, safeFileName);
        fs.writeFileSync(targetPath, fileBuffer);
        finalUrl = finalTarget.localPublicUrl;
      }

      return res.status(201).json({
        success: true,
        message: finalTarget.isPrivate
          ? 'Dokumen berhasil disimpan ke zona privat terproteksi.'
          : 'Berkas berhasil diunggah.',
        url: finalUrl,
        data: {
          originalName: req.file.originalname,
          fileName: safeFileName,
          url: finalUrl,
          size: req.file.size,
          mimeType,
          module: finalTarget.moduleKey,
          zone: finalTarget.visibility,
          subfolder: finalTarget.subfolder,
          isPrivate: finalTarget.isPrivate,
          isCloud: Boolean(cloudResult)
        }
      });
    }

    // 2. Tangani fallback JSON Base64
    const { base64Data, fileName, mimeType } = req.body || {};

    if (!base64Data || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Berkas tidak terdeteksi. Silakan pilih berkas (JPG, PNG, WebP, atau PDF max 10MB).',
        error: 'Berkas tidak terdeteksi.'
      });
    }

    const normalizedMime = String(mimeType).toLowerCase();
    const extension = ALLOWED_MIME_TYPES[normalizedMime] || '.jpg';
    const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'Ukuran berkas melebihi batas maksimum 10 MB.',
        error: 'Ukuran berkas melebihi 10MB.'
      });
    }

    if (!validateMagicBytes(buffer, normalizedMime)) {
      return res.status(400).json({
        success: false,
        message: 'Integritas berkas ditolak: Konten biner tidak sesuai format.'
      });
    }

    const safeHash = crypto.randomBytes(12).toString('hex');
    const activeCtx = getCurrentTenantContext();
    const useTenantPrefix = isMultiTenantRoutingEnabled() && Boolean(activeCtx?.tenantId);
    const initialTarget = resolveTenantStorageTarget({
      moduleKey: requestedModule,
      fieldName,
      reqPath: req.path,
      fileName: `tmp-${safeHash}${extension}`,
      tenantId: activeCtx?.tenantId,
      useTenantPrefix
    });
    const safeFileName = `${initialTarget.isPrivate ? 'private' : 'upload'}-${Date.now()}-${safeHash}${extension}`;
    const finalTarget = resolveTenantStorageTarget({
      moduleKey: initialTarget.moduleKey,
      fieldName,
      reqPath: req.path,
      fileName: safeFileName,
      tenantId: activeCtx?.tenantId,
      useTenantPrefix
    });

    const cloudResult = await uploadToCloudStorage(
      buffer,
      finalTarget.cloudObjectPath,
      normalizedMime,
      finalTarget.isPrivate,
      finalTarget.localPublicUrl
    );

    let finalUrl = '';
    if (cloudResult?.signedUrl || cloudResult?.publicCdnUrl) {
      finalUrl = (cloudResult.signedUrl || cloudResult.publicCdnUrl) as string;
    } else {
      ensureUploadDir(finalTarget.localTargetDir);
      const targetPath = path.join(finalTarget.localTargetDir, safeFileName);
      fs.writeFileSync(targetPath, buffer);
      finalUrl = finalTarget.localPublicUrl;
    }

    return res.status(201).json({
      success: true,
      message: finalTarget.isPrivate
        ? 'Dokumen tersimpan di zona privat.'
        : 'Berkas berhasil diunggah.',
      url: finalUrl,
      data: {
        originalName: path.basename(fileName || safeFileName),
        fileName: safeFileName,
        url: finalUrl,
        size: buffer.length,
        mimeType: normalizedMime,
        module: finalTarget.moduleKey,
        zone: finalTarget.visibility,
        subfolder: finalTarget.subfolder,
        isPrivate: finalTarget.isPrivate,
        isCloud: Boolean(cloudResult)
      }
    });
  } catch (err: any) {
    console.warn('⚠️ [Upload handler error]:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses unggahan berkas di server.'
    });
  }
};

router.post('/', uploadSingleMiddleware, handleUploadRequest);
router.post('/file', uploadSingleMiddleware, handleUploadRequest);
router.post('/ktp', uploadSingleMiddleware, handleUploadRequest);

/**
 * Informasi Peta Jalur Penyimpanan Publik-vs-Privat (Admin Only)
 */
router.get('/registry', authenticateToken, requireRoles('super_admin', 'admin_desa'), (_req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    data: getStorageArchitectureSummary()
  });
});

/**
 * Akses berkas privat terproteksi:
 * Mendukung baik format baru (/api/upload/private/:subfolder/:filename)
 * maupun format lama (/api/upload/private/:filename).
 */
const handleServePrivateFile = async (req: AuthenticatedRequest, res: Response) => {
  const { subfolder, filename, tenantId: paramTenantId } = req.params as Record<string, string>;
  const safeFile = path.basename(filename || '');

  if (!safeFile || safeFile !== filename || filename.includes('..')) {
    return res.status(400).json({ success: false, error: 'Nama berkas tidak valid.' });
  }

  const activeCtx = getCurrentTenantContext();
  const activeTenantId = activeCtx?.tenantId || null;

  // Enforce strict tenant isolation for private file downloads
  if (activeTenantId && req.user?.tenantId && req.user.tenantId !== activeTenantId) {
    return res.status(403).json({ success: false, error: 'Akses lintas-tenant untuk dokumen privat ditolak.' });
  }
  if (paramTenantId && activeTenantId && paramTenantId !== activeTenantId) {
    return res.status(403).json({ success: false, error: 'Dokumen privat bukan milik portal desa ini.' });
  }

  let baseRelativePath = safeFile;
  if (subfolder) {
    const safeSub = path.basename(subfolder);
    if (safeSub !== subfolder || !isAllowedPrivateSubfolder(safeSub)) {
      return res.status(403).json({ success: false, error: 'Subfolder privat tidak valid.' });
    }
    baseRelativePath = `${safeSub}/${safeFile}`;
  }

  const baseResolved = path.resolve(PRIVATE_UPLOAD_DIR);
  const rawCandidates = resolveLegacyCompatibleStorageCandidates(
    paramTenantId ? `tenants/${paramTenantId}/${baseRelativePath}` : baseRelativePath,
    activeTenantId
  );
  const candidates =
    activeTenantId && activeTenantId !== 'tenant_pulau_betung'
      ? rawCandidates.filter((c) => c.startsWith(`tenants/${activeTenantId}/`))
      : rawCandidates;

  for (const relCandidate of candidates) {
    const candidateAbs = path.resolve(PRIVATE_UPLOAD_DIR, relCandidate);
    if (!candidateAbs.startsWith(baseResolved + path.sep)) {
      return res.status(403).json({ success: false, error: 'Akses direktori ditolak.' });
    }
    if (fs.existsSync(candidateAbs)) {
      return res.sendFile(candidateAbs);
    }
  }

  // Fallback Cloud Storage Signed URL jika berkas hanya ada di bucket cloud
  const cloudLookupPath = activeTenantId
    ? `tenants/${activeTenantId}/private/${baseRelativePath}`
    : `private/${baseRelativePath}`;
  const signedUrl = await generateSignedUrl(cloudLookupPath, 900);
  if (signedUrl) {
    return res.redirect(302, signedUrl);
  }

  return res.status(404).json({ success: false, error: 'Dokumen tidak ditemukan.' });
};

router.get(
  '/private/tenants/:tenantId/:subfolder/:filename',
  authenticateToken,
  requireRoles('super_admin', 'admin_desa', 'operator'),
  handleServePrivateFile
);

router.get(
  '/private/:subfolder/:filename',
  authenticateToken,
  requireRoles('super_admin', 'admin_desa', 'operator'),
  handleServePrivateFile
);

router.get(
  '/private/:filename',
  authenticateToken,
  requireRoles('super_admin', 'admin_desa', 'operator'),
  handleServePrivateFile
);

export { PUBLIC_UPLOADS_DIR };
export default router;
