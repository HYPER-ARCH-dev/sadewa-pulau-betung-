import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 5. Template Surat Keterangan Beda Nama / Identitas
 * Kode Klasifikasi: 470 (Kependudukan Umum)
 * Keyword: OFFICIAL_LETTER, BEDA_NAMA_TEMPLATE
 */
export function buildBedaNamaTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const nameKtp = sanitizeText(request.formData?.name_in_ktp, request.citizenName);
  const nameDoc = sanitizeText(request.formData?.name_in_document, 'Nama Pembanding');
  const docSrc = sanitizeText(request.formData?.document_source, 'Ijazah / Buku Tabungan / Akta');

  return {
    title: 'SURAT KETERANGAN BEDA NAMA / IDENTITAS',
    statement: `Bahwa nama yang bersangkutan sebagaimana tercantum pada KTP/KK dan nama yang tercantum pada dokumen pendukung lainnya adalah benar-benar SATU ORANG YANG SAMA penduduk ${ctx.villageName}, ${ctx.subDistrict}, ${ctx.regency}.`,
    extraFields: [
      { label: 'Nama Tercantum di KTP/KK', value: nameKtp },
      { label: 'Nama di Dokumen Lain', value: nameDoc },
      { label: 'Sumber Dokumen', value: docSrc }
    ],
    purpose: getCleanPurpose(request, 'Penyesuaian identitas resmi kependudukan dan perbaikan berkas administrasi perbankan/kedinasan.')
  };
}

