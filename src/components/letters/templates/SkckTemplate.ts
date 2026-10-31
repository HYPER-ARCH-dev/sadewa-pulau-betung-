import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 4. Template Surat Pengantar Catatan Kepolisian (SKCK)
 * Kode Klasifikasi: 300 (Ketertiban Umum & Keamanan)
 * Keyword: OFFICIAL_LETTER, SKCK_TEMPLATE
 */
export function buildSkckTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const pTarget = sanitizeText(request.formData?.police_target, '');
  return {
    title: 'SURAT PENGANTAR CATATAN KEPOLISIAN (SKCK)',
    statement: `Bahwa yang bersangkutan adalah benar warga ${ctx.villageName} yang berkelakuan baik, tidak sedang menjalani proses peradilan pidana, serta tidak pernah terlibat tindakan kriminalitas yang meresahkan masyarakat desa.`,
    extraFields: pTarget ? [
      { label: 'Tujuan Pengurusan SKCK', value: pTarget }
    ] : undefined,
    purpose: getCleanPurpose(request, `Pengantar pembuatan Surat Keterangan Catatan Kepolisian (SKCK) di ${ctx.polsekName} / ${ctx.polresName} untuk melamar pekerjaan.`)
  };
}

