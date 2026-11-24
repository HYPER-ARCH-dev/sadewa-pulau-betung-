// ============================================================================
// 🔐 SISTEM AUTENTIKASI & HAK AKSES PERAN (AUTH & RBAC SYSTEM)
// ============================================================================
// Berkas ini mengatur seluruh mekanisme keamanan login dan hak akses:
// 1. Password Hashing: Menggunakan scrypt bawaan Node.js + Salt acak 16-byte
//    agar password tidak bisa dibobol dengan rainbow table / kamus kata sandi.
// 2. Token Sesi: Dibuat menggunakan algoritma HMAC-SHA256 yang ditandatangani
//    kunci rahasia (SESSION_SECRET). Mirip JWT tapi lebih ringan dan aman.
// 3. Middleware authenticateToken: Memeriksa token di header request dan
//    memvalidasi user aktif langsung ke database secara real-time.
// 4. Force Logout (tokenVersion): Jika user ganti password atau logout,
//    nilai tokenVersion di DB dinaikkan sehingga token lama otomatis hangus!
// 5. Middleware requireRoles: Menjaga endpoint agar hanya bisa diakses oleh
//    role tertentu (misal: Super Admin, Kades, Operator, Editor Berita).
// ============================================================================

import crypto from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { getControlPlanePrisma, getUserById } from './db/prisma-helpers';
import { getCurrentTenantContext, isMultiTenantRoutingEnabled } from './db/tenantContext';
import { sanitizeDiagnosticMessage } from './db/connection-diagnostic';

// Kunci rahasia darurat untuk mode pengembangan jika developer belum membuat SESSION_SECRET di .env
let devFallbackSecret: string | null = null;

/**
 * Mengambil kunci rahasia sesi (SESSION_SECRET) dari Environment Variables.
 * Kunci ini minimal harus sepanjang 32 karakter agar tahan dari serangan brute-force.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }

  // Jika di mode produksi (.env NODE_ENV=production), kunci rahasia adalah WAJIB MUTLAK!
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: "SESSION_SECRET" (min 32 characters) MUST be defined in Environment Variables in Production!');
  }

  // Jika di mode dev lokal dan belum diset, buatkan kunci acak sementara
  if (!devFallbackSecret) {
    devFallbackSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ SESSION_SECRET tidak terdefinisi di environment. Menggunakan secret dev fallback karena bukan di production.');
  }
  return devFallbackSecret;
}

/**
 * Mengubah kata sandi biasa menjadi hash acak yang aman menggunakan scrypt.
 * @param password Kata sandi asli yang diketik user
 * @param salt Garam acak (string unik per pengguna)
 */
export function hashPassword(password: string, salt: string): string {
  // scryptSync menghasilkan hash sepanjang 64 byte dalam format heksadesimal
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Menghasilkan garam acak (salt) sepanjang 16 byte (32 karakter hex).
 * Salt memastikan dua orang dengan password sama tetap menghasilkan hash yang berbeda di DB.
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Memeriksa apakah password yang dimasukkan saat login cocok dengan hash di database.
 * Menggunakan 'crypto.timingSafeEqual' untuk mencegah peretasan berbasis pengukuran waktu respon (Timing Attack).
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = hashPassword(password, salt);
    // Membandingkan hash secara waktu-tetap (konstan)
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ============================================================================
// 🎫 STRUKTUR DATA PAYLOAD TOKEN (MULTI-TENANT + PLATFORM AWARE)
// ============================================================================
export type StaffRole =
  | 'super_admin'
  | 'admin_desa'
  | 'operator'
  | 'editor'
  | 'admin_posyandu'
  | 'platform_super_admin'
  | 'platform_ops';

export interface TokenPayload {
  scope?: 'tenant' | 'platform';
  tenantId?: string | null;
  userId: string;
  username: string;
  role: StaffRole;
  name: string;
  permissions?: string[] | Record<string, boolean>;
  tokenVersion: number;
  exp: number;
}

/**
 * Membuat token sesi berbasis HMAC-SHA256 untuk petugas/admin desa.
 * Secara otomatis mengikat `tenantId` agar token dari satu desa tidak berlaku di desa lain.
 */
export function createToken(user: {
  id: string;
  username: string;
  role: any;
  name: string;
  tokenVersion?: number;
  villageId?: string | null;
}): string {
  const secret = getSessionSecret();
  const activeCtx = getCurrentTenantContext();
  const resolvedTenantId = user.villageId ?? activeCtx?.tenantId ?? null;

  const payload: TokenPayload = {
    scope: 'tenant',
    tenantId: resolvedTenantId,
    userId: user.id,
    username: user.username,
    role: user.role as any,
    name: user.name,
    tokenVersion: user.tokenVersion || 1,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Membuat token khusus Platform Super Admin / Ops (hanya diterima oleh endpoint Platform Control Plane).
 */
export function createPlatformToken(user: {
  id: string;
  username: string;
  role: 'platform_super_admin' | 'platform_ops';
  name: string;
  tokenVersion?: number;
}): string {
  const secret = getSessionSecret();
  const payload: TokenPayload = {
    scope: 'platform',
    tenantId: null,
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    tokenVersion: user.tokenVersion || 1,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Membaca dan memverifikasi keaslian token yang dikirimkan oleh browser.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getSessionSecret();
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Middleware: Mengamankan rute API desa dengan memeriksa token Bearer, status aktif DB,
 * tokenVersion, serta batas isolasi tenant (`payload.tenantId === activeCtx.tenantId`).
 */
export const authenticateToken: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const authHeader = authReq.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ success: false, error: 'Akses ditolak. Sesi atau token otentikasi tidak ditemukan.' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ success: false, error: 'Sesi telah kedaluwarsa atau token tidak valid. Silakan login kembali.' });
      return;
    }

    // Tolak token Platform agar tidak digunakan menyamar sebagai admin desa
    if (payload.scope === 'platform') {
      res.status(403).json({
        success: false,
        error: 'Token pengelola platform tidak dapat dipakai pada endpoint operasional desa.'
      });
      return;
    }

    const activeCtx = getCurrentTenantContext();
    if (isMultiTenantRoutingEnabled() && !activeCtx?.tenantId) {
      res.status(403).json({
        success: false,
        error: 'Konteks portal desa tidak teridentifikasi untuk permintaan terautentikasi.'
      });
      return;
    }

    if (
      activeCtx?.tenantId &&
      payload.tenantId !== activeCtx.tenantId &&
      (isMultiTenantRoutingEnabled() || Boolean(payload.tenantId))
    ) {
      res.status(403).json({
        success: false,
        error: 'Token sesi tidak berlaku untuk portal desa ini (lintas-tenant ditolak).'
      });
      return;
    }

    // Pengecekan real-time langsung ke Database tenant aktif via Prisma
    const user = await getUserById(payload.userId);

    if (!user || user.isActive === false) {
      res.status(403).json({ success: false, error: 'Pengguna dinas tidak ditemukan atau telah dinonaktifkan oleh administrator.' });
      return;
    }

    if (activeCtx?.tenantId && user.villageId && user.villageId !== activeCtx.tenantId) {
      res.status(403).json({
        success: false,
        error: 'Akses ditolak: akun pengguna tidak terdaftar pada portal desa ini.'
      });
      return;
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ success: false, error: 'Sesi Anda telah berakhir (kata sandi telah diubah atau logout dari perangkat lain). Silakan login kembali.' });
      return;
    }

    const resolvedPermissions = Array.isArray(user.permissions)
      ? (user.permissions as string[])
      : user.permissions && typeof user.permissions === 'object'
      ? (user.permissions as Record<string, boolean>)
      : [];

    authReq.user = {
      ...payload,
      scope: 'tenant',
      tenantId: user.villageId ?? payload.tenantId ?? activeCtx?.tenantId ?? null,
      role: user.role as any,
      permissions: resolvedPermissions
    };
    next();
  } catch (error: any) {
    console.warn('⚠️ [AUTH-MIDDLEWARE-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    res.status(503).json({ success: false, error: 'Layanan autentikasi sedang gangguan (Database Offline).' });
    return;
  }
};

export function requireRoles(...allowedRoles: Array<'super_admin' | 'admin_desa' | 'operator' | 'editor' | 'admin_posyandu'>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ success: false, error: 'Diperlukan autentikasi petugas.' });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role as any)) {
      res.status(403).json({
        success: false,
        error: `Akses ditolak. Peran '${authReq.user.role}' tidak memiliki izin untuk tindakan ini.`
      });
      return;
    }

    next();
  };
}

export function hasModulePermission(
  permissions: TokenPayload['permissions'],
  requiredModules: string[]
): boolean {
  if (!permissions || requiredModules.length === 0) return false;
  if (Array.isArray(permissions)) {
    return requiredModules.some((mod) => permissions.includes(mod));
  }
  if (typeof permissions === 'object') {
    return requiredModules.some((mod) => (permissions as Record<string, boolean>)[mod] === true);
  }
  return false;
}

export function requireRolesOrPermission(
  allowedRoles: Array<'super_admin' | 'admin_desa' | 'operator' | 'editor' | 'admin_posyandu'>,
  requiredModules: string[] = []
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ success: false, error: 'Diperlukan autentikasi petugas.' });
      return;
    }

    if (allowedRoles.includes(authReq.user.role as any)) {
      next();
      return;
    }

    if (hasModulePermission(authReq.user.permissions, requiredModules)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: `Akses ditolak. Peran '${authReq.user.role}' tidak memiliki izin untuk modul ini.`
    });
  };
}

/**
 * Middleware: Memastikan endpoint Platform Control Plane hanya dilayani pada domain platform
 * (ketika MULTI_TENANT_ROUTING=true) dan menolak permintaan dari custom domain / subdomain desa.
 */
export const requirePlatformScopeHost: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const activeCtx = getCurrentTenantContext();
  if (isMultiTenantRoutingEnabled() && !activeCtx?.isPlatformScope) {
    res.status(403).json({
      success: false,
      error: 'Akses ditolak. Endpoint Platform Control Plane hanya tersedia melalui domain pengelola platform.'
    });
    return;
  }
  next();
};

/**
 * Middleware: Autentikasi khusus Pengelola Platform SaaS (Platform Super Admin / Platform Ops).
 * - Token harus memiliki `scope === 'platform'`.
 * - Menolak token admin desa (`scope: 'tenant'`) agar tidak pernah bisa eskalasi hak akses ke Control Plane.
 */
export const authenticatePlatformToken: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const activeCtx = getCurrentTenantContext();
    if (isMultiTenantRoutingEnabled() && !activeCtx?.isPlatformScope) {
      res.status(403).json({
        success: false,
        error: 'Endpoint Platform Control Plane tidak dapat diakses dari portal desa.'
      });
      return;
    }

    const authHeader = authReq.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ success: false, error: 'Sesi atau token pengelola platform tidak ditemukan.' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ success: false, error: 'Sesi platform telah kedaluwarsa atau token tidak valid.' });
      return;
    }

    if (payload.scope !== 'platform') {
      res.status(403).json({
        success: false,
        error: 'Akses ditolak. Token admin desa tidak diizinkan mengakses Platform Control Plane.'
      });
      return;
    }

    const platformUser = await (getControlPlanePrisma() as any).platformUser.findUnique({
      where: { id: payload.userId }
    });

    if (!platformUser || platformUser.isActive === false) {
      res.status(403).json({
        success: false,
        error: 'Akun pengelola platform tidak ditemukan atau sedang dinonaktifkan.'
      });
      return;
    }

    if (platformUser.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({
        success: false,
        error: 'Sesi pengelola platform telah dicabut. Silakan login kembali.'
      });
      return;
    }

    authReq.user = {
      ...payload,
      scope: 'platform',
      tenantId: null,
      role: platformUser.role as StaffRole,
      name: platformUser.name,
      username: platformUser.username,
      tokenVersion: platformUser.tokenVersion
    };
    next();
  } catch (error: any) {
    console.warn('⚠️ [PLATFORM-AUTH-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    res.status(503).json({ success: false, error: 'Layanan autentikasi platform sedang tidak tersedia.' });
  }
};

export function requirePlatformRoles(...allowedRoles: Array<'platform_super_admin' | 'platform_ops'>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || authReq.user.scope !== 'platform') {
      res.status(401).json({ success: false, error: 'Diperlukan autentikasi pengelola platform.' });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role as any)) {
      res.status(403).json({
        success: false,
        error: `Akses ditolak. Peran '${authReq.user.role}' tidak memiliki izin untuk tindakan platform ini.`
      });
      return;
    }

    next();
  };
}

