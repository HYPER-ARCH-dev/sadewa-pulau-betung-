import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 9. Template Surat Keterangan Kelahiran
 * Kode Klasifikasi: 472.11/SK-LAHIR (Pencatatan Kelahiran Penduduk)
 * Keyword: OFFICIAL_LETTER, KELAHIRAN_TEMPLATE
 */
export function buildKelahiranTemplate(
  request: ServiceRequest,
  defaultDate: string,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const childName = sanitizeText(
    request.formData?.child_name || request.formData?.nama_anak,
    'Bayi / Anak Kandung'
  );
  const childGender = sanitizeText(
    request.formData?.child_gender || request.formData?.jenis_kelamin_anak,
    '-'
  );
  const birthLoc = sanitizeText(
    request.formData?.birth_place || request.formData?.tempat_lahir_anak || request.formData?.location_event,
    ctx.villageName
  );
  const birthDate = sanitizeText(
    request.formData?.birth_date || request.formData?.tanggal_lahir_anak || request.formData?.event_date,
    defaultDate
  );
  const birthOrder = sanitizeText(
    request.formData?.birth_order || request.formData?.anak_ke,
    '-'
  );

  const extraFields: LetterExtraField[] = [
    { label: 'Nama Lengkap Anak', value: childName },
    { label: 'Jenis Kelamin Anak', value: childGender },
    { label: 'Tempat, Tanggal Lahir', value: `${birthLoc}, ${birthDate}` },
    { label: 'Kelahiran Anak Ke-', value: birthOrder !== '-' ? `Anak ke-${birthOrder}` : '-' },
    { label: 'Nama Orang Tua / Pelapor', value: request.citizenName || '-' }
  ];

  return {
    title: 'SURAT KETERANGAN KELAHIRAN',
    statement:
      `Kepala ${ctx.villageName} menerangkan bahwa telah lahir seorang anak dari pasangan penduduk yang berdomisili di ${ctx.villageName}, ${ctx.subDistrict}, ${ctx.regency} dengan identitas kelahiran sebagaimana tercatat di bawah ini.`,
    extraFields,
    purpose: getCleanPurpose(
      request,
      `Persyaratan penerbitan Akta Kelahiran dan penambahan anggota keluarga pada Kartu Keluarga (KK) di ${ctx.dukcapilName}.`
    )
  };
}

