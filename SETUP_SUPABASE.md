# 🏛️ PANDUAN LENGKAP SETUP SUPABASE — SADEWA DIGITAL SERVICE
**Dokumentasi Resmi Integrasi Database Relasional (PostgreSQL) & Cloud Storage SADEWA**

---

## 1. Membuat Project Baru di Supabase

1. Kunjungi [https://supabase.com](https://supabase.com) dan login ke akun Anda.
2. Klik tombol **New Project** di dashboard organisasi Anda.
3. Masukkan konfigurasi project:
   - **Name:** `sadewa-pulau-betung` (atau nama desa Anda).
   - **Database Password:** Buat password yang kuat (contoh: minimal 16 karakter, kombinasi huruf, angka, simbol). *Simpan password ini baik-baik!*
   - **Region:** Pilih **Singapore (ap-southeast-1)** untuk latensi terendah dari Indonesia (<30ms).
   - **Pricing Plan:** Free Plan (atau Pro untuk volume produksi tinggi).
4. Klik **Create new project** dan tunggu proses provisioning (~1–2 menit).

---

## 2. Mengambil Kredensial & Connection Strings

Setelah project selesai dibuat:

### A. Connection String Database (DATABASE_URL & DIRECT_URL)
1. Buka menu **Project Settings** (ikon gerigi di sidebar kiri bawah) -> pilih tab **Database**.
2. Gulir ke bawah ke bagian **Connection string**:
   - Pilih tab **URI**.
   - Pilih mode **Transaction** (PgBouncer Pooler Port `6543`):
     ```text
     postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15&schema=sadewa
     ```
     *Gunakan string ini sebagai `DATABASE_URL` di aplikasi Express.*
   - Pilih tab **Session / Direct** (Direct Connection Port `5432`):
     ```text
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?schema=sadewa
     ```
     *Gunakan string ini sebagai `DIRECT_URL` untuk eksekusi migrasi schema Prisma CLI.*

### B. API Keys & Project URL
1. Buka menu **Project Settings** -> pilih tab **API**.
2. Salin nilai-nilai berikut:
   - **Project URL:** `https://[PROJECT_REF].supabase.co` (Masukkan ke `SUPABASE_URL`)
   - **Project API Keys (`anon` / `public`):** Masukkan ke `SUPABASE_ANON_KEY`
   - **Project API Keys (`service_role` / `secret`):** Masukkan ke `SUPABASE_SERVICE_ROLE_KEY` *(JANGAN PERNAH diekspos ke browser / client-side)*

---

## 3. Konfigurasi Variabel Lingkungan (`.env`)

Buka atau buat file `.env` di direktori root project SADEWA, lalu isi dengan format berikut:

```env
# ==============================================================================
# SADEWA DIGITAL SERVICE - SUPABASE & DATABASE CONFIGURATION
# ==============================================================================

# DATABASE_URL: Pooler PgBouncer Runtime Express (Port 6543)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15&schema=sadewa"

# DIRECT_URL: Direct PostgreSQL Connection untuk Prisma CLI (Port 5432)
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?schema=sadewa"

# MIGRATION_PHASE: Fase transisi arsitektur
# Pilihan: PHASE_1_JSON_ONLY | PHASE_2_DUAL_WRITE | PHASE_3_SUPABASE_ONLY
MIGRATION_PHASE="PHASE_2_DUAL_WRITE"

# SUPABASE STORAGE & CLIENT SDK
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
SUPABASE_STORAGE_BUCKET="sadewa-uploads"

# KUNCI KEAMANAN SESI (Minimal 32 karakter acak)
SESSION_SECRET="kunci-rahasia-sesi-sadewa-desa-pulau-betung-super-aman-2026"
```

Pastikan juga template `.env.example` telah mencantumkan variabel-variabel di atas.

---

## 4. Konfigurasi 6 Bucket Supabase Storage

SADEWA memisahkan penyimpanan berkas ke dalam 6 bucket dengan aturan privasi ketat:

| Nama Bucket | Status Privasi | Batas Ukuran | Tipe File Diizinkan (MIME) | Kegunaan |
| :--- | :--- | :--- | :--- | :--- |
| `sadewa-uploads` | **Public** | 10 MB | `image/*`, `application/pdf` | Media umum portal desa & banner |
| `ktp-kk-documents` | **Private** | 5 MB | `image/jpeg`, `image/png`, `application/pdf` | Berkas KTP/KK pemohon surat |
| `official-signatures` | **Private** | 2 MB | `image/png` | Tanda tangan & cap stempel digital Kades |
| `news-covers` | **Public** | 5 MB | `image/*` | Foto sampul berita & pengumuman desa |
| `gallery-media` | **Public** | 15 MB | `image/*`, `video/mp4` | Galeri foto & dokumentasi kegiatan |
| `project-evidences` | **Public** | 10 MB | `image/*`, `application/pdf` | Foto progres fisik pembangunan & APBDes |

### Cara Membuat Bucket di Dashboard Supabase:
1. Buka menu **Storage** di sidebar kiri dashboard Supabase.
2. Klik **New bucket**.
3. Masukkan nama bucket (misal: `ktp-kk-documents`).
4. Untuk bucket privat (`ktp-kk-documents`, `official-signatures`), pastikan toggle **Public bucket** dimatikan (**OFF**).
5. Klik **Save**.
6. Ulangi untuk ke-6 bucket di atas.

---

## 5. Menerapkan Skema Database & RLS Policy

### A. Deploy Skema Prisma ke Supabase
Jalankan perintah push skema Prisma ke database Supabase:
```bash
npx prisma db push
```
*Perintah ini akan membuat skema `sadewa` dan seluruh 22+ tabel relasional di Supabase secara otomatis.*

### B. Menerapkan Row Level Security (RLS) & Storage Security
Buka menu **SQL Editor** di dashboard Supabase, lalu jalankan query SQL berikut:

```sql
-- 1. Buat schema sadewa jika belum ada
CREATE SCHEMA IF NOT EXISTS sadewa;

-- 2. Aktifkan RLS pada seluruh tabel di schema sadewa
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'sadewa') LOOP
        EXECUTE format('ALTER TABLE sadewa.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;

-- 3. Policy Backend Proxy (Option C - SADEWA Architecture)
-- Backend Express menggunakan SUPABASE_SERVICE_ROLE_KEY untuk akses penuh dengan verifikasi RBAC di level aplikasi.
-- Berikan akses bypass RLS untuk service_role:
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'sadewa') LOOP
        EXECUTE format('DROP POLICY IF EXISTS service_role_all_access ON sadewa.%I;', r.tablename);
        EXECUTE format('CREATE POLICY service_role_all_access ON sadewa.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', r.tablename);
    END LOOP;
END $$;

-- 4. Audit Log Protection: Tabel AuditLog bersifat APPEND-ONLY (Dilarang UPDATE/DELETE bahkan oleh admin)
DROP POLICY IF EXISTS prevent_audit_tampering ON sadewa."AuditLog";
CREATE POLICY prevent_audit_tampering ON sadewa."AuditLog" FOR INSERT TO service_role WITH CHECK (true);
```

---

## 6. Verifikasi Koneksi & Kesiapan Sistem

Jalankan rangkaian perintah berikut di terminal untuk memverifikasi seluruh komponen:

### 1. Generate Prisma Client
```bash
npx prisma generate
```
*Output: `✔ Generated Prisma Client`*

### 2. Cek Status Migrasi
```bash
npx prisma migrate status
# atau
npx prisma db pull
```

### 3. Jalankan Tool Audit Konsistensi 22 Entitas
```bash
npx tsx scripts/verify-migration-consistency.ts
```
*Script ini akan membandingkan record JSON vs Supabase dan menampilkan tabel status.*

### 4. Uji Coba Worker Retry Antrean Gagal
```bash
npx tsx scripts/retry-sync-failures.ts
# atau untuk force full-sync:
npx tsx scripts/retry-sync-failures.ts --flush
```

---
**Selesai!** Setup Supabase siap digunakan untuk eksekusi **Fase 3: ETL Transfer Data Real**.
