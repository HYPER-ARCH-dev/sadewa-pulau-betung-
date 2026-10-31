import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * TEMPLATE STRATEGIS INTER-INSTANSI (TINGKAT KECAMATAN)
 * Surat Pengantar Rekomendasi Camat / Kantor Kecamatan
 * Digunakan untuk perizinan usaha, rekomendasi bantuan bencana, atau kelayakan berkas warga.
 * Keyword: OFFICIAL_LETTER, KECAMATAN_RECOMMENDATION_TEMPLATE
 */
export function buildRekomendasiCamatTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const tujuanCamat = sanitizeText(
    request.formData?.target_subdistrict || request.formData?.camat_name,
    `Camat ${ctx.subDistrict}`
  );
  const nomorRegistrasiDesa = sanitizeText(
    request.formData?.village_reg_number,
    `474.1 / REG-KEC / ${ctx.letterCodePrefix}`
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Tujuan Instansi / Jabatan', value: tujuanCamat },
    { label: 'Nomor Registrasi Berkas Desa', value: nomorRegistrasiDesa },
    { label: 'Tingkat Kewenangan', value: `Pemerintahan ${ctx.subDistrict}` },
    { label: 'Status Verifikasi Desa', value: 'Memenuhi Syarat Administratif & Berkas Lengkap' }
  ];

  return {
    title: 'SURAT PENGANTAR REKOMENDASI KECAMATAN',
    customOpening: `Kepada Yth. Bapak/Ibu ${tujuanCamat}\ndi Tempat.\n\nDengan hormat, bersama ini Kepala ${ctx.villageName} mengajukan permohonan rekomendasi untuk warga berikut:`,
    statement:
      `Menerangkan dengan sebenarnya bahwa warga yang identitasnya tercantum di atas adalah benar penduduk desa kami. Setelah dilakukan verifikasi berkas dan kelayakan lapangan, Pemerintah Desa memberikan rekomendasi penuh kepada yang bersangkutan untuk diproses lebih lanjut di Kantor Kecamatan ${ctx.subDistrict}.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      `Pengurusan Surat Rekomendasi Resmi di Tingkat Kantor Kecamatan ${ctx.subDistrict}.`
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'FORMAT INTEGRASI INTER-INSTANSI TINGKAT KECAMATAN — MODULAR TEMPLATE',
    isBundle: false
  };
}
