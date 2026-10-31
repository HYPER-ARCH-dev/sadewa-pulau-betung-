import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 16. Template Surat Keterangan Belum Memiliki Rumah
 * Kode Klasifikasi: 640/SK-RUMAH (Perumahan & Tata Ruang Pemukiman)
 * Menerangkan pemohon belum memiliki hunian/rumah pribadi untuk permohonan KPR Bersubsidi atau Rusunawa.
 * Keyword: OFFICIAL_LETTER, BELUM_MEMILIKI_RUMAH_TEMPLATE
 */
export function buildBelumMemilikiRumahTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const livingStatus = sanitizeText(
    request.formData?.current_living_status || request.formData?.status_tempat_tinggal,
    'Menumpang di Rumah Orang Tua / Kontrak'
  );
  const bankName = sanitizeText(
    request.formData?.bank_name || request.formData?.nama_bank,
    'Bank Penyalur KPR Subsidi (BTN / Bank Lainnya)'
  );
  const housingTarget = sanitizeText(
    request.formData?.housing_target || request.formData?.lokasi_perumahan,
    `Perumahan Subsidi di Wilayah ${ctx.regency}`
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Status Tempat Tinggal Saat Ini', value: livingStatus },
    { label: 'Bank / Lembaga Pembiayaan Dituju', value: bankName },
    { label: 'Rencana Lokasi Perumahan', value: housingTarget },
    { label: 'Kepemilikan Rumah Pribadi', value: 'Belum Pernah Memiliki Hunian / Rumah Pribadi' }
  ];

  return {
    title: 'SURAT KETERANGAN BELUM MEMILIKI RUMAH',
    statement:
      `Kepala ${ctx.villageName} menerangkan bahwa nama yang tercantum di atas adalah benar penduduk yang berdomisili di ${ctx.villageName}, ${ctx.subDistrict}, ${ctx.regency}. Berdasarkan pemeriksaan register aset dan keterangan RT setempat, yang bersangkutan sampai saat surat ini diterbitkan benar-benar BELUM MEMILIKI RUMAH TINGGAL SENDIRI (baik atas nama sendiri maupun pasangan).`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      'Persyaratan permohonan fasilitas Kredit Pemilikan Rumah (KPR) Bersubsidi FLPP / Sewa Rusunawa pemerintah.'
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'DRAFT FORMAT — PERLU VALIDASI ADMINISTRATIF'
  };
}

