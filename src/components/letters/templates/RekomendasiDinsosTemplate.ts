import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * TEMPLATE STRATEGIS INTER-INSTANSI (TINGKAT KABUPATEN - DINAS SOSIAL)
 * Surat Rekomendasi Bantuan Sosial / BPJS PBI / DTKS
 * Keyword: OFFICIAL_LETTER, DINSOS_TEMPLATE
 */
export function buildRekomendasiDinsosTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const programBansos = sanitizeText(
    request.formData?.bansos_program_type || request.formData?.jenis_bantuan,
    'BPJS Kesehatan PBI (APBD/APBN) / Usulan Data DTKS'
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Tujuan Instansi', value: `Dinas Sosial ${ctx.regency}` },
    { label: 'Program Bantuan Dituju', value: programBansos },
    { label: 'Status Ekonomi Keluarga', value: 'Kategori Mampu Sejahtera Bawah / Rentan Miskin' },
    { label: 'Verifikasi Operator SIKS-NG', value: 'Terdaftar / Layak Diusulkan Masuk DTKS' }
  ];

  return {
    title: 'SURAT REKOMENDASI DINAS SOSIAL',
    customOpening: `Kepada Yth. Kepala Dinas Sosial ${ctx.regency}\ndi Tempat.\n\nDengan hormat, Kepala ${ctx.villageName} memberikan rekomendasi sosial kepada warga berikut:`,
    statement:
      `Menerangkan dengan sebenarnya bahwa warga di atas adalah penduduk ${ctx.villageName} yang setelah melalui proses verifikasi lapangan dan Musyawarah Desa (Musdes), dikategorikan keluarga kurang mampu yang layak mendapatkan fasilitasi pelayanan perlindungan sosial.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      `Pengurusan jaminan sosial kesehatan (BPJS PBI) dan verifikasi data DTKS di Dinas Sosial ${ctx.regency}.`
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'FORMAT INTEGRASI INTER-INSTANSI TINGKAT KABUPATEN (DINAS SOSIAL) — MODULAR TEMPLATE'
  };
}
