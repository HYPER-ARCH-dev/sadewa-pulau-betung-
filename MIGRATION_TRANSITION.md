# 📋 STRATEGI TRANSISI MIGRASI ZERO-DOWNTIME (PHASE 2 ➔ PHASE 3)
**Proyek:** SADEWA DIGITAL SERVICE (Desa Pulau Betung)

---

## 1. Timeline & Durasi `PHASE_2_DUAL_WRITE`
* **Durasi Rekomendasi:** **7 s/d 14 Hari Kalender**.
* **Tujuan:** 
  1. Memastikan setiap penambahan permohonan surat, pendaftaran warga, data balita posyandu, dan SPORADIK tanah berhasil tersimpan identik di kedua database (JSON file & PostgreSQL Supabase).
  2. Menguji ketahanan koneksi antrean dual-write pada beban kerja harian kantor desa.

---

## 2. Prosedur Verifikasi Integritas Data (JSON == Supabase) Sebelum Cutover

Sebelum beralih ke `PHASE_3_SUPABASE_ONLY`, jalankan audit verifikasi konsistensi:

```bash
# Jalankan script komparasi checksum & record count
npx tsx scripts/verify-migration-consistency.ts
```

### Kriteria Kelayakan Cutover:
- [ ] **Row Count Match 100%**: Jumlah baris di JSON sama persis dengan tabel di Supabase untuk seluruh 22 entitas.
- [ ] **SyncFailureQueue Bersih**: Nilai `syncFailureQueue.length === 0` selama minimal 48 jam berturut-turut.
- [ ] **Foreign Key Check Passed**: Tidak ada record orphan pada `ServiceRequest.residentId` atau `ToddlerRecord.parentResidentId`.

---

## 3. Penanganan & Re-Sync Antrean Gagal (`SyncFailureQueue`)

Jika terdapat kegagalan dual-write (misalnya koneksi Supabase terputus sesaat):

1. **Penyimpanan Otomatis:** Setiap kegagalan dicatat ke array `syncFailureQueue` di `pulau_betung_db.json` dan file log `logs/dual-write-failures.log`.
2. **Background Cron Worker:** Sistem secara otomatis menjalankan *exponential backoff retry* setiap 5 menit untuk mengirim ulang data yang tertunda.
3. **Manual Re-Sync Trigger (Jika Dibutuhkan):**
   ```bash
   npx tsx scripts/retry-sync-failures.ts --flush
   ```

---

## 4. Prosedur Cutover ke `PHASE_3_SUPABASE_ONLY`

1. **Jadwalkan Waktu Transisi:** Lakukan pada sore hari di luar jam pelayanan aktif (misal: 17.00 WIB).
2. **Ubah Konfigurasi Lingkungan:**
   ```env
   MIGRATION_PHASE=PHASE_3_SUPABASE_ONLY
   ```
3. **Restart Aplikasi Server.**
4. **Verifikasi Operasional:** Uji buat 1 permohonan surat uji coba dan pastikan data langsung terbaca dari Supabase.

---

## 5. Emergency Rollback Plan (Jika Terjadi Masalah di PHASE 3)

Jika dalam 24 jam pertama setelah cutover ke PHASE 3 ditemukan kendala fatal:
1. Ubah kembali `.env` menjadi:
   ```env
   MIGRATION_PHASE=PHASE_2_DUAL_WRITE
   ```
2. Jalankan sync reverse untuk mengekspor data yang sempat masuk di Supabase kembali ke JSON file:
   ```bash
   npx tsx scripts/sync-supabase-to-json.ts
   ```
3. Kembalikan ke `MIGRATION_PHASE=PHASE_1_JSON_ONLY` jika perbaikan Supabase membutuhkan waktu lama.
