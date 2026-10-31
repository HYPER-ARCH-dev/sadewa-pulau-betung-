// ============================================================================
// 🏛️ SERVER UTAMA SADEWA (Sistem Administrasi & Pelayanan Desa Warga)
// ============================================================================
// Berkas ini adalah "jantung" dari backend server kita menggunakan Express.js.
// Tugas utamanya:
// 1. Menyiapkan keamanan (Helmet, Rate Limiter, Validasi Token Sesi).
// 2. Membuka pintu rute API (Autentikasi, Pelayanan Warga, Admin, AI Panjul, Upload).
// 3. Mengatur penyimpanan berkas statis & gambar hasil upload warga.
// 4. Menangani mode pengembangan (Vite Dev) vs produksi (dist static).
// 5. Menjadwalkan tugas otomatis (Cron Job) seperti backup database berkala.
// ============================================================================

import dotenv from 'dotenv';
// Muat konfigurasi dari berkas .env ke dalam process.env
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getSessionSecret } from './server/auth';
import authRouter from './server/routes/auth';
import publicRouter from './server/routes/public';
import adminRouter from './server/routes/admin';
import uploadRouter from './server/routes/upload';
import aiRouter from './server/routes/ai';
import { getDb } from './server/db/database';
import cron from 'node-cron';
import { exec } from 'child_process';
import util from 'util';

// Mengubah fungsi exec jadul (callback) jadi Promise biar bisa kita 'await' dengan rapi
const execPromise = util.promisify(exec);

/**
 * Fungsi utama untuk menyalakan server dari nol hingga siap melayani warga.
 */
async function startServer() {
// --- 1. VALIDASI KEAMANAN AWAL (SESSION SECRET) ---
// Kunci rahasia ini krusial untuk menandatangani token sesi login (HMAC-SHA256).
// Jika di produksi tidak ada kunci rahasia yang kuat, server akan menolak untuk jalan.
try {
  // Ambil kunci rahasia dari environment variable (SESSION_SECRET)
  getSessionSecret();
  console.log('🔒 SESSION_SECRET berhasil disiapkan dan aman.');
} catch (secErr: any) {
  // Catat error keamanan jika kunci rahasia tidak ditemukan atau terlalu pendek
  console.error('❌ Peringatan Keamanan Kritis:', secErr.message);
  if (process.env.NODE_ENV === 'production') {
    // Stop server jika di mode produksi demi mencegah celah keamanan fatal
    process.exit(1);
  }
}

// --- 2. INISIALISASI PANGKALAN DATA (DATABASE) ---
// Memuat data desa dari database warisan (JSON) atau Cloud DB saat server booting.
try {
  // Jalankan fungsi getDb untuk memastikan file JSON atau koneksi awal siap
  getDb();
  console.log('✅ Pangkalan data Pulau Betung berhasil dimuat.');
} catch (dbErr) {
  // Jika database gagal dimuat, catat error-nya (server tetap jalan dengan state kosong)
  console.error('Error saat inisialisasi pangkalan data:', dbErr);
}

  // Buat aplikasi express baru
  const app = express();
  // Port standar yang digunakan untuk dev server dan hosting cloud
  const PORT = 3000;

  // Percayai proxy (misal Nginx / Cloud Run / Load Balancer) supaya IP asli pengguna terbaca akurat
  // Ini krusial agar batasan request (Rate Limiting) gak salah sasaran ke IP proxy!
  app.set('trust proxy', 1);

  // Pasang Helmet untuk melindungi header HTTP dari serangan web umum (Clickjacking, XSS, sniffing)
  // Catatan: CSP & frameguard dimatikan agar iframe preview di AI Studio tetap berjalan mulus
  app.use(helmet({
    contentSecurityPolicy: false, // Vite mengurus CSP sendiri di mode development
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    frameguard: false
  }));

  // ==========================================================================
  // 🛡️ SISTEM PEMBATAS KECEPATAN (RATE LIMITERS)
  // ==========================================================================
  // Berguna untuk melindungi server dari serangan spam, bot, dan brute-force.
  
  // 1. Pembatas Login: Maksimal 10 percobaan per 15 menit per alamat IP.
  // Mencegah peretas mencoba menebak password admin secara terus-menerus.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Durasi jendela waktu: 15 menit
    max: 10, // Maksimal 10 kali percobaan per IP
    message: { success: false, error: 'Terlalu banyak percobaan masuk. Silakan coba lagi dalam 15 menit.' },
    standardHeaders: true, // Mengirim header standar RateLimit-*
    legacyHeaders: false,
  });

  // 2. Pembatas Kiriman Publik (Surat, Aduan, Kontak): Maksimal 20 kiriman per jam.
  // Mencegah formulir warga diserang bot pengirim surat palsu / spam massal.
  const publicPostLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Durasi jendela waktu: 1 jam
    max: 20, // Maksimal 20 pengajuan per jam
    message: { success: false, error: 'Batas kiriman per jam tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 3. Pembatas Tanya AI PANJUL: Maksimal 50 pertanyaan per jam per pengguna.
  // Menjaga kuota API Gemini AI agar hemat dan tidak habis dipakai secara berlebihan.
  const aiQueryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Durasi jendela waktu: 1 jam
    max: 50, // Maksimal 50 query per jam
    message: { success: false, error: 'Batas tanya AI per jam tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 4. Pembatas Absensi Perangkat Desa: Maksimal 30 request per jam.
  // Mencegah kecurangan absensi berbasis spam klik / auto-tap.
  const attendanceLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Durasi jendela waktu: 1 jam
    max: 30, // Maksimal 30 request
    message: { success: false, error: 'Batas absensi tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 5. Pembatas Upload Dokumen/Foto: Maksimal 10 upload per jam per IP.
  // Melindungi memori dan harddisk server dari kiriman file berkuran besar bertubi-tubi.
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // Durasi jendela waktu: 1 jam
    max: 10, // Maksimal 10 upload
    message: { success: false, error: 'Batas unggah berkas tercapai. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ==========================================================================
  // 📦 KONFIGURASI UKURAN DATA (PAYLOAD LIMIT)
  // ==========================================================================
  // Kita set batas maksimal JSON & form input ke 15MB.
  // Kenapa 15MB? Karena foto KTP/KK/Surat Tanah hasil foto kamera HP warga
  // seringkali beresolusi tinggi, jadi biar tidak error 'Request Entity Too Large'.
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // ==========================================================================
  // 🔒 HEADER KEAMANAN TAMBAHAN (SECURITY HEADERS)
  // ==========================================================================
  // - nosniff: Melarang browser menebak-nebak tipe file selain yang ditentukan server.
  // - X-XSS-Protection: Mengaktifkan filter bawaan browser terhadap injeksi script jahat.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // ==========================================================================
  // 📂 PENYIMPANAN BERKAS & GAMBAR HASIL UNGGAH (UPLOADS STORAGE)
  // ==========================================================================
  // Folder 'public/uploads' disiapkan otomatis jika belum ada di server.
  // Semua foto KTP, bukti aduan, struk bansos, dan logo desa disimpan di sini
  // dan bisa diakses via URL /uploads/...
  const publicUploadsStaticDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(publicUploadsStaticDir)) {
    fs.mkdirSync(publicUploadsStaticDir, { recursive: true });
  }
  app.use('/uploads', express.static(publicUploadsStaticDir));

  // Mendukung folder warisan lama (legacy) untuk menjaga kompatibilitas foto-foto lama
  const legacyPublicUploadsPath = path.join(process.cwd(), 'uploads', 'public');
  if (!fs.existsSync(legacyPublicUploadsPath)) {
    fs.mkdirSync(legacyPublicUploadsPath, { recursive: true });
  }
  app.use('/uploads/public', express.static(legacyPublicUploadsPath));

  // ==========================================================================
  // 🩺 CEK KESEHATAN SISTEM (HEALTH CHECK ENDPOINT)
  // ==========================================================================
  // Endpoint ini dipakai oleh Cloud Hosting / Uptime Monitor untuk memastikan server tetap hidup
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Sistem Informasi & Pelayanan Administrasi Desa Pulau Betung',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // ==========================================================================
  // 🚦 PENDAFTARAN RUTE API UTAMA (ROUTES REGISTRATION)
  // ==========================================================================
  // 1. Jalur Login: Diberikan pelindung loginLimiter
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', authRouter); // Login, Logout, Info Pengguna Aktif (/me), Ganti Password
  
  // 2. Jalur Layanan Publik: Kirim pengajuan surat, buat aduan, pesan kontak
  app.use('/api/public/services/apply', publicPostLimiter);
  app.use('/api/public/complaints', publicPostLimiter);
  app.use('/api/public/contact', publicPostLimiter);
  app.use('/api/public', publicRouter); // Profil desa, berita, UMKM, APBDes, penerima Bansos KPM
  
  // 3. Jalur Dashboard Khusus Petugas/Admin Desa
  app.use('/api/admin', adminRouter); // CRUD Data Warga, Validasi Surat, Laporan Keuangan
  
  // 4. Jalur Upload Berkas (Foto, PDF syarat permohonan surat)
  app.use('/api/upload', uploadLimiter, uploadRouter);
  
  // 5. Jalur AI Cerdas PANJUL (Gemini AI Chat, OCR KTP, Text-to-Speech Suara Lembut)
  app.use('/api/ai', aiQueryLimiter, aiRouter);

  // 6. Jalur Absensi Pegawai Desa dengan batasan rate limit
  app.use('/api/public/attendance/*', attendanceLimiter);
  app.use('/api/attendance/*', attendanceLimiter);

  // Alias rute publik agar bisa dipanggil langsung tanpa embel-embel /public/
  app.use('/api', publicRouter);

  // ==========================================================================
  // 🔍 PEMERIKSAAN KEASLIAN SURAT VIA QR CODE (/verify-document)
  // ==========================================================================
  // Kalau ada orang scan QR di kertas surat cetak:
  // - Jika yang minta adalah API/HP minta JSON -> kita sajikan data JSON verifikasi.
  // - Jika dibuka di browser umum -> halaman web portal akan nampilin status dokumen resmi.
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
  // Semua request yang mengarah ke /api/* tapi endpoint-nya tidak ada
  // akan otomatis dikembalikan dalam bentuk JSON (bukan halaman HTML 404 rusak).
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
  // Menjaga agar aplikasi tidak langsung mati (crash) jika ada error yang tidak terduga.
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('⚠️ [Server Error Catch]:', err);

    // Kalau respon sudah sempat dikirim sebelumnya, teruskan ke default error handler Express
    if (res.headersSent) {
      return next(err);
    }

    // Kasus 1: Ukuran berkas atau body melebihi batas (Error HTTP 413)
    if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
      return res.status(413).contentType('application/json').json({
        success: false,
        message: 'Ukuran data atau berkas terlalu besar (maksimal 10MB). Harap kompres berkas atau perkecil resolusi gambar.',
        error: 'Ukuran data atau berkas melebihi batas maksimal 10MB.'
      });
    }

    // Kasus 2: Format JSON dari klien salah/rusak (SyntaxError)
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).contentType('application/json').json({
        success: false,
        message: 'Format data JSON dalam permintaan tidak valid.',
        error: 'Format data JSON tidak valid.'
      });
    }

    // Kasus 3: Error umum lainnya (Status 4xx atau 500)
    const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600
      ? err.status
      : (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500);

    return res.status(statusCode).contentType('application/json').json({
      success: false,
      message: err.message || 'Terjadi kesalahan pada pemrosesan server.',
      error: err.message || 'Internal Server Error'
    });
  });

  // ==========================================================================
  // 🌐 PENGATUR TAMPILAN FRONTEND (VITE DEV vs PRODUCTION BUILD)
  // ==========================================================================
  if (process.env.NODE_ENV === 'production') {
    // Di mode produksi:
    // Sajikan file HTML, CSS, dan JS yang sudah di-compile ke dalam folder 'dist'
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Rute bintang (*) agar semua navigasi SPA (Single Page Application)
    // kembali membuka file index.html sehingga React Router yang mengurus halamannya.
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.sendFile(path.join(process.cwd(), 'index.html'));
      }
    });
  } else {
    // Di mode pengembangan (Development):
    // Gunakan server Vite bawaan dengan middlewareMode untuk kompilasi kilat & Hot Reload
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    
    // Lewatkan request API dan file upload agar tidak diproses oleh Vite
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
        return next();
      }
      try {
        const rawIndex = path.join(process.cwd(), 'index.html');
        if (fs.existsSync(rawIndex)) {
          const template = fs.readFileSync(rawIndex, 'utf-8');
          const html = await vite.transformIndexHtml(req.originalUrl, template);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        }
        next();
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  // ==========================================================================
  // 🚀 MENJALANKAN LISTENER SERVER & PENJADWAL BACKUP OTOMATIS
  // ==========================================================================
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Sistem Desa Pulau Betung aktif pada port ${PORT}`);
    
    // --- PENJADWALAN BACKUP OTOMATIS (CRON JOB) ---
    // Menjalankan backup database setiap malam pukul 02:00 AM WIB (Waktu Indonesia Barat)
    // saat aktivitas warga dan perangkat desa sedang sepi.
    // Format Cron: "menit(0) jam(2) hari(*) bulan(*) hari_minggu(*)"
    cron.schedule('0 2 * * *', async () => {
      console.log('⏰ [CRON-BACKUP] Memulai proses backup database terjadwal (02:00 AM)...');
      try {
        const scriptPath = path.join(process.cwd(), 'server', 'scripts', 'db-backup.ts');
        await execPromise(`npx tsx ${scriptPath}`);
        console.log('✅ [CRON-BACKUP] Sukses: Backup database harian berhasil disimpan.');
      } catch (err: any) {
        console.error('❌ [CRON-BACKUP] Gagal:', err.message);
      }
    }, {
      timezone: "Asia/Jakarta"
    });
    console.log('⏰ [CRON-SCHEDULER] Backup harian terkonfigurasi (Setiap hari pukul 02:00 WIB).');
  });
}

// Mulai nyalakan server
startServer();
