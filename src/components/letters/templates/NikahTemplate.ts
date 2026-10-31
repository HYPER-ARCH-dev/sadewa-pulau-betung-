import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterExtraField, LetterPageDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';

/**
 * 7. Template Bundel Pengantar Nikah (Model N1 - N4 Kemenag)
 * Kode Klasifikasi: 474.2/SP-NIKAH (Pencatatan Perkawinan)
 * Sesuai PMA No. 20 Tahun 2019 & Kepdirjen Bimas Islam No. 473 Tahun 2020:
 * - Model N1: Surat Pengantar Nikah dari Desa
 * - Model N2: Permohonan Kehendak Nikah & Keterangan Asal Usul
 * - Model N3: Surat Persetujuan Mempelai
 * - Model N4: Surat Izin Orang Tua / Wali
 * Keyword: OFFICIAL_LETTER, NIKAH_TEMPLATE, N1_N4_BUNDLE
 */
export function buildNikahTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const mStatus = sanitizeText(
    request.formData?.marital_status,
    'Jejaka / Perawan (Belum Pernah Menikah)'
  );
  const pName = sanitizeText(
    request.formData?.partner_name || request.formData?.nama_pasangan,
    'Calon Pasangan Terlampir'
  );
  const fName = sanitizeText(
    request.formData?.father_name || request.formData?.nama_ayah,
    '-'
  );
  const mName = sanitizeText(
    request.formData?.mother_name || request.formData?.nama_ibu,
    '-'
  );
  const wDate = sanitizeText(
    request.formData?.wedding_plan_date || request.formData?.tanggal_nikah,
    'Sesuai Jadwal KUA'
  );
  const wLoc = sanitizeText(
    request.formData?.wedding_location || request.formData?.tempat_nikah,
    ctx.kuaName
  );
  const maharInfo = sanitizeText(
    request.formData?.mahar_wali_info,
    'Sesuai Ketentuan Syariat Islam & Administrasi KUA'
  );

  const pages: LetterPageDetails[] = [
    // HALAMAN 1: MODEL N1
    {
      pageNumber: 1,
      pageCode: 'Model N1',
      title: 'SURAT PENGANTAR NIKAH',
      subtitle: 'Formulir Pengantar Perkawinan Desa ke Kantor Urusan Agama (KUA)',
      statement:
        `Bahwa nama warga pemohon tersebut di atas adalah benar penduduk ${ctx.villageName} yang berkehendak melangsungkan perkawinan dengan ketentuan sebagai berikut:`,
      extraFields: [
        { label: 'Status Perkawinan', value: mStatus },
        { label: 'Nama Ayah Kandung', value: fName },
        { label: 'Nama Ibu Kandung', value: mName },
        { label: 'Nama Calon Pasangan', value: pName }
      ],
      purpose: `Pendaftaran pemeriksaan berkas nikah dan pencatatan akad nikah di ${ctx.kuaName}.`,
      signType: 'kades'
    },

    // HALAMAN 2: MODEL N2
    {
      pageNumber: 2,
      pageCode: 'Model N2',
      title: 'SURAT PERMOHONAN KEHENDAK NIKAH',
      subtitle: 'Keterangan Asal Usul & Rencana Pelaksanaan Akad Nikah',
      statement:
        `Pemerintah ${ctx.villageName} dengan ini menerangkan keterangan kehendak pernikahan dan data asal-usul antara calon mempelai dengan calon pasangannya sebagaimana rincian berikut ini:`,
      extraFields: [
        { label: 'Nama Calon Mempelai', value: request.citizenName },
        { label: 'Nama Calon Pasangan', value: pName },
        { label: 'Rencana Tanggal Akad Nikah', value: wDate },
        { label: 'Tempat Pelaksanaan Akad', value: wLoc },
        { label: 'Ketentuan Mahar / Wali', value: maharInfo }
      ],
      purpose: `Permohonan kehendak nikah di ${ctx.kuaName} sesuai ketentuan PMA No. 20 Tahun 2019.`,
      signType: 'kades'
    },

    // HALAMAN 3: MODEL N3
    {
      pageNumber: 3,
      pageCode: 'Model N3',
      title: 'SURAT PERSETUJUAN MEMPELAI',
      subtitle: 'Pernyataan Kesepakatan Bersama Calon Suami & Calon Istri',
      statement:
        'Kami yang bertanda tangan di bawah ini menyatakan dengan sesungguhnya bahwa kami melangsungkan pernikahan atas dasar suka rela dan persetujuan bersama, tanpa adanya paksaan, ancaman, atau tekanan dari pihak manapun.',
      extraFields: [
        { label: 'I. Calon Mempelai Pria', value: request.citizenGender?.toLowerCase() === 'laki-laki' ? request.citizenName : pName },
        { label: 'II. Calon Mempelai Wanita', value: request.citizenGender?.toLowerCase() === 'perempuan' ? request.citizenName : pName },
        { label: 'Status Kesepakatan', value: 'Sepakat Menikah Atas Dasar Kerelaan Bersama' }
      ],
      purpose: `Persyaratan wajib pemeriksaan nikah (Model N3) di ${ctx.kuaName}.`,
      signType: 'mempelai',
      customSigners: {
        leftTitle: 'Calon Mempelai Pemohon',
        leftName: request.citizenName,
        leftSub: 'Pihak I (Pemohon)',
        rightTitle: 'Calon Pasangan',
        rightName: pName,
        rightSub: 'Pihak II (Pasangan)'
      }
    },

    // HALAMAN 4: MODEL N4
    {
      pageNumber: 4,
      pageCode: 'Model N4',
      title: 'SURAT IZIN ORANG TUA / WALI',
      subtitle: 'Pernyataan Restu & Persetujuan Orang Tua Kandung',
      statement:
        'Kami yang bertanda tangan di bawah ini orang tua / wali dari calon mempelai, dengan ini menyatakan memberikan izin, restu, dan persetujuan sepenuhnya kepada anak kami untuk melangsungkan pernikahan dengan calon pasangannya.',
      extraFields: [
        { label: 'Memberikan Izin Kepada', value: request.citizenName },
        { label: 'Untuk Menikah Dengan', value: pName },
        { label: 'Nama Ayah Kandung', value: fName },
        { label: 'Nama Ibu Kandung', value: mName }
      ],
      purpose: `Pemenuhan syarat administratif restu orang tua (Model N4) untuk pendaftaran di ${ctx.kuaName}.`,
      signType: 'orang_tua',
      customSigners: {
        leftTitle: 'Ayah Kandung / Wali',
        leftName: fName !== '-' ? fName : 'Ayah Kandung',
        leftSub: 'Orang Tua / Wali',
        rightTitle: 'Ibu Kandung',
        rightName: mName !== '-' ? mName : 'Ibu Kandung',
        rightSub: 'Orang Tua'
      }
    }
  ];

  const overallExtraFields: LetterExtraField[] = [
    { label: 'Status Perkawinan', value: mStatus },
    { label: 'Nama Calon Pasangan', value: pName },
    { label: 'Nama Ayah Kandung', value: fName },
    { label: 'Nama Ibu Kandung', value: mName },
    { label: 'Rencana Pelaksanaan', value: `${wDate} (${wLoc})` }
  ];

  return {
    title: 'PAKET PENGANTAR NIKAH (MODEL N1 - N4)',
    statement:
      `Bahwa nama tersebut di atas adalah benar warga penduduk ${ctx.villageName} yang berstatus hukum sebagaimana tercatat di bawah ini dan bermaksud untuk melangsungkan pernikahan di ${ctx.kuaName}. Yang bersangkutan telah memenuhi syarat administrasi dan tidak ada halangan perkawinan menurut hukum syariat Islam maupun perundang-undangan Negara Republik Indonesia.`,
    extraFields: overallExtraFields,
    purpose: getCleanPurpose(
      request,
      `Pendaftaran pemeriksaan berkas nikah dan pencatatan akad perkawinan (Model N1 - N4) di ${ctx.kuaName}.`
    ),
    isBundle: true,
    pages
  };
}

