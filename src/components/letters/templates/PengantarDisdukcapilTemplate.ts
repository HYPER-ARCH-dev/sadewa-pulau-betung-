import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * TEMPLATE STRATEGIS INTER-INSTANSI (TINGKAT KABUPATEN - DISDUKCAPIL)
 * Surat Pengantar Layanan Administrasi Kependudukan & Catatan Sipil (KTP-el, KK, Akta)
 * Keyword: OFFICIAL_LETTER, DISDUKCAPIL_TEMPLATE
 */
export function buildPengantarDisdukcapilTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const jenisLayananCapil = sanitizeText(
    request.formData?.capil_service_type || request.formData?.jenis_layanan,
    'Penerbitan KTP-el / Pembaharuan Kartu Keluarga / Akta Kelahiran'
  );
  const alasanPengajuan = sanitizeText(
    request.formData?.reason || request.formData?.alasan_pengajuan,
    'Kerusakan / Kehilangan / Perubahan Data Elemen Kependudukan'
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Instansi Tujuan', value: `Dinas Kependudukan dan Pencatatan Sipil ${ctx.regency}` },
    { label: 'Jenis Layanan Adduk', value: jenisLayananCapil },
    { label: 'Keterangan Pengajuan', value: alasanPengajuan },
    { label: 'Status Data SIAK', value: 'Data Kependudukan Terdaftar Aktif di Database Desa' }
  ];

  return {
    title: 'SURAT PENGANTAR ADDUK DISDUKCAPIL',
    customOpening: `Kepada Yth. Kepala Dinas Kependudukan dan Pencatatan Sipil ${ctx.regency}\ndi Tempat.\n\nDengan hormat, Kepala ${ctx.villageName} mengantar permohonan penerbitan/perubahan dokumen kependudukan untuk warga:`,
    statement:
      `Menerangkan bahwa yang bersangkutan adalah warga negara Indonesia yang berdomisili sah di ${ctx.villageName}. Berkas persyaratan administratif telah diperiksa oleh Perangkat Desa dan dinyatakan lengkap untuk ditindaklanjuti dalam Sistem Informasi Administrasi Kependudukan (SIAK) Kabupaten.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      `Penerbitan dokumen kependudukan di Dinas Kependudukan dan Pencatatan Sipil ${ctx.regency}.`
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'FORMAT INTEGRASI INTER-INSTANSI TINGKAT KABUPATEN (DISDUKCAPIL) — MODULAR TEMPLATE'
  };
}
