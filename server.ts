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
import { isMultiTenantRoutingEnabled } from './server/db/tenantContext';
import { runAllTenantsBackupSweep } from './server/scripts/db-backup';
import cron from 'node-cron';

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

  // --- 2. INISIALISASI PANGKALAN DATA LOKAL (Hanya jika mode fallback JSON diizinkan) ---
  if (!isMultiTenantRoutingEnabled() && process.env.MIGRATION_PHASE !== 'PHASE_3_SUPABASE_ONLY') {
    try {
      getDb();
      console.log('✅ Pangkalan data lokal fallback siap digunakan.');
    } catch (dbErr) {
      console.error('Error saat inisialisasi pangkalan data:', dbErr);
    }
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
  // 🚀 MENJALANKAN LISTENER SERVER & PENJADWAL BACKUP OTOMATIS PER-TENANT
  // ==========================================================================
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server SADEWA aktif pada port ${PORT}`);

    cron.schedule('0 2 * * *', async () => {
      console.log('⏰ [CRON-BACKUP] Memulai backup database terjadwal terisolasi per-tenant (02:00 WIB)...');
      try {
        const summary = await runAllTenantsBackupSweep();
        console.log(
          `✅ [CRON-BACKUP] Sweep selesai: ${summary.succeeded}/${summary.totalTenants} tenant berhasil, ${summary.failed} gagal.`
        );
      } catch (err: any) {
        console.error('❌ [CRON-BACKUP] Gagal:', err?.message || err);
      }
    }, {
      timezone: "Asia/Jakarta"
    });
    console.log('⏰ [CRON-SCHEDULER] Backup harian terisolasi per-tenant terkonfigurasi (02:00 WIB).');
  });
}

// Mulai nyalakan server
startServer();
