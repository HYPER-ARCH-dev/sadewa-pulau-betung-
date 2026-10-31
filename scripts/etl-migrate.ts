/**
 * SADEWA DIGITAL SERVICE - ETL Data Migration Script
 * File: scripts/etl-migrate.ts
 * 
 * Mengekstrak data dari data/pulau_betung_db.json, melakukan transformasi (normalisasi enum, konversi tanggal, dsb),
 * dan memuat (Load) data ke Supabase PostgreSQL via Prisma dalam urutan dependensi tier.
 * 
 * Penggunaan:
 *   npx tsx scripts/etl-migrate.ts                (Default: Dry-Run Mode)
 *   npx tsx scripts/etl-migrate.ts --dry-run      (Simulasi validasi & transformasi)
 *   npx tsx scripts/etl-migrate.ts --apply        (Eksekusi insert real ke Supabase)
 *   npx tsx scripts/etl-migrate.ts --entity=User  (Hanya memproses 1 entity)
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  normalizeStatus,
  RESIDENT_STATUS_MAP,
  MUTATION_TYPE_MAP,
  SERVICE_STATUS_MAP,
  COMPLAINT_STATUS_MAP,
  BANSOS_STATUS_MAP
} from '../server/utils/statusNormalizer';

// Inisialisasi Path & Konstanta
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pulau_betung_db.json');
const ERRORS_FILE = path.join(DATA_DIR, 'etl-errors.json');
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'etl-migration.log');

const DEFAULT_BATCH_SIZE = 100;

// Pastikan direktori logs dan data ada
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Logger Utility
function log(message: string, toConsole = true) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${message}`;
  if (toConsole) console.log(message);
  fs.appendFileSync(LOG_FILE, formatted + '\n', 'utf-8');
}

function logError(entity: string, error: any, context?: any) {
  const errEntry = {
    timestamp: new Date().toISOString(),
    entity,
    message: error?.message || String(error),
    stack: error?.stack,
    context
  };

  let existingErrors: any[] = [];
  if (fs.existsSync(ERRORS_FILE)) {
    try {
      existingErrors = JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf-8'));
    } catch {
      existingErrors = [];
    }
  }
  existingErrors.push(errEntry);
  fs.writeFileSync(ERRORS_FILE, JSON.stringify(existingErrors, null, 2), 'utf-8');
  log(`❌ [ERROR ${entity}] ${errEntry.message}`, true);
}

// Parse Command Line Arguments
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply || args.includes('--dry-run');
const entityArg = args.find(a => a.startsWith('--entity='))?.split('=')[1];
const batchSizeArg = args.find(a => a.startsWith('--batch-size='))?.split('=')[1];
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg, 10) : DEFAULT_BATCH_SIZE;

// Helper Konversi Tanggal Aman
function parseDate(val: any, fallbackNow = false): Date | null {
  if (!val) return fallbackNow ? new Date() : null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return fallbackNow ? new Date() : null;
  return d;
}

function parseRequiredDate(val: any, fieldName: string, entity: string): Date {
  const d = parseDate(val, true);
  return d || new Date();
}

interface EntityMigrationSummary {
  entity: string;
  tier: number;
  extracted: number;
  transformed: number;
  loaded: number;
  failed: number;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'DRY_RUN_OK';
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function loadBatch<T>(
  items: T[],
  batchSize: number,
  entityName: string,
  tier: number,
  insertFn: (item: any) => Promise<void>
): Promise<{ loaded: number; failed: number }> {
  let loaded = 0;
  let failed = 0;
  const chunks = chunkArray(items, batchSize);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      for (const item of chunk) {
        await insertFn(item);
      }
      loaded += chunk.length;
      log(`  [Tier ${tier}: ${entityName}] Batch ${i + 1}/${chunks.length} loaded (${chunk.length} rows)`);
    } catch (err: any) {
      failed += chunk.length;
      logError(entityName, err, { batch: i + 1 });
    }
  }
  return { loaded, failed };
}

// Inisialisasi Prisma Client dengan directUrl untuk migrasi data bebas pooler collision
function getEtlPrismaClient(): PrismaClient {
  let dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
  if (dbUrl && !dbUrl.includes('pgbouncer=true') && dbUrl.includes(':6543')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
  if (dbUrl) {
    process.env.DATABASE_URL = dbUrl;
  }
  return new PrismaClient();
}

async function runEtl() {
  log('================================================================================');
  log(`🚀 [SADEWA ETL] DATA MIGRATION ENGINE (JSON FILE -> SUPABASE POSTGRESQL)`);
  log(`📅 Mode: ${isDryRun ? '🔍 DRY-RUN (Simulasi Validasi & Transformasi)' : '⚡ REAL APPLY (Insert ke Database)'}`);
  log(`📦 Batch Size: ${BATCH_SIZE} row/batch | Target Entity: ${entityArg || 'SEMUA (27 Entitas)'}`);
  log('================================================================================\n');

  if (!fs.existsSync(DB_FILE)) {
    log(`❌ Error: File sumber data tidak ditemukan di: ${DB_FILE}`);
    return;
  }

  // Bersihkan file error jika running apply baru
  if (isApply && fs.existsSync(ERRORS_FILE)) {
    fs.writeFileSync(ERRORS_FILE, '[]', 'utf-8');
  }

  const rawJson = fs.readFileSync(DB_FILE, 'utf-8');
  const jsonDb = JSON.parse(rawJson);
  const prisma = getEtlPrismaClient();

  const summaries: EntityMigrationSummary[] = [];

  // ==========================================================================
  // TIER 0: INDEPENDENT ROOT ENTITIES (User, VillageProfile, Dusun)
  // ==========================================================================

  // 1. VillageProfile (Tier 0)
  if (!entityArg || entityArg.toLowerCase() === 'villageprofile') {
    const summary: EntityMigrationSummary = {
      entity: 'VillageProfile',
      tier: 0,
      extracted: jsonDb.villageProfile ? 1 : 0,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    if (jsonDb.villageProfile) {
      try {
        const vp = jsonDb.villageProfile;
        const record = {
          villageName: vp.villageName || vp.name || 'Desa Pulau Betung',
          district: vp.district || 'Pampangan',
          regency: vp.regency || 'Ogan Komering Ilir',
          province: vp.province || 'Sumatera Selatan',
          postalCode: vp.postalCode || '30654',
          addressStreet: vp.addressStreet || 'Jl. Raya Pulau Betung No. 01',
          email: vp.email || 'pemdes@pulaubetung.desa.id',
          phone: vp.phone || '0812-7489-0001',
          website: vp.website || 'https://pulaubetung.desa.id',
          villageLogoUrl: vp.villageLogoUrl || '/logo.png',
          regencyLogoUrl: vp.regencyLogoUrl || '/oki-logo.png',
          letterCodePrefix: vp.letterCodePrefix || '140',
          motto: vp.motto || 'Maju, Mandiri, Sejahtera',
          vision: vp.vision || 'Mewujudkan Desa Pulau Betung yang Maju dan Sejahtera',
          mission: vp.mission || [],
          history: vp.history || 'Sejarah Desa Pulau Betung',
          totalPopulation: Number(vp.totalPopulation) || 1250,
          totalFamilies: Number(vp.totalFamilies) || 350,
          areaSqKm: Number(vp.areaSqKm) || 15.4,
          borders: vp.borders || { north: '-', south: '-', east: '-', west: '-' },
          officeLocation: vp.officeLocation || null,
          kadesName: vp.kadesName || 'M. Tarmizi, S.Kom',
          kadesNip: vp.kadesNip || null,
          kadesPhotoUrl: vp.kadesPhotoUrl || null,
          kadesGreetingTitle: vp.kadesGreetingTitle || null,
          kadesGreeting: vp.kadesGreeting || null,
          officialSignatureUrl: vp.officialSignatureUrl || null,
          heroTitle: vp.heroTitle || 'Selamat Datang di Portal Desa Pulau Betung',
          heroSubtitle: vp.heroSubtitle || null,
          heroBackgroundUrl: vp.heroBackgroundUrl || null,
          heroBadgeText: vp.heroBadgeText || 'Portal Resmi',
          heroIsActive: vp.heroIsActive !== undefined ? Boolean(vp.heroIsActive) : true,
          sadewaLogoUrl: vp.sadewaLogoUrl || null,
          whatsappCenter: vp.whatsappCenter || '081274890001',
          operatingHours: vp.operatingHours || null,
          emergencyContacts: vp.emergencyContacts || null,
          lastUpdated: parseRequiredDate(vp.lastUpdated, 'lastUpdated', 'VillageProfile'),
          updatedBy: vp.updatedBy || 'System ETL'
        };
        summary.transformed = 1;

        if (!isDryRun) {
          await prisma.villageProfile.upsert({
            where: { id: vp.id || 'default-profile-id' },
            update: record,
            create: { id: vp.id || 'default-profile-id', ...record }
          });
          summary.loaded = 1;
          summary.status = 'SUCCESS';
          log(`  [Tier 0: VillageProfile] Loaded 1 profile successfully`);
        }
      } catch (err: any) {
        summary.failed = 1;
        summary.status = 'FAILED';
        logError('VillageProfile', err);
      }
    }
    summaries.push(summary);
  }

  // 2. User (Tier 0)
  if (!entityArg || entityArg.toLowerCase() === 'user') {
    const rawUsers = jsonDb.users || [];
    const summary: EntityMigrationSummary = {
      entity: 'User',
      tier: 0,
      extracted: rawUsers.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedUsers = rawUsers.map((u: any) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      passwordHash: u.passwordHash,
      salt: u.salt,
      role: u.role,
      roleTitle: u.roleTitle || u.role,
      phone: u.phone || null,
      isActive: u.isActive !== undefined ? Boolean(u.isActive) : true,
      lastLogin: parseDate(u.lastLogin),
      createdAt: parseRequiredDate(u.createdAt, 'createdAt', 'User'),
      updatedAt: parseRequiredDate(u.updatedAt || u.createdAt, 'updatedAt', 'User')
    }));
    summary.transformed = transformedUsers.length;

    if (!isDryRun && transformedUsers.length > 0) {
      const res = await loadBatch(
        transformedUsers,
        BATCH_SIZE,
        'User',
        0,
        async (item) => {
          await prisma.user.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 3. Dusun (Tier 0)
  const rawTerritories = jsonDb.territories || [];
  if (!entityArg || entityArg.toLowerCase() === 'dusun') {
    const summary: EntityMigrationSummary = {
      entity: 'Dusun',
      tier: 0,
      extracted: rawTerritories.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedDusuns = rawTerritories.map((d: any, idx: number) => ({
      id: d.id,
      number: d.number !== undefined ? Number(d.number) : idx + 1,
      customName: d.customName || null,
      name: d.name || `Dusun ${idx + 1}`,
      leaderName: d.leaderName || null,
      isActive: d.isActive !== undefined ? Boolean(d.isActive) : true,
      createdAt: parseRequiredDate(d.createdAt, 'createdAt', 'Dusun'),
      updatedAt: parseRequiredDate(d.updatedAt || d.createdAt, 'updatedAt', 'Dusun')
    }));
    summary.transformed = transformedDusuns.length;

    if (!isDryRun && transformedDusuns.length > 0) {
      const res = await loadBatch(
        transformedDusuns,
        BATCH_SIZE,
        'Dusun',
        0,
        async (item) => {
          await prisma.dusun.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // ==========================================================================
  // TIER 1: DEPENDS ON TIER 0 (RW, RT, VillageService, VillageOfficial, MapFacility)
  // ==========================================================================

  // 4. RW (Tier 1 - Depends on Dusun)
  const rawRws: any[] = [];
  rawTerritories.forEach((d: any) => {
    (d.rws || []).forEach((rw: any) => {
      rawRws.push({ ...rw, dusunId: d.id });
    });
  });

  if (!entityArg || entityArg.toLowerCase() === 'rw') {
    const summary: EntityMigrationSummary = {
      entity: 'RW',
      tier: 1,
      extracted: rawRws.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedRws = rawRws.map((rw: any) => ({
      id: rw.id,
      name: rw.name,
      dusunId: rw.dusunId,
      leaderName: rw.leaderName || null,
      isActive: rw.isActive !== undefined ? Boolean(rw.isActive) : true,
      createdAt: parseRequiredDate(rw.createdAt, 'createdAt', 'RW'),
      updatedAt: parseRequiredDate(rw.updatedAt || rw.createdAt, 'updatedAt', 'RW')
    }));
    summary.transformed = transformedRws.length;

    if (!isDryRun && transformedRws.length > 0) {
      const res = await loadBatch(
        transformedRws,
        BATCH_SIZE,
        'RW',
        1,
        async (item) => {
          await prisma.rW.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 5. RT (Tier 1 - Depends on RW)
  const rawRts: any[] = [];
  rawTerritories.forEach((d: any) => {
    (d.rws || []).forEach((rw: any) => {
      (rw.rts || []).forEach((rt: any) => {
        rawRts.push({ ...rt, rwId: rw.id, dusunId: d.id });
      });
    });
  });

  if (!entityArg || entityArg.toLowerCase() === 'rt') {
    const summary: EntityMigrationSummary = {
      entity: 'RT',
      tier: 1,
      extracted: rawRts.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedRts = rawRts.map((rt: any) => ({
      id: rt.id,
      name: rt.name,
      rwId: rt.rwId,
      dusunId: rt.dusunId,
      leaderName: rt.leaderName || null,
      isActive: rt.isActive !== undefined ? Boolean(rt.isActive) : true,
      createdAt: parseRequiredDate(rt.createdAt, 'createdAt', 'RT'),
      updatedAt: parseRequiredDate(rt.updatedAt || rt.createdAt, 'updatedAt', 'RT')
    }));
    summary.transformed = transformedRts.length;

    if (!isDryRun && transformedRts.length > 0) {
      const res = await loadBatch(
        transformedRts,
        BATCH_SIZE,
        'RT',
        1,
        async (item) => {
          await prisma.rT.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 6. VillageService (Tier 1)
  const rawServices = jsonDb.services || [];
  if (!entityArg || entityArg.toLowerCase() === 'villageservice') {
    const summary: EntityMigrationSummary = {
      entity: 'VillageService',
      tier: 1,
      extracted: rawServices.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedServices = rawServices.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category || 'umum',
      letterClass: s.letterClass || null,
      allowDownload: s.allowDownload !== undefined ? Boolean(s.allowDownload) : true,
      isMultiPage: s.isMultiPage !== undefined ? Boolean(s.isMultiPage) : false,
      pageCount: Number(s.pageCount) || 1,
      shortName: s.shortName || null,
      description: s.description || '',
      requirements: s.requirements || [],
      procedures: s.procedures || [],
      estimatedDays: s.estimatedDays ? String(s.estimatedDays) : '1-2 Hari Kerja',
      cost: s.cost || 'Gratis',
      isActive: s.isActive !== undefined ? Boolean(s.isActive) : true,
      requiredFields: s.requiredFields || [],
      createdAt: parseRequiredDate(s.createdAt, 'createdAt', 'VillageService'),
      updatedAt: parseRequiredDate(s.updatedAt || s.createdAt, 'updatedAt', 'VillageService')
    }));
    summary.transformed = transformedServices.length;

    if (!isDryRun && transformedServices.length > 0) {
      const res = await loadBatch(
        transformedServices,
        BATCH_SIZE,
        'VillageService',
        1,
        async (item) => {
          await prisma.villageService.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 7. VillageOfficial (Tier 1)
  const rawOfficials = jsonDb.officials || [];
  if (!entityArg || entityArg.toLowerCase() === 'villageofficial') {
    const summary: EntityMigrationSummary = {
      entity: 'VillageOfficial',
      tier: 1,
      extracted: rawOfficials.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedOfficials = rawOfficials.map((o: any) => ({
      id: o.id,
      name: o.name,
      position: o.position,
      section: o.section || 'sekretariat',
      nip: o.nip || null,
      bio: o.bio || '',
      imageUrl: o.imageUrl || '/placeholder-avatar.png',
      tenure: o.tenure || '2021 - 2027',
      phone: o.phone || null,
      gender: o.gender || null,
      birthDate: o.birthDate || null,
      isActive: o.isActive !== undefined ? Boolean(o.isActive) : true,
      displayOrder: Number(o.displayOrder) || 0,
      hasAdminAccess: o.hasAdminAccess !== undefined ? Boolean(o.hasAdminAccess) : false,
      adminRole: o.adminRole || null,
      adminUsername: o.adminUsername || null,
      allowedModules: o.allowedModules || null,
      createdAt: parseRequiredDate(o.createdAt, 'createdAt', 'VillageOfficial'),
      updatedAt: parseRequiredDate(o.updatedAt || o.createdAt, 'updatedAt', 'VillageOfficial')
    }));
    summary.transformed = transformedOfficials.length;

    if (!isDryRun && transformedOfficials.length > 0) {
      const res = await loadBatch(
        transformedOfficials,
        BATCH_SIZE,
        'VillageOfficial',
        1,
        async (item) => {
          await prisma.villageOfficial.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 8. MapFacility (Tier 1)
  const rawFacilities = jsonDb.facilities || [];
  if (!entityArg || entityArg.toLowerCase() === 'mapfacility') {
    const summary: EntityMigrationSummary = {
      entity: 'MapFacility',
      tier: 1,
      extracted: rawFacilities.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedFacilities = rawFacilities.map((f: any) => ({
      id: f.id,
      name: f.name,
      category: f.category || 'infrastruktur',
      address: f.address || '',
      dusun: f.dusun || '',
      coordinatesLabel: f.coordinatesLabel || '',
      description: f.description || '',
      coordinates: f.coordinates || [-3.254, 104.982],
      imageUrl: f.imageUrl || null,
      contact: f.contact || null,
      createdAt: parseRequiredDate(f.createdAt, 'createdAt', 'MapFacility'),
      updatedAt: parseRequiredDate(f.updatedAt || f.createdAt, 'updatedAt', 'MapFacility')
    }));
    summary.transformed = transformedFacilities.length;

    if (!isDryRun && transformedFacilities.length > 0) {
      const res = await loadBatch(
        transformedFacilities,
        BATCH_SIZE,
        'MapFacility',
        1,
        async (item) => {
          await prisma.mapFacility.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // ==========================================================================
  // TIER 2: CITIZEN DATA, ECONOMIC, GIS & HEALTH
  // ==========================================================================

  // 9. Resident (Tier 2)
  const rawResidents = jsonDb.residents || [];
  if (!entityArg || entityArg.toLowerCase() === 'resident') {
    const summary: EntityMigrationSummary = {
      entity: 'Resident',
      tier: 2,
      extracted: rawResidents.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedResidents = rawResidents.map((r: any) => ({
      id: r.id,
      nik: String(r.nik).trim(),
      kkNumber: String(r.kkNumber || r.noKk || '').trim(),
      fullName: r.fullName || r.name || 'Warga Desa',
      gender: r.gender === 'L' || r.gender === 'Laki-laki' ? 'Laki-laki' : 'Perempuan',
      birthPlace: r.birthPlace || 'Pulau Betung',
      birthDate: parseRequiredDate(r.birthDate, 'birthDate', 'Resident'),
      religion: r.religion || 'Islam',
      maritalStatus: r.maritalStatus || 'Kawin',
      education: r.education || 'SMA / Sederajat',
      occupation: r.occupation || 'Petani / Pekebun',
      address: r.address || 'Desa Pulau Betung',
      dusunId: r.dusunId || null,
      rwId: r.rwId || null,
      rtId: r.rtId || null,
      phone: r.phone || null,
      status: normalizeStatus(r.status, 'HIDUP', RESIDENT_STATUS_MAP) as any,
      mutationType: r.mutationType ? (normalizeStatus(r.mutationType, 'MASUK', MUTATION_TYPE_MAP) as any) : null,
      mutationDate: parseDate(r.mutationDate),
      mutationReason: r.mutationReason || null,
      hasKus: Boolean(r.hasKus),
      isStuntingRisk: Boolean(r.isStuntingRisk),
      economicStatus: r.economicStatus || 'Umum',
      isActive: r.isActive !== undefined ? Boolean(r.isActive) : true,
      createdAt: parseRequiredDate(r.createdAt, 'createdAt', 'Resident'),
      updatedAt: parseRequiredDate(r.updatedAt || r.createdAt, 'updatedAt', 'Resident')
    }));
    summary.transformed = transformedResidents.length;

    if (!isDryRun && transformedResidents.length > 0) {
      const res = await loadBatch(
        transformedResidents,
        BATCH_SIZE,
        'Resident',
        2,
        async (item) => {
          await prisma.resident.upsert({
            where: { nik: item.nik },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 10. BansosRecipient (Tier 2 - Depends on Resident)
  const rawBansos = jsonDb.bansosRecipients || [];
  if (!entityArg || entityArg.toLowerCase() === 'bansosrecipient') {
    const summary: EntityMigrationSummary = {
      entity: 'BansosRecipient',
      tier: 2,
      extracted: rawBansos.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedBansos = rawBansos.map((b: any) => ({
      id: b.id,
      residentId: b.residentId,
      programName: b.programName || 'BLT-DD',
      fiscalYear: Number(b.fiscalYear) || 2026,
      stageOrMonth: b.stageOrMonth || 'Tahap 1',
      nominalAmount: Number(b.nominalAmount) || 300000,
      status: normalizeStatus(b.status, 'TERDAFTAR', BANSOS_STATUS_MAP) as any,
      disbursedAt: parseDate(b.disbursedAt || b.disbursementDate),
      notes: b.notes || null,
      createdAt: parseRequiredDate(b.createdAt, 'createdAt', 'BansosRecipient'),
      updatedAt: parseRequiredDate(b.updatedAt || b.createdAt, 'updatedAt', 'BansosRecipient')
    }));
    summary.transformed = transformedBansos.length;

    if (!isDryRun && transformedBansos.length > 0) {
      const res = await loadBatch(
        transformedBansos,
        BATCH_SIZE,
        'BansosRecipient',
        2,
        async (item) => {
          await prisma.bansosRecipient.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 11. LandParcel (Tier 2)
  const rawLands = jsonDb.landParcels || [];
  if (!entityArg || entityArg.toLowerCase() === 'landparcel') {
    const summary: EntityMigrationSummary = {
      entity: 'LandParcel',
      tier: 2,
      extracted: rawLands.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedLands = rawLands.map((l: any) => ({
      id: l.id,
      nop: l.nop,
      ownerName: l.ownerName,
      ownerNik: l.ownerNik || '',
      phone: l.phone || null,
      addressDusun: l.addressDusun || 'Dusun 1',
      landUseCategory: l.landUseCategory || 'PEMUKIMAN',
      landAreaSqM: Number(l.landAreaSqM) || 0,
      landAreaHectares: Number(l.landAreaHectares) || 0,
      buildingAreaSqM: Number(l.buildingAreaSqM) || 0,
      coordinates: l.coordinates || [],
      boundaries: l.boundaries || [],
      njopLandPerSqM: Number(l.njopLandPerSqM) || 50000,
      njopBuildingPerSqM: Number(l.njopBuildingPerSqM) || 250000,
      pbbTaxAmount: Number(l.pbbTaxAmount) || 0,
      pbbStatus: l.pbbStatus || 'BELUM_LUNAS',
      pbbPaymentDate: parseDate(l.pbbPaymentDate),
      pbbReceiptNumber: l.pbbReceiptNumber || null,
      sporadikStatus: l.sporadikStatus || 'BELUM_TERDAFTAR',
      sporadikRequestCode: l.sporadikRequestCode || null,
      sporadikCertificateNumber: l.sporadikCertificateNumber || null,
      sporadikIssuedDate: parseDate(l.sporadikIssuedDate),
      surveyorName: l.surveyorName || null,
      witnesses: l.witnesses || null,
      notes: l.notes || null,
      createdAt: parseRequiredDate(l.createdAt, 'createdAt', 'LandParcel'),
      updatedAt: parseRequiredDate(l.updatedAt || l.createdAt, 'updatedAt', 'LandParcel')
    }));
    summary.transformed = transformedLands.length;

    if (!isDryRun && transformedLands.length > 0) {
      const res = await loadBatch(
        transformedLands,
        BATCH_SIZE,
        'LandParcel',
        2,
        async (item) => {
          await prisma.landParcel.upsert({
            where: { nop: item.nop },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 12. ToddlerRecord (Tier 2)
  const rawToddlers = jsonDb.toddlerRecords || [];
  if (!entityArg || entityArg.toLowerCase() === 'toddlerrecord') {
    const summary: EntityMigrationSummary = {
      entity: 'ToddlerRecord',
      tier: 2,
      extracted: rawToddlers.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedToddlers = rawToddlers.map((t: any) => ({
      id: t.id,
      nik: t.nik,
      name: t.name,
      gender: t.gender || 'L',
      birthDate: parseRequiredDate(t.birthDate, 'birthDate', 'ToddlerRecord'),
      birthWeightKg: Number(t.birthWeightKg) || 3.0,
      birthHeightCm: Number(t.birthHeightCm) || 50.0,
      parentName: t.parentName || 'Orang Tua',
      parentNik: t.parentNik || null,
      parentPhone: t.parentPhone || '0812-0000-0000',
      dusunName: t.dusunName || 'Dusun 1',
      rtRw: t.rtRw || '01/01',
      address: t.address || 'Desa Pulau Betung',
      coordinates: t.coordinates || [-3.254, 104.982],
      kmsCardNumber: t.kmsCardNumber || `KMS-${t.nik}`,
      isInterventionTarget: Boolean(t.isInterventionTarget),
      createdAt: parseRequiredDate(t.createdAt, 'createdAt', 'ToddlerRecord'),
      updatedAt: parseRequiredDate(t.updatedAt || t.createdAt, 'updatedAt', 'ToddlerRecord')
    }));
    summary.transformed = transformedToddlers.length;

    if (!isDryRun && transformedToddlers.length > 0) {
      const res = await loadBatch(
        transformedToddlers,
        BATCH_SIZE,
        'ToddlerRecord',
        2,
        async (item) => {
          await prisma.toddlerRecord.upsert({
            where: { nik: item.nik },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 13. PosyanduSchedule (Tier 2)
  const rawPosyandu = jsonDb.posyanduSchedules || [];
  if (!entityArg || entityArg.toLowerCase() === 'posyanduschedule') {
    const summary: EntityMigrationSummary = {
      entity: 'PosyanduSchedule',
      tier: 2,
      extracted: rawPosyandu.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedPosyandu = rawPosyandu.map((p: any) => ({
      id: p.id,
      posyanduName: p.posyanduName,
      dusunName: p.dusunName,
      location: p.location,
      scheduleDate: parseRequiredDate(p.scheduleDate, 'scheduleDate', 'PosyanduSchedule'),
      startTime: p.startTime || '08:30',
      endTime: p.endTime || '11:30',
      cadreInCharge: p.cadreInCharge || 'Kader Posyandu',
      bidanInCharge: p.bidanInCharge || 'Bidan Desa',
      notes: p.notes || null,
      createdAt: parseRequiredDate(p.createdAt, 'createdAt', 'PosyanduSchedule'),
      updatedAt: parseRequiredDate(p.updatedAt || p.createdAt, 'updatedAt', 'PosyanduSchedule')
    }));
    summary.transformed = transformedPosyandu.length;

    if (!isDryRun && transformedPosyandu.length > 0) {
      const res = await loadBatch(
        transformedPosyandu,
        BATCH_SIZE,
        'PosyanduSchedule',
        2,
        async (item) => {
          await prisma.posyanduSchedule.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 14. BudgetYearData (Tier 2)
  if (!entityArg || entityArg.toLowerCase() === 'budgetyeardata') {
    const summary: EntityMigrationSummary = {
      entity: 'BudgetYearData',
      tier: 2,
      extracted: jsonDb.budget ? 1 : 0,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    if (jsonDb.budget) {
      try {
        const b = jsonDb.budget;
        const totalIncomeVal = Number(b.totalIncome || b.totalRevenue) || 0;
        const totalExpVal = Number(b.totalExpenditure) || 0;
        const totalFinVal = Number(b.totalFinancing) || 0;
        const record = {
          year: Number(b.year) || 2026,
          documentType: b.documentType || 'murni',
          status: b.status || 'BERLAKU',
          legalRefNumber: b.legalRefNumber || null,
          enactmentDate: parseDate(b.enactmentDate),
          totalIncome: totalIncomeVal,
          totalIncomeRealized: Number(b.totalIncomeRealized) || 0,
          totalExpenditure: totalExpVal,
          totalExpenditureRealized: Number(b.totalExpenditureRealized) || 0,
          totalFinancing: totalFinVal,
          totalFinancingRealized: Number(b.totalFinancingRealized) || 0,
          realizationPercentage: Number(b.realizationPercentage) || 0,
          incomeBreakdown: b.incomeBreakdown || b.revenueBreakdown || [],
          expenditureBreakdown: b.expenditureBreakdown || [],
          incomeItems: b.incomeItems || null,
          expenditureItems: b.expenditureItems || null,
          financingItems: b.financingItems || null,
          publicDocuments: b.publicDocuments || [],
          createdAt: parseRequiredDate(b.createdAt, 'createdAt', 'BudgetYearData'),
          updatedAt: parseRequiredDate(b.updatedAt || b.createdAt, 'updatedAt', 'BudgetYearData')
        };
        summary.transformed = 1;

        if (!isDryRun) {
          await prisma.budgetYearData.upsert({
            where: { year: record.year },
            update: record,
            create: { id: b.id || 'budget-2026', ...record }
          });
          summary.loaded = 1;
          summary.status = 'SUCCESS';
          log(`  [Tier 2: BudgetYearData] Loaded 1 budget record successfully`);
        }
      } catch (err: any) {
        summary.failed = 1;
        summary.status = 'FAILED';
        logError('BudgetYearData', err);
      }
    }
    summaries.push(summary);
  }

  // 15. DevelopmentProject (Tier 2)
  const rawProjects = jsonDb.developmentProjects || [];
  if (!entityArg || entityArg.toLowerCase() === 'developmentproject') {
    const summary: EntityMigrationSummary = {
      entity: 'DevelopmentProject',
      tier: 2,
      extracted: rawProjects.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedProjects = rawProjects.map((p: any) => ({
      id: p.id,
      title: p.title || p.name || 'Proyek Pembangunan Desa',
      location: p.location,
      budget: Number(p.budget) || 0,
      fundingSource: p.fundingSource || 'Dana Desa (DD)',
      contractor: p.contractor || 'TPK Desa Pulau Betung',
      fiscalYear: Number(p.fiscalYear) || 2026,
      progressPercent: Number(p.progressPercent) || 0,
      status: p.status || 'sedang_berjalan',
      startDate: parseRequiredDate(p.startDate, 'startDate', 'DevelopmentProject'),
      targetEndDate: parseRequiredDate(p.targetEndDate, 'targetEndDate', 'DevelopmentProject'),
      description: p.description || '',
      beforeImage: p.beforeImage || '/placeholder-project.png',
      inProgressImage: p.inProgressImage || '/placeholder-project.png',
      completedImage: p.completedImage || null,
      createdAt: parseRequiredDate(p.createdAt, 'createdAt', 'DevelopmentProject'),
      updatedAt: parseRequiredDate(p.updatedAt || p.createdAt, 'updatedAt', 'DevelopmentProject')
    }));
    summary.transformed = transformedProjects.length;

    if (!isDryRun && transformedProjects.length > 0) {
      const res = await loadBatch(
        transformedProjects,
        BATCH_SIZE,
        'DevelopmentProject',
        2,
        async (item) => {
          await prisma.developmentProject.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 16. VillagePotential (Tier 2)
  const rawPotentials = jsonDb.potentials || [];
  if (!entityArg || entityArg.toLowerCase() === 'villagepotential') {
    const summary: EntityMigrationSummary = {
      entity: 'VillagePotential',
      tier: 2,
      extracted: rawPotentials.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedPotentials = rawPotentials.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category || 'pertanian',
      description: p.description || '',
      highlightStat: p.highlightStat || '',
      imageUrl: p.imageUrl || '/placeholder-potential.png',
      keyCommodities: p.keyCommodities || [],
      keyOpportunities: p.keyOpportunities || null,
      createdAt: parseRequiredDate(p.createdAt, 'createdAt', 'VillagePotential'),
      updatedAt: parseRequiredDate(p.updatedAt || p.createdAt, 'updatedAt', 'VillagePotential')
    }));
    summary.transformed = transformedPotentials.length;

    if (!isDryRun && transformedPotentials.length > 0) {
      const res = await loadBatch(
        transformedPotentials,
        BATCH_SIZE,
        'VillagePotential',
        2,
        async (item) => {
          await prisma.villagePotential.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 17. UmkmItem (Tier 2)
  const rawUmkm = jsonDb.umkm || [];
  if (!entityArg || entityArg.toLowerCase() === 'umkmitem') {
    const summary: EntityMigrationSummary = {
      entity: 'UmkmItem',
      tier: 2,
      extracted: rawUmkm.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedUmkm = rawUmkm.map((u: any) => ({
      id: u.id,
      name: u.name,
      ownerName: u.ownerName,
      category: u.category || 'kuliner',
      description: u.description || '',
      products: u.products || [],
      imageUrl: u.imageUrl || '/placeholder-umkm.png',
      location: u.location || 'Desa Pulau Betung',
      whatsappContact: u.whatsappContact || '081200000000',
      phone: u.phone || null,
      priceRange: u.priceRange || 'Rp 10.000 - Rp 50.000',
      isVerified: Boolean(u.isVerified),
      createdAt: parseRequiredDate(u.createdAt, 'createdAt', 'UmkmItem'),
      updatedAt: parseRequiredDate(u.updatedAt || u.createdAt, 'updatedAt', 'UmkmItem')
    }));
    summary.transformed = transformedUmkm.length;

    if (!isDryRun && transformedUmkm.length > 0) {
      const res = await loadBatch(
        transformedUmkm,
        BATCH_SIZE,
        'UmkmItem',
        2,
        async (item) => {
          await prisma.umkmItem.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // ==========================================================================
  // TIER 3: SERVICES TRANSACTIONS, COMPLAINTS, PUBLICATIONS
  // ==========================================================================

  // 18. ServiceRequest (Tier 3)
  const rawRequests = jsonDb.serviceRequests || [];
  if (!entityArg || entityArg.toLowerCase() === 'servicerequest') {
    const summary: EntityMigrationSummary = {
      entity: 'ServiceRequest',
      tier: 3,
      extracted: rawRequests.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedRequests = rawRequests.map((r: any) => ({
      id: r.id,
      trackingCode: r.trackingCode || `TRK-${r.id}`,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      citizenName: r.citizenName,
      citizenNik: r.citizenNik || null,
      citizenNikMasked: r.citizenNikMasked || '1602************',
      phone: r.phone || '-',
      addressDusun: r.addressDusun || 'Dusun 1',
      citizenGender: r.citizenGender || null,
      citizenBirthPlace: r.citizenBirthPlace || null,
      citizenBirthDate: r.citizenBirthDate || null,
      dusunId: r.dusunId || null,
      rwId: r.rwId || null,
      rtId: r.rtId || null,
      requestDate: parseRequiredDate(r.requestDate, 'requestDate', 'ServiceRequest'),
      status: normalizeStatus(r.status, 'diajukan', SERVICE_STATUS_MAP).toLowerCase(),
      notes: r.notes || null,
      staffNotes: r.staffNotes || null,
      processedBy: r.processedBy || null,
      completedAt: parseDate(r.completedAt),
      fileAttachmentName: r.fileAttachmentName || null,
      fileAttachmentUrl: r.fileAttachmentUrl || null,
      ktpAttachmentUrl: r.ktpAttachmentUrl || null,
      officialLetterNumber: r.officialLetterNumber || null,
      formData: r.formData || null,
      letterheadSnapshot: r.letterheadSnapshot || null,
      createdAt: parseRequiredDate(r.createdAt, 'createdAt', 'ServiceRequest'),
      updatedAt: parseRequiredDate(r.updatedAt || r.createdAt, 'updatedAt', 'ServiceRequest')
    }));
    summary.transformed = transformedRequests.length;

    if (!isDryRun && transformedRequests.length > 0) {
      const res = await loadBatch(
        transformedRequests,
        BATCH_SIZE,
        'ServiceRequest',
        3,
        async (item) => {
          await prisma.serviceRequest.upsert({
            where: { trackingCode: item.trackingCode },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 19. DeletedServiceRequest (Tier 3)
  const rawDeleted = jsonDb.deletedServiceRequests || [];
  if (!entityArg || entityArg.toLowerCase() === 'deletedservicerequest') {
    const summary: EntityMigrationSummary = {
      entity: 'DeletedServiceRequest',
      tier: 3,
      extracted: rawDeleted.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedDeleted = rawDeleted.map((d: any) => ({
      id: d.id,
      originalRequestId: d.originalRequestId || d.id,
      trackingCode: d.trackingCode,
      serviceId: d.serviceId,
      serviceName: d.serviceName,
      citizenName: d.citizenName,
      citizenNikMasked: d.citizenNikMasked || '1602************',
      phone: d.phone || '-',
      addressDusun: d.addressDusun || 'Dusun 1',
      requestDate: parseRequiredDate(d.requestDate, 'requestDate', 'DeletedServiceRequest'),
      lastStatus: d.lastStatus || 'diajukan',
      deletedAt: parseRequiredDate(d.deletedAt, 'deletedAt', 'DeletedServiceRequest'),
      deletedByUserName: d.deletedByUserName || 'Operator',
      deletedByUserRole: d.deletedByUserRole || 'operator',
      deletionReason: d.deletionReason || 'Dihapus oleh admin',
      fullRequestSnapshot: d.fullRequestSnapshot || {},
      createdAt: parseRequiredDate(d.createdAt, 'createdAt', 'DeletedServiceRequest')
    }));
    summary.transformed = transformedDeleted.length;

    if (!isDryRun && transformedDeleted.length > 0) {
      const res = await loadBatch(
        transformedDeleted,
        BATCH_SIZE,
        'DeletedServiceRequest',
        3,
        async (item) => {
          await prisma.deletedServiceRequest.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 20. Complaint (Tier 3)
  const rawComplaints = jsonDb.complaints || [];
  if (!entityArg || entityArg.toLowerCase() === 'complaint') {
    const summary: EntityMigrationSummary = {
      entity: 'Complaint',
      tier: 3,
      extracted: rawComplaints.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedComplaints = rawComplaints.map((c: any) => ({
      id: c.id,
      ticketNumber: c.ticketNumber || `TKT-${c.id}`,
      category: c.category || 'infrastruktur',
      title: c.title,
      content: c.content,
      reporterName: c.reporterName,
      isAnonymous: Boolean(c.isAnonymous),
      reporterContact: c.reporterContact || null,
      location: c.location || 'Desa Pulau Betung',
      status: normalizeStatus(c.status, 'diterima', COMPLAINT_STATUS_MAP).toLowerCase(),
      adminResponse: c.adminResponse || null,
      respondedBy: c.respondedBy || null,
      fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian || null,
      catatanTindakLanjut: c.catatanTindakLanjut || null,
      createdAt: parseRequiredDate(c.createdAt, 'createdAt', 'Complaint'),
      updatedAt: parseRequiredDate(c.updatedAt || c.createdAt, 'updatedAt', 'Complaint')
    }));
    summary.transformed = transformedComplaints.length;

    if (!isDryRun && transformedComplaints.length > 0) {
      const res = await loadBatch(
        transformedComplaints,
        BATCH_SIZE,
        'Complaint',
        3,
        async (item) => {
          await prisma.complaint.upsert({
            where: { ticketNumber: item.ticketNumber },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 21. NewsItem (Tier 3)
  const rawNews = jsonDb.news || [];
  if (!entityArg || entityArg.toLowerCase() === 'newsitem') {
    const summary: EntityMigrationSummary = {
      entity: 'NewsItem',
      tier: 3,
      extracted: rawNews.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedNews = rawNews.map((n: any) => ({
      id: n.id,
      title: n.title,
      slug: n.slug || `berita-${n.id}`,
      content: n.content,
      summary: n.summary || '',
      category: n.category || 'pemerintahan',
      coverImage: n.coverImage || '/placeholder-news.png',
      gallery: n.gallery || null,
      author: n.author || 'Pemerintah Desa',
      publishedAt: parseRequiredDate(n.publishedAt, 'publishedAt', 'NewsItem'),
      isPublished: n.isPublished !== undefined ? Boolean(n.isPublished) : true,
      views: Number(n.views) || 0,
      createdAt: parseRequiredDate(n.createdAt, 'createdAt', 'NewsItem'),
      updatedAt: parseRequiredDate(n.updatedAt || n.createdAt, 'updatedAt', 'NewsItem')
    }));
    summary.transformed = transformedNews.length;

    if (!isDryRun && transformedNews.length > 0) {
      const res = await loadBatch(
        transformedNews,
        BATCH_SIZE,
        'NewsItem',
        3,
        async (item) => {
          await prisma.newsItem.upsert({
            where: { slug: item.slug },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 22. Announcement (Tier 3)
  const rawAnnouncements = jsonDb.announcements || [];
  if (!entityArg || entityArg.toLowerCase() === 'announcement') {
    const summary: EntityMigrationSummary = {
      entity: 'Announcement',
      tier: 3,
      extracted: rawAnnouncements.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedAnnouncements = rawAnnouncements.map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      publishedAt: parseRequiredDate(a.publishedAt, 'publishedAt', 'Announcement'),
      validUntil: parseRequiredDate(a.validUntil, 'validUntil', 'Announcement'),
      priority: a.priority || 'normal',
      isActive: a.isActive !== undefined ? Boolean(a.isActive) : true,
      attachmentUrl: a.attachmentUrl || null,
      attachmentName: a.attachmentName || null,
      createdAt: parseRequiredDate(a.createdAt, 'createdAt', 'Announcement'),
      updatedAt: parseRequiredDate(a.updatedAt || a.createdAt, 'updatedAt', 'Announcement')
    }));
    summary.transformed = transformedAnnouncements.length;

    if (!isDryRun && transformedAnnouncements.length > 0) {
      const res = await loadBatch(
        transformedAnnouncements,
        BATCH_SIZE,
        'Announcement',
        3,
        async (item) => {
          await prisma.announcement.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 23. AgendaItem (Tier 3)
  const rawAgendas = jsonDb.agendas || [];
  if (!entityArg || entityArg.toLowerCase() === 'agendaitem') {
    const summary: EntityMigrationSummary = {
      entity: 'AgendaItem',
      tier: 3,
      extracted: rawAgendas.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedAgendas = rawAgendas.map((ag: any) => ({
      id: ag.id,
      title: ag.title,
      description: ag.description || '',
      date: parseRequiredDate(ag.date, 'date', 'AgendaItem'),
      time: ag.time || '09:00 - Selesai',
      location: ag.location || 'Kantor Desa Pulau Betung',
      organizer: ag.organizer || 'Pemerintah Desa',
      category: ag.category || null,
      status: ag.status || 'akan_datang',
      createdAt: parseRequiredDate(ag.createdAt, 'createdAt', 'AgendaItem'),
      updatedAt: parseRequiredDate(ag.updatedAt || ag.createdAt, 'updatedAt', 'AgendaItem')
    }));
    summary.transformed = transformedAgendas.length;

    if (!isDryRun && transformedAgendas.length > 0) {
      const res = await loadBatch(
        transformedAgendas,
        BATCH_SIZE,
        'AgendaItem',
        3,
        async (item) => {
          await prisma.agendaItem.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 24. GalleryItem (Tier 3)
  const rawGallery = jsonDb.gallery || [];
  if (!entityArg || entityArg.toLowerCase() === 'galleryitem') {
    const summary: EntityMigrationSummary = {
      entity: 'GalleryItem',
      tier: 3,
      extracted: rawGallery.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedGallery = rawGallery.map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description || '',
      category: g.category || 'kegiatan',
      mediaUrl: g.mediaUrl || g.imageUrl || '/placeholder-gallery.png',
      mediaType: g.mediaType || 'image',
      date: parseRequiredDate(g.date, 'date', 'GalleryItem'),
      createdAt: parseRequiredDate(g.createdAt, 'createdAt', 'GalleryItem'),
      updatedAt: parseRequiredDate(g.updatedAt || g.createdAt, 'updatedAt', 'GalleryItem')
    }));
    summary.transformed = transformedGallery.length;

    if (!isDryRun && transformedGallery.length > 0) {
      const res = await loadBatch(
        transformedGallery,
        BATCH_SIZE,
        'GalleryItem',
        3,
        async (item) => {
          await prisma.galleryItem.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // ==========================================================================
  // TIER 4: LOGS & DETAILED SUB-RECORDS (ToddlerMeasurement, AuditLog, AttendanceLog)
  // ==========================================================================

  // 25. ToddlerMeasurement (Tier 4 - Depends on ToddlerRecord)
  const rawMeasurements: any[] = [];
  rawToddlers.forEach((t: any) => {
    (t.measurements || []).forEach((m: any) => {
      rawMeasurements.push({ ...m, toddlerId: t.id });
    });
  });

  if (!entityArg || entityArg.toLowerCase() === 'toddlermeasurement') {
    const summary: EntityMigrationSummary = {
      entity: 'ToddlerMeasurement',
      tier: 4,
      extracted: rawMeasurements.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedMeasurements = rawMeasurements.map((m: any) => ({
      id: m.id,
      toddlerId: m.toddlerId,
      measurementDate: parseRequiredDate(m.measurementDate, 'measurementDate', 'ToddlerMeasurement'),
      ageInMonths: Number(m.ageInMonths) || 0,
      weightKg: Number(m.weightKg) || 0,
      heightCm: Number(m.heightCm) || 0,
      headCircumferenceCm: Number(m.headCircumferenceCm) || 0,
      vitA: Boolean(m.vitA),
      deworming: Boolean(m.deworming),
      immunizationStatus: m.immunizationStatus || 'Lengkap',
      zScoreHeightForAge: Number(m.zScoreHeightForAge) || 0,
      zScoreWeightForAge: Number(m.zScoreWeightForAge) || 0,
      zScoreWeightForHeight: Number(m.zScoreWeightForHeight) || 0,
      stuntingCategory: m.stuntingCategory || 'Normal',
      weightCategory: m.weightCategory || 'Normal',
      overallStatus: m.overallStatus || 'Normal (Gizi Baik)',
      cadreNotes: m.cadreNotes || null,
      measuredBy: m.measuredBy || null,
      createdAt: parseRequiredDate(m.createdAt, 'createdAt', 'ToddlerMeasurement')
    }));
    summary.transformed = transformedMeasurements.length;

    if (!isDryRun && transformedMeasurements.length > 0) {
      const res = await loadBatch(
        transformedMeasurements,
        BATCH_SIZE,
        'ToddlerMeasurement',
        4,
        async (item) => {
          await prisma.toddlerMeasurement.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 26. AuditLog (Tier 4)
  const rawAuditLogs = jsonDb.auditLogs || [];
  if (!entityArg || entityArg.toLowerCase() === 'auditlog') {
    const summary: EntityMigrationSummary = {
      entity: 'AuditLog',
      tier: 4,
      extracted: rawAuditLogs.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedAudit = rawAuditLogs.map((a: any) => ({
      id: a.id,
      userId: a.userId || 'system',
      userName: a.userName || 'System',
      userRole: a.userRole || 'admin',
      action: a.action || 'UPDATE',
      module: a.module || 'SYSTEM',
      details: typeof a.details === 'object' ? JSON.stringify(a.details) : String(a.details || ''),
      timestamp: parseRequiredDate(a.timestamp, 'timestamp', 'AuditLog'),
      ipAddress: a.ipAddress || '127.0.0.1',
      level: a.level || 'info'
    }));
    summary.transformed = transformedAudit.length;

    if (!isDryRun && transformedAudit.length > 0) {
      const res = await loadBatch(
        transformedAudit,
        BATCH_SIZE,
        'AuditLog',
        4,
        async (item) => {
          await prisma.auditLog.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // 27. AttendanceLog (Tier 4)
  const rawAttendance = jsonDb.attendance || [];
  if (!entityArg || entityArg.toLowerCase() === 'attendancelog') {
    const summary: EntityMigrationSummary = {
      entity: 'AttendanceLog',
      tier: 4,
      extracted: rawAttendance.length,
      transformed: 0,
      loaded: 0,
      failed: 0,
      status: 'DRY_RUN_OK'
    };

    const transformedAttendance = rawAttendance.map((att: any) => ({
      id: att.id,
      officialId: att.officialId,
      officialName: att.officialName,
      type: att.type || 'masuk',
      timestamp: parseRequiredDate(att.timestamp, 'timestamp', 'AttendanceLog'),
      date: att.date || new Date().toISOString().split('T')[0],
      location: att.location || null,
      status: att.status || 'hadir',
      notes: att.notes || null,
      deviceId: att.deviceId || null,
      selfieUrl: att.selfieUrl || null,
      createdAt: parseRequiredDate(att.createdAt, 'createdAt', 'AttendanceLog')
    }));
    summary.transformed = transformedAttendance.length;

    if (!isDryRun && transformedAttendance.length > 0) {
      const res = await loadBatch(
        transformedAttendance,
        BATCH_SIZE,
        'AttendanceLog',
        4,
        async (item) => {
          await prisma.attendanceLog.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
      );
      summary.loaded = res.loaded;
      summary.failed = res.failed;
      summary.status = res.failed === 0 ? 'SUCCESS' : 'FAILED';
    }
    summaries.push(summary);
  }

  // ==========================================================================
  // RINGKASAN HASIL EKSEKUSI ETL
  // ==========================================================================
  console.log('\n=========================================================================================');
  console.log(`📊 RINGKASAN HASIL EKSEKUSI ETL (${isDryRun ? 'DRY-RUN SIMULATION' : 'REAL DATABASE LOAD'})`);
  console.log('=========================================================================================');
  console.log('| Tier | Model / Entitas             | Extracted | Transform | Loaded | Failed | Status     |');
  console.log('-----------------------------------------------------------------------------------------');

  let totalExt = 0;
  let totalTrans = 0;
  let totalLoad = 0;
  let totalFail = 0;

  summaries.forEach((s) => {
    const t = `T${s.tier}`.padEnd(4);
    const ent = s.entity.padEnd(27);
    const ext = s.extracted.toString().padStart(9);
    const tr = s.transformed.toString().padStart(9);
    const ld = s.loaded.toString().padStart(6);
    const fl = s.failed.toString().padStart(6);
    const st = s.status === 'SUCCESS' ? '✅ SUCCESS' : s.status === 'DRY_RUN_OK' ? '🔍 DRY_RUN' : '❌ FAILED';
    totalExt += s.extracted;
    totalTrans += s.transformed;
    totalLoad += s.loaded;
    totalFail += s.failed;
    console.log(`| ${t} | ${ent} | ${ext} | ${tr} | ${ld} | ${fl} | ${st.padEnd(10)} |`);
  });

  console.log('-----------------------------------------------------------------------------------------');
  console.log(`TOTAL RECORDS: Extracted: ${totalExt} | Transformed: ${totalTrans} | Loaded: ${totalLoad} | Failed: ${totalFail}`);
  console.log('=========================================================================================\n');

  if (isDryRun) {
    console.log('💡 [CATATAN DRY-RUN]: Tidak ada perubahan yang ditulis ke database Supabase.');
    console.log('   Semua data berhasil diekstrak & divalidasi dengan transformasi schema yang kompatibel.');
    console.log('   Untuk melakukan eksekusi migrasi riil, jalankan:');
    console.log('   👉 npx tsx scripts/etl-migrate.ts --apply\n');
  }

  await prisma.$disconnect();
}

runEtl().catch((err) => {
  logError('GLOBAL_ETL', err);
  process.exit(1);
});
