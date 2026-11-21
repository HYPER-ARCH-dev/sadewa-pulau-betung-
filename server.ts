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
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getSessionSecret } from './server/auth';
import { createApiApp } from './server/app';
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
  try {
    getSessionSecret();
    console.log('🔒 SESSION_SECRET berhasil disiapkan dan aman.');
  } catch (secErr: any) {
    console.error('❌ Peringatan Keamanan Kritis:', secErr.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // --- 2. INISIALISASI PANGKALAN DATA (DATABASE) ---
  try {
    getDb();
    console.log('✅ Pangkalan data Pulau Betung berhasil dimuat.');
  } catch (dbErr) {
    console.error('Error saat inisialisasi pangkalan data:', dbErr);
  }

  // Buat aplikasi Express bersama seluruh rute API & keamanan
  const app = createApiApp();
  const PORT = 3000;

  // ==========================================================================
  // 🌐 PENGATUR TAMPILAN FRONTEND (VITE DEV vs PRODUCTION BUILD)
  // ==========================================================================
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.sendFile(path.join(process.cwd(), 'index.html'));
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);

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
