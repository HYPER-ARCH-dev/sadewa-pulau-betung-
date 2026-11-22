/**
 * NOMOR SURAT RESMI & KLASIFIKASI KEMENDAGRI (SERVER-SIDE)
 * Standar Tata Naskah Dinas Kementerian Dalam Negeri RI
 * Keyword: OFFICIAL_LETTER, LETTER_NUMBER
 */

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ServiceRequest } from '../../src/types';
import { SERVER_CONFIG } from '../config/constants';
import { getCurrentTenantContext } from '../db/tenantContext';

export interface LetterClassification {
  code: string;       // Kode Klasifikasi Permendagri No. 83 Tahun 2022
  label: string;      // Singkatan Arsip
  title: string;      // Judul Resmi Surat Sesuai Tata Naskah Dinas
  categoryName: string;
}

export function toRomanMonth(monthNumber: number): string {
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const index = Math.max(0, Math.min(11, monthNumber - 1));
  return romanMonths[index];
}

export function getLetterClassification(serviceName: string): LetterClassification {
  const s = serviceName.toLowerCase();

  // 1. Surat Keterangan Usaha (SKU) - Kode 510 (Perdagangan/Perekonomian)
  if (s.includes('usaha') || s.includes('sku')) {
    return {
      code: '510',
      label: 'SKU',
      title: 'SURAT KETERANGAN USAHA (SKU)',
      categoryName: 'Perekonomian & Perdagangan'
    };
  }

  // 2. Surat Keterangan Tidak Mampu (SKTM) - Kode 401 (Kesejahteraan Sosial)
  if (s.includes('tidak mampu') || s.includes('sktm') || s.includes('miskin') || s.includes('bantuan')) {
    return {
      code: '401',
      label: 'SKTM',
      title: 'SURAT KETERANGAN TIDAK MAMPU (SKTM)',
      categoryName: 'Kesejahteraan Sosial'
    };
  }

  // 3. Surat Pengantar Nikah (KUA) - Kode 474.2 (Perkawinan/Pencatatan Sipil)
  if (s.includes('nikah') || s.includes('kua') || s.includes('perkawinan')) {
    return {
      code: '474.2',
      label: 'SP-NIKAH',
      title: 'SURAT PENGANTAR NIKAH (KUA)',
      categoryName: 'Kependudukan & Urusan Agama'
    };
  }

  // 4. Pengantar Catatan Kepolisian (SKCK) - Kode 300 (Ketertiban Umum)
  if (s.includes('skck') || s.includes('polisi') || s.includes('kepolisian')) {
    return {
      code: '300',
      label: 'SP-SKCK',
      title: 'SURAT PENGANTAR CATATAN KEPOLISIAN (SKCK)',
      categoryName: 'Ketertiban & Keamanan'
    };
  }

  // 5. Keterangan Kelahiran - Kode 474.1
  if (s.includes('lahir') || s.includes('kelahiran')) {
    return {
      code: '474.1',
      label: 'SK-LAHIR',
      title: 'SURAT KETERANGAN KELAHIRAN',
      categoryName: 'Pencatatan Sipil'
    };
  }

  // 6. Keterangan Kematian - Kode 474.3
  if (s.includes('mati') || s.includes('kematian') || s.includes('meninggal')) {
    return {
      code: '474.3',
      label: 'SK-MATI',
      title: 'SURAT KETERANGAN KEMATIAN',
      categoryName: 'Pencatatan Sipil'
    };
  }

  // 7. Beda Nama / Beda Identitas - Kode 470
  if (s.includes('beda nama') || s.includes('identitas') || s.includes('perbedaan')) {
    return {
      code: '470',
      label: 'SK-BEDA',
      title: 'SURAT KETERANGAN BEDA NAMA',
      categoryName: 'Kependudukan & Identitas'
    };
  }

  // 8. Belum Menikah / Lajang - Kode 474.1
  if (s.includes('belum nikah') || s.includes('belum kawin') || s.includes('lajang')) {
    return {
      code: '474.1',
      label: 'SK-BELUM-NIKAH',
      title: 'SURAT KETERANGAN BELUM MENIKAH',
      categoryName: 'Status Kependudukan'
    };
  }

  // 9. Keterangan Kehilangan - Kode 140
  if (s.includes('hilang') || s.includes('kehilangan')) {
    return {
      code: '140',
      label: 'SP-HILANG',
      title: 'SURAT KETERANGAN PENGANTAR KEHILANGAN',
      categoryName: 'Ketertiban & Kepolisian'
    };
  }

  // 10. Ahli Waris - Kode 474.3
  if (s.includes('waris') || s.includes('ahli waris')) {
    return {
      code: '474.3',
      label: 'SK-WARIS',
      title: 'SURAT KETERANGAN AHLI WARIS',
      categoryName: 'Hukum & Kependudukan'
    };
  }

  // Default: Domisili - Kode 470
  return {
    code: '470',
    label: 'SK-DOM',
    title: 'SURAT KETERANGAN DOMISILI',
    categoryName: 'Kependudukan Umum'
  };
}

function extractMonthAndYear(dateInput?: string | Date): { month: number; year: number } {
  if (!dateInput) {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  if (dateInput instanceof Date) {
    return { month: dateInput.getMonth() + 1, year: dateInput.getFullYear() };
  }

  const isoMatch = String(dateInput).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return { month: parseInt(isoMatch[2], 10), year: parseInt(isoMatch[1], 10) };
  }

  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return { month: parsed.getMonth() + 1, year: parsed.getFullYear() };
  }

  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Mutex Async Lock untuk menjamin eksekusi atomik saat penerbitan nomor surat resmi
 */
class AsyncLock {
  private queue: Promise<void> = Promise.resolve();

  async acquire<T>(task: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const nextTicket = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentTicket = this.queue;
    this.queue = this.queue.then(() => nextTicket);
    await currentTicket;
    try {
      return await task();
    } finally {
      release!();
    }
  }
}

const letterLock = new AsyncLock();

export interface LetterNumberingOptions {
  prisma?: PrismaClient;
  villageId?: string | null;
  villageCode?: string | null;
}

/**
 * Server-side Atomic Letter Number Generator (Multi-Tenant & Database-Atomic)
 * - Jika `options.prisma` disediakan: menggunakan atomic PostgreSQL UPSERT pada tabel
 *   `LetterSequenceCounter(villageId, classificationCode, year, month)` sehingga dua server
 *   atau dua desa tidak pernah menerbitkan nomor ganda.
 * - Jika berjalan pada mode JSON offline / tanpa DB: fallback ke in-memory AsyncLock.
 */
export async function assignServerLetterNumberAtomic(
  serviceName: string,
  targetDate: string | Date | undefined,
  allRequests: ServiceRequest[],
  excludeRequestId?: string,
  options: LetterNumberingOptions = {}
): Promise<string> {
  const ctx = getCurrentTenantContext();
  const classification = getLetterClassification(serviceName);
  const { month, year } = extractMonthAndYear(targetDate);
  const romanMonth = toRomanMonth(month);
  const villageCode =
    options.villageCode?.trim() ||
    ctx?.letterCodePrefix?.trim() ||
    SERVER_CONFIG.VILLAGE_CODE;
  const effectiveVillageId =
    options.villageId?.trim() ||
    ctx?.tenantId ||
    'tenant_pulau_betung';

  if (options.prisma) {
    const db = options.prisma as any;
    return letterLock.acquire(async () => {
      for (let attempt = 0; attempt < 25; attempt++) {
        let nextSeq: number;

        if (typeof db.$queryRawUnsafe === 'function') {
          const idSeed = `lsc-${crypto.randomUUID()}`;
          const rows = (await db.$queryRawUnsafe(
            `INSERT INTO "sadewa"."LetterSequenceCounter" ("id", "villageId", "classificationCode", "year", "month", "lastSequence", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, 1, NOW())
             ON CONFLICT ("villageId", "classificationCode", "year", "month")
             DO UPDATE SET "lastSequence" = "sadewa"."LetterSequenceCounter"."lastSequence" + 1, "updatedAt" = NOW()
             RETURNING "lastSequence"`,
            idSeed,
            effectiveVillageId,
            classification.code,
            year,
            month
          )) as Array<{ lastSequence: number }>;

          nextSeq = Number(rows?.[0]?.lastSequence ?? 1);
        } else {
          const counterRow = await db.letterSequenceCounter.upsert({
            where: {
              villageId_classificationCode_year_month: {
                villageId: effectiveVillageId,
                classificationCode: classification.code,
                year,
                month
              }
            },
            update: { lastSequence: { increment: 1 } },
            create: {
              villageId: effectiveVillageId,
              classificationCode: classification.code,
              year,
              month,
              lastSequence: 1
            }
          });
          nextSeq = Number(counterRow?.lastSequence ?? 1);
        }

        const paddedSeq = String(nextSeq).padStart(3, '0');
        const candidate = `${classification.code} / ${paddedSeq} / ${classification.label} / ${villageCode} / ${romanMonth} / ${year}`;

        // Pastikan tidak bentrok dengan nomor manual yang mungkin sudah tersimpan di ServiceRequest
        const collision = await db.serviceRequest.findFirst({
          where: {
            officialLetterNumber: candidate,
            ...(excludeRequestId ? { id: { not: excludeRequestId } } : {})
          },
          select: { id: true }
        });

        if (!collision) {
          return candidate;
        }
      }

      throw new Error('Gagal menghasilkan nomor surat unik setelah beberapa percobaan.');
    });
  }

  return letterLock.acquire(async () => {
    const monthRequests = allRequests.filter((r) => {
      if (excludeRequestId && r.id === excludeRequestId) return false;
      const rDate = extractMonthAndYear(r.completedAt || r.requestDate);
      return rDate.month === month && rDate.year === year;
    });

    let maxSeq = 0;
    const existingNumbers = new Set<string>();

    for (const r of allRequests) {
      if (r.officialLetterNumber) {
        existingNumbers.add(r.officialLetterNumber.trim());
      }
    }

    for (const r of monthRequests) {
      if (r.officialLetterNumber) {
        const parts = r.officialLetterNumber.split('/').map((p) => p.trim());
        if (parts.length >= 2) {
          const seq = parseInt(parts[1], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }

    let nextSeq = maxSeq + 1;
    let candidate = '';

    while (true) {
      const paddedSeq = String(nextSeq).padStart(3, '0');
      candidate = `${classification.code} / ${paddedSeq} / ${classification.label} / ${villageCode} / ${romanMonth} / ${year}`;
      if (!existingNumbers.has(candidate)) {
        break;
      }
      nextSeq++;
    }

    return candidate;
  });
}
