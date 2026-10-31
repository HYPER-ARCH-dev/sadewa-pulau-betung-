import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 6. Template Surat Keterangan Belum Menikah
 * Kode Klasifikasi: 474.2 (Perkawinan / Status Lajang)
 * Mengaitkan data pemohon, status belum kawin, orang tua, dan tujuan permohonan.
 * Keyword: OFFICIAL_LETTER, BELUM_MENIKAH_TEMPLATE
 */
export function buildBelumMenikahTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const fName = sanitizeText(
    request.formData?.father_name || request.formData?.nama_ayah,
    '-'
  );
  const mName = sanitizeText(
    request.formData?.mother_name || request.formData?.nama_ibu,
    '-'
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Status Perkawinan', value: 'Belum Kawin / Belum Pernah Menikah (Lajang)' },
    { label: 'Nama Ayah Kandung', value: fName },
    { label: 'Nama Ibu Kandung', value: mName }
  ];

  return {
    title: 'SURAT KETERANGAN BELUM MENIKAH',
    statement:
      `Bahwa berdasarkan penelusuran data buku register kependudukan ${ctx.villageName} sampai saat surat keterangan ini diterbitkan, nama tersebut di atas benar-benar BELUM PERNAH MENIKAH (berstatus lajang / belum kawin) dengan siapapun baik secara hukum agama maupun hukum perundang-undangan Negara Republik Indonesia.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      'Persyaratan seleksi administrasi ketenagakerjaan, CPNS, kedinasan, rekrutmen BUMN, atau pengajuan beasiswa pendidikan.'
    )
  };
}

