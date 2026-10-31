# 🛡️ PANDUAN PROSEDUR ROLLBACK EMERGENCY (SADEWA)

Dokumen ini berisi SOP (Standard Operating Procedure) pemulihan darurat untuk aplikasi SADEWA jika terjadi kegagalan deployment, degradasi performa, korupsi basis data, atau insiden keamanan di lingkungan produksi (GCP Cloud Run & Supabase PostgreSQL).

---

## 1. PROSEDUR ROLLBACK DEPLOYMENT CLOUD RUN

Jika versi baru yang di-deploy ke GCP Cloud Run mengalami crash, high memory, atau *unhandled exceptions*:

### A. Instant Traffic Reversion via Cloud Console / CLI
```bash
# 1. Cek daftar revisi Cloud Run yang aktif
gcloud run revisions list --service=sadewa-app --region=asia-east1

# 2. Alihkan 100% traffic secara instan ke revisi sebelumnya yang stabil
gcloud run services update-traffic sadewa-app \
  --region=asia-east1 \
  --to-revisions=sadewa-app-00014-fix=100
```

### B. Rollback Container Image via Artifact Registry
```bash
# Deploy ulang image versi stable sebelumnya
gcloud run deploy sadewa-app \
  --image=asia-east1-docker.pkg.dev/PROJECT_ID/sadewa-repo/sadewa:v1.0.4-stable \
  --region=asia-east1 \
  --platform=managed
```

---

## 2. PROSEDUR RESTORE BASIS DATA SUPABASE (DATABASE RECOVERY)

Jika terjadi insiden data terhapus secara tidak sengaja, transaksi korup, atau skema bermasalah:

### A. Point-in-Time Recovery (PITR) / Automated Backup
1. Buka **Supabase Dashboard** -> Project **SADEWA**.
2. Masuk ke menu **Database** -> **Backups**.
3. Pilih snapshot harian sebelum insiden terjadi.
4. Klik **Restore Backup** atau gunakan Point-in-Time Recovery (PITR) untuk mengembalikan state DB ke detik tertentu sebelum insiden.

### B. Fallback / Emergency Restore dari File JSON Backup
Jika koneksi Supabase terputus total atau tabel PostgreSQL rusak:
1. Ubah variabel lingkungan Cloud Run:
   ```bash
   gcloud run services update sadewa-app \
     --set-env-vars="MIGRATION_PHASE=PHASE_1_JSON_ONLY" \
     --region=asia-east1
   ```
2. Aplikasi akan otomatis mengalihkan *database engine* ke adapter file JSON lokal (`pulau_betung_db.json`) tanpa *downtime* layanan publik.
3. Setelah Supabase pulih, jalankan re-sinkronisasi ETL:
   ```bash
   npx tsx scripts/etl-migrate.ts --apply
   ```

---

## 3. PROSEDUR REVERT DATA & PEMULIHAN TRANSAKSI SALAH

Jika operator atau admin desa salah memasukkan data atau menghapus berkas/surat:

### A. Pemulihan Surat Terhapus (Deleted Request Log)
SADEWA memiliki fitur **Soft-Delete Recovery** untuk permohonan surat:
1. Login sebagai **Super Admin** / **Admin Desa**.
2. Buka **Panel Admin** -> **Manajemen Surat** -> Tab **Arsip / Log Terhapus**.
3. Cari resi surat yang terhapus, lalu klik tombol **Pulihkan Surat**.
4. API `/api/admin/requests/deleted/:id/restore` akan mengembalikan surat ke tabel utama `ServiceRequest`.

### B. Audit Log Rollback Inspector
Gunakan menu **Log & Keamanan Audit** (`/api/admin/audit-logs`) untuk mengidentifikasi ID pengguna, alamat IP, dan Timestamp saat perubahan data terjadi untuk keperluan investigasi data.

---

## 4. EMERGENCY CRITICAL BUG PROCEDURE (ISOLASI & CUTOFF)

Jika ditemukan celah keamanan kritis atau kebocoran kredensial:

### A. Cabut Sesi & Invalidate Semua Token Admin
Ubah `SESSION_SECRET` di GCP Secret Manager / Cloud Run Env Variables:
```bash
gcloud run services update sadewa-app \
  --set-env-vars="SESSION_SECRET=$(openssl rand -hex 32)" \
  --region=asia-east1
```
*Dampak: Semua token JWT aktif akan langsung kedaluwarsa, memaksa semua sesi admin untuk login ulang.*

### B. Kunci Akun Admin & Reset Password
Jalankan skrip emergency reset di server:
```bash
npx tsx scripts/create-admin.ts
```

---

## 5. CONTACT & ESCALATION MATRIX

| Peran | Kontak Darurat | Penanggung Jawab |
|---|---|---|
| Lead DevOps Engineer | devops@pulaubetung.desa.id | Infrastructure & Cloud Run |
| Database Administrator | dba@pulaubetung.desa.id | Supabase Backup & PITR |
| Security Lead | security@pulaubetung.desa.id | JWT Invalidation & Audit |
