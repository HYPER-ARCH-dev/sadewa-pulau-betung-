# 🛡️ PRE-MIGRATION SAFETY PLAN: SINGLE SOURCE OF TRUTH

**Proyek:** SADEWA (Sistem Informasi & Pelayanan Desa Pulau Betung)  
**Tujuan:** Konsolidasi data dari JSON/localStorage ke Supabase PostgreSQL 17.6.

---

## 1. INVENTARISASI DATA LEGACY (JSON)
Berdasarkan audit terhadap `data/pulau_betung_db.json`:

| Entitas | Jumlah di JSON | Status di PostgreSQL | Catatan |
| :--- | :--- | :--- | :--- |
| **User** | 4 | Sinkron | `admin_sadewa` dkk sudah ada di DB. |
| **Service** | 15 | Parsial | Master data layanan surat perlu dipastikan lengkap. |
| **ServiceRequest** | 18 | **Kosong/Tertinggal** | **PRIORITAS TINGGI.** 18 record ini hanya ada di JSON. |
| **Complaint** | 3 | Kosong | Data pengaduan warga perlu dimigrasi. |
| **NewsItem** | 3 | Kosong | Berita desa perlu dimigrasi. |
| **Announcement** | 3 | Kosong | Pengumuman perlu dimigrasi. |
| **AgendaItem** | 3 | Kosong | Agenda kegiatan perlu dimigrasi. |
| **Project** | 3 | Kosong | Data pembangunan perlu dimigrasi. |
| **UMKM** | 3 | Kosong | Data UMKM perlu dimigrasi. |
| **Official** | 6 | Kosong | Struktur aparatur perlu dimigrasi. |
| **Facility** | 6 | Kosong | Fasilitas desa perlu dimigrasi. |
| **Territory** | 2 Dusun | Kosong | Struktur Dusun/RW/RT harus dimigrasi dengan relasi. |
| **Resident** | 0 | **31 (Primary)** | Data penduduk sudah berada di PostgreSQL. |
| **BansosRecipient**| 0 | **7 (Primary)** | Data KPM sudah berada di PostgreSQL. |
| **AuditLog** | 5 | 72 | Log sistem bercampur, PostgreSQL lebih lengkap. |

---

## 2. RENCANA MIGRASI 1 KALI (ONE-TIME SCRIPT)
Akan dibuat script `scripts/migrate-to-supabase.ts` dengan karakteristik:
1. **Idempotent**: Menggunakan `upsert` (update if exists, create if not) atau pengecekan ID sebelum insert.
2. **Mapping Cerdas**:
   - Menangani nested data (Dusun -> RW -> RT).
   - Konversi format tanggal string (JSON) ke `DateTime` (PostgreSQL).
   - Pemetaan field yang berbeda (misal: `coverImage` vs `imageUrl`).
3. **Prio 1: ServiceRequest**: Memastikan 18 record di JSON masuk ke PostgreSQL tanpa menimpa data baru jika ada.
4. **Transaction**: Menggunakan `prisma.$transaction` untuk entitas yang saling berhubungan (Territories).
5. **Report**: Menghasilkan log sukses/gagal per record.

---

## 3. STRATEGI BACKUP & ROLLBACK

### Langkah Pencegahan (Pre-Migration):
1. **Backup JSON**: Menyalin `data/pulau_betung_db.json` ke `backups/legacy-before-migration.json`.
2. **Backup PostgreSQL**: Menjalankan snapshot manual via `/api/admin/backups/create` sebelum script dijalankan.

### Prosedur Rollback:
- Jika script migrasi gagal total: Basis data PostgreSQL dapat dikembalikan (restore) dari snapshot terakhir.
- Code rollback: Aplikasi tetap dapat menunjuk kembali ke JSON dengan mengubah `MIGRATION_PHASE` atau memutar balik perubahan route.
- **Catatan**: File JSON tidak akan dihapus dan tetap disimpan sebagai "Cold Storage" untuk audit manual jika ditemukan diskrepansi data di masa depan.

---

## 4. DAFTAR PERUBAHAN KODE (THE CUTOVER)

### A. Refaktor `server/routes/admin.ts`
Seluruh endpoint yang menggunakan `getDb()` akan diganti dengan model Prisma:
- `GET /api/admin/news` -> `prisma.newsItem.findMany()`
- `POST /api/admin/announcements` -> `prisma.announcement.create()`
- `DELETE /api/admin/requests/:id` -> `prisma.serviceRequest.delete()` (Pindah ke `DeletedServiceRequest`)
- Dst untuk seluruh modul Publication & Development.

### B. Perbaikan Bug Master Reset
Memperbaiki model name yang salah pada endpoint `/api/admin/reset-database`:
- `deletedServiceRequestRecord` ➔ `deletedServiceRequest`
- `attendanceRecord` ➔ `attendanceLog`

### C. Refaktor Frontend `DataContext.tsx`
- Menghapus ketergantungan `localStorage` sebagai primary store.
- Memastikan `reloadServerData` memanggil seluruh endpoint API baru.
- Menghapus sinkronisasi reaktif ke `localStorage` (hanya simpan `currentUser` & `token`).

---

## 5. KRITERIA KEBERHASILAN (SUCCESS METRICS)
1. **Row Count Match**: Jumlah record di PostgreSQL sesuai dengan (JSON + existing PostgreSQL).
2. **Admin Dashboard Stats**: Statistik menampilkan data yang benar (Request: 18+, Resident: 31+).
3. **No Local Storage**: Bansos & WebGIS tetap muncul meskipun `localStorage` dibersihkan (menandakan data berasal dari API).
4. **Zero Data Loss**: 18 ServiceRequest dari JSON dapat diakses dan dikelola via dashboard admin.
