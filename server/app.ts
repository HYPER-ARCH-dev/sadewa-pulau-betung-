// ============================================================================
// 🏛️ APLIKASI EXPRESS API SADEWA (SHARED ENTRYPOINT: NODE & VERCEL SERVERLESS)
// ============================================================================
// Berkas ini memisahkan konfigurasi Express API dari Vite dev server & cron job,
// sehingga API backend berjalan identik baik di server Node.js (server.ts)
// maupun sebagai Vercel Serverless Function (/api/index.ts).
// ============================================================================

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { getSessionSecret } from './auth';
import { getPrisma } from './db/prisma-helpers';
import { sanitizeDiagnosticMessage } from './db/connection-diagnostic';
import authRouter from './routes/auth';
import publicRouter from './routes/public';
import adminRouter from './routes/admin';
import uploadRouter from './routes/upload';
import aiRouter from './routes/ai';
import { SERVER_CONFIG } from './config/constants';

export function createApiApp(): express.Express {
  const app = express();

  // Percayai proxy (Vercel Edge / Nginx / Cloud Run) agar req.ip & Rate Limiting akurat
  app.set('trust proxy', 1);

  // Pasang Helmet untuk melindungi header HTTP dari serangan web umum
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    frameguard: false
  }));

  // ==========================================================================
  // 🛡️ SISTEM PEMBATAS KECEPATAN (RATE LIMITERS)
  // ==========================================================================
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Terlalu banyak percobaan masuk. Silakan coba lagi dalam 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const publicPostLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Batas kiriman per jam tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiQueryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: { success: false, error: 'Batas tanya AI per jam tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const attendanceLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: { success: false, error: 'Batas absensi tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Batas unggah berkas tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ==========================================================================
  // 📦 KONFIGURASI UKURAN DATA (PAYLOAD LIMIT)
  // ==========================================================================
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // ==========================================================================
  // 🔒 HEADER KEAMANAN TAMBAHAN (SECURITY HEADERS)
  // ==========================================================================
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // ==========================================================================
  // 📂 PENYIMPANAN BERKAS & GAMBAR HASIL UNGGAH (UPLOADS STORAGE)
  // ==========================================================================
  const publicUploadsStaticDir = SERVER_CONFIG.PUBLIC_UPLOAD_DIR;
  try {
    if (!fs.existsSync(publicUploadsStaticDir)) {
      fs.mkdirSync(publicUploadsStaticDir, { recursive: true });
    }
  } catch {
    // Abaikan pada filesystem read-only
  }
  app.use('/uploads', express.static(publicUploadsStaticDir));

  const legacyPublicUploadsPath = SERVER_CONFIG.LEGACY_PUBLIC_UPLOAD_DIR;
  if (legacyPublicUploadsPath !== publicUploadsStaticDir && fs.existsSync(legacyPublicUploadsPath)) {
    app.use('/uploads/public', express.static(legacyPublicUploadsPath));
  }

  // ==========================================================================
  // 🩺 CEK KESEHATAN SISTEM (HEALTH CHECK ENDPOINT)
  // ==========================================================================
  app.get('/api/health', async (_req, res) => {
    let sessionSecretReady = false;
    try {
      sessionSecretReady = Boolean(getSessionSecret());
    } catch {
      sessionSecretReady = false;
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const directUrl = process.env.DIRECT_URL || '';

    let dbReachable = false;
    let dbErrorCode: string | null = null;
    let dbErrorSummary: string | null = null;

    if (dbUrl) {
      try {
        await getPrisma().$queryRawUnsafe('SELECT 1');
        dbReachable = true;
      } catch (err: any) {
        dbReachable = false;
        dbErrorCode = typeof err?.code === 'string' ? err.code : (typeof err?.errorCode === 'string' ? err.errorCode : 'DB_ERROR');
        dbErrorSummary = sanitizeDiagnosticMessage(
          String(err?.message || 'Database connection failed'),
          [dbUrl, directUrl, process.env.SESSION_SECRET]
        );
      }
    } else {
      dbErrorCode = 'MISSING_DATABASE_URL';
      dbErrorSummary = 'DATABASE_URL environment variable is not defined.';
    }

    res.json({
      status: 'ok',
      service: 'Sistem Informasi & Pelayanan Administrasi Desa Pulau Betung',
      version: '1.0.0',
      runtime: SERVER_CONFIG.IS_SERVERLESS ? 'serverless' : 'node',
      checks: {
        databaseConfigured: Boolean(dbUrl),
        directUrlConfigured: Boolean(directUrl),
        sessionSecretReady,
        supabaseStorageConfigured: Boolean(
          process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)
        ),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        migrationPhase: process.env.MIGRATION_PHASE || 'UNSET',
        dbUsesPoolerPort: dbUrl.includes(':6543'),
        dbHasPgbouncerParam: dbUrl.includes('pgbouncer=true'),
        dbHasSchemaParam: dbUrl.includes('schema=sadewa'),
        dbReachable,
        dbErrorCode,
        dbErrorSummary
      },
      timestamp: new Date().toISOString()
    });
  });

  // ==========================================================================
  // 🚦 PENDAFTARAN RUTE API UTAMA (ROUTES REGISTRATION)
  // ==========================================================================
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', authRouter);

  app.use('/api/public/services/apply', publicPostLimiter);
  app.use('/api/public/complaints', publicPostLimiter);
  app.use('/api/public/contact', publicPostLimiter);
  app.use('/api/public/attendance/*', attendanceLimiter);
  app.use('/api/attendance/*', attendanceLimiter);
  app.use('/api/public', publicRouter);

  app.use('/api/admin', adminRouter);
  app.use('/api/upload', uploadLimiter, uploadRouter);
  app.use('/api/ai', aiQueryLimiter, aiRouter);

  app.use('/api', publicRouter);

  // ==========================================================================
  // 🔍 PEMERIKSAAN KEASLIAN SURAT VIA QR CODE (/verify-document)
  // ==========================================================================
  app.get(['/verify-document', '/verify/:identifier'], (req, res, next) => {
    const isJsonRequested = (req.headers.accept && req.headers.accept.includes('application/json')) ||
      req.query.format === 'json';
    if (isJsonRequested) {
      return (publicRouter as any).handle(req, res, next);
    }
    next();
  });

  // ==========================================================================
  // ⛔ PENANGKAP RUTE API YANG SALAH (API 404 NOT FOUND)
  // ==========================================================================
  app.all(['/api', '/api/*'], (req, res) => {
    res.status(404).contentType('application/json').json({
      success: false,
      message: `Endpoint API '${req.path}' tidak ditemukan.`,
      verified: false,
      reason: 'ENDPOINT_NOT_FOUND',
      error: `Endpoint API '${req.path}' tidak ditemukan.`
    });
  });

  // ==========================================================================
  // 🚨 PENANGANAN ERROR GLOBAL (GLOBAL ERROR HANDLER)
  // ==========================================================================
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.warn('⚠️ [Server Error Catch]:', sanitizeDiagnosticMessage(err?.message || String(err)));

    if (res.headersSent) {
      return next(err);
    }

    if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
      return res.status(413).contentType('application/json').json({
        success: false,
        message: 'Ukuran data atau berkas terlalu besar (maksimal 10MB). Harap kompres berkas atau perkecil resolusi gambar.',
        error: 'Ukuran data atau berkas melebihi batas maksimal 10MB.'
      });
    }

    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).contentType('application/json').json({
        success: false,
        message: 'Format data JSON dalam permintaan tidak valid.',
        error: 'Format data JSON tidak valid.'
      });
    }

    const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600
      ? err.status
      : (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500);

    return res.status(statusCode).contentType('application/json').json({
      success: false,
      message: err.message || 'Terjadi kesalahan pada pemrosesan server.',
      error: err.message || 'Internal Server Error'
    });
  });

  return app;
}
