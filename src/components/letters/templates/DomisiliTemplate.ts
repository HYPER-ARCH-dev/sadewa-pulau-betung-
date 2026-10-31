import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 10. Template Surat Keterangan Domisili
 * Kode Klasifikasi: 470 (Kependudukan / Domisili)
 * Keyword: OFFICIAL_LETTER, DOMISILI_TEMPLATE
 */
export function buildDomisiliTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const originAddr = sanitizeText(request.formData?.origin_address, '');
  const livingSince = sanitizeText(request.formData?.living_since, '');
  const domFields: { label: string; value: string }[] = [];
  if (originAddr) {
    domFields.push({ label: 'Alamat Asal', value: originAddr });
  }
  if (livingSince) {
    domFields.push({ label: 'Tinggal di Desa Sejak', value: `Tahun ${livingSince}` });
  }

  return {
    title: 'SURAT KETERANGAN DOMISILI',
    statement: `Bahwa nama tersebut di atas adalah benar-benar penduduk yang bertempat tinggal dan berdomisili tetap di wilayah ${ctx.fullLocationString}.`,
    extraFields: domFields.length > 0 ? domFields : undefined,
    purpose: getCleanPurpose(request, 'Persyaratan administrasi kependudukan dan keperluan kedinasan/pekerjaan.')
  };
}

