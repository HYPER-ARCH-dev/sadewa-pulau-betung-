/**
 * NOMOR SURAT RESMI & KLASIFIKASI KEMENDAGRI
 * Standar Tata Naskah Dinas Kementerian Dalam Negeri RI
 * Keyword: OFFICIAL_LETTER, LETTER_NUMBER
 */

import { ServiceRequest } from '../types';
import { VILLAGE_INFO } from '../constants/village';
import { getLetterFormatConfig } from '../data/letterClassification';

export interface LetterClassification {
  code: string;       // Kode Klasifikasi Kemendagri (e.g. 503, 460, 474.2, 330, 470, 593)
  label: string;      // Singkatan Arsip (e.g. SKU, SKTM, SP-NIKAH, SP-SKCK, SK-DOM)
  title: string;      // Judul Resmi Surat
  categoryName: string;
}

/**
 * Konversi angka bulan (1-12) ke angka Romawi resmi tata naskah dinas
 */
export function toRomanMonth(monthNumber: number): string {
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const index = Math.max(0, Math.min(11, monthNumber - 1));
  return romanMonths[index];
}

/**
 * Mendeteksi klasifikasi kode surat dan singkatan arsip berdasarkan nama layanan atau ID layanan.
 * Menggunakan data sumber tunggal dari letterClassification.ts untuk memastikan konsistensi.
 */
export function getLetterClassification(serviceNameOrId: string): LetterClassification {
  const config = getLetterFormatConfig(serviceNameOrId);
  const prefixParts = config.codePrefix.split('/');
  
  // Mengurai codePrefix. Misalnya: "593/SK-SPORADIK" -> code: "593", label: "SK-SPORADIK"
  const code = prefixParts[0] || '470';
  const label = prefixParts.length > 1 ? prefixParts[1] : (prefixParts[0] || 'SK-DOM');

  return {
    code,
    label,
    title: config.name.toUpperCase(),
    categoryName: config.name
  };
}

/**
 * Parsing tanggal fleksibel menjadi objek { month: number (1-12), year: number }
 */
function extractMonthAndYear(dateInput?: string | Date): { month: number; year: number } {
  if (!dateInput) {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  if (dateInput instanceof Date) {
    return { month: dateInput.getMonth() + 1, year: dateInput.getFullYear() };
  }

  // Format YYYY-MM-DD
  const isoMatch = dateInput.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return { month: parseInt(isoMatch[2], 10), year: parseInt(isoMatch[1], 10) };
  }

  // Format DD Month YYYY (e.g. "30 Agu 2026" or "15 September 2026")
  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return { month: parsed.getMonth() + 1, year: parsed.getFullYear() };
  }

  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Menghasilkan Nomor Surat Resmi dengan format:
 * [KODE_KLASIFIKASI] / [NOMOR_URUT_3_DIGIT] / [SINGKATAN_SURAT] / PB-PMY / [BULAN_ROMAWI] / [TAHUN]
 *
 * Contoh: 510 / 001 / SKU / PB-PMY / IX / 2026
 *
 * Catatan Penting:
 * - Nomor urut (001, 002, dst.) otomatis ME-RESET setiap awal bulan baru!
 * - Dilengkapi pemisahan klasifikasi per jenis urusan surat.
 */
export function generateOfficialLetterNumber(
  serviceNameOrId: string,
  dateInput: string | Date | undefined,
  existingRequests: ServiceRequest[],
  currentRequestId?: string
): string {
  const classification = getLetterClassification(serviceNameOrId);
  const { month, year } = extractMonthAndYear(dateInput);
  const romanMonth = toRomanMonth(month);

  // Ambil semua surat yang terdaftar di bulan dan tahun yang sama
  // dan sudah memiliki nomor surat atau berstatus disetujui/selesai
  const requestsInSameMonth = existingRequests.filter((req) => {
    if (currentRequestId && req.id === currentRequestId) return false;
    const reqDate = extractMonthAndYear(req.completedAt || req.requestDate);
    return reqDate.month === month && reqDate.year === year;
  });

  // Cari nomor urut tertinggi pada bulan berjalan untuk jenis klasifikasi ini (atau agenda umum desa)
  let maxSeq = 0;

  for (const r of requestsInSameMonth) {
    if (r.officialLetterNumber) {
      // Pola: "470 / 003 / SKU / PB-PMY / IX / 2026" atau "510/003/SKU/PB-PMY/IX/2026"
      const parts = r.officialLetterNumber.split('/').map((p) => p.trim());
      if (parts.length >= 2) {
        const parsedSeq = parseInt(parts[1], 10);
        if (!isNaN(parsedSeq) && parsedSeq > maxSeq) {
          maxSeq = parsedSeq;
        }
      }
    }
  }

  // Nomor berikutnya dimulai dari 001 setiap bulan baru
  const nextSeq = maxSeq + 1;
  const seqPadded = String(nextSeq).padStart(3, '0');

  return `${classification.code} / ${seqPadded} / ${classification.label} / ${VILLAGE_INFO.LETTER_CODE_PREFIX} / ${romanMonth} / ${year}`;
}
