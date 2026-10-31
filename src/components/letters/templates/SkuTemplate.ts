import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 1. Template Surat Keterangan Usaha (SKU)
 * Kode Klasifikasi: 510 (Perekonomian & Perdagangan)
 * Keyword: OFFICIAL_LETTER, SKU_TEMPLATE
 */
export function buildSkuTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const bName = sanitizeText(request.formData?.business_name || request.formData?.businessName, 'Usaha Rakyat Mandiri');
  const bType = sanitizeText(request.formData?.business_type || request.formData?.businessType, 'Perdagangan Hasil Bumi / Perkebunan');
  const bAddress = sanitizeText(request.formData?.business_address, `${sanitizeText(request.addressDusun, 'Dusun Setempat')}, ${ctx.villageName}`);

  return {
    title: 'SURAT KETERANGAN USAHA (SKU)',
    statement: `Bahwa nama tersebut di atas adalah benar-benar warga penduduk ${ctx.fullLocationString}, dan berdasarkan pengamatan serta data yang ada pada kami, yang bersangkutan benar memiliki dan menjalankan kegiatan usaha:`,
    extraFields: [
      { label: 'Nama Usaha', value: bName },
      { label: 'Bidang / Jenis', value: bType },
      { label: 'Lokasi Usaha', value: bAddress }
    ],
    purpose: getCleanPurpose(request, 'Persyaratan kelengkapan administrasi pengajuan pembiayaan Kredit Usaha Rakyat (KUR) / Izin Usaha Perbankan.')
  };
}

