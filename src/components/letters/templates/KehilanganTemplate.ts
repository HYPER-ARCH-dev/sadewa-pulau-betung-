import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 7. Template Surat Pengantar Kehilangan
 * Kode Klasifikasi: 140 (Pengantar Umum & Kehilangan)
 * Keyword: OFFICIAL_LETTER, KEHILANGAN_TEMPLATE
 */
export function buildKehilanganTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const lostItem = sanitizeText(request.formData?.lost_item, 'KTP / KK / Surat Berharga');
  const estLoc = sanitizeText(request.formData?.estimated_location, `Wilayah ${ctx.subDistrict}`);

  return {
    title: 'SURAT KETERANGAN PENGANTAR KEHILANGAN',
    statement: `Bahwa nama tersebut di atas adalah benar warga ${ctx.villageName} yang melaporkan telah kehilangan dokumen/barang berharga sebagaimana tercantum di bawah ini dan surat pengantar ini diberikan sebagai syarat pelaporan resmi ke kepolisian setempat.`,
    extraFields: [
      { label: 'Barang/Dokumen Hilang', value: lostItem },
      { label: 'Perkiraan Lokasi & Waktu', value: estLoc }
    ],
    purpose: getCleanPurpose(request, `Pengantar pengurusan Surat Tanda Penerimaan Laporan Kehilangan (STPLK) di ${ctx.polsekName}.`)
  };
}

