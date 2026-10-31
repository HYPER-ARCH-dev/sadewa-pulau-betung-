/**
 * SADEWA DIGITAL SERVICE - Script Koreksi Orphan Services (scripts/fix-orphan-services.ts)
 * 
 * Script ini memeriksa data permohonan surat yang menggunakan ID legacy (misal: 'srv-domisili', 'srv-kematian')
 * dan melakukan mapping aman ke ID resmi yang terdaftar pada tabel VillageService.
 * 
 * Mode: Dapat dijalankan dengan argumen --apply untuk menulis perubahan, default adalah dry-run.
 */

import fs from 'fs';
import path from 'path';

const LEGACY_SERVICE_MAP: Record<string, string> = {
  'srv-domisili': 'srv-1', // Surat Keterangan Domisili
  'srv-kematian': 'srv-7', // Surat Keterangan Kematian
  'srv-usaha': 'srv-2',    // Surat Keterangan Usaha (SKU)
  'srv-sktm': 'srv-3',     // Surat Keterangan Tidak Mampu (SKTM)
  'srv-kelahiran': 'srv-6',// Surat Keterangan Kelahiran
  'srv-pindah': 'srv-5'    // Surat Keterangan Pindah
};

async function fixOrphanServices() {
  const isApply = process.argv.includes('--apply');
  console.log('\n===============================================================');
  console.log(`🔧 [SADEWA REPAIR] KOREKSI ORPHAN SERVICE ID (Mode: ${isApply ? 'APPLY' : 'DRY-RUN'})`);
  console.log('===============================================================\n');

  const jsonDbPath = path.join(process.cwd(), 'data', 'pulau_betung_db.json');
  if (!fs.existsSync(jsonDbPath)) {
    console.error(`❌ File database tidak ditemukan: ${jsonDbPath}`);
    return;
  }

  const rawJson = fs.readFileSync(jsonDbPath, 'utf-8');
  const db = JSON.parse(rawJson);

  const registeredServiceIds = new Set((db.services || []).map((s: any) => s.id));
  const requests = db.serviceRequests || [];

  let orphanFound = 0;
  let fixedCount = 0;

  for (const req of requests) {
    if (req.serviceId && !registeredServiceIds.has(req.serviceId)) {
      orphanFound++;
      const mappedId = LEGACY_SERVICE_MAP[req.serviceId];

      console.log(`⚠️  Ditemukan Orphan pada Request [${req.trackingCode}]:`);
      console.log(`   - Service ID Lama   : ${req.serviceId}`);
      console.log(`   - Mapping Target    : ${mappedId || 'TIDAK ADA MAPPING OTOMATIS'}`);

      if (mappedId) {
        req.legacyServiceId = req.serviceId; // Simpan ID lama untuk histori audit
        if (isApply) {
          req.serviceId = mappedId;
        }
        fixedCount++;
      }
    }
  }

  console.log('\n---------------------------------------------------------------');
  console.log(`📊 Hasil Analisis: Total Orphan: ${orphanFound} | Terpetakan: ${fixedCount}`);
  console.log('---------------------------------------------------------------');

  if (isApply) {
    fs.writeFileSync(jsonDbPath, JSON.stringify(db, null, 2), 'utf-8');
    console.log('✅ File pulau_betung_db.json berhasil diperbarui dengan backup legacyServiceId.');
  } else {
    console.log('💡 Ini adalah simulasi (Dry-Run). Jalankan: npx tsx scripts/fix-orphan-services.ts --apply untuk menerapkan.');
  }
}

fixOrphanServices().catch(console.error);
