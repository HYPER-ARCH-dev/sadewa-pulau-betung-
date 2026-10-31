import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 15. Template Surat Keterangan Penghasilan Orang Tua
 * Kode Klasifikasi: 470/SK-HASIL (Ekonomi Kependudukan / Penghasilan Wali)
 * Menerangkan rata-rata pendapatan kotor/bersih orang tua bagi pemohon beasiswa/kampus.
 * Keyword: OFFICIAL_LETTER, PENGHASILAN_ORTU_TEMPLATE
 */
export function buildPenghasilanOrtuTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const parentName = sanitizeText(
    request.formData?.parent_name || request.formData?.nama_orang_tua || request.formData?.nama_ayah,
    'Orang Tua Pemohon'
  );
  const parentJob = sanitizeText(
    request.formData?.parent_job || request.formData?.pekerjaan_ortu,
    'Petani / Wiraswasta / Buruh Harian'
  );
  const income = sanitizeText(
    request.formData?.monthly_income || request.formData?.penghasilan_bulanan,
    'Rp 1.500.000 / bulan'
  );
  const dependents = sanitizeText(
    request.formData?.dependents_count || request.formData?.jumlah_tanggungan,
    '2 Orang'
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Nama Orang Tua / Wali', value: parentName },
    { label: 'Pekerjaan Orang Tua / Wali', value: parentJob },
    { label: 'Rata-rata Penghasilan Bersih', value: income },
    { label: 'Jumlah Tanggungan Keluarga', value: `${dependents} orang anak/tanggungan` }
  ];

  return {
    title: 'SURAT KETERANGAN PENGHASILAN ORANG TUA',
    statement:
      `Kepala ${ctx.villageName} menerangkan bahwa nama yang tercantum di atas adalah benar anak kandung/wali dari orang tua yang berdomisili di ${ctx.villageName}, ${ctx.subDistrict}, ${ctx.regency}. Berdasarkan data keterangan penghasilan dan survei sosial desa, yang bersangkutan memiliki pekerjaan dan estimasi penghasilan rata-rata per bulan sebagaimana tercatat di bawah ini.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      'Persyaratan permohonan pendaftaran beasiswa pendidikan (KIP Kuliah / Pemda), keringanan Uang Kuliah Tunggal (UKT), atau bantuan perlengkapan sekolah.'
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'DRAFT FORMAT — PERLU VALIDASI ADMINISTRATIF'
  };
}

