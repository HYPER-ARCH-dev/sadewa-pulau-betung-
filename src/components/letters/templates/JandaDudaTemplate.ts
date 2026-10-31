import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 14. Template Surat Keterangan Status Janda / Duda
 * Kode Klasifikasi: 474.3/SK-JD (Status Pernikahan / Perceraian / Kematian Pasangan)
 * Menerangkan status perkawinan yang berakhir karena perceraian atau ditinggal wafat.
 * Keyword: OFFICIAL_LETTER, JANDA_DUDA_TEMPLATE
 */
export function buildJandaDudaTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const condition = sanitizeText(
    request.formData?.marital_condition || request.formData?.status_perkawinan,
    'Janda / Duda'
  );
  const exSpouse = sanitizeText(
    request.formData?.ex_spouse_name || request.formData?.nama_pasangan_terdahulu,
    '-'
  );
  const decreeNum = sanitizeText(
    request.formData?.decree_number || request.formData?.nomor_akta,
    'Tercatat pada Register Adminduk'
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Status Perkawinan Saat Ini', value: condition },
    { label: 'Nama Pasangan Terdahulu', value: exSpouse },
    { label: 'Dasar Hukum / Nomor Akta', value: decreeNum },
    { label: 'Keterangan Tambahan', value: 'Sampai saat surat ini dikeluarkan belum pernah menikah kembali dengan siapapun' }
  ];

  return {
    title: 'SURAT KETERANGAN STATUS JANDA / DUDA',
    statement:
      `Kepala ${ctx.villageName} menerangkan bahwa nama tersebut di atas adalah benar warga penduduk ${ctx.villageName}, ${ctx.subDistrict}, ${ctx.regency}. Berdasarkan data register perkawinan dan kependudukan desa, yang bersangkutan saat ini berstatus sebagaimana tercantum di bawah ini dan tidak dalam ikatan tali perkawinan dengan pihak lain.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      `Persyaratan administratif pengurusan hak pensiun, tunjangan keluarga, jaminan sosial ketenagakerjaan, atau pendaftaran perkawinan baru di ${ctx.kuaName}.`
    ),
    isDraftFormatPendingValidation: true,
    administrativeNote: 'DRAFT FORMAT — PERLU VALIDASI ADMINISTRATIF'
  };
}

