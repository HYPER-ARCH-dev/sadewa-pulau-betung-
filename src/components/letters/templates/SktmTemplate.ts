import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 2. Template Surat Keterangan Tidak Mampu (SKTM)
 * Kode Klasifikasi: 401 (Kesejahteraan Sosial)
 * Keyword: OFFICIAL_LETTER, SKTM_TEMPLATE
 */
export function buildSktmTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const inst = sanitizeText(request.formData?.institution, '');
  const depName = sanitizeText(request.formData?.dependent_name, '');

  const extra: { label: string; value: string }[] = [];
  if (inst) {
    extra.push({ label: 'Instansi / Kampus Dituju', value: inst });
  }
  if (depName) {
    extra.push({ label: 'Nama Tanggungan / Siswa', value: depName });
  }

  return {
    title: 'SURAT KETERANGAN TIDAK MAMPU (SKTM)',
    statement: `Bahwa nama tersebut di atas adalah benar warga berdomisili di ${ctx.villageName}, ${ctx.subDistrict}, ${ctx.regency}. Berdasarkan data Terpadu Kesejahteraan Sosial (DTKS) dan verifikasi lapangan, keluarga yang bersangkutan tergolong dalam keluarga prasejahtera / ekonomi lemah.`,
    extraFields: extra.length > 0 ? extra : undefined,
    purpose: getCleanPurpose(request, 'Persyaratan permohonan bantuan keringanan biaya pendidikan / beasiswa / jaminan kesehatan sosial.')
  };
}

