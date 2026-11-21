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
  resolveStorageTarget,
  isAllowedPrivateSubfolder,
  getStorageArchitectureSummary
} from '../config/storageRegistry';

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

/**
 * Helper untuk membuat Signed URL terproteksi (TTL 15 menit / 900 detik)
 */
export async function generateSignedUrl(relativeOrCloudPath: string, expiresInSeconds: number = 900): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const bucketName = STORAGE_PATHS.SUPABASE_BUCKET;

  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const normalized = relativeOrCloudPath.replace(/^\/+/, '');
    const uploadPath = normalized.startsWith('private/') ? normalized : `private/${normalized}`;
    const targetUrl = `${cleanUrl}/storage/v1/object/sign/${bucketName}/${uploadPath}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': 'application/json'
      },
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
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const bucketName = STORAGE_PATHS.SUPABASE_BUCKET;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const targetUrl = `${cleanUrl}/storage/v1/object/${bucketName}/${cloudObjectPath}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': mimeType,
        'x-upsert': 'true'
      },
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
 * Helper untuk menghapus seluruh objek (termasuk subfolder per modul) di bucket Supabase Storage
 */
export async function clearSupabaseStorageBucket(): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const bucketName = STORAGE_PATHS.SUPABASE_BUCKET;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials tidak ditemukan. Melewati pembersihan storage bucket.');
    return false;
  }

  const prefixes = [
    'public',
    'private',
    ...Object.values(STORAGE_MODULES).map((m) => `${m.visibility}/${m.subfolder}`)
  ];

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    for (const prefix of [...new Set(prefixes)]) {
      let hasMore = true;
      let totalDeleted = 0;

      while (hasMore) {
        const listRes = await fetch(`${cleanUrl}/storage/v1/object/list/${bucketName}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
            'Content-Type': 'application/json'
          },
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
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
            'Content-Type': 'application/json'
          },
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

      const target = resolveStorageTarget({
        moduleKey: requestedModule,
        fieldName,
        reqPath: req.path,
        fileName: provisionalName
      });

      const safeFileName = `${target.isPrivate ? 'private' : 'upload'}-${Date.now()}-${safeHash}${extension}`;
      const finalTarget = resolveStorageTarget({
        moduleKey: target.moduleKey,
        fieldName,
        reqPath: req.path,
        fileName: safeFileName
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
    const initialTarget = resolveStorageTarget({
      moduleKey: requestedModule,
      fieldName,
      reqPath: req.path,
      fileName: `tmp-${safeHash}${extension}`
    });
    const safeFileName = `${initialTarget.isPrivate ? 'private' : 'upload'}-${Date.now()}-${safeHash}${extension}`;
    const finalTarget = resolveStorageTarget({
      moduleKey: initialTarget.moduleKey,
      fieldName,
      reqPath: req.path,
      fileName: safeFileName
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
const handleServePrivateFile = (req: AuthenticatedRequest, res: Response) => {
  const { subfolder, filename } = req.params;
  const safeFile = path.basename(filename || '');

  if (!safeFile || safeFile !== filename || filename.includes('..')) {
    return res.status(400).json({ success: false, error: 'Nama berkas tidak valid.' });
  }

  let resolvedPath = '';
  if (subfolder) {
    const safeSub = path.basename(subfolder);
    if (safeSub !== subfolder || !isAllowedPrivateSubfolder(safeSub)) {
      return res.status(403).json({ success: false, error: 'Subfolder privat tidak valid.' });
    }
    resolvedPath = path.resolve(PRIVATE_UPLOAD_DIR, safeSub, safeFile);
  } else {
    resolvedPath = path.resolve(PRIVATE_UPLOAD_DIR, safeFile);
  }

  const baseResolved = path.resolve(PRIVATE_UPLOAD_DIR);
  if (!resolvedPath.startsWith(baseResolved + path.sep)) {
    return res.status(403).json({ success: false, error: 'Akses direktori ditolak.' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ success: false, error: 'Dokumen tidak ditemukan.' });
  }

  return res.sendFile(resolvedPath);
};

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
