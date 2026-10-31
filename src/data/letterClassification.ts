export type LetterClass = 'CLASS_A' | 'CLASS_B';

export interface LetterFormatConfig {
  id: string;
  name: string;
  shortName: string;
  category: LetterClass;
  documentClass?: 'A' | 'B';
  allowDownload: boolean;
  isMultiPage?: boolean;
  pageCount?: number;
  description: string;
  codePrefix: string;
  iconName: string;
  requiresPhysicalVerification: boolean;
  requirements?: string[];
}

/**
 * 15 Menu Pilihan Layanan Surat SADEWA -> 18 Format Dokumen Aktual
 * KELAS A: Dokumen Sensitif / Hak Milik / Peristiwa Hukum (allowDownload: false, wajib verifikasi fisik di kantor desa)
 * KELAS B: Dokumen Keterangan Umum (allowDownload: true, dapat dicetak mandiri oleh warga)
 * Khusus 'Paket Pengantar Nikah N1-N4': Dokumen multi-halaman bundle (N1, N2, N3, N4)
 */
export const LETTER_FORMAT_CONFIGS: LetterFormatConfig[] = [
  // --- KELAS A (Sensitif, allowDownload: false) ---
  {
    id: 'srv-sku',
    name: 'Surat Keterangan Usaha (SKU)',
    shortName: 'SKU',
    category: 'CLASS_A',
    documentClass: 'A',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '503/SKU',
    iconName: 'Briefcase',
    requiresPhysicalVerification: true,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Foto Tempat / Lokasi Usaha di Desa',
      'Surat Pengantar dari Ketua RT Setempat'
    ],
    description: 'Menerangkan kepemilikan dan kegiatan usaha aktif di wilayah Desa Pulau Betung untuk perbankan, KUR, atau perizinan usaha.'
  },
  {
    id: 'srv-beda-nama',
    name: 'Surat Keterangan Beda Nama / Identitas',
    shortName: 'Beda Nama',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '140/SK-BEDA',
    iconName: 'FileCheck2',
    requiresPhysicalVerification: true,
    requirements: [
      'KTP & Kartu Keluarga (KK) Asli/Fotokopi',
      'Dokumen Pembanding yang Berbeda (Ijazah / Akta Lahir / Buku Nikah / Rekening Bank)',
      'Surat Pengantar dari Ketua RT Setempat'
    ],
    description: 'Penegasan yuridis atas perbedaan penulisan nama/tanggal lahir pada dokumen resmi yang merupakan orang yang sama.'
  },
  {
    id: 'srv-ahli-waris',
    name: 'Surat Keterangan Ahli Waris',
    shortName: 'Ahli Waris',
    category: 'CLASS_A',
    documentClass: 'A',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '593/SK-WARIS',
    iconName: 'Scale',
    requiresPhysicalVerification: true,
    requirements: [
      'KTP & KK Seluruh Ahli Waris',
      'Surat Kematian Pewaris dari Rumah Sakit / Desa',
      'Buku Nikah Pewaris',
      'Surat Pernyataan Ahli Waris Bermaterai & Saksi Keluarga'
    ],
    description: 'Dokumen legalitas penetapan silsilah ahli waris yang sah secara perdata dan hukum adat desa.'
  },
  {
    id: 'srv-sporadik',
    name: 'Surat Pernyataan Penguasaan Fisik Bidang Tanah (Sporadik)',
    shortName: 'Sporadik',
    category: 'CLASS_A',
    documentClass: 'A',
    allowDownload: false,
    isMultiPage: true,
    pageCount: 3,
    codePrefix: '593/SK-SPORADIK',
    iconName: 'Landmark',
    requiresPhysicalVerification: true,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Surat Riwayat Tanah & Bukti Perolehan (Jual Beli / Hibah / Waris)',
      'Tanda Batas Tanah Disetujui Tetangga Berbatasan',
      'KTP Saksi-Saksi Batas Tanah'
    ],
    description: 'Surat bukti penguasaan fisik tanah tidak sengketa sebagai dasar permohonan sertifikat hak milik di BPN.'
  },
  {
    id: 'srv-nikah-bundle',
    name: 'Paket Pengantar Nikah N1-N4',
    shortName: 'Pengantar Nikah (N1-N4)',
    category: 'CLASS_A',
    documentClass: 'A',
    allowDownload: false,
    isMultiPage: true,
    pageCount: 4,
    codePrefix: '474.2/SP-NIKAH',
    iconName: 'HeartHandshake',
    requiresPhysicalVerification: true,
    requirements: [
      'Fotokopi KTP dan KK Calon Pengantin (Pria & Wanita)',
      'Fotokopi Akta Kelahiran & Ijazah Terakhir',
      'Fotokopi KTP Orang Tua / Wali Nikah',
      'Pas Foto Berdampingan Latar Biru (2x3 dan 4x6)',
      'Surat Pengantar dari Ketua RT Setempat',
      'Akta Cerai / Surat Kematian Pasangan (Jika Duda/Janda)'
    ],
    description: 'Bundle multi-halaman lengkap Kemenag: Model N1 (Pengantar), Model N2 (Asal-Usul), Model N3 (Persetujuan Calon), Model N4 (Izin Orang Tua).'
  },
  {
    id: 'srv-pindah-domisili',
    name: 'Surat Keterangan Pindah Domisili',
    shortName: 'Pindah Domisili',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '470/SK-PINDAH',
    iconName: 'Truck',
    requiresPhysicalVerification: true,
    requirements: [
      'KTP & Kartu Keluarga (KK) Asli',
      'Surat Pengantar dari Ketua RT Setempat',
      'Pas Foto 4x6 (2 lembar)',
      'Rincian Alamat Tujuan Pindah Lengkap'
    ],
    description: 'Surat pengantar perpindahan kependudukan warga ke luar desa atau antar kecamatan/kabupaten.'
  },
  {
    id: 'srv-janda-duda',
    name: 'Surat Keterangan Status Janda / Duda',
    shortName: 'Janda / Duda',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '474.3/SK-JD',
    iconName: 'Users',
    requiresPhysicalVerification: true,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Akta Cerai Pengadilan Agama (Cerai Hidup) / Akta Kematian Pasangan (Cerai Mati)',
      'Surat Pengantar dari Ketua RT Setempat'
    ],
    description: 'Menerangkan status perkawinan berakhir karena perceraian berkekuatan hukum tetap atau ditinggal wafat.'
  },
  {
    id: 'srv-kehilangan',
    name: 'Surat Pengantar Laporan Kehilangan',
    shortName: 'Kehilangan',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '330/SP-HILANG',
    iconName: 'Search',
    requiresPhysicalVerification: true,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Surat Pengantar dari Ketua RT Setempat',
      'Rincian / Fotokopi Dokumen atau Barang yang Hilang'
    ],
    description: 'Pengantar pembuatan Surat Tanda Penerimaan Laporan Kehilangan (STPLK) di Polsek Pemayung.'
  },

  // --- KELAS B (Umum, allowDownload: true) ---
  {
    id: 'srv-domisili',
    name: 'Surat Keterangan Domisili (SKD)',
    shortName: 'Domisili / SKD',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '470/SK-DOM',
    iconName: 'Home',
    requiresPhysicalVerification: false,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Surat Pengantar dari Ketua RT Setempat'
    ],
    description: 'Menerangkan domisili dan tempat tinggal pemohon yang sah di wilayah hukum Desa Pulau Betung.'
  },
  {
    id: 'srv-skck',
    name: 'Surat Pengantar SKCK Kepolisian',
    shortName: 'SKCK',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '330/SP-SKCK',
    iconName: 'ShieldCheck',
    requiresPhysicalVerification: false,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Surat Pengantar dari Ketua RT Setempat',
      'Pas Foto 4x6 Berlatar Merah'
    ],
    description: 'Surat pengantar kelakuan baik untuk permohonan SKCK di Polsek Pemayung / Polres Batang Hari.'
  },
  {
    id: 'srv-sktm',
    name: 'Surat Keterangan Tidak Mampu (SKTM)',
    shortName: 'SKTM',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '460/SKTM',
    iconName: 'HeartHandshake',
    requiresPhysicalVerification: false,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Surat Pengantar / Keterangan dari Ketua RT Setempat',
      'Foto Rumah / Bukti Penunjang Prasejahtera'
    ],
    description: 'Surat rekomendasi bagi warga prasejahtera untuk keringanan biaya sekolah, kuliah, BPJS, atau rumah sakit.'
  },
  {
    id: 'srv-belum-menikah',
    name: 'Surat Keterangan Belum Menikah',
    shortName: 'Belum Menikah',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '474.1/SK-BELUM-NIKAH',
    iconName: 'UserCheck',
    requiresPhysicalVerification: false,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Surat Pengantar dari Ketua RT Setempat',
      'Surat Pernyataan Belum Pernah Menikah Bermaterai'
    ],
    description: 'Menerangkan warga berstatus jejaka/perawan (lajang) untuk melamar pekerjaan, CPNS, TNI/Polri, atau beasiswa.'
  },
  {
    id: 'srv-penghasilan-ortu',
    name: 'Surat Keterangan Penghasilan Orang Tua',
    shortName: 'Penghasilan Ortu',
    category: 'CLASS_A',
    documentClass: 'A',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '470/SK-HASIL',
    iconName: 'Wallet',
    requiresPhysicalVerification: false,
    requirements: [
      'KTP Orang Tua & Kartu Keluarga (KK)',
      'Surat Pengantar dari Ketua RT Setempat',
      'Slip Gaji / Bukti Estimasi Penghasilan Usaha'
    ],
    description: 'Menerangkan estimasi pendapatan kotor/bersih orang tua bagi pemohon beasiswa atau pendaftaran kuliah.'
  },
  {
    id: 'srv-kelahiran',
    name: 'Surat Keterangan Kelahiran',
    shortName: 'Kelahiran',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '474.1/SK-LAHIR',
    iconName: 'Baby',
    requiresPhysicalVerification: false,
    requirements: [
      'Surat Kelahiran dari Bidan / Rumah Sakit / Puskesmas',
      'KTP Kedua Orang Tua & Kartu Keluarga (KK)',
      'Buku Nikah Orang Tua',
      'KTP 2 (dua) Orang Saksi Kelahiran'
    ],
    description: 'Surat keterangan pencatatan kelahiran anak sebagai syarat penerbitan Akta Kelahiran dan penambahan KK di Dukcapil.'
  },
  {
    id: 'srv-belum-memiliki-rumah',
    name: 'Surat Keterangan Belum Memiliki Rumah',
    shortName: 'Belum Memiliki Rumah',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '640/SK-RUMAH',
    iconName: 'Building2',
    requiresPhysicalVerification: false,
    requirements: [
      'KTP & Kartu Keluarga (KK) Pemohon',
      'Surat Pengantar dari Ketua RT Setempat',
      'Surat Pernyataan Belum Memiliki Rumah Pribadi'
    ],
    description: 'Menerangkan pemohon belum memiliki hunian/rumah pribadi untuk permohonan KPR Bersubsidi atau Rusunawa.'
  },

  // --- KELAS INTER-INSTANSI & SURAT KHUSUS ---
  {
    id: 'srv-rec-camat',
    name: 'Surat Pengantar Rekomendasi Camat',
    shortName: 'Rekomendasi Camat',
    category: 'CLASS_A',
    documentClass: 'A',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '474.1/SK-REC-CAMAT',
    iconName: 'Building',
    requiresPhysicalVerification: true,
    description: 'Surat pengantar rekomendasi resmi untuk Kantor Kecamatan Pemayung.'
  },
  {
    id: 'srv-rec-disdukcapil',
    name: 'Surat Pengantar Layanan Adduk Disdukcapil',
    shortName: 'Pengantar Disdukcapil',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '470.1/SK-DISDUKCAPIL',
    iconName: 'FileText',
    requiresPhysicalVerification: false,
    description: 'Surat pengantar pengurusan dokumen kependudukan di Disdukcapil Batang Hari.'
  },
  {
    id: 'srv-rec-dinsos',
    name: 'Surat Rekomendasi Dinas Sosial (BPJS / DTKS)',
    shortName: 'Rekomendasi Dinsos',
    category: 'CLASS_B',
    documentClass: 'B',
    allowDownload: true,
    isMultiPage: false,
    codePrefix: '460.1/SK-DINSOS',
    iconName: 'HeartHandshake',
    requiresPhysicalVerification: false,
    description: 'Surat rekomendasi fasilitasi perlindungan sosial dan BPJS PBI di Dinas Sosial.'
  },
  {
    id: 'srv-rec-provinsi',
    name: 'Surat Pengantar Usulan / Program Provinsi',
    shortName: 'Pengantar Provinsi',
    category: 'CLASS_A',
    documentClass: 'A',
    allowDownload: false,
    isMultiPage: false,
    codePrefix: '470.2/SK-PROV',
    iconName: 'Landmark',
    requiresPhysicalVerification: true,
    description: 'Surat pengantar rekomendasi proposal dan usulan program ke Pemprov Jambi.'
  }
];

/**
 * Helper untuk mendeteksi klasifikasi dokumen (Kelas A / B, hak unduh, multi-halaman)
 */
export function getLetterFormatConfig(serviceNameOrId: string = ''): LetterFormatConfig {
  const q = serviceNameOrId.toLowerCase().trim();

  // Cek exact ID
  const direct = LETTER_FORMAT_CONFIGS.find((c) => c.id === serviceNameOrId);
  if (direct) return direct;

  // Mapping legacy numbered IDs
  const legacyIdMap: Record<string, string> = {
    'srv-1': 'srv-sku',
    'srv-2': 'srv-domisili',
    'srv-3': 'srv-skck',
    'srv-4': 'srv-sktm',
    'srv-5': 'srv-kelahiran',
    'srv-6': 'srv-nikah-bundle',
    'srv-7': 'srv-beda-nama',
    'srv-8': 'srv-belum-menikah',
    'srv-9': 'srv-kehilangan'
  };
  if (legacyIdMap[serviceNameOrId]) {
    const matched = LETTER_FORMAT_CONFIGS.find((c) => c.id === legacyIdMap[serviceNameOrId]);
    if (matched) return matched;
  }

  // Cek keyword match
  if (q.includes('camat')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-rec-camat')!;
  }
  if (q.includes('disdukcapil') || q.includes('capil')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-rec-disdukcapil')!;
  }
  if (q.includes('dinsos') || q.includes('sosial')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-rec-dinsos')!;
  }
  if (q.includes('provinsi') || q.includes('hibah')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-rec-provinsi')!;
  }
  if (q.includes('nikah') || q.includes('kua') || q.includes('n1') || q.includes('perkawinan')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-nikah-bundle')!;
  }
  if (q.includes('usaha') || q.includes('sku')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-sku')!;
  }
  if (q.includes('beda nama') || q.includes('identitas')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-beda-nama')!;
  }
  if (q.includes('waris') || q.includes('ahli waris')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-ahli-waris')!;
  }
  if (q.includes('sporadik') || q.includes('tanah') || q.includes('fisik bidang')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-sporadik')!;
  }
  if (q.includes('pindah')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-pindah-domisili')!;
  }
  if (q.includes('janda') || q.includes('duda')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-janda-duda')!;
  }
  if (q.includes('hilang') || q.includes('kehilangan')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-kehilangan')!;
  }
  if (q.includes('skck') || q.includes('polisi') || q.includes('kepolisian')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-skck')!;
  }
  if (q.includes('tidak mampu') || q.includes('sktm')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-sktm')!;
  }
  if (q.includes('belum nikah') || q.includes('belum kawin') || q.includes('lajang')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-belum-menikah')!;
  }
  if (q.includes('penghasilan') || q.includes('gaji')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-penghasilan-ortu')!;
  }
  if (q.includes('lahir') || q.includes('kelahiran')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-kelahiran')!;
  }
  if (q.includes('rumah') || q.includes('kpr')) {
    return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-belum-memiliki-rumah')!;
  }

  // Default fallback: Domisili (Kelas B)
  return LETTER_FORMAT_CONFIGS.find((c) => c.id === 'srv-domisili')!;
}
