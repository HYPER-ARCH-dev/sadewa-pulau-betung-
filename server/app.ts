// ============================================================================
// 🏛️ APLIKASI EXPRESS API SADEWA (SHARED ENTRYPOINT: NODE & VERCEL SERVERLESS)
// ============================================================================
// Berkas ini memisahkan konfigurasi Express API dari Vite dev server & cron job,
// sehingga API backend berjalan identik baik di server Node.js (server.ts)
// maupun sebagai Vercel Serverless Function (/api/index.ts).
// ============================================================================

import express from 'express';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { getSessionSecret } from './auth';
import {
  probeDatabaseStatus,
  getVillageProfile,
  isDatabaseAvailableCached,
  isJsonFallbackAllowed
} from './db/prisma-helpers';
import { getDb } from './db/database';
import {
  getCurrentTenantContext,
  isMultiTenantRoutingEnabled,
  runWithTenantContext
} from './db/tenantContext';
import {
  extractTenantRequestHostname,
  tenantResolverMiddleware,
  resolveTenantContextBySlug
} from './middleware/tenantResolver';
import { sanitizeDiagnosticMessage } from './db/connection-diagnostic';
import authRouter from './routes/auth';
import publicRouter from './routes/public';
import adminRouter from './routes/admin';
import platformRouter from './routes/platform';
import uploadRouter from './routes/upload';
import aiRouter from './routes/ai';
import { publicGisRouter, adminGisRouter } from './routes/gis';
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
  // 🛡️ SISTEM PEMBATAS KECEPATAN TERISOLASI PER-TENANT (NOISY-NEIGHBOR GUARD)
  // ==========================================================================
  const tenantKeyGenerator = (req: express.Request): string => {
    const ctx = getCurrentTenantContext();
    const tenantScopeKey =
      ctx?.tenantId ||
      (ctx?.isPlatformScope ? 'platform' : null) ||
      extractTenantRequestHostname(req) ||
      'default';
    return `${tenantScopeKey}:${ipKeyGenerator(req.ip || '127.0.0.1')}`;
  };

  const tenantApiBurstMax = Math.max(30, Number.parseInt(process.env.TENANT_API_RATE_LIMIT_PER_MIN || '300', 10) || 300);
  const tenantApiBurstLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: tenantApiBurstMax,
    keyGenerator: tenantKeyGenerator,
    skip: (req) => req.path === '/health' || req.originalUrl === '/api/health',
    message: { success: false, error: 'Batas permintaan API per menit untuk portal ini tercapai. Coba sebentar lagi.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: tenantKeyGenerator,
    message: { success: false, error: 'Terlalu banyak percobaan masuk. Silakan coba lagi dalam 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const publicPostLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    keyGenerator: tenantKeyGenerator,
    message: { success: false, error: 'Batas kiriman per jam tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiQueryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    keyGenerator: tenantKeyGenerator,
    message: { success: false, error: 'Batas tanya AI per jam tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const attendanceLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    keyGenerator: tenantKeyGenerator,
    message: { success: false, error: 'Batas absensi tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: tenantKeyGenerator,
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
  // 🌐 MULTI-TENANT HOST RESOLVER + NOISY-NEIGHBOR API LIMITER
  // ==========================================================================
  app.use(['/api', '/manifest.webmanifest', '/verify-document', '/verify', '/v'], tenantResolverMiddleware);
  app.use('/api', tenantApiBurstLimiter);

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
  // 📱 MANIFEST PWA DINAMIS PER-DESA (/manifest.webmanifest)
  // ==========================================================================
  app.get('/manifest.webmanifest', async (_req, res) => {
    const ctx = getCurrentTenantContext();
    let villageName = ctx?.tenantName || 'SADEWA - Portal Digital Desa';
    let shortName = ctx?.tenantName ? ctx.tenantName.replace(/^Desa\s+/i, '').slice(0, 14) : 'SADEWA';
    let description = 'Sistem Informasi & Pelayanan Administrasi Desa Terpadu';

    try {
      if (await isDatabaseAvailableCached()) {
        const profile = await getVillageProfile();
        if (profile?.villageName) {
          villageName = `Portal ${profile.villageName}`;
          shortName = profile.villageName.replace(/^Desa\s+/i, '').slice(0, 14) || shortName;
          description = `Layanan Administrasi & Transparansi ${profile.villageName}`;
        }
      } else if (isJsonFallbackAllowed()) {
        const fallbackProfile = getDb().villageProfile;
        if (fallbackProfile?.villageName) {
          villageName = `Portal ${fallbackProfile.villageName}`;
          shortName = fallbackProfile.villageName.replace(/^Desa\s+/i, '').slice(0, 14) || shortName;
        }
      }
    } catch {
      // Gunakan metadata tenant default jika query profil tertunda
    }

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({
      name: villageName,
      short_name: shortName,
      description,
      start_url: '/',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#047857',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }
      ]
    });
  });

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

    const ctx = getCurrentTenantContext();
    const dbUrl = process.env.DATABASE_URL || '';
    const directUrl = process.env.DIRECT_URL || '';

    const dbProbe = await probeDatabaseStatus(30000);
    const dbReachable = dbProbe.reachable;
    const dbErrorCode = dbProbe.errorCode;
    const dbErrorSummary = dbProbe.errorSummary;

    res.json({
      status: 'ok',
      service: ctx?.tenantName
        ? `Sistem Informasi & Pelayanan Administrasi ${ctx.tenantName}`
        : 'Sistem Informasi & Pelayanan Administrasi Desa SADEWA',
      version: '1.0.0',
      runtime: SERVER_CONFIG.IS_SERVERLESS ? 'serverless' : 'node',
      checks: {
        multiTenantRouting: isMultiTenantRoutingEnabled(),
        tenantScope: ctx?.isPlatformScope ? 'platform' : (ctx?.slug || 'legacy-single-tenant'),
        databaseConfigured: Boolean(dbUrl),
        directUrlConfigured: Boolean(directUrl),
        sessionSecretReady,
        supabaseStorageConfigured: Boolean(
          process.env.SUPABASE_URL &&
            (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY)
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
  app.use('/api/public/gis', publicGisRouter);
  app.use('/api/public', publicRouter);

  app.use('/api/admin/gis', adminGisRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/platform', platformRouter);
  app.use('/api/upload', uploadLimiter, uploadRouter);
  app.use('/api/ai', aiQueryLimiter, aiRouter);

  app.use('/api', publicRouter);

  // ==========================================================================
  // 🔍 PEMERIKSAAN KEASLIAN SURAT VIA QR CODE (/verify-document & /v/:slug/verify/:identifier)
  // ==========================================================================
  app.get(['/verify-document', '/verify/:identifier'], (req, res, next) => {
    const isJsonRequested = (req.headers.accept && req.headers.accept.includes('application/json')) ||
      req.query.format === 'json';
    if (isJsonRequested) {
      return (publicRouter as any).handle(req, res, next);
    }
    next();
  });

  app.get('/v/:slug/verify/:identifier', async (req, res, next) => {
    const isJsonRequested = (req.headers.accept && req.headers.accept.includes('application/json')) ||
      req.query.format === 'json';
    if (!isJsonRequested) {
      return next();
    }

    try {
      const slugCtx = await resolveTenantContextBySlug(req.params.slug);
      if (slugCtx) {
        return runWithTenantContext(slugCtx, () => (publicRouter as any).handle(req, res, next));
      }
      if (isMultiTenantRoutingEnabled()) {
        return res.status(404).json({
          success: false,
          verified: false,
          reason: 'TENANT_NOT_FOUND',
          error: `Portal desa '${req.params.slug}' tidak ditemukan atau tidak aktif.`
        });
      }
      return (publicRouter as any).handle(req, res, next);
    } catch (err: any) {
      return next(err);
    }
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
