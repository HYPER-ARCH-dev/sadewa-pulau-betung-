import { PrismaClient } from '@prisma/client';
import { getLetterClassification } from './letterNumbering';

export const DEFAULT_TENANT_ID = 'tenant_pulau_betung';
export const DEFAULT_TENANT_SLUG = 'pulau-betung';
export const DEFAULT_TENANT_NAME = 'Desa Pulau Betung';
export const DEFAULT_TENANT_PREFIX = 'PB-PMY';
export const DEFAULT_TENANT_DOMAIN = 'pulau-betung.sadewa.id';

export const TENANT_OWNED_DELEGATES: ReadonlyArray<{ modelName: string; delegateKey: string }> = [
  { modelName: 'User', delegateKey: 'user' },
  { modelName: 'VillageProfile', delegateKey: 'villageProfile' },
  { modelName: 'Dusun', delegateKey: 'dusun' },
  { modelName: 'RW', delegateKey: 'rW' },
  { modelName: 'RT', delegateKey: 'rT' },
  { modelName: 'VillageService', delegateKey: 'villageService' },
  { modelName: 'ServiceRequest', delegateKey: 'serviceRequest' },
  { modelName: 'DeletedServiceRequest', delegateKey: 'deletedServiceRequest' },
  { modelName: 'Complaint', delegateKey: 'complaint' },
  { modelName: 'Resident', delegateKey: 'resident' },
  { modelName: 'BansosRecipient', delegateKey: 'bansosRecipient' },
  { modelName: 'NewsItem', delegateKey: 'newsItem' },
  { modelName: 'Announcement', delegateKey: 'announcement' },
  { modelName: 'AgendaItem', delegateKey: 'agendaItem' },
  { modelName: 'GalleryItem', delegateKey: 'galleryItem' },
  { modelName: 'BudgetYearData', delegateKey: 'budgetYearData' },
  { modelName: 'DevelopmentProject', delegateKey: 'developmentProject' },
  { modelName: 'VillagePotential', delegateKey: 'villagePotential' },
  { modelName: 'UmkmItem', delegateKey: 'umkmItem' },
  { modelName: 'VillageOfficial', delegateKey: 'villageOfficial' },
  { modelName: 'MapFacility', delegateKey: 'mapFacility' },
  { modelName: 'LandParcel', delegateKey: 'landParcel' },
  { modelName: 'ToddlerRecord', delegateKey: 'toddlerRecord' },
  { modelName: 'ToddlerMeasurement', delegateKey: 'toddlerMeasurement' },
  { modelName: 'PosyanduSchedule', delegateKey: 'posyanduSchedule' },
  { modelName: 'AuditLog', delegateKey: 'auditLog' },
  { modelName: 'AttendanceLog', delegateKey: 'attendanceLog' }
];

const ROMAN_TO_MONTH: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12
};

export interface ParsedLetterNumber {
  classificationCode: string;
  sequence: number;
  month: number;
  year: number;
}

export interface LetterCounterSeedItem {
  villageId: string;
  classificationCode: string;
  year: number;
  month: number;
  maxSequence: number;
}

export interface BackfillOptions {
  tenantId?: string;
  slug?: string;
  name?: string;
  letterCodePrefix?: string;
  primaryDomain?: string;
  customDomain?: string | null;
  dryRun?: boolean;
}

export interface BackfillReport {
  dryRun: boolean;
  tenantId: string;
  primaryDomain: string;
  tableUpdates: Record<string, number>;
  totalRowsAffected: number;
  letterCountersComputed: LetterCounterSeedItem[];
  letterCountersUpserted: number;
}

export interface MigrationConsistencyReport {
  passed: boolean;
  tenantId: string;
  tenantActive: boolean;
  primaryDomainVerified: boolean;
  nullCountsByTable: Record<string, number>;
  totalNullRows: number;
  letterCounterMismatches: Array<{
    classificationCode: string;
    year: number;
    month: number;
    expectedMinSequence: number;
    actualSequence: number | null;
  }>;
  historicalQrRecordsChecked: number;
  errors: string[];
}

function getFallbackMonthYear(dateInput?: Date | string | null): { month: number; year: number } {
  if (dateInput) {
    const dt = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!Number.isNaN(dt.getTime())) {
      return { month: dt.getMonth() + 1, year: dt.getFullYear() };
    }
  }
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Mengurai nomor surat resmi seperti "510 / 001 / SKU / PB-PMY / IX / 2026"
 * atau format manual agar LetterSequenceCounter dapat di-seed tanpa mengubah arsip.
 */
export function parseOfficialLetterNumber(
  letterNumber: string,
  fallbackServiceName: string = 'Domisili',
  fallbackDate?: Date | string | null
): ParsedLetterNumber | null {
  const trimmed = String(letterNumber || '').trim();
  if (!trimmed) return null;

  const fallbackClass = getLetterClassification(fallbackServiceName).code;
  const fallbackDateParts = getFallbackMonthYear(fallbackDate);

  const segments = trimmed
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  let classificationCode = fallbackClass;
  if (/^\d{2,3}(?:\.\d+)?$/.test(segments[0])) {
    classificationCode = segments[0];
  }

  let sequence = 0;
  if (/^\d{1,6}$/.test(segments[1])) {
    sequence = Number.parseInt(segments[1], 10);
  } else {
    for (let i = 1; i < segments.length; i++) {
      if (/^\d{1,5}$/.test(segments[i]) && !/^(19|20)\d{2}$/.test(segments[i])) {
        sequence = Number.parseInt(segments[i], 10);
        break;
      }
    }
  }

  if (!Number.isFinite(sequence) || sequence < 1) {
    return null;
  }

  let month = fallbackDateParts.month;
  for (const seg of segments) {
    const roman = ROMAN_TO_MONTH[seg.toUpperCase()];
    if (roman) {
      month = roman;
      break;
    }
  }

  let year = fallbackDateParts.year;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^(19|20)\d{2}$/.test(segments[i])) {
      year = Number.parseInt(segments[i], 10);
      break;
    }
  }

  return {
    classificationCode,
    sequence,
    month,
    year
  };
}

export function computeMaxLetterSequences(
  requests: Array<{
    villageId?: string | null;
    serviceName: string;
    officialLetterNumber: string | null;
    completedAt?: Date | string | null;
    requestDate?: Date | string | null;
  }>,
  defaultVillageId: string = DEFAULT_TENANT_ID
): LetterCounterSeedItem[] {
  const maxByKey = new Map<string, LetterCounterSeedItem>();

  for (const req of requests) {
    if (!req.officialLetterNumber) continue;
    const parsed = parseOfficialLetterNumber(
      req.officialLetterNumber,
      req.serviceName,
      req.completedAt || req.requestDate
    );
    if (!parsed) continue;

    const villageId = req.villageId?.trim() || defaultVillageId;
    const key = `${villageId}::${parsed.classificationCode}::${parsed.year}::${parsed.month}`;
    const existing = maxByKey.get(key);

    if (!existing || parsed.sequence > existing.maxSequence) {
      maxByKey.set(key, {
        villageId,
        classificationCode: parsed.classificationCode,
        year: parsed.year,
        month: parsed.month,
        maxSequence: parsed.sequence
      });
    }
  }

  return Array.from(maxByKey.values()).sort((a, b) =>
    a.year !== b.year
      ? a.year - b.year
      : a.month !== b.month
      ? a.month - b.month
      : a.classificationCode.localeCompare(b.classificationCode)
  );
}

/**
 * Menjalankan bootstrap tenant awal Desa Pulau Betung, mengisi `villageId` pada
 * seluruh baris NULL di 27 tabel secara idempotent, dan menginisialisasi counter nomor surat.
 */
export async function backfillDefaultPulauBetungTenant(
  prisma: PrismaClient,
  options: BackfillOptions = {}
): Promise<BackfillReport> {
  const dryRun = Boolean(options.dryRun);
  const tenantId = options.tenantId?.trim() || DEFAULT_TENANT_ID;
  const slug = options.slug?.trim() || DEFAULT_TENANT_SLUG;
  const name = options.name?.trim() || DEFAULT_TENANT_NAME;
  const letterCodePrefix = options.letterCodePrefix?.trim() || DEFAULT_TENANT_PREFIX;
  const primaryDomain = options.primaryDomain?.trim().toLowerCase() || DEFAULT_TENANT_DOMAIN;
  const customDomain = options.customDomain?.trim().toLowerCase() || null;

  if (!dryRun) {
    await (prisma as any).tenant.upsert({
      where: { id: tenantId },
      update: {
        slug,
        name,
        letterCodePrefix,
        tenancyMode: 'SHARED',
        status: 'ACTIVE',
        primaryDomain
      },
      create: {
        id: tenantId,
        slug,
        name,
        letterCodePrefix,
        tenancyMode: 'SHARED',
        status: 'ACTIVE',
        primaryDomain
      }
    });

    await (prisma as any).tenantDomain.upsert({
      where: { domain: primaryDomain },
      update: {
        tenantId,
        isCustom: false,
        isPrimary: true,
        verificationStatus: 'VERIFIED',
        sslStatus: 'ACTIVE',
        verifiedAt: new Date()
      },
      create: {
        tenantId,
        domain: primaryDomain,
        isCustom: false,
        isPrimary: true,
        verificationStatus: 'VERIFIED',
        sslStatus: 'ACTIVE',
        verifiedAt: new Date()
      }
    });

    if (customDomain && customDomain !== primaryDomain) {
      await (prisma as any).tenantDomain.upsert({
        where: { domain: customDomain },
        update: {
          tenantId,
          isCustom: true
        },
        create: {
          tenantId,
          domain: customDomain,
          isCustom: true,
          isPrimary: false,
          verificationStatus: 'PENDING_VERIFICATION',
          sslStatus: 'PENDING'
        }
      });
    }
  }

  const tableUpdates: Record<string, number> = {};
  let totalRowsAffected = 0;

  for (const { modelName, delegateKey } of TENANT_OWNED_DELEGATES) {
    const delegate = (prisma as any)[delegateKey];
    if (!delegate) {
      throw new Error(`Delegate Prisma "${delegateKey}" untuk model "${modelName}" tidak ditemukan.`);
    }

    if (dryRun) {
      const pendingCount: number = await delegate.count({
        where: { villageId: null }
      });
      tableUpdates[modelName] = pendingCount;
      totalRowsAffected += pendingCount;
    } else {
      const result = await delegate.updateMany({
        where: { villageId: null },
        data: { villageId: tenantId }
      });
      const updated = Number(result?.count ?? 0);
      tableUpdates[modelName] = updated;
      totalRowsAffected += updated;
    }
  }

  // Hitung seed LetterSequenceCounter dari arsip ServiceRequest historis (read-only pada ServiceRequest)
  const historicalRequests = await (prisma as any).serviceRequest.findMany({
    where: {
      officialLetterNumber: { not: null }
    },
    select: {
      villageId: true,
      serviceName: true,
      officialLetterNumber: true,
      completedAt: true,
      requestDate: true
    }
  });

  const letterCountersComputed = computeMaxLetterSequences(historicalRequests, tenantId);
  let letterCountersUpserted = 0;

  if (!dryRun) {
    for (const item of letterCountersComputed) {
      const existingCounter = await (prisma as any).letterSequenceCounter.findUnique({
        where: {
          villageId_classificationCode_year_month: {
            villageId: item.villageId,
            classificationCode: item.classificationCode,
            year: item.year,
            month: item.month
          }
        }
      });

      const targetSeq = Math.max(existingCounter?.lastSequence ?? 0, item.maxSequence);
      await (prisma as any).letterSequenceCounter.upsert({
        where: {
          villageId_classificationCode_year_month: {
            villageId: item.villageId,
            classificationCode: item.classificationCode,
            year: item.year,
            month: item.month
          }
        },
        update: {
          lastSequence: targetSeq
        },
        create: {
          villageId: item.villageId,
          classificationCode: item.classificationCode,
          year: item.year,
          month: item.month,
          lastSequence: targetSeq
        }
      });
      letterCountersUpserted++;
    }
  }

  return {
    dryRun,
    tenantId,
    primaryDomain,
    tableUpdates,
    totalRowsAffected,
    letterCountersComputed,
    letterCountersUpserted
  };
}

/**
 * Memverifikasi seluruh invarian pasca-backfill sebelum cutover `NOT NULL` & composite unique:
 * - Tenant Pulau Betung aktif & domain terverifikasi
 * - 0 baris memiliki `villageId IS NULL` di ke-27 tabel operasional
 * - Seluruh `LetterSequenceCounter` >= nomor urut historis tertinggi pada arsip
 * - Arsip QR `ServiceRequest` tetap memiliki `villageId` & `trackingCode` utuh
 */
export async function verifyMigrationConsistency(
  prisma: PrismaClient,
  tenantId: string = DEFAULT_TENANT_ID,
  expectedPrimaryDomain: string = DEFAULT_TENANT_DOMAIN
): Promise<MigrationConsistencyReport> {
  const errors: string[] = [];

  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: tenantId }
  });
  const tenantActive = Boolean(tenant && tenant.status === 'ACTIVE');
  if (!tenantActive) {
    errors.push(`Tenant "${tenantId}" tidak ditemukan atau tidak berstatus ACTIVE.`);
  }

  const domainRecord = await (prisma as any).tenantDomain.findUnique({
    where: { domain: expectedPrimaryDomain.toLowerCase() }
  });
  const primaryDomainVerified = Boolean(
    domainRecord &&
      domainRecord.tenantId === tenantId &&
      domainRecord.verificationStatus === 'VERIFIED'
  );
  if (!primaryDomainVerified) {
    errors.push(
      `TenantDomain utama "${expectedPrimaryDomain}" belum terhubung ke "${tenantId}" atau belum VERIFIED.`
    );
  }

  const nullCountsByTable: Record<string, number> = {};
  let totalNullRows = 0;

  for (const { modelName, delegateKey } of TENANT_OWNED_DELEGATES) {
    const delegate = (prisma as any)[delegateKey];
    const nullCount = Number(await delegate.count({ where: { villageId: null } }));
    nullCountsByTable[modelName] = nullCount;
    totalNullRows += nullCount;
    if (nullCount > 0) {
      errors.push(`Tabel "${modelName}" masih memiliki ${nullCount} baris dengan villageId IS NULL.`);
    }
  }

  const historicalRequests = await (prisma as any).serviceRequest.findMany({
    where: { officialLetterNumber: { not: null } },
    select: {
      id: true,
      villageId: true,
      trackingCode: true,
      serviceName: true,
      officialLetterNumber: true,
      completedAt: true,
      requestDate: true
    }
  });

  const expectedCounters = computeMaxLetterSequences(historicalRequests, tenantId);
  const letterCounterMismatches: MigrationConsistencyReport['letterCounterMismatches'] = [];

  for (const expected of expectedCounters) {
    const counter = await (prisma as any).letterSequenceCounter.findUnique({
      where: {
        villageId_classificationCode_year_month: {
          villageId: expected.villageId,
          classificationCode: expected.classificationCode,
          year: expected.year,
          month: expected.month
        }
      }
    });

    const actualSeq = counter ? Number(counter.lastSequence) : null;
    if (actualSeq === null || actualSeq < expected.maxSequence) {
      letterCounterMismatches.push({
        classificationCode: expected.classificationCode,
        year: expected.year,
        month: expected.month,
        expectedMinSequence: expected.maxSequence,
        actualSequence: actualSeq
      });
      errors.push(
        `LetterSequenceCounter (${expected.classificationCode}, ${expected.month}/${expected.year}) tidak sinkron: aktual=${actualSeq ?? 'MISSING'}, minimal=${expected.maxSequence}.`
      );
    }
  }

  let historicalQrRecordsChecked = 0;
  for (const req of historicalRequests) {
    historicalQrRecordsChecked++;
    if (!req.trackingCode || !req.villageId) {
      errors.push(`Arsip QR ServiceRequest id="${req.id}" kehilangan trackingCode atau villageId.`);
    }
  }

  return {
    passed: errors.length === 0,
    tenantId,
    tenantActive,
    primaryDomainVerified,
    nullCountsByTable,
    totalNullRows,
    letterCounterMismatches,
    historicalQrRecordsChecked,
    errors
  };
}
