/**
 * SADEWA DIGITAL SERVICE - Sync Failure Retry Worker (scripts/retry-sync-failures.ts)
 * 
 * Memproses dan mencoba ulang item yang gagal pada antrean dual-write (data/sync-failures.json):
 * - Membaca payload dari sync-failures.json
 * - Untuk setiap item, mencoba eksekusi sync ulang ke Supabase PostgreSQL via Prisma
 * - Sukses -> Dihapus dari antrean
 * - Gagal -> Attempts di-increment, lastError diupdate, disimpan kembali
 * - Ringkasan: X sukses, Y gagal
 * - Mode --flush: Menjalankan full re-sync dari pulau_betung_db.json dan mereset antrean
 */

import fs from 'fs';
import path from 'path';
import { executeDualWriteSync } from '../server/db/sync/syncEngine';

const DATA_DIR = path.join(process.cwd(), 'data');
const FAIL_FILE = path.join(DATA_DIR, 'sync-failures.json');
const DB_FILE = path.join(DATA_DIR, 'pulau_betung_db.json');

interface FailureItem {
  id: string;
  entity: string;
  failedAt: string;
  attempts: number;
  lastError: string;
  payload: any;
}

// Map entity name to DatabaseSchema key
const ENTITY_TO_DB_KEY: Record<string, string> = {
  VillageProfile: 'villageProfile',
  User: 'users',
  Territories: 'territories',
  Dusun: 'territories',
  VillageService: 'services',
  ServiceRequest: 'serviceRequests',
  DeletedServiceRequest: 'deletedServiceRequests',
  Complaint: 'complaints',
  Resident: 'residents',
  BansosRecipient: 'bansosRecipients',
  LandParcel: 'landParcels',
  ToddlerRecord: 'toddlerRecords',
  PosyanduSchedule: 'posyanduSchedules',
  NewsItem: 'news',
  Announcement: 'announcements',
  AgendaItem: 'agendas',
  GalleryItem: 'gallery',
  BudgetYearData: 'budget',
  DevelopmentProject: 'developmentProjects',
  VillagePotential: 'potentials',
  UmkmItem: 'umkm',
  VillageOfficial: 'officials',
  MapFacility: 'facilities',
  AuditLog: 'auditLogs',
  AttendanceLog: 'attendance'
};

async function retrySyncFailures() {
  const isFlush = process.argv.includes('--flush');

  console.log('\n===============================================================');
  console.log(`🔄 [SADEWA RETRY WORKER] MEMPROSES ANTREAN GAGAL DUAL-WRITE`);
  console.log(`   Mode: ${isFlush ? '⚡ FLUSH ALL (FULL RE-SYNC)' : '🎯 ITEM-BY-ITEM RETRY'}`);
  console.log('===============================================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL tidak terdefinisi di environment!');
    return;
  }

  // MODE 1: FLUSH ALL
  if (isFlush) {
    if (!fs.existsSync(DB_FILE)) {
      console.error(`❌ File database JSON tidak ditemukan di: ${DB_FILE}`);
      return;
    }
    console.log('⚡ Menjalankan Full Sync Ulang dari data/pulau_betung_db.json...');
    const fullDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    
    // Reset hashes agar semua entitas dipaksa sinkron
    const hashFile = path.join(DATA_DIR, 'sync-hashes.json');
    if (fs.existsSync(hashFile)) fs.unlinkSync(hashFile);

    await executeDualWriteSync(fullDb);
    fs.writeFileSync(FAIL_FILE, JSON.stringify([], null, 2), 'utf-8');
    console.log('✅ Full Re-Sync selesai. Seluruh antrean kegagalan telah di-flush.\n');
    return;
  }

  // MODE 2: ITEM-BY-ITEM RETRY
  if (!fs.existsSync(FAIL_FILE)) {
    console.log('✅ Antrean sync-failures.json tidak ditemukan atau kosong. Tidak ada yang perlu diretry.\n');
    return;
  }

  let failures: FailureItem[] = [];
  try {
    failures = JSON.parse(fs.readFileSync(FAIL_FILE, 'utf-8'));
  } catch (err) {
    console.error('❌ Gagal membaca file sync-failures.json:', err);
    return;
  }

  if (!Array.isArray(failures) || failures.length === 0) {
    console.log('✅ Antrean sync-failures.json kosong (0 item). Semua data sinkron.\n');
    return;
  }

  console.log(`📦 Ditemukan ${failures.length} item dalam antrean kegagalan. Memulai proses retry...\n`);

  let successCount = 0;
  let failCount = 0;
  const stillFailed: FailureItem[] = [];

  for (const item of failures) {
    const dbKey = ENTITY_TO_DB_KEY[item.entity] || item.entity;
    console.log(`⏳ Mencoba ulang [${item.entity}] (Percobaan #${item.attempts + 1})...`);

    try {
      // Buat partial payload object untuk trigger syncEngine
      const partialDbPayload: Record<string, any> = {};
      
      // Hapus hash lama untuk entitas ini agar engine dipaksa memproses
      const hashFile = path.join(DATA_DIR, 'sync-hashes.json');
      if (fs.existsSync(hashFile)) {
        try {
          const hashes = JSON.parse(fs.readFileSync(hashFile, 'utf-8'));
          delete hashes[item.entity];
          fs.writeFileSync(hashFile, JSON.stringify(hashes, null, 2), 'utf-8');
        } catch {}
      }

      partialDbPayload[dbKey] = item.payload;
      await executeDualWriteSync(partialDbPayload);

      console.log(`   ✅ BERHASIL sinkronisasi [${item.entity}]`);
      successCount++;
    } catch (retryErr: any) {
      const errMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error(`   ❌ GAGAL sinkronisasi [${item.entity}]: ${errMsg}`);
      failCount++;

      stillFailed.push({
        ...item,
        attempts: item.attempts + 1,
        failedAt: new Date().toISOString(),
        lastError: errMsg
      });
    }
  }

  // Simpan kembali item yang masih gagal
  try {
    const tmp = `${FAIL_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(stillFailed, null, 2), 'utf-8');
    fs.renameSync(tmp, FAIL_FILE);
  } catch (saveErr) {
    console.error('⚠️ Gagal menyimpan antrean kegagalan yang tersisa:', saveErr);
  }

  console.log('\n===============================================================');
  console.log(`📊 HASIL RETRY SYNC:`);
  console.log(`   - Berhasil diproses & dihapus: ${successCount}`);
  console.log(`   - Masih gagal & disimpan:     ${failCount}`);
  console.log(`   - Sisa antrean di file:       ${stillFailed.length}`);
  console.log('===============================================================\n');
}

retrySyncFailures().catch(console.error);
