// ============================================================================
// 🔑 RUTE API AUTENTIKASI PETUGAS & ADMIN DESA (/api/auth)
// ============================================================================
// Berkas ini menangani semua urusan masuk-keluar sistem:
// 1. POST /login: Verifikasi username/email & password, proteksi brute-force
//    (kunci akun 15 menit jika 5x gagal berturut-turut), generate token sesi.
// 2. GET /me: Mengambil profil data akun petugas yang sedang aktif login.
// 3. POST /logout: Mengakhiri sesi dan menaikkan tokenVersion agar token hangus.
// 4. POST /change-password: Mengganti password lama dengan salt & hash baru.
// ============================================================================

import { Router, Request, Response } from 'express';
import { getPrisma, getUserById, recordAuditLogDb } from '../db/prisma-helpers';
import { verifyPassword, createToken, hashPassword, generateSalt, authenticateToken, AuthenticatedRequest } from '../auth';

const router = Router();

// ============================================================================
// 🚪 1. ENDPOINT LOGIN: PINTU GERBANG UTAMA PORTAL ADMIN SADEWA
// ============================================================================
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validasi input: username dan password tidak boleh kosong
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Nama pengguna dan kata sandi wajib diisi dunsanak!' });
    }

    const prisma = getPrisma();
    const identifier = String(username).trim();

    // Cari user di database berdasarkan username ATAU email.
    // Menggunakan mode 'insensitive' agar tidak sensitif huruf besar/kecil (misal Admin / admin sama saja).
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: 'insensitive' } },
          { email: { equals: identifier, mode: 'insensitive' } }
        ],
        isActive: true, // Hanya izinkan akun yang berstatus aktif
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Kredensial tidak valid. Pengguna tidak ditemukan.' });
    }

    // --- PROTEKSI SERANGAN BRUTE-FORCE (PENEBAKAN KATA SANDI) ---
    // Cek apakah akun sedang dalam masa penguncian (lockout)
    if (user.lockoutUntil) {
      const lockoutTime = new Date(user.lockoutUntil).getTime();
      const now = Date.now();
      
      // Jika waktu sekarang masih di bawah waktu selesai kunci
      if (now < lockoutTime) {
        const remainingMinutes = Math.ceil((lockoutTime - now) / (1000 * 60));
        return res.status(403).json({ 
          success: false, 
          error: `Akun terkunci sementara demi keamanan karena terlalu banyak percobaan masuk yang gagal. Silakan coba kembali dalam ${remainingMinutes} menit.` 
        });
      }
    }

    // Periksa keaslian kata sandi menggunakan fungsi hash salted scrypt
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    
    if (!isValid) {
      // --- PENANGANAN JIKA KATA SANDI SALAH ---
      // Tambah 1 ke counter gagal login secara atomic
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true, username: true, name: true, role: true }
      });

      const failedCount = updatedUser.failedLoginCount;
      const isLockout = failedCount >= 5; // Batas toleransi maksimal 5 kali gagal
      
      if (isLockout) {
        // Kunci akun selama 15 menit ke depan
        const lockoutDate = new Date(Date.now() + 15 * 60 * 1000);
        await prisma.user.update({
          where: { id: user.id },
          data: { lockoutUntil: lockoutDate }
        });
        
        // Catat ke log audit keamanan desa
        recordAuditLogDb(
          user.id, user.name, user.role,
          'Blokir Login', 'Keamanan',
          `Akun ${user.username} terkunci otomatis selama 15 menit akibat 5x gagal memasukkan kata sandi.`,
          req.ip || '127.0.0.1'
        );

        return res.status(403).json({ 
          success: false, 
          error: 'Terlalu banyak percobaan gagal. Akun Anda dikunci selama 15 menit demi keamanan data desa.' 
        });
      }

      return res.status(401).json({ 
        success: false, 
        error: `Kata sandi salah. Percobaan ke-${failedCount} dari 5. Jika gagal 5 kali, akun akan dikunci.` 
      });
    }

    // --- JIKA LOGIN BERHASIL ---
    // 1. Reset hitungan gagal login ke 0
    // 2. Buka kunci akun jika sebelumnya pernah terkunci
    // 3. Catat waktu terakhir login
    const nowIso = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockoutUntil: null,
        lastLogin: nowIso,
      },
    });

    // Buat token sesi HMAC-SHA256 untuk dipakai request selanjutnya di frontend
    const token = createToken(user as any);

    // Catat log aktivitas masuk ke sistem
    recordAuditLogDb(
      user.id, user.name, user.role,
      'Login Sistem', 'Autentikasi',
      `Petugas ${user.name} (${user.roleTitle}) berhasil masuk ke dashboard admin.`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Selamat datang kembali, ${user.name}`,
      token,
      mustChangePassword: user.mustChangePassword, // Memberi tahu frontend jika ini akun baru dan perlu ganti password
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        roleTitle: user.roleTitle,
        phone: user.phone,
        lastLogin: nowIso.toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ [AUTH-LOGIN-ERROR]:', error);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem pada server autentikasi.' });
  }
});

// ============================================================================
// 👤 2. ENDPOINT PROFIL PENGGUNA AKTIF (/api/auth/me)
// ============================================================================
// Mengembalikan identitas petugas yang sedang login berdasarkan token Bearer
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ success: false, error: 'Sesi tidak valid.' });
    }

    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        roleTitle: user.roleTitle,
        phone: user.phone,
        lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
      }
    });
  } catch (error: any) {
    console.error('❌ [AUTH-ME-ERROR]:', error);
    return res.status(500).json({ success: false, error: 'Gagal memuat profil pengguna.' });
  }
});

// ============================================================================
// 🚪 3. ENDPOINT LOGOUT PETUGAS (/api/auth/logout)
// ============================================================================
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    // Naikkan nilai tokenVersion di database agar token lama tidak bisa dipakai lagi (Revocation)
    try {
      await getPrisma().user.update({
        where: { id: req.user.userId },
        data: { tokenVersion: { increment: 1 } }
      });
    } catch (err) {
      console.warn('⚠️ Gagal menaikkan tokenVersion saat logout:', err);
    }

    // Catat log aktivitas logout
    recordAuditLogDb(
      req.user.userId,
      req.user.name,
      req.user.role,
      'Logout Sistem',
      'Autentikasi',
      `Petugas ${req.user.name} mengakhiri sesi dashboard.`,
      req.ip || '127.0.0.1'
    );
  }
  return res.json({ success: true, message: 'Berhasil keluar dari sistem.' });
});

// ============================================================================
// 🔒 4. ENDPOINT GANTI KATA SANDI (/api/auth/change-password)
// ============================================================================
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Kata sandi saat ini dan kata sandi baru harus diisi.' });
    }

    // Batasan minimal keamanan panjang password
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Kata sandi baru minimal 6 karakter demi keamanan akun dinas.' });
    }

    const user = await getUserById(req.user?.userId || '');
    if (!user) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
    }

    // Verifikasi apakah kata sandi lama benar
    const isValid = verifyPassword(currentPassword, user.passwordHash, user.salt);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Kata sandi saat ini tidak sesuai.' });
    }

    // Buat salt baru dan hash baru untuk password baru
    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword, newSalt);

    // Simpan kata sandi baru dan cabut token lama (tokenVersion + 1)
    await getPrisma().user.update({
      where: { id: user.id },
      data: {
        salt: newSalt,
        passwordHash: newHash,
        mustChangePassword: false, // Hilangkan kewajiban ganti password
        tokenVersion: { increment: 1 } // Matikan semua sesi login lama di perangkat lain
      },
    });

    recordAuditLogDb(
      user.id,
      user.name,
      user.role,
      'Ubah Kata Sandi',
      'Autentikasi',
      `Pengguna ${user.name} memperbarui kata sandi akun dinas.`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Kata sandi berhasil diperbarui.' });
  } catch (error: any) {
    console.error('❌ [AUTH-CHANGE-PASSWORD-ERROR]:', error);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui kata sandi.' });
  }
});

export default router;
