/**
 * UPLOAD SERVICE (SERVER-SIDE)
 * Menangani upload berkas KTP/persyaratan warga menggunakan middleware Multer.
 * Batas: Max 2MB, filter JPG/PNG/PDF.
 * Simpan ke: public/uploads/ dan mengembalikan URL valid: /uploads/[filename]
 * Keyword: MULTER, KTP_UPLOAD, FILE_UPLOAD
 */

import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../auth';
import { SERVER_CONFIG } from '../config/constants';

const router = Router();

// Folder target statis: public/uploads
const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const PRIVATE_UPLOAD_DIR = SERVER_CONFIG.PRIVATE_UPLOAD_DIR;

// Pastikan direktori tersedia
if (!fs.existsSync(PUBLIC_UPLOADS_DIR)) {
  fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PRIVATE_UPLOAD_DIR)) {
  fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types & extensions
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
} as Record<string, string>;

/**
 * Konfigurasi Storage Multer ke memoryStorage (Keamanan: berkas tidak ditulis ke disk secara otomatis)
 */
const storage = multer.memoryStorage();

/**
 * Filter Berkas (FIX 3: Validasi MIME DAN Ekstensi secara AND)
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
    fileSize: 10 * 1024 * 1024 // Batas: Maksimum 10 MB
  },
  fileFilter
});

/**
 * Middleware untuk menangani field 'file' atau 'ktp' secara fleksibel
 */
const uploadSingleMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const uploadHandler = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'ktp', maxCount: 1 }
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

    // Normalisasi file ke req.file jika ada di fields
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files['file'] && files['file'][0]) {
        req.file = files['file'][0];
      } else if (files['ktp'] && files['ktp'][0]) {
        req.file = files['ktp'][0];
      }
    }

    next();
  });
};

/**
 * Validasi Magic Bytes (File Content Sniffing) untuk Base64 Fallback
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  return false;
}

/**
 * Helper untuk membuat Signed URL terproteksi (TTL 15 menit / 900 detik)
 * untuk dokumen privat seperti KTP warga & berkas rahasia
 */
export async function generateSignedUrl(fileName: string, expiresInSeconds: number = 900): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'sadewa-uploads';

  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const uploadPath = `private/${fileName}`;
    const targetUrl = `${cleanUrl}/storage/v1/object/sign/${bucketName}/${uploadPath}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds })
    });

    if (response.ok) {
      const data = await response.json();
      return `${cleanUrl}/storage/v1${data.signedURL}`;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Helper untuk mengunggah berkas ke Supabase Storage
 */
async function uploadToCloudStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  isPrivate: boolean = false
): Promise<{ publicCdnUrl?: string; signedUrl?: string } | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'sadewa-uploads';

  if (!supabaseUrl || !supabaseKey) {
    return null; // Menggunakan fallback disk lokal
  }

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    const folderPath = isPrivate ? 'private' : 'public';
    const uploadPath = `${folderPath}/${fileName}`;
    const targetUrl = `${cleanUrl}/storage/v1/object/${bucketName}/${uploadPath}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': mimeType,
        'x-upsert': 'true'
      },
      body: buffer
    });

    if (response.ok) {
      if (isPrivate) {
        // Untuk dokumen private (KTP), buat Signed URL (TTL 15 Menit)
        const signedUrl = await generateSignedUrl(fileName, 900);
        console.log(`🔒 Dokumen KTP/Privat berhasil disimpan di folder 'private/' Supabase Storage with Signed URL.`);
        return { signedUrl: signedUrl || `/api/upload/private/${fileName}` };
      } else {
        const publicCdnUrl = `${cleanUrl}/storage/v1/object/public/${bucketName}/${uploadPath}`;
        console.log(`🌐 Berkas publik berhasil diunggah ke Supabase Storage CDN: ${publicCdnUrl}`);
        return { publicCdnUrl };
      }
    } else {
      const errText = await response.text();
      console.warn(`⚠️ Supabase Storage upload error (${response.status}): ${errText}. Menggunakan fallback lokal.`);
      return null;
    }
  } catch (err) {
    console.warn(`⚠️ Gagal terhubung ke Cloud Storage:`, err);
    return null;
  }
}

/**
 * Helper untuk menghapus seluruh objek di bucket Supabase Storage saat Factory Reset
 * Menggunakan pagination loop (batch 1000 file per iterasi) untuk performa tinggi & bebas limit
 */
export async function clearSupabaseStorageBucket(): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'sadewa-uploads';

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials tidak ditemukan. Melewati pembersihan storage bucket.');
    return false;
  }

  try {
    const cleanUrl = supabaseUrl.replace(/\/$/, '');
    for (const prefix of ['public', 'private']) {
      let hasMore = true;
      let totalDeleted = 0;

      while (hasMore) {
        // 1. Minta daftar file per batch (max 1000 per request)
        const listRes = await fetch(`${cleanUrl}/storage/v1/object/list/${bucketName}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prefix, limit: 1000, offset: 0 })
        });

        if (!listRes.ok) {
          const errText = await listRes.text();
          console.warn(`⚠️ Gagal mendaftar berkas '${prefix}' di Supabase Storage (${listRes.status}): ${errText}`);
          hasMore = false;
          break;
        }

        const files: any[] = await listRes.json();
        if (!Array.isArray(files) || files.length === 0) {
          hasMore = false;
          break;
        }

        // 2. Buat daftar prefix lokasi file yang akan dihapus secara batch
        const prefixesToDelete = files.map(f => `${prefix}/${f.name}`);
        const delRes = await fetch(`${cleanUrl}/storage/v1/object/${bucketName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prefixes: prefixesToDelete })
        });

        if (delRes.ok) {
          totalDeleted += files.length;
          // Jika jumlah file yang didapat < 1000, berarti seluruh file di folder ini sudah habis
          if (files.length < 1000) {
            hasMore = false;
          }
        } else {
          const delErr = await delRes.text();
          console.warn(`⚠️ Gagal menghapus batch berkas '${prefix}' (${delRes.status}): ${delErr}`);
          hasMore = false;
        }
      }
      console.log(`🧹 Folder '${prefix}/' Supabase Storage berhasil dibersihkan total (${totalDeleted} berkas terhapus).`);
    }
    return true;
  } catch (err: any) {
    console.warn('⚠️ Gagal membersihkan bucket Supabase Storage:', err?.message || err);
    return false;
  }
}

/**
 * POST /api/upload, POST /api/upload/file, dan POST /api/upload/ktp
 */
const handleUploadRequest = async (req: Request, res: Response) => {
  try {
    let extension = '.jpg';
    // FIX 1: isPrivate HANYA ditentukan dari SERVER (Route & Field Name), BUKAN Payload Client
    const fieldName = (req.file?.fieldname || req.body?.fieldname || '').toLowerCase();
    const pathLower = (req.path || '').toLowerCase();
    const PRIVATE_FIELDS = ['ktp', 'selfie', 'dokumen-surat', 'dokumen', 'persyaratan', 'berkas-rahasia'];

    const isPrivate = pathLower.includes('/ktp') || 
                      pathLower.includes('/private') || 
                      PRIVATE_FIELDS.includes(fieldName);

    // 1. Tangani jika diunggah via Multer (multipart/form-data)
    if (req.file) {
      const fileBuffer = req.file.buffer; // Memory storage uses buffer

      // FIX 3b: Jalankan validateMagicBytes di SEMUA jalur
      if (!validateMagicBytes(fileBuffer, req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Integritas berkas ditolak: Konten biner tidak sesuai format.'
        });
      }

      // FIX 3c: Tentukan ekstensi dari mime hasil deteksi magic bytes
      extension = ALLOWED_MIME_TYPES[req.file.mimetype] || '.jpg';
      const safeHash = crypto.randomBytes(12).toString('hex');
      const safeFileName = `${isPrivate ? 'private' : 'upload'}-${Date.now()}-${safeHash}${extension}`;

      const cloudResult = await uploadToCloudStorage(fileBuffer, safeFileName, req.file.mimetype, isPrivate);

      // FIX 3e: File privat tidak pernah ke public/uploads
      let finalUrl = '';
      if (cloudResult?.signedUrl || cloudResult?.publicCdnUrl) {
        finalUrl = (cloudResult.signedUrl || cloudResult.publicCdnUrl) as string;
      } else {
        const targetDir = isPrivate ? PRIVATE_UPLOAD_DIR : PUBLIC_UPLOADS_DIR;
        const targetPath = path.join(targetDir, safeFileName);
        fs.writeFileSync(targetPath, fileBuffer);
        finalUrl = isPrivate ? `/api/upload/private/${safeFileName}` : `/uploads/${safeFileName}`;
      }

      return res.status(201).json({
        success: true,
        message: isPrivate
          ? 'Dokumen berhasil disimpan secara terproteksi.'
          : 'Berkas berhasil diunggah.',
        url: finalUrl,
        data: {
          originalName: req.file.originalname,
          fileName: safeFileName,
          url: finalUrl,
          size: req.file.size,
          mimeType: req.file.mimetype,
          isPrivate,
          isCloud: Boolean(cloudResult)
        }
      });
    }

    // 2. Tangani fallback jika data dikirim sebagai JSON Base64
    const { base64Data, fileName, mimeType } = req.body || {};

    if (!base64Data || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Berkas tidak terdeteksi. Silakan pilih berkas (JPG, PNG, WebP, atau PDF max 10MB).',
        error: 'Berkas tidak terdeteksi.'
      });
    }

    extension = ALLOWED_MIME_TYPES[mimeType] || '.jpg';
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'Ukuran berkas melebihi batas maksimum 10 MB.',
        error: 'Ukuran berkas melebihi 10MB.'
      });
    }

    if (!validateMagicBytes(buffer, mimeType)) {
      return res.status(400).json({
        success: false,
        message: 'Integritas berkas ditolak: Konten biner tidak sesuai format.'
      });
    }

    const safeHash = crypto.randomBytes(12).toString('hex');
    const safeFileName = `${isPrivate ? 'private' : 'upload'}-${Date.now()}-${safeHash}${extension}`;

    const cloudResult = await uploadToCloudStorage(buffer, safeFileName, mimeType, isPrivate);

    let finalUrl = '';
    if (cloudResult?.signedUrl || cloudResult?.publicCdnUrl) {
      finalUrl = (cloudResult.signedUrl || cloudResult.publicCdnUrl) as string;
    } else {
      const targetDir = isPrivate ? PRIVATE_UPLOAD_DIR : PUBLIC_UPLOADS_DIR;
      const targetPath = path.join(targetDir, safeFileName);
      fs.writeFileSync(targetPath, buffer);
      finalUrl = isPrivate ? `/api/upload/private/${safeFileName}` : `/uploads/${safeFileName}`;
    }

    return res.status(201).json({
      success: true,
      message: isPrivate
        ? 'Dokumen tersimpan secara privat.'
        : 'Berkas berhasil diunggah.',
      url: finalUrl,
      data: {
        originalName: path.basename(fileName || safeFileName),
        fileName: safeFileName,
        url: finalUrl,
        size: buffer.length,
        mimeType,
        isPrivate,
        isCloud: Boolean(cloudResult)
      }
    });
  } catch (err: any) {
    console.error('Upload handler error:', err);
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
 * Akses berkas privat terproteksi
 * GET /api/upload/private/:filename
 */
router.get(
  '/private/:filename',
  authenticateToken,
  requireRoles('super_admin', 'admin_desa', 'operator'),
  (req: AuthenticatedRequest, res: Response) => {
    const { filename } = req.params;
    const sanitized = path.basename(filename);

    if (sanitized !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Nama berkas tidak valid.' });
    }

    const filePath = path.resolve(PRIVATE_UPLOAD_DIR, sanitized);
    if (!filePath.startsWith(PRIVATE_UPLOAD_DIR)) {
      return res.status(403).json({ success: false, error: 'Akses direktori ditolak.' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Dokumen tidak ditemukan.' });
    }

    return res.sendFile(filePath);
  }
);

export default router;
