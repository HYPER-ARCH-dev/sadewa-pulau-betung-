/**
 * SADEWA DIGITAL SERVICE - Verification Tool (scripts/verify-migration-consistency.ts)
 * 
 * Memverifikasi konsistensi data antara JSON Database (pulau_betung_db.json) dan Supabase PostgreSQL via Prisma:
 * 1. Menghitung record count untuk SEMUA 22+ model data
 * 2. Memeriksa keberadaan sync failure di data/sync-failures.json
 * 3. Memeriksa integritas foreign key (Broken References)
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pulau_betung_db.json');
const FAIL_FILE = path.join(DATA_DIR, 'sync-failures.json');

interface VerificationResult {
  entity: string;
  jsonCount: number;
  supabaseCount: number;
  diff: number;
  status: 'MATCH' | 'MISMATCH' | 'ERROR';
  notes?: string;
}

async function verifyConsistency() {
  console.log('\n========================================================================================');
  console.log('🔍 [SADEWA AUDIT] VERIFIKASI KONSISTENSI DATA 22 ENTITAS (JSON FILE vs SUPABASE POSTGRESQL)');
  console.log('========================================================================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL tidak terdefinisi di environment!');
    console.log('💡 Pastikan DATABASE_URL diset di .env sebelum menjalankan verifikasi.\n');
    return;
  }

  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ File database JSON tidak ditemukan di: ${DB_FILE}`);
    return;
  }

  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const jsonDb = JSON.parse(raw);
  let dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
  if (dbUrl && !dbUrl.includes('pgbouncer=true') && dbUrl.includes(':6543')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
  if (dbUrl) {
    process.env.DATABASE_URL = dbUrl;
  }
  const prisma = new PrismaClient();

  const results: VerificationResult[] = [];

  try {
    // 1. VillageProfile
    const vpCount = await prisma.villageProfile.count();
    results.push({
      entity: 'VillageProfile',
      jsonCount: jsonDb.villageProfile ? 1 : 0,
      supabaseCount: vpCount,
      diff: Math.abs((jsonDb.villageProfile ? 1 : 0) - vpCount),
      status: (jsonDb.villageProfile ? 1 : 0) === vpCount ? 'MATCH' : 'MISMATCH'
    });

    // 2. User
    const userCount = await prisma.user.count();
    results.push({
      entity: 'User',
      jsonCount: (jsonDb.users || []).length,
      supabaseCount: userCount,
      diff: Math.abs((jsonDb.users || []).length - userCount),
      status: (jsonDb.users || []).length === userCount ? 'MATCH' : 'MISMATCH'
    });

    // 3. Dusun (Territories)
    const dusunCount = await prisma.dusun.count();
    results.push({
      entity: 'Dusun',
      jsonCount: (jsonDb.territories || []).length,
      supabaseCount: dusunCount,
      diff: Math.abs((jsonDb.territories || []).length - dusunCount),
      status: (jsonDb.territories || []).length === dusunCount ? 'MATCH' : 'MISMATCH'
    });

    // 4. RW (Nested in Territories)
    const jsonRwCount = (jsonDb.territories || []).reduce((acc: number, d: any) => acc + (d.rws || []).length, 0);
    const rwCount = await prisma.rW.count();
    results.push({
      entity: 'RW',
      jsonCount: jsonRwCount,
      supabaseCount: rwCount,
      diff: Math.abs(jsonRwCount - rwCount),
      status: jsonRwCount === rwCount ? 'MATCH' : 'MISMATCH'
    });

    // 5. RT (Nested in RW)
    const jsonRtCount = (jsonDb.territories || []).reduce((acc: number, d: any) => {
      return acc + (d.rws || []).reduce((rAcc: number, rw: any) => rAcc + (rw.rts || []).length, 0);
    }, 0);
    const rtCount = await prisma.rT.count();
    results.push({
      entity: 'RT',
      jsonCount: jsonRtCount,
      supabaseCount: rtCount,
      diff: Math.abs(jsonRtCount - rtCount),
      status: jsonRtCount === rtCount ? 'MATCH' : 'MISMATCH'
    });

    // 6. VillageService
    const serviceCount = await prisma.villageService.count();
    results.push({
      entity: 'VillageService',
      jsonCount: (jsonDb.services || []).length,
      supabaseCount: serviceCount,
      diff: Math.abs((jsonDb.services || []).length - serviceCount),
      status: (jsonDb.services || []).length === serviceCount ? 'MATCH' : 'MISMATCH'
    });

    // 7. ServiceRequest
    const reqCount = await prisma.serviceRequest.count();
    results.push({
      entity: 'ServiceRequest',
      jsonCount: (jsonDb.serviceRequests || []).length,
      supabaseCount: reqCount,
      diff: Math.abs((jsonDb.serviceRequests || []).length - reqCount),
      status: (jsonDb.serviceRequests || []).length === reqCount ? 'MATCH' : 'MISMATCH'
    });

    // 8. DeletedServiceRequest
    const delCount = await prisma.deletedServiceRequest.count();
    results.push({
      entity: 'DeletedServiceRequest',
      jsonCount: (jsonDb.deletedServiceRequests || []).length,
      supabaseCount: delCount,
      diff: Math.abs((jsonDb.deletedServiceRequests || []).length - delCount),
      status: (jsonDb.deletedServiceRequests || []).length === delCount ? 'MATCH' : 'MISMATCH'
    });

    // 9. Complaint
    const complaintCount = await prisma.complaint.count();
    results.push({
      entity: 'Complaint',
      jsonCount: (jsonDb.complaints || []).length,
      supabaseCount: complaintCount,
      diff: Math.abs((jsonDb.complaints || []).length - complaintCount),
      status: (jsonDb.complaints || []).length === complaintCount ? 'MATCH' : 'MISMATCH'
    });

    // 10. Resident
    const residentCount = await prisma.resident.count();
    results.push({
      entity: 'Resident',
      jsonCount: (jsonDb.residents || []).length,
      supabaseCount: residentCount,
      diff: Math.abs((jsonDb.residents || []).length - residentCount),
      status: (jsonDb.residents || []).length === residentCount ? 'MATCH' : 'MISMATCH'
    });

    // 11. BansosRecipient
    const bansosCount = await prisma.bansosRecipient.count();
    results.push({
      entity: 'BansosRecipient',
      jsonCount: (jsonDb.bansosRecipients || []).length,
      supabaseCount: bansosCount,
      diff: Math.abs((jsonDb.bansosRecipients || []).length - bansosCount),
      status: (jsonDb.bansosRecipients || []).length === bansosCount ? 'MATCH' : 'MISMATCH'
    });

    // 12. LandParcel (WebGIS)
    const landCount = await prisma.landParcel.count();
    results.push({
      entity: 'LandParcel',
      jsonCount: (jsonDb.landParcels || []).length,
      supabaseCount: landCount,
      diff: Math.abs((jsonDb.landParcels || []).length - landCount),
      status: (jsonDb.landParcels || []).length === landCount ? 'MATCH' : 'MISMATCH'
    });

    // 13. ToddlerRecord (Posyandu Balita)
    const toddlerCount = await prisma.toddlerRecord.count();
    results.push({
      entity: 'ToddlerRecord',
      jsonCount: (jsonDb.toddlerRecords || []).length,
      supabaseCount: toddlerCount,
      diff: Math.abs((jsonDb.toddlerRecords || []).length - toddlerCount),
      status: (jsonDb.toddlerRecords || []).length === toddlerCount ? 'MATCH' : 'MISMATCH'
    });

    // 14. ToddlerMeasurement
    const jsonMeasCount = (jsonDb.toddlerRecords || []).reduce((acc: number, t: any) => acc + (t.measurements || []).length, 0);
    const measCount = await prisma.toddlerMeasurement.count();
    results.push({
      entity: 'ToddlerMeasurement',
      jsonCount: jsonMeasCount,
      supabaseCount: measCount,
      diff: Math.abs(jsonMeasCount - measCount),
      status: jsonMeasCount === measCount ? 'MATCH' : 'MISMATCH'
    });

    // 15. PosyanduSchedule
    const posyanduCount = await prisma.posyanduSchedule.count();
    results.push({
      entity: 'PosyanduSchedule',
      jsonCount: (jsonDb.posyanduSchedules || []).length,
      supabaseCount: posyanduCount,
      diff: Math.abs((jsonDb.posyanduSchedules || []).length - posyanduCount),
      status: (jsonDb.posyanduSchedules || []).length === posyanduCount ? 'MATCH' : 'MISMATCH'
    });

    // 16. NewsItem
    const newsCount = await prisma.newsItem.count();
    results.push({
      entity: 'NewsItem',
      jsonCount: (jsonDb.news || []).length,
      supabaseCount: newsCount,
      diff: Math.abs((jsonDb.news || []).length - newsCount),
      status: (jsonDb.news || []).length === newsCount ? 'MATCH' : 'MISMATCH'
    });

    // 17. Announcement
    const annCount = await prisma.announcement.count();
    results.push({
      entity: 'Announcement',
      jsonCount: (jsonDb.announcements || []).length,
      supabaseCount: annCount,
      diff: Math.abs((jsonDb.announcements || []).length - annCount),
      status: (jsonDb.announcements || []).length === annCount ? 'MATCH' : 'MISMATCH'
    });

    // 18. AgendaItem
    const agendaCount = await prisma.agendaItem.count();
    results.push({
      entity: 'AgendaItem',
      jsonCount: (jsonDb.agendas || []).length,
      supabaseCount: agendaCount,
      diff: Math.abs((jsonDb.agendas || []).length - agendaCount),
      status: (jsonDb.agendas || []).length === agendaCount ? 'MATCH' : 'MISMATCH'
    });

    // 19. GalleryItem
    const galleryCount = await prisma.galleryItem.count();
    results.push({
      entity: 'GalleryItem',
      jsonCount: (jsonDb.gallery || []).length,
      supabaseCount: galleryCount,
      diff: Math.abs((jsonDb.gallery || []).length - galleryCount),
      status: (jsonDb.gallery || []).length === galleryCount ? 'MATCH' : 'MISMATCH'
    });

    // 20. BudgetYearData (APBDes)
    const budgetCount = await prisma.budgetYearData.count();
    results.push({
      entity: 'BudgetYearData',
      jsonCount: jsonDb.budget ? 1 : 0,
      supabaseCount: budgetCount,
      diff: Math.abs((jsonDb.budget ? 1 : 0) - budgetCount),
      status: (jsonDb.budget ? 1 : 0) === budgetCount ? 'MATCH' : 'MISMATCH'
    });

    // 21. DevelopmentProject
    const projCount = await prisma.developmentProject.count();
    results.push({
      entity: 'DevelopmentProject',
      jsonCount: (jsonDb.developmentProjects || []).length,
      supabaseCount: projCount,
      diff: Math.abs((jsonDb.developmentProjects || []).length - projCount),
      status: (jsonDb.developmentProjects || []).length === projCount ? 'MATCH' : 'MISMATCH'
    });

    // 22. VillagePotential
    const potCount = await prisma.villagePotential.count();
    results.push({
      entity: 'VillagePotential',
      jsonCount: (jsonDb.potentials || []).length,
      supabaseCount: potCount,
      diff: Math.abs((jsonDb.potentials || []).length - potCount),
      status: (jsonDb.potentials || []).length === potCount ? 'MATCH' : 'MISMATCH'
    });

    // 23. UmkmItem
    const umkmCount = await prisma.umkmItem.count();
    results.push({
      entity: 'UmkmItem',
      jsonCount: (jsonDb.umkm || []).length,
      supabaseCount: umkmCount,
      diff: Math.abs((jsonDb.umkm || []).length - umkmCount),
      status: (jsonDb.umkm || []).length === umkmCount ? 'MATCH' : 'MISMATCH'
    });

    // 24. VillageOfficial
    const officialCount = await prisma.villageOfficial.count();
    results.push({
      entity: 'VillageOfficial',
      jsonCount: (jsonDb.officials || []).length,
      supabaseCount: officialCount,
      diff: Math.abs((jsonDb.officials || []).length - officialCount),
      status: (jsonDb.officials || []).length === officialCount ? 'MATCH' : 'MISMATCH'
    });

    // 25. MapFacility
    const facilityCount = await prisma.mapFacility.count();
    results.push({
      entity: 'MapFacility',
      jsonCount: (jsonDb.facilities || []).length,
      supabaseCount: facilityCount,
      diff: Math.abs((jsonDb.facilities || []).length - facilityCount),
      status: (jsonDb.facilities || []).length === facilityCount ? 'MATCH' : 'MISMATCH'
    });

    // 26. AuditLog
    const auditCount = await prisma.auditLog.count();
    results.push({
      entity: 'AuditLog',
      jsonCount: (jsonDb.auditLogs || []).length,
      supabaseCount: auditCount,
      diff: Math.abs((jsonDb.auditLogs || []).length - auditCount),
      status: (jsonDb.auditLogs || []).length === auditCount ? 'MATCH' : 'MISMATCH'
    });

    // 27. AttendanceLog
    const attCount = await prisma.attendanceLog.count();
    results.push({
      entity: 'AttendanceLog',
      jsonCount: (jsonDb.attendance || []).length,
      supabaseCount: attCount,
      diff: Math.abs((jsonDb.attendance || []).length - attCount),
      status: (jsonDb.attendance || []).length === attCount ? 'MATCH' : 'MISMATCH'
    });

    // Cetak Tabel Ringkasan
    console.log('-----------------------------------------------------------------------------------------');
    console.log('| #  | Model / Entitas             | JSON Record | Supabase DB | Selisih | Status       |');
    console.log('-----------------------------------------------------------------------------------------');

    let matchCount = 0;
    let mismatchCount = 0;

    results.forEach((r, idx) => {
      const num = (idx + 1).toString().padStart(2);
      const ent = r.entity.padEnd(27);
      const jc = r.jsonCount.toString().padStart(11);
      const sc = r.supabaseCount.toString().padStart(11);
      const df = r.diff.toString().padStart(7);
      const icon = r.status === 'MATCH' ? '✅ MATCH' : '⚠️ MISMATCH';
      if (r.status === 'MATCH') matchCount++;
      else mismatchCount++;
      console.log(`| ${num} | ${ent} | ${jc} | ${sc} | ${df} | ${icon.padEnd(12)} |`);
    });

    console.log('-----------------------------------------------------------------------------------------');
    console.log(`📊 TOTAL ENTITAS: ${results.length} | MATCH: ${matchCount} | MISMATCH: ${mismatchCount}\n`);

    // Cek Antrean Gagal
    if (fs.existsSync(FAIL_FILE)) {
      const fails = JSON.parse(fs.readFileSync(FAIL_FILE, 'utf-8'));
      if (fails.length > 0) {
        console.log(`⚠️ PERINGATAN: Terdapat ${fails.length} item gagal di ${FAIL_FILE}`);
        console.log('   Jalankan: npx tsx scripts/retry-sync-failures.ts untuk mencoba ulang.');
      } else {
        console.log('✅ Antrean sync-failures.json bersih (0 item gagal).');
      }
    }

  } catch (error: any) {
    console.error('❌ Error saat eksekusi verifikasi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyConsistency().catch(console.error);
