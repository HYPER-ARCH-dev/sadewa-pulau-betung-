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
import { getUserById } from './db/prisma-helpers';

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
// 🎫 STRUKTUR DATA PAYLOAD TOKEN
// ============================================================================
export interface TokenPayload {
  userId: string;       // ID unik pengguna di database
  username: string;     // Username login
  role: 'super_admin' | 'admin_desa' | 'operator' | 'editor' | 'admin_posyandu'; // Peran dinas
  name: string;         // Nama lengkap pejabat/petugas
  tokenVersion: number; // Versi token untuk fitur pembatalan instan (Revocation)
  exp: number;          // Waktu kedaluwarsa (Unix timestamp detik)
}

/**
 * Membuat token sesi berbasis HMAC-SHA256 untuk dikirim ke browser setelah login berhasil.
 * Format token: <payload_base64url>.<tanda_tangan_hmac>
 * Masa berlaku default: 12 Jam.
 */
export function createToken(user: { id: string; username: string; role: any; name: string; tokenVersion?: number }): string {
  const secret = getSessionSecret();
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role as any,
    name: user.name,
    tokenVersion: user.tokenVersion || 1,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60) // Berlaku selama 12 jam sejak dibuat
  };
  
  // Encode payload ke format base64url yang aman di URL/header
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  // Buat tanda tangan digital HMAC-SHA256 menggunakan SESSION_SECRET
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  
  // Gabungkan payload dan signature dengan titik
  return `${payloadStr}.${signature}`;
}

/**
 * Membaca dan memverifikasi keaslian token yang dikirimkan oleh browser.
 * Menjamin token tidak dipalsukan dan belum kedaluwarsa.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getSessionSecret();
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    // Hitung ulang tanda tangan berdasarkan payload yang diterima
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    // Cek apakah tanda tangan cocok (menggunakan timingSafeEqual agar aman)
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null; // Tanda tangan palsu atau token telah dimanipulasi
    }

    // Parse JSON payload
    const payload: TokenPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    
    // Periksa apakah token sudah expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token sudah kadaluwarsa
    }
    
    return payload; // Token sah!
  } catch {
    return null;
  }
}

// Request yang telah disuntikkan data user hasil autentikasi
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Middleware: Mengamankan rute API dengan memeriksa token Authorization: Bearer <token>.
 * Melakukan verifikasi rangkap:
 * 1. Verifikasi keaslian tanda tangan token.
 * 2. Cek database apakah akun pengguna masih aktif (isActive: true).
 * 3. Cek versi token (tokenVersion) untuk memastikan token belum dicabut/logout.
 */
export const authenticateToken: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const authHeader = authReq.headers['authorization'];
    // Ambil token dari format "Bearer eyJhbGciOi..."
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

    // Pengecekan real-time langsung ke Database via Prisma
    const user = await getUserById(payload.userId);
    
    if (!user || user.isActive === false) {
      res.status(403).json({ success: false, error: 'Pengguna dinas tidak ditemukan atau telah dinonaktifkan oleh administrator.' });
      return;
    }

    // Validasi tokenVersion: Jika user ganti password atau logout di tempat lain, token lama tertolak
    if (user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ success: false, error: 'Sesi Anda telah berakhir (kata sandi telah diubah atau logout dari perangkat lain). Silakan login kembali.' });
      return;
    }

    // Lampirkan data user ke object request agar fungsi handler berikutnya bisa langsung memakainya
    // Selalu gunakan role terkini dari database, bukan dari token lama!
    authReq.user = { ...payload, role: user.role as any };
    next();
  } catch (error: any) {
    console.error('⚠️ [AUTH-MIDDLEWARE-ERROR]:', error.message);
    res.status(503).json({ success: false, error: 'Layanan autentikasi sedang gangguan (Database Offline).' });
    return;
  }
};

/**
 * Middleware: Pengecekan Hak Akses Berdasarkan Peran (Role-Based Access Control / RBAC).
 * Contoh pemakaian: requireRoles('super_admin', 'admin_desa')
 */
export function requireRoles(...allowedRoles: Array<'super_admin' | 'admin_desa' | 'operator' | 'editor' | 'admin_posyandu'>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ success: false, error: 'Diperlukan autentikasi petugas.' });
      return;
    }

    // Jika peran pengguna tidak terdaftar di daftar peran yang diizinkan
    if (!allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        error: `Akses ditolak. Peran '${authReq.user.role}' tidak memiliki izin untuk tindakan ini.`
      });
      return;
    }

    // Izin diberikan, lanjut eksekusi
    next();
  };
}
