import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 13. Template Surat Keterangan Pindah Domisili
 * Kode Klasifikasi: 475/SK-PINDAH (Perpindahan Penduduk / SKPWNI)
 * Surat pengantar perpindahan kependudukan warga ke luar desa atau antar kecamatan/kabupaten.
 * Keyword: OFFICIAL_LETTER, PINDAH_DOMISILI_TEMPLATE
 */
export function buildPindahDomisiliTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const destAddress = sanitizeText(
    request.formData?.destination_address || request.formData?.alamat_tujuan,
    '-'
  );
  const moveReason = sanitizeText(
    request.formData?.move_reason || request.formData?.alasan_pindah,
    'Keluarga / Pekerjaan'
  );
  const familyCount = sanitizeText(
    request.formData?.family_members_moving || request.formData?.jumlah_keluarga,
    '1 Orang (Pemohon Saja)'
  );
  const originAddress = request.addressDusun || `${ctx.villageName}, ${ctx.subDistrict}, ${ctx.regency}`;

  const extraFields: LetterExtraField[] = [
    { label: 'Alamat Asal', value: originAddress },
    { label: 'Alamat Lengkap Tujuan Pindah', value: destAddress },
    { label: 'Alasan Kepindahan', value: moveReason },
    { label: 'Jumlah Anggota Keluarga Pindah', value: familyCount }
  ];

  return {
    title: 'SURAT KETERANGAN PINDAH DOMISILI',
    statement:
      `Kepala ${ctx.villageName} menerangkan bahwa nama tersebut di atas adalah benar tercatat dalam basis data kependudukan ${ctx.villageName} dan telah mengajukan permohonan perpindahan tempat tinggal/kependudukan ke alamat tujuan baru sebagaimana tercantum dalam rincian di bawah ini. Yang bersangkutan berkelakuan baik dan tidak sedang tersangkut perkara pidana selama berdomisili di desa kami.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      `Pengantar pengurusan penerbitan Surat Keterangan Pindah Warga Negara Indonesia (SKPWNI) dan penyesuaian Kartu Keluarga di ${ctx.dukcapilName}.`
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'DRAFT FORMAT — PERLU VALIDASI ADMINISTRATIF'
  };
}

