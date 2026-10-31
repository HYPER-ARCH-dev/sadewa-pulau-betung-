/**
 * SADEWA DIGITAL SERVICE - Full Dual-Write Sync Engine (server/db/sync/syncEngine.ts)
 * 
 * Mengelola sinkronisasi 22 model data dari JSON/Memory ke Supabase PostgreSQL via Prisma:
 * - Hash-Based Change Detection (MD5 hash per entity)
 * - Isolated Transactions (Satu transaction per entity)
 * - Atomic Failure Queue & Auto Log Rotation (>10MB)
 * - Strongly-Typed Prisma Client & TransactionClient
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export const ResidentStatus = {
  HIDUP: 'HIDUP',
  MENINGGAL: 'MENINGGAL',
  PINDAH: 'PINDAH'
} as const;

export const MutationType = {
  MASUK: 'MASUK',
  KELUAR: 'KELUAR'
} as const;

export const ServiceStatus = {
  DRAFT: 'DRAFT',
  DIAJUKAN: 'DIAJUKAN',
  DIVERIFIKASI: 'DIVERIFIKASI',
  DIPROSES: 'DIPROSES',
  DISETUJUI: 'DISETUJUI',
  SELESAI: 'SELESAI',
  DITOLAK: 'DITOLAK'
} as const;

export const ComplaintStatus = {
  DITERIMA: 'DITERIMA',
  DIVERIFIKASI: 'DIVERIFIKASI',
  DIPROSES: 'DIPROSES',
  SELESAI: 'SELESAI',
  DITOLAK: 'DITOLAK'
} as const;

export const BansosStatus = {
  TERDAFTAR: 'TERDAFTAR',
  SALUR_SELESAI: 'SALUR_SELESAI',
  TERTUNDA: 'TERTUNDA',
  GAGAL_SALUR: 'GAGAL_SALUR'
} as const;

import {
  normalizeStatus,
  RESIDENT_STATUS_MAP,
  MUTATION_TYPE_MAP,
  SERVICE_STATUS_MAP,
  COMPLAINT_STATUS_MAP,
  BANSOS_STATUS_MAP
} from '../../utils/statusNormalizer';

const DATA_DIR = path.join(process.cwd(), 'data');
const SYNC_HASH_FILE = path.join(DATA_DIR, 'sync-hashes.json');
const SYNC_FAILURES_FILE = path.join(DATA_DIR, 'sync-failures.json');
const LOG_DIR = path.join(process.cwd(), 'logs');
const FAIL_LOG = path.join(LOG_DIR, 'dual-write-failures.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 Megabytes

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!prismaInstance && process.env.DATABASE_URL && process.env.MIGRATION_PHASE !== 'PHASE_1_JSON_ONLY') {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// 1. HASH-BASED CHANGE DETECTION
function getEntityHash(data: any): string {
  if (!data) return '';
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

function loadSyncHashes(): Record<string, string> {
  try {
    if (fs.existsSync(SYNC_HASH_FILE)) {
      return JSON.parse(fs.readFileSync(SYNC_HASH_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveSyncHashes(hashes: Record<string, string>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${SYNC_HASH_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(hashes, null, 2), 'utf-8');
    fs.renameSync(tmp, SYNC_HASH_FILE);
  } catch (err) {
    console.error('⚠️ Failed to save sync hashes:', err);
  }
}

// 2. ATOMIC FAILURE LOGGER & LOG ROTATION
export function logSyncFailure(entityName: string, payload: any, error: any): void {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

    // Rotate if > 10MB
    if (fs.existsSync(FAIL_LOG)) {
      const stats = fs.statSync(FAIL_LOG);
      if (stats.size > MAX_LOG_SIZE) {
        const rotatedName = path.join(LOG_DIR, `dual-write-failures-${Date.now()}.bak`);
        fs.renameSync(FAIL_LOG, rotatedName);
      }
    }

    const errMessage = error instanceof Error ? error.message : String(error);
    const failureRecord = {
      id: `fail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      entity: entityName,
      failedAt: new Date().toISOString(),
      attempts: 1,
      lastError: errMessage,
      payloadSnippet: Array.isArray(payload) ? `Array length: ${payload.length}` : typeof payload
    };

    const logEntry = `[${failureRecord.failedAt}] ENTITY: ${entityName} | ERROR: ${errMessage}\n`;
    fs.appendFileSync(FAIL_LOG, logEntry, 'utf-8');

    // Append atomically to sync-failures.json
    let failures: any[] = [];
    if (fs.existsSync(SYNC_FAILURES_FILE)) {
      try {
        failures = JSON.parse(fs.readFileSync(SYNC_FAILURES_FILE, 'utf-8'));
      } catch {}
    }
    failures.push({ ...failureRecord, payload });
    const tmpFail = `${SYNC_FAILURES_FILE}.tmp`;
    fs.writeFileSync(tmpFail, JSON.stringify(failures, null, 2), 'utf-8');
    fs.renameSync(tmpFail, SYNC_FAILURES_FILE);
  } catch (e) {
    console.error(`❌ Critical error in logSyncFailure for ${entityName}:`, e);
  }
}

// 3. COMPLETE 22-ENTITY DUAL WRITE EXECUTOR (STRONGLY TYPED)
export async function executeDualWriteSync(dbData: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const currentHashes = loadSyncHashes();
  const nextHashes = { ...currentHashes };

  const shouldSync = (entityName: string, rawData: any): boolean => {
    const newHash = getEntityHash(rawData);
    if (currentHashes[entityName] === newHash) {
      return false; // Skip, data identik
    }
    nextHashes[entityName] = newHash;
    return true;
  };

  // ENTITY 1: VillageProfile
  if (dbData.villageProfile && shouldSync('VillageProfile', dbData.villageProfile)) {
    try {
      const vp = dbData.villageProfile;
      await prisma.$transaction(async (tx: TransactionClient) => {
        await tx.villageProfile.upsert({
          where: { id: 'default' },
          update: {
            villageName: vp.villageName,
            district: vp.district,
            regency: vp.regency,
            province: vp.province || 'Jambi',
            postalCode: vp.postalCode || '36654',
            addressStreet: vp.addressStreet,
            email: vp.email,
            phone: vp.phone,
            website: vp.website,
            villageLogoUrl: vp.villageLogoUrl,
            regencyLogoUrl: vp.regencyLogoUrl,
            letterCodePrefix: vp.letterCodePrefix,
            motto: vp.motto,
            vision: vp.vision || '',
            mission: vp.mission || [],
            history: vp.history || '',
            totalPopulation: vp.totalPopulation || 0,
            totalFamilies: vp.totalFamilies || 0,
            areaSqKm: vp.areaSqKm || 0,
            borders: vp.borders || {},
            officeLocation: vp.officeLocation || null,
            kadesName: vp.kadesName,
            kadesNip: vp.kadesNip,
            kadesPhotoUrl: vp.kadesPhotoUrl,
            kadesGreetingTitle: vp.kadesGreetingTitle,
            kadesGreeting: vp.kadesGreeting || '',
            officialSignatureUrl: vp.officialSignatureUrl,
            heroTitle: vp.heroTitle,
            heroSubtitle: vp.heroSubtitle,
            heroBackgroundUrl: vp.heroBackgroundUrl,
            heroBadgeText: vp.heroBadgeText,
            heroIsActive: vp.heroIsActive ?? true,
            sadewaLogoUrl: vp.sadewaLogoUrl,
            whatsappCenter: vp.whatsappCenter,
            operatingHours: vp.operatingHours || null,
            emergencyContacts: vp.emergencyContacts || null,
            lastUpdated: new Date()
          },
          create: {
            id: 'default',
            villageName: vp.villageName || 'Desa Pulau Betung',
            district: vp.district || 'Pemayung',
            regency: vp.regency || 'Batang Hari',
            province: vp.province || 'Jambi',
            postalCode: vp.postalCode || '36654',
            vision: vp.vision || '',
            mission: vp.mission || [],
            history: vp.history || '',
            totalPopulation: vp.totalPopulation || 0,
            totalFamilies: vp.totalFamilies || 0,
            areaSqKm: vp.areaSqKm || 0,
            borders: vp.borders || {}
          }
        });
      });
    } catch (err) {
      logSyncFailure('VillageProfile', dbData.villageProfile, err);
    }
  }

  // ENTITY 2: Users
  if (dbData.users && shouldSync('User', dbData.users)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const u of dbData.users) {
          await tx.user.upsert({
            where: { email: u.email },
            update: {
              name: u.name,
              username: u.username || u.email.split('@')[0],
              passwordHash: u.passwordHash,
              salt: u.salt,
              role: u.role,
              roleTitle: u.roleTitle,
              phone: u.phone,
              gender: u.gender,
              birthDate: u.birthDate,
              isActive: u.isActive ?? true,
              lastLogin: u.lastLogin ? new Date(u.lastLogin) : null
            },
            create: {
              id: u.id,
              name: u.name,
              username: u.username || u.email.split('@')[0],
              email: u.email,
              passwordHash: u.passwordHash,
              salt: u.salt,
              role: u.role,
              roleTitle: u.roleTitle,
              phone: u.phone,
              gender: u.gender,
              birthDate: u.birthDate,
              isActive: u.isActive ?? true,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('User', dbData.users, err);
    }
  }

  // ENTITY 3: Territories (Dusun, RW, RT)
  if (dbData.territories && shouldSync('Territories', dbData.territories)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const d of dbData.territories) {
          const dusun = await tx.dusun.upsert({
            where: { id: d.id },
            update: { number: d.number, customName: d.customName, name: d.name, leaderName: d.leaderName, isActive: d.isActive ?? true },
            create: { id: d.id, number: d.number, customName: d.customName, name: d.name, leaderName: d.leaderName, isActive: d.isActive ?? true }
          });

          for (const rw of d.rws || []) {
            const rwRec = await tx.rW.upsert({
              where: { id: rw.id },
              update: { name: rw.name, leaderName: rw.leaderName, isActive: rw.isActive ?? true, dusunId: dusun.id },
              create: { id: rw.id, name: rw.name, leaderName: rw.leaderName, isActive: rw.isActive ?? true, dusunId: dusun.id }
            });

            for (const rt of rw.rts || []) {
              await tx.rT.upsert({
                where: { id: rt.id },
                update: { name: rt.name, leaderName: rt.leaderName, isActive: rt.isActive ?? true, rwId: rwRec.id, dusunId: dusun.id },
                create: { id: rt.id, name: rt.name, leaderName: rt.leaderName, isActive: rt.isActive ?? true, rwId: rwRec.id, dusunId: dusun.id }
              });
            }
          }
        }
      });
    } catch (err) {
      logSyncFailure('Territories', dbData.territories, err);
    }
  }

  // ENTITY 4: Village Services
  if (dbData.services && shouldSync('VillageService', dbData.services)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const s of dbData.services) {
          await tx.villageService.upsert({
            where: { id: s.id },
            update: {
              name: s.name,
              category: s.category,
              letterClass: s.letterClass,
              allowDownload: s.allowDownload ?? true,
              isMultiPage: s.isMultiPage ?? false,
              pageCount: s.pageCount ?? 1,
              shortName: s.shortName,
              description: s.description || '',
              requirements: s.requirements || [],
              procedures: s.procedures || [],
              estimatedDays: s.estimatedDays || '1 Hari',
              cost: s.cost || 'Gratis',
              isActive: s.isActive ?? true,
              requiredFields: s.requiredFields || []
            },
            create: {
              id: s.id,
              name: s.name,
              category: s.category,
              letterClass: s.letterClass,
              shortName: s.shortName,
              description: s.description || '',
              requirements: s.requirements || [],
              procedures: s.procedures || [],
              estimatedDays: s.estimatedDays || '1 Hari',
              cost: s.cost || 'Gratis',
              isActive: s.isActive ?? true,
              requiredFields: s.requiredFields || []
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('VillageService', dbData.services, err);
    }
  }

  // ENTITY 5: Service Requests
  if (dbData.serviceRequests && shouldSync('ServiceRequest', dbData.serviceRequests)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const req of dbData.serviceRequests) {
          await tx.serviceRequest.upsert({
            where: { trackingCode: req.trackingCode },
            update: {
              serviceId: req.serviceId,
              legacyServiceId: req.legacyServiceId || null,
              serviceName: req.serviceName,
              citizenName: req.citizenName,
              citizenNik: req.citizenNik || null,
              citizenNikMasked: req.citizenNikMasked,
              phone: req.phone,
              addressDusun: req.addressDusun,
              status: normalizeStatus(req.status, ServiceStatus.DIAJUKAN, SERVICE_STATUS_MAP) as any,
              notes: req.notes,
              staffNotes: req.staffNotes,
              processedBy: req.processedBy,
              completedAt: req.completedAt ? new Date(req.completedAt) : null,
              officialLetterNumber: req.officialLetterNumber,
              formData: req.formData || null,
              letterheadSnapshot: req.letterheadSnapshot || null
            },
            create: {
              id: req.id,
              trackingCode: req.trackingCode,
              serviceId: req.serviceId,
              legacyServiceId: req.legacyServiceId || null,
              serviceName: req.serviceName,
              citizenName: req.citizenName,
              citizenNik: req.citizenNik || null,
              citizenNikMasked: req.citizenNikMasked,
              phone: req.phone,
              addressDusun: req.addressDusun,
              requestDate: req.requestDate ? new Date(req.requestDate) : new Date(),
              status: normalizeStatus(req.status, ServiceStatus.DIAJUKAN, SERVICE_STATUS_MAP) as any,
              notes: req.notes,
              staffNotes: req.staffNotes,
              processedBy: req.processedBy,
              officialLetterNumber: req.officialLetterNumber,
              formData: req.formData || null,
              letterheadSnapshot: req.letterheadSnapshot || null
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('ServiceRequest', dbData.serviceRequests, err);
    }
  }

  // ENTITY 6: Deleted Service Requests
  if (dbData.deletedServiceRequests && shouldSync('DeletedServiceRequest', dbData.deletedServiceRequests)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const del of dbData.deletedServiceRequests) {
          await tx.deletedServiceRequest.upsert({
            where: { id: del.id },
            update: {
              lastStatus: del.lastStatus,
              deletionReason: del.deletionReason,
              fullRequestSnapshot: del.fullRequestSnapshot || {}
            },
            create: {
              id: del.id,
              originalRequestId: del.originalRequestId || del.id,
              trackingCode: del.trackingCode,
              serviceId: del.serviceId,
              serviceName: del.serviceName,
              citizenName: del.citizenName,
              citizenNikMasked: del.citizenNikMasked,
              phone: del.phone,
              addressDusun: del.addressDusun,
              requestDate: del.requestDate ? new Date(del.requestDate) : new Date(),
              lastStatus: del.lastStatus || 'DIBATALKAN',
              deletedAt: del.deletedAt ? new Date(del.deletedAt) : new Date(),
              deletedByUserName: del.deletedByUserName || 'Admin',
              deletedByUserRole: del.deletedByUserRole || 'super_admin',
              deletionReason: del.deletionReason || 'Dihapus oleh admin',
              fullRequestSnapshot: del.fullRequestSnapshot || {}
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('DeletedServiceRequest', dbData.deletedServiceRequests, err);
    }
  }

  // ENTITY 7: Complaints
  if (dbData.complaints && shouldSync('Complaint', dbData.complaints)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const c of dbData.complaints) {
          await tx.complaint.upsert({
            where: { ticketNumber: c.ticketNumber },
            update: {
              category: c.category,
              title: c.title,
              content: c.content,
              status: normalizeStatus(c.status, ComplaintStatus.DITERIMA, COMPLAINT_STATUS_MAP) as any,
              adminResponse: c.adminResponse,
              respondedBy: c.respondedBy,
              fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian,
              catatanTindakLanjut: c.catatanTindakLanjut
            },
            create: {
              id: c.id,
              ticketNumber: c.ticketNumber,
              category: c.category,
              title: c.title,
              content: c.content,
              reporterName: c.reporterName,
              isAnonymous: c.isAnonymous ?? false,
              reporterContact: c.reporterContact,
              location: c.location,
              status: normalizeStatus(c.status, ComplaintStatus.DITERIMA, COMPLAINT_STATUS_MAP) as any,
              createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('Complaint', dbData.complaints, err);
    }
  }

  // ENTITY 8: Residents
  if (dbData.residents && shouldSync('Resident', dbData.residents)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const r of dbData.residents) {
          await tx.resident.upsert({
            where: { nik: r.nik },
            update: {
              kkNumber: r.kk || r.kkNumber || '1504000000000000',
              fullName: r.name || r.fullName,
              gender: r.gender || 'Laki-laki',
              birthPlace: r.birthPlace || 'Pulau Betung',
              birthDate: r.birthDate ? new Date(r.birthDate) : new Date('1990-01-01'),
              religion: r.religion || 'Islam',
              maritalStatus: r.maritalStatus || 'Kawin',
              education: r.education || 'SMA / Sederajat',
              occupation: r.occupation || 'Petani / Pekebun',
              address: r.address || 'Desa Pulau Betung',
              status: normalizeStatus(r.status, ResidentStatus.HIDUP, RESIDENT_STATUS_MAP) as any,
              mutationType: r.mutationType ? (normalizeStatus(r.mutationType, MutationType.MASUK, MUTATION_TYPE_MAP) as any) : null,
              hasKus: r.hasKus ?? r.hasSku ?? false,
              isStuntingRisk: r.isStuntingRisk ?? false,
              economicStatus: r.economicStatus || 'Umum',
              isActive: r.status !== 'Meninggal' && r.status !== 'Pindah'
            },
            create: {
              id: r.id,
              nik: r.nik,
              kkNumber: r.kk || r.kkNumber || '1504000000000000',
              fullName: r.name || r.fullName,
              gender: r.gender || 'Laki-laki',
              birthPlace: r.birthPlace || 'Pulau Betung',
              birthDate: r.birthDate ? new Date(r.birthDate) : new Date('1990-01-01'),
              religion: r.religion || 'Islam',
              maritalStatus: r.maritalStatus || 'Kawin',
              education: r.education || 'SMA / Sederajat',
              occupation: r.occupation || 'Petani / Pekebun',
              address: r.address || 'Desa Pulau Betung',
              status: normalizeStatus(r.status, ResidentStatus.HIDUP, RESIDENT_STATUS_MAP) as any,
              mutationType: r.mutationType ? (normalizeStatus(r.mutationType, MutationType.MASUK, MUTATION_TYPE_MAP) as any) : null,
              hasKus: r.hasKus ?? r.hasSku ?? false,
              isStuntingRisk: r.isStuntingRisk ?? false,
              economicStatus: r.economicStatus || 'Umum'
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('Resident', dbData.residents, err);
    }
  }

  // ENTITY 9: Bansos Recipients
  if (dbData.bansosRecipients && shouldSync('BansosRecipient', dbData.bansosRecipients)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const b of dbData.bansosRecipients) {
          await tx.bansosRecipient.upsert({
            where: { id: b.id },
            update: {
              programName: b.programName,
              fiscalYear: b.fiscalYear || new Date().getFullYear(),
              stageOrMonth: b.stageOrMonth || 'Tahap 1',
              nominalAmount: b.nominalAmount || 0,
              status: normalizeStatus(b.status, BansosStatus.TERDAFTAR, BANSOS_STATUS_MAP) as any,
              disbursedAt: b.disbursedAt ? new Date(b.disbursedAt) : null,
              notes: b.notes
            },
            create: {
              id: b.id,
              residentId: b.residentId,
              programName: b.programName,
              fiscalYear: b.fiscalYear || new Date().getFullYear(),
              stageOrMonth: b.stageOrMonth || 'Tahap 1',
              nominalAmount: b.nominalAmount || 0,
              status: normalizeStatus(b.status, BansosStatus.TERDAFTAR, BANSOS_STATUS_MAP) as any,
              disbursedAt: b.disbursedAt ? new Date(b.disbursedAt) : null,
              notes: b.notes
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('BansosRecipient', dbData.bansosRecipients, err);
    }
  }

  // ENTITY 10: Land Parcels (WebGIS)
  if (dbData.landParcels && shouldSync('LandParcel', dbData.landParcels)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const p of dbData.landParcels) {
          await tx.landParcel.upsert({
            where: { nop: p.nop },
            update: {
              ownerName: p.ownerName,
              ownerNik: p.ownerNik,
              addressDusun: p.addressDusun,
              landUseCategory: p.landUseCategory,
              landAreaSqM: p.landAreaSqM || 0,
              landAreaHectares: p.landAreaHectares || 0,
              buildingAreaSqM: p.buildingAreaSqM || 0,
              coordinates: p.coordinates || [],
              boundaries: p.boundaries || [],
              njopLandPerSqM: p.njopLandPerSqM || 0,
              njopBuildingPerSqM: p.njopBuildingPerSqM || 0,
              pbbTaxAmount: p.pbbTaxAmount || 0,
              pbbStatus: p.pbbStatus || 'BELUM_LUNAS',
              sporadikStatus: p.sporadikStatus || 'BELUM_TERDAFTAR'
            },
            create: {
              id: p.id,
              nop: p.nop,
              ownerName: p.ownerName,
              ownerNik: p.ownerNik,
              addressDusun: p.addressDusun,
              landUseCategory: p.landUseCategory,
              landAreaSqM: p.landAreaSqM || 0,
              landAreaHectares: p.landAreaHectares || 0,
              buildingAreaSqM: p.buildingAreaSqM || 0,
              coordinates: p.coordinates || [],
              boundaries: p.boundaries || [],
              njopLandPerSqM: p.njopLandPerSqM || 0,
              njopBuildingPerSqM: p.njopBuildingPerSqM || 0,
              pbbTaxAmount: p.pbbTaxAmount || 0,
              pbbStatus: p.pbbStatus || 'BELUM_LUNAS',
              sporadikStatus: p.sporadikStatus || 'BELUM_TERDAFTAR'
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('LandParcel', dbData.landParcels, err);
    }
  }

  // ENTITY 11 & 12: Toddler Records & Measurements (Posyandu)
  if (dbData.toddlerRecords && shouldSync('ToddlerRecord', dbData.toddlerRecords)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const t of dbData.toddlerRecords) {
          const record = await tx.toddlerRecord.upsert({
            where: { nik: t.nik },
            update: {
              name: t.name,
              gender: t.gender,
              parentName: t.parentName,
              parentPhone: t.parentPhone,
              dusunName: t.dusunName,
              rtRw: t.rtRw,
              address: t.address,
              coordinates: t.coordinates || [0, 0],
              kmsCardNumber: t.kmsCardNumber,
              isInterventionTarget: t.isInterventionTarget ?? false
            },
            create: {
              id: t.id,
              nik: t.nik,
              name: t.name,
              gender: t.gender,
              birthDate: t.birthDate ? new Date(t.birthDate) : new Date(),
              birthWeightKg: t.birthWeightKg || 3.0,
              birthHeightCm: t.birthHeightCm || 50.0,
              parentName: t.parentName,
              parentNik: t.parentNik,
              parentPhone: t.parentPhone,
              dusunName: t.dusunName,
              rtRw: t.rtRw,
              address: t.address,
              coordinates: t.coordinates || [0, 0],
              kmsCardNumber: t.kmsCardNumber,
              isInterventionTarget: t.isInterventionTarget ?? false
            }
          });

          for (const m of t.measurements || []) {
            await tx.toddlerMeasurement.upsert({
              where: { id: m.id },
              update: {
                weightKg: m.weightKg,
                heightCm: m.heightCm,
                headCircumferenceCm: m.headCircumferenceCm,
                stuntingCategory: m.stuntingCategory,
                weightCategory: m.weightCategory,
                overallStatus: m.overallStatus,
                cadreNotes: m.cadreNotes
              },
              create: {
                id: m.id,
                toddlerId: record.id,
                measurementDate: m.measurementDate ? new Date(m.measurementDate) : new Date(),
                ageInMonths: m.ageInMonths || 0,
                weightKg: m.weightKg || 0,
                heightCm: m.heightCm || 0,
                headCircumferenceCm: m.headCircumferenceCm || 0,
                immunizationStatus: m.immunizationStatus || 'Lengkap',
                zScoreHeightForAge: m.zScoreHeightForAge || 0,
                zScoreWeightForAge: m.zScoreWeightForAge || 0,
                zScoreWeightForHeight: m.zScoreWeightForHeight || 0,
                stuntingCategory: m.stuntingCategory || 'Normal',
                weightCategory: m.weightCategory || 'Normal',
                overallStatus: m.overallStatus || 'Normal (Gizi Baik)'
              }
            });
          }
        }
      });
    } catch (err) {
      logSyncFailure('ToddlerRecord', dbData.toddlerRecords, err);
    }
  }

  // ENTITY 13: Posyandu Schedules
  if (dbData.posyanduSchedules && shouldSync('PosyanduSchedule', dbData.posyanduSchedules)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const ps of dbData.posyanduSchedules) {
          await tx.posyanduSchedule.upsert({
            where: { id: ps.id },
            update: {
              posyanduName: ps.posyanduName,
              dusunName: ps.dusunName,
              location: ps.location,
              scheduleDate: new Date(ps.scheduleDate),
              startTime: ps.startTime,
              endTime: ps.endTime,
              cadreInCharge: ps.cadreInCharge,
              bidanInCharge: ps.bidanInCharge,
              notes: ps.notes
            },
            create: {
              id: ps.id,
              posyanduName: ps.posyanduName,
              dusunName: ps.dusunName,
              location: ps.location,
              scheduleDate: new Date(ps.scheduleDate),
              startTime: ps.startTime,
              endTime: ps.endTime,
              cadreInCharge: ps.cadreInCharge,
              bidanInCharge: ps.bidanInCharge,
              notes: ps.notes
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('PosyanduSchedule', dbData.posyanduSchedules, err);
    }
  }

  // ENTITY 14: News Items
  if (dbData.news && shouldSync('NewsItem', dbData.news)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const n of dbData.news) {
          await tx.newsItem.upsert({
            where: { slug: n.slug },
            update: { title: n.title, content: n.content, summary: n.summary, category: n.category, coverImage: n.coverImage, views: n.views || 0, isPublished: n.isPublished ?? true },
            create: { id: n.id, title: n.title, slug: n.slug, content: n.content, summary: n.summary, category: n.category, coverImage: n.coverImage, author: n.author || 'Admin', isPublished: n.isPublished ?? true }
          });
        }
      });
    } catch (err) {
      logSyncFailure('NewsItem', dbData.news, err);
    }
  }

  // ENTITY 15: Announcements
  if (dbData.announcements && shouldSync('Announcement', dbData.announcements)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const a of dbData.announcements) {
          await tx.announcement.upsert({
            where: { id: a.id },
            update: { title: a.title, content: a.content, priority: a.priority || 'normal', isActive: a.isActive ?? true },
            create: { id: a.id, title: a.title, content: a.content, validUntil: a.validUntil ? new Date(a.validUntil) : new Date(Date.now() + 30 * 86400000), priority: a.priority || 'normal', isActive: a.isActive ?? true }
          });
        }
      });
    } catch (err) {
      logSyncFailure('Announcement', dbData.announcements, err);
    }
  }

  // ENTITY 16: Agendas
  if (dbData.agendas && shouldSync('AgendaItem', dbData.agendas)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const ag of dbData.agendas) {
          await tx.agendaItem.upsert({
            where: { id: ag.id },
            update: { title: ag.title, description: ag.description, location: ag.location, organizer: ag.organizer, status: ag.status || 'akan_datang' },
            create: { id: ag.id, title: ag.title, description: ag.description, date: new Date(ag.date), time: ag.time, location: ag.location, organizer: ag.organizer, status: ag.status || 'akan_datang' }
          });
        }
      });
    } catch (err) {
      logSyncFailure('AgendaItem', dbData.agendas, err);
    }
  }

  // ENTITY 17: Gallery Items
  if (dbData.gallery && shouldSync('GalleryItem', dbData.gallery)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const g of dbData.gallery) {
          await tx.galleryItem.upsert({
            where: { id: g.id },
            update: { title: g.title, description: g.description, category: g.category, mediaUrl: g.mediaUrl },
            create: { id: g.id, title: g.title, description: g.description, category: g.category, mediaUrl: g.mediaUrl }
          });
        }
      });
    } catch (err) {
      logSyncFailure('GalleryItem', dbData.gallery, err);
    }
  }

  // ENTITY 18: Budget Year Data (APBDes)
  if (dbData.budget && shouldSync('BudgetYearData', dbData.budget)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        const b = dbData.budget;
        await tx.budgetYearData.upsert({
          where: { year: b.year || 2026 },
          update: {
            totalIncome: b.totalIncome || 0,
            totalIncomeRealized: b.totalIncomeRealized || 0,
            totalExpenditure: b.totalExpenditure || 0,
            totalExpenditureRealized: b.totalExpenditureRealized || 0,
            incomeBreakdown: b.incomeBreakdown || [],
            expenditureBreakdown: b.expenditureBreakdown || [],
            publicDocuments: b.publicDocuments || []
          },
          create: {
            id: b.id || 'budget-2026',
            year: b.year || 2026,
            totalIncome: b.totalIncome || 0,
            totalExpenditure: b.totalExpenditure || 0,
            incomeBreakdown: b.incomeBreakdown || [],
            expenditureBreakdown: b.expenditureBreakdown || [],
            publicDocuments: b.publicDocuments || []
          }
        });
      });
    } catch (err) {
      logSyncFailure('BudgetYearData', dbData.budget, err);
    }
  }

  // ENTITY 19: Development Projects
  if (dbData.developmentProjects && shouldSync('DevelopmentProject', dbData.developmentProjects)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const dp of dbData.developmentProjects) {
          await tx.developmentProject.upsert({
            where: { id: dp.id },
            update: { title: dp.title, progressPercent: dp.progressPercent || 0, status: dp.status },
            create: {
              id: dp.id,
              title: dp.title,
              location: dp.location,
              fiscalYear: dp.fiscalYear || 2026,
              budget: dp.budget || 0,
              fundingSource: dp.fundingSource || 'Dana Desa',
              contractor: dp.contractor || 'TPK',
              status: dp.status || 'sedang_berjalan',
              progressPercent: dp.progressPercent || 0,
              startDate: new Date(dp.startDate || Date.now()),
              targetEndDate: new Date(dp.targetEndDate || Date.now() + 90 * 86400000),
              description: dp.description || '',
              beforeImage: dp.beforeImage || '',
              inProgressImage: dp.inProgressImage || ''
            }
          });
        }
      });
    } catch (err) {
      logSyncFailure('DevelopmentProject', dbData.developmentProjects, err);
    }
  }

  // ENTITY 20: Village Potentials
  if (dbData.potentials && shouldSync('VillagePotential', dbData.potentials)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const pot of dbData.potentials) {
          await tx.villagePotential.upsert({
            where: { id: pot.id },
            update: { name: pot.name, category: pot.category, description: pot.description, highlightStat: pot.highlightStat, imageUrl: pot.imageUrl, keyCommodities: pot.keyCommodities || [] },
            create: { id: pot.id, name: pot.name, category: pot.category, description: pot.description, highlightStat: pot.highlightStat, imageUrl: pot.imageUrl, keyCommodities: pot.keyCommodities || [] }
          });
        }
      });
    } catch (err) {
      logSyncFailure('VillagePotential', dbData.potentials, err);
    }
  }

  // ENTITY 21: UMKM Items
  if (dbData.umkm && shouldSync('UmkmItem', dbData.umkm)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const u of dbData.umkm) {
          await tx.umkmItem.upsert({
            where: { id: u.id },
            update: { name: u.name, ownerName: u.ownerName, category: u.category, description: u.description, products: u.products || [], imageUrl: u.imageUrl, location: u.location, whatsappContact: u.whatsappContact, isVerified: u.isVerified ?? false },
            create: { id: u.id, name: u.name, ownerName: u.ownerName, category: u.category, description: u.description, products: u.products || [], imageUrl: u.imageUrl, location: u.location, whatsappContact: u.whatsappContact, isVerified: u.isVerified ?? false }
          });
        }
      });
    } catch (err) {
      logSyncFailure('UmkmItem', dbData.umkm, err);
    }
  }

  // ENTITY 22: Village Officials, Map Facilities, Audit Logs, & Attendance Logs
  if (dbData.officials && shouldSync('VillageOfficial', dbData.officials)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const off of dbData.officials) {
          await tx.villageOfficial.upsert({
            where: { id: off.id },
            update: { name: off.name, position: off.position, section: off.section, bio: off.bio || '', imageUrl: off.imageUrl || '', tenure: off.tenure || '', phone: off.phone, isActive: off.isActive ?? true },
            create: { id: off.id, name: off.name, position: off.position, section: off.section, bio: off.bio || '', imageUrl: off.imageUrl || '', tenure: off.tenure || '', phone: off.phone, isActive: off.isActive ?? true }
          });
        }
      });
    } catch (err) {
      logSyncFailure('VillageOfficial', dbData.officials, err);
    }
  }

  if (dbData.facilities && shouldSync('MapFacility', dbData.facilities)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const fac of dbData.facilities) {
          await tx.mapFacility.upsert({
            where: { id: fac.id },
            update: { name: fac.name, category: fac.category, address: fac.address, dusun: fac.dusun, coordinatesLabel: fac.coordinatesLabel, description: fac.description || '', coordinates: fac.coordinates || [0, 0] },
            create: { id: fac.id, name: fac.name, category: fac.category, address: fac.address, dusun: fac.dusun, coordinatesLabel: fac.coordinatesLabel, description: fac.description || '', coordinates: fac.coordinates || [0, 0] }
          });
        }
      });
    } catch (err) {
      logSyncFailure('MapFacility', dbData.facilities, err);
    }
  }

  if (dbData.auditLogs && shouldSync('AuditLog', dbData.auditLogs)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const log of dbData.auditLogs) {
          await tx.auditLog.upsert({
            where: { id: log.id },
            update: { details: log.details },
            create: { id: log.id, userId: log.userId, userName: log.userName, userRole: log.userRole, action: log.action, module: log.module, details: log.details, timestamp: log.timestamp ? new Date(log.timestamp) : new Date(), ipAddress: log.ipAddress || '127.0.0.1' }
          });
        }
      });
    } catch (err) {
      logSyncFailure('AuditLog', dbData.auditLogs, err);
    }
  }

  if (dbData.attendance && shouldSync('AttendanceLog', dbData.attendance)) {
    try {
      await prisma.$transaction(async (tx: TransactionClient) => {
        for (const att of dbData.attendance) {
          await tx.attendanceLog.upsert({
            where: { id: att.id },
            update: { status: att.status, notes: att.notes },
            create: { id: att.id, officialId: att.officialId, officialName: att.officialName, type: att.type, date: att.date, timestamp: att.timestamp ? new Date(att.timestamp) : new Date(), status: att.status || 'hadir', notes: att.notes }
          });
        }
      });
    } catch (err) {
      logSyncFailure('AttendanceLog', dbData.attendance, err);
    }
  }

  // Simpan state hash terbaru setelah eksekusi
  saveSyncHashes(nextHashes);
}
