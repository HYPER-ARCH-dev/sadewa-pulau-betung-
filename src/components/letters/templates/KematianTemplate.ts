import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 8. Template Surat Keterangan Kematian
 * Kode Klasifikasi: 474.3 (Pencatatan Kematian)
 * Keyword: OFFICIAL_LETTER, KEMATIAN_TEMPLATE
 */
export function buildKematianTemplate(
  request: ServiceRequest,
  defaultDate: string,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const deathDate = sanitizeText(request.formData?.event_date || request.formData?.death_date, defaultDate);
  const deathLoc = sanitizeText(request.formData?.location_event || request.formData?.death_location, ctx.villageName);

  return {
    title: 'SURAT KETERANGAN KEMATIAN',
    statement: `Kepala ${ctx.villageName} menerangkan dengan sebenarnya bahwa telah berpulang ke rahmatullah warga ${ctx.villageName} sebagaimana tercantum dalam registrasi kependudukan desa guna pencatatan akta kematian resmi.`,
    extraFields: [
      { label: 'Tanggal Peristiwa', value: deathDate },
      { label: 'Tempat Kejadian', value: deathLoc }
    ],
    purpose: getCleanPurpose(request, `Pengurusan pencatatan akta kematian di ${ctx.dukcapilName} dan administrasi ahli waris.`)
  };
}

