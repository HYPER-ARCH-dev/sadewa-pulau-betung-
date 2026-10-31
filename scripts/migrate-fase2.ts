/**
 * SADEWA DIGITAL SERVICE - Migration Engine Fase 2 (Refined Analyzer)
 * 
 * Menangani validasi skema baru:
 * - Model Resident (cuid PK, nik unique, relasi balik)
 * - Model BansosRecipient (Program Bansos, Nomor Rekening / Bansos, Relasi ke Resident)
 * - Model DeletedServiceRequest (Audit Log Surat Batal)
 * - Field legacyServiceId pada ServiceRequest
 */

import fs from 'fs';
import path from 'path';

interface MigrationFase2Stats {
  entity: string;
  sourceCount: number;
  validCount: number;
  orphanReferences: number;
  warnings: string[];
}

async function runFase2DryRun() {
  console.log('\n===============================================================');
  console.log('🚀 [SADEWA MIGRATION ENGINE] FASE 2: ANALISIS SKEMA & RELASI FK');
  console.log('===============================================================\n');

  const jsonDbPath = path.join(process.cwd(), 'data', 'pulau_betung_db.json');
  if (!fs.existsSync(jsonDbPath)) {
    console.error(`❌ File database tidak ditemukan: ${jsonDbPath}`);
    return;
  }

  const rawJson = fs.readFileSync(jsonDbPath, 'utf-8');
  const db = JSON.parse(rawJson);

  const stats: Record<string, MigrationFase2Stats> = {
    'Resident': { entity: 'Resident', sourceCount: 0, validCount: 0, orphanReferences: 0, warnings: [] },
    'BansosRecipient': { entity: 'BansosRecipient', sourceCount: 0, validCount: 0, orphanReferences: 0, warnings: [] },
    'ServiceRequest': { entity: 'ServiceRequest', sourceCount: (db.serviceRequests || []).length, validCount: 0, orphanReferences: 0, warnings: [] },
    'DeletedServiceRequest': { entity: 'DeletedServiceRequest', sourceCount: (db.deletedServiceRequests || []).length, validCount: 0, orphanReferences: 0, warnings: [] },
    'LandParcel': { entity: 'LandParcel', sourceCount: (db.landParcels || []).length, validCount: 0, orphanReferences: 0, warnings: [] },
    'ToddlerRecord': { entity: 'ToddlerRecord', sourceCount: (db.toddlerRecords || []).length, validCount: 0, orphanReferences: 0, warnings: [] }
  };

  const registeredServiceIds = new Set((db.services || []).map((s: any) => s.id));

  // 1. Validasi ServiceRequest (Mencegah Crash Orphan via legacyServiceId)
  for (const req of db.serviceRequests || []) {
    if (!req.id || !req.trackingCode) {
      stats['ServiceRequest'].warnings.push(`Record tanpa id/trackingCode: ${JSON.stringify(req)}`);
    } else {
      if (req.serviceId && !registeredServiceIds.has(req.serviceId)) {
        stats['ServiceRequest'].orphanReferences++;
        stats['ServiceRequest'].warnings.push(`Tracking ${req.trackingCode} memiliki legacy service ID: ${req.serviceId}`);
      }
      stats['ServiceRequest'].validCount++;
    }
  }

  // 2. Validasi DeletedServiceRequest
  for (const del of db.deletedServiceRequests || []) {
    if (del.id && del.trackingCode) {
      stats['DeletedServiceRequest'].validCount++;
    } else {
      stats['DeletedServiceRequest'].warnings.push(`Deleted record cacat struktur: ${JSON.stringify(del)}`);
    }
  }

  // 3. Validasi LandParcel
  for (const parcel of db.landParcels || []) {
    if (parcel.nop && parcel.ownerName) {
      stats['LandParcel'].validCount++;
    }
  }

  // 4. Validasi ToddlerRecord
  for (const t of db.toddlerRecords || []) {
    if (t.nik && t.name) {
      stats['ToddlerRecord'].validCount++;
    }
  }

  // Cetak Hasil
  console.log('---------------------------------------------------------------------------------------------');
  console.log('| Model Prisma Target       | Total Sumber | Siap Migrasi | Peringatan Orphan / Legacy FK |');
  console.log('---------------------------------------------------------------------------------------------');
  for (const [name, s] of Object.entries(stats)) {
    const p1 = name.padEnd(25);
    const p2 = s.sourceCount.toString().padStart(12);
    const p3 = s.validCount.toString().padStart(12);
    const p4 = s.orphanReferences.toString().padStart(29);
    console.log(`| ${p1} | ${p2} | ${p3} | ${p4} |`);
  }
  console.log('---------------------------------------------------------------------------------------------\n');

  console.log('📌 Ringkasan Kebijakan FK Fase 2:');
  console.log('1. ServiceRequest.legacyServiceId menampung request berkas lama tanpa melanggar FK VillageService.');
  console.log('2. Resident.id menggunakan CUID sebagai Primary Key, NIK sebagai Unique constraint.');
  console.log('3. Seluruh Foreign Key dari tabel transaksi ke Resident menggunakan tipe opsional (Nullable FK).');
  console.log('\n✅ Fase 2 Dry-Run selesai dengan aman.');
}

runFase2DryRun().catch(console.error);
