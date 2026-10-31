import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * TEMPLATE STRATEGIS INTER-INSTANSI (TINGKAT PROVINSI)
 * Surat Pengantar Usulan Program / Bantuan Hibah / Kerjasama Provinsi
 * Keyword: OFFICIAL_LETTER, PROVINCE_RECOMMENDATION_TEMPLATE
 */
export function buildRekomendasiProvinsiTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const targetDinasProvinsi = sanitizeText(
    request.formData?.provincial_agency,
    `Gubernur ${ctx.province} c.q. Dinas Terkait`
  );
  const programTitle = sanitizeText(
    request.formData?.program_title || request.formData?.nama_kegiatan,
    'Proposal Bantuan Hibah / Sarana Prasarana Desa / Pemuda'
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Instansi Tujuan Provinsi', value: targetDinasProvinsi },
    { label: 'Nama Usulan Program', value: programTitle },
    { label: 'Tingkat Wilayah', value: ctx.province },
    { label: 'Dukungan Pemerintah Desa', value: 'Disetujui Dalam Rencana Kerja Pemerintah Desa (RKPDes)' }
  ];

  return {
    title: 'SURAT PENGANTAR USULAN PROVINSI',
    customOpening: `Kepada Yth. ${targetDinasProvinsi}\ndi Tempat.\n\nDengan hormat, Kepala ${ctx.villageName} menyampaikan berkas usulan/proposal sebagai berikut:`,
    statement:
      `Menerangkan bahwa Pemerintah Desa ${ctx.villageName} mendukung penuh usulan kegiatan/program masyarakat tersebut di atas yang berdampak langsung pada pembangunan, pemberdayaan ekonomi, dan kesejahteraan warga masyarakat di wilayah Provinsi.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      `Pengajuan proposal dan permohonan fasilitas program di Pemerintah Provinsi ${ctx.province}.`
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'FORMAT INTEGRASI INTER-INSTANSI TINGKAT PROVINSI — MODULAR TEMPLATE'
  };
}
