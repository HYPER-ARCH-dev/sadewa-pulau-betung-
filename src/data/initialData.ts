import {
  User,
  VillageService,
  ServiceRequest,
  Complaint,
  NewsItem,
  Announcement,
  AgendaItem,
  GalleryItem,
  BudgetYearData,
  DevelopmentProject,
  VillagePotential,
  UmkmItem,
  VillageOfficial,
  MapFacility,
  AuditLog,
  DusunRecord
} from '../types';

export const INITIAL_TERRITORIES: DusunRecord[] = [
  {
    id: 'dus-1',
    number: 1,
    customName: '',
    name: 'Dusun 1',
    leaderName: 'Ahmad Supandi',
    isActive: true,
    rws: [
      {
        id: 'rw-1',
        dusunId: 'dus-1',
        name: 'RW 01',
        leaderName: 'M. Yusuf',
        isActive: true,
        rts: [
          { id: 'rt-1', dusunId: 'dus-1', rwId: 'rw-1', name: 'RT 01', leaderName: 'Budi Santoso', isActive: true },
          { id: 'rt-2', dusunId: 'dus-1', rwId: 'rw-1', name: 'RT 02', leaderName: 'Hendra Saputra', isActive: true },
          { id: 'rt-3', dusunId: 'dus-1', rwId: 'rw-1', name: 'RT 03', leaderName: 'Samsul Bahri', isActive: true }
        ]
      },
      {
        id: 'rw-2',
        dusunId: 'dus-1',
        name: 'RW 02',
        leaderName: 'Ridwan',
        isActive: true,
        rts: [
          { id: 'rt-4', dusunId: 'dus-1', rwId: 'rw-2', name: 'RT 04', leaderName: 'Rahmat Hidayat', isActive: true }
        ]
      }
    ]
  },
  {
    id: 'dus-2',
    number: 2,
    customName: '',
    name: 'Dusun 2',
    leaderName: 'Zulkifli',
    isActive: true,
    rws: [
      {
        id: 'rw-3',
        dusunId: 'dus-2',
        name: 'RW 03',
        leaderName: 'Usman',
        isActive: true,
        rts: [
          { id: 'rt-5', dusunId: 'dus-2', rwId: 'rw-3', name: 'RT 05', leaderName: 'Eko Prasetyo', isActive: true },
          { id: 'rt-6', dusunId: 'dus-2', rwId: 'rw-3', name: 'RT 06', leaderName: 'Agus Triono', isActive: true }
        ]
      }
    ]
  },
  {
    id: 'dus-3',
    number: 3,
    customName: '',
    name: 'Dusun 3',
    leaderName: 'Ahmad Dahlan',
    isActive: true,
    rws: [
      {
        id: 'rw-4',
        dusunId: 'dus-3',
        name: 'RW 04',
        leaderName: 'Hasanuddin',
        isActive: true,
        rts: [
          { id: 'rt-7', dusunId: 'dus-3', rwId: 'rw-4', name: 'RT 07', leaderName: 'Nurhadi', isActive: true },
          { id: 'rt-8', dusunId: 'dus-3', rwId: 'rw-4', name: 'RT 08', leaderName: 'Subagyo', isActive: true }
        ]
      }
    ]
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Admin SADEWA',
    username: 'admin_sadewa',
    phone: '0812-7489-0001',
    email: 'admin.sadewa@pulaubetung.sadewa.id',
    role: 'super_admin',
    roleTitle: 'Super Administrator',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    lastLogin: '2026-09-02 08:30 WIB'
  },
  {
    id: 'usr-2',
    name: 'Ahmad Fauzi, S.AP',
    username: 'fauzi_sekdes',
    phone: '0812-7489-0002',
    email: 'sekdes@pulaubetung.sadewa.id',
    role: 'admin_desa',
    roleTitle: 'Sekretaris Desa (Admin)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    lastLogin: '2026-09-01 14:15 WIB'
  },
  {
    id: 'usr-3',
    name: 'Siti Rahmawati',
    username: 'siti_layanan',
    phone: '0812-7489-0003',
    email: 'pelayanan@pulaubetung.sadewa.id',
    role: 'operator',
    roleTitle: 'Operator Pelayanan & Kependudukan',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    lastLogin: '2026-09-02 09:10 WIB'
  },
  {
    id: 'usr-4',
    name: 'Budi Santoso',
    username: 'budi_media',
    phone: '0812-7489-0004',
    email: 'publikasi@pulaubetung.sadewa.id',
    role: 'editor',
    roleTitle: 'Editor Konten & Dokumentasi',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    lastLogin: '2026-08-31 16:40 WIB'
  }
];

export const INITIAL_SERVICES: VillageService[] = [
  // =========================================================================
  // KELAS A (DOKUMEN SENSITIF - HAK MILIK / PERISTIWA HUKUM)
  // Aturan: allowDownload = false. Demi kepastian hukum, warga wajib datang
  // ke Kantor Desa membawa dokumen persyaratan asli untuk mengambil surat fisik.
  // =========================================================================
  {
    id: 'srv-1',
    name: 'Surat Keterangan Usaha (SKU)',
    shortName: 'SKU',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: false,
    description: 'Surat resmi yang menerangkan bahwa warga benar memiliki kegiatan usaha aktif di wilayah Desa Pulau Betung guna keperluan perbankan, KUR, atau perizinan.',
    requirements: [
      'Foto/Scan KTP Pemohon (Warga Desa Pulau Betung)',
      'Foto/Scan Kartu Keluarga (KK)',
      'Foto tempat/kegiatan usaha di desa',
      'Surat pengantar RT setempat'
    ],
    procedures: [
      'Mengisi formulir pengajuan online atau datang ke Kantor Desa',
      'Petugas memverifikasi kelengkapan berkas dan keabsahan usaha',
      'Kasi Pelayanan menyetujui draf surat keterangan',
      'Tanda tangan elektronik Kepala Desa',
      'Warga mengambil surat cetak bertanda tangan basah/legalisir di Kantor Desa'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'business_name', label: 'Nama Usaha / Toko', type: 'text', required: true, helper: 'Contoh: Usaha Kopi Betung Sejahtera' },
      { id: 'business_type', label: 'Jenis / Bidang Usaha', type: 'text', required: true, helper: 'Contoh: Perdagangan Hasil Bumi / Kuliner' },
      { id: 'business_address', label: 'Lokasi Usaha (RT/Dusun)', type: 'text', required: true, helper: 'Contoh: RT 03 Dusun Betung Indah' },
      { id: 'purpose', label: 'Tujuan Penggunaan Surat', type: 'text', required: true, helper: 'Contoh: Pengajuan KUR Bank / Tambahan Modal' }
    ]
  },
  {
    id: 'srv-7',
    name: 'Surat Keterangan Beda Nama / Identitas',
    shortName: 'Beda Nama',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: false,
    description: 'Surat penegasan resmi bahwa terdapat perbedaan penulisan nama atau tanggal lahir antara KTP, KK, Ijazah, Buku Nikah, atau Rekening Bank namun merupakan satu orang yang sama.',
    requirements: [
      'KTP & Kartu Keluarga asli/fotokopi',
      'Dokumen pembanding yang berbeda (Ijazah / Akta Lahir / Buku Nikah / Rekening Bank)',
      'Surat Pengantar RT setempat'
    ],
    procedures: [
      'Pemeriksaan riwayat data adminduk pemohon di basis data desa',
      'Verifikasi dokumen pembanding fisik di kantor desa',
      'Penerbitan Surat Keterangan Beda Nama resmi berkop desa'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'name_in_ktp', label: 'Nama Tercantum di KTP/KK', type: 'text', required: true },
      { id: 'name_in_document', label: 'Nama Tercantum di Dokumen Lain', type: 'text', required: true },
      { id: 'document_source', label: 'Nama Dokumen yang Berbeda', type: 'text', required: true, helper: 'Contoh: Ijazah SMA / Buku Tabungan Bank Jambi / BPJS' },
      { id: 'purpose', label: 'Keperluan Perbaikan / Penggunaan', type: 'text', required: true }
    ]
  },
  {
    id: 'srv-ahli-waris',
    name: 'Surat Keterangan Ahli Waris',
    shortName: 'Ahli Waris',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: false,
    description: 'Dokumen legalitas penetapan silsilah ahli waris yang sah secara perdata dan hukum adat desa untuk pengurusan aset, perbankan, atau pertanahan.',
    requirements: [
      'KTP & KK Seluruh Ahli Waris',
      'Surat Kematian Pewaris dari Rumah Sakit / Desa',
      'Surat Pernyataan Ahli Waris bermaterai dan ditandatangani para saksi',
      'Buku Nikah Pewaris'
    ],
    procedures: [
      'Pemeriksaan silsilah keluarga dan saksi-saksi keluarga',
      'Verifikasi data kependudukan dan surat kematian pewaris',
      'Penandatanganan berita acara di hadapan Kepala Desa & BPD',
      'Pengambilan surat fisik resmi berstempel basah'
    ],
    estimatedDays: '2 - 3 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'deceased_name', label: 'Nama Almarhum / Pewaris', type: 'text', required: true },
      { id: 'death_date', label: 'Tanggal Meninggal Dunia', type: 'text', required: true, helper: 'Contoh: 12 Januari 2025' },
      { id: 'heirs_list', label: 'Daftar Nama Ahli Waris & Hubungan', type: 'textarea', required: true, helper: 'Contoh: 1. Siti Aminah (Istri), 2. Budi Santoso (Anak Kandung)' },
      { id: 'purpose', label: 'Keperluan Surat', type: 'text', required: true, helper: 'Contoh: Pengurusan Rekening Tabungan Bank / Pengalihan Hak' }
    ]
  },
  {
    id: 'srv-sporadik',
    name: 'Surat Pernyataan Penguasaan Fisik Bidang Tanah (Sporadik)',
    shortName: 'Sporadik',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: false,
    description: 'Surat bukti penguasaan fisik tanah yang tidak dalam sengketa sebagai dasar permohonan sertifikat hak milik di Kantor ATR/BPN Batang Hari.',
    requirements: [
      'KTP & KK Pemohon',
      'Surat Riwayat Tanah & Bukti Perolehan (Jual Beli / Hibah / Warisan)',
      'Tanda Batas Tanah disetujui para tetangga batas',
      'KTP Saksi-saksi Perbatasan'
    ],
    procedures: [
      'Pemeriksaan berkas kepemilikan dan batas tanah',
      'Peninjauan lapangan oleh Tim Pertanahan Desa & Kepala Dusun',
      'Pemasangan pengumuman tidak ada sengketa di kantor desa',
      'Penandatanganan dokumen Sporadik oleh Kepala Desa'
    ],
    estimatedDays: '3 - 5 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'land_location', label: 'Letak Tanah (RT / Dusun / Jalan)', type: 'text', required: true },
      { id: 'land_area', label: 'Perkiraan Luas Tanah (m²)', type: 'text', required: true, helper: 'Contoh: 1.200 m²' },
      { id: 'border_north', label: 'Batas Sebelah Utara', type: 'text', required: true },
      { id: 'border_south', label: 'Batas Sebelah Selatan', type: 'text', required: true },
      { id: 'border_east', label: 'Batas Sebelah Timur', type: 'text', required: true },
      { id: 'border_west', label: 'Batas Sebelah Barat', type: 'text', required: true },
      { id: 'land_source', label: 'Asal Perolehan Tanah', type: 'text', required: true, helper: 'Contoh: Warisan Orang Tua Tahun 2005' }
    ]
  },
  {
    id: 'srv-6',
    name: 'Paket Pengantar Nikah N1-N4',
    shortName: 'Pengantar Nikah (N1-N4)',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: true,
    pageCount: 4,
    description: 'Bundle multi-halaman lengkap Kemenag bagi warga yang akan menikah: Model N1 (Pengantar), Model N2 (Asal-Usul), Model N3 (Persetujuan Calon), Model N4 (Izin Orang Tua).',
    requirements: [
      'Fotokopi KTP dan KK Calon Pengantin (Pria & Wanita)',
      'Fotokopi Akta Kelahiran & Ijazah Terakhir',
      'Fotokopi KTP Orang Tua / Wali Nikah',
      'Pas foto berdampingan ukuran 2x3 (4 lembar) dan 4x6 (2 lembar) latar biru',
      'Surat Pengantar dari Ketua RT setempat',
      'Akta Cerai / Surat Kematian jika berstatus Duda atau Janda'
    ],
    procedures: [
      'Mengisi formulir data calon mempelai dan orang tua',
      'Verifikasi status pernikahan dan berkas pendukung oleh Kasi Pelayanan',
      'Pemeriksaan tidak adanya halangan hukum/syar’i oleh Penghulu Desa',
      'Penerbitan 4 lembar dokumen bundel resmi (N1, N2, N3, N4)',
      'Pengambilan dokumen bundel fisik di kantor desa untuk dibawa ke KUA Pemayung'
    ],
    estimatedDays: '1 - 2 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'partner_name', label: 'Nama Lengkap Calon Pasangan', type: 'text', required: true, helper: 'Nama pasangan yang akan dinikahi' },
      { id: 'marital_status', label: 'Status Calon Pengantin', type: 'select', options: ['Jejaka / Perawan (Belum Menikah)', 'Duda', 'Janda'], required: true },
      { id: 'father_name', label: 'Nama Ayah Kandung', type: 'text', required: true },
      { id: 'mother_name', label: 'Nama Ibu Kandung', type: 'text', required: true },
      { id: 'wedding_plan_date', label: 'Rencana Tanggal Akad Nikah', type: 'text', required: true, helper: 'Contoh: 20 Desember 2026' },
      { id: 'wedding_location', label: 'Tempat Pelaksanaan Akad', type: 'text', required: true, helper: 'Contoh: Rumah Mempelai Perempuan / KUA Pemayung' },
      { id: 'mahar_wali_info', label: 'Ketentuan Mahar / Wali', type: 'text', required: true, defaultValue: 'Sesuai Ketentuan Syariat Islam & Administrasi KUA', helper: 'Contoh: Emas 10 Gram Tunai / Wali Nasab' }
    ]
  },
  {
    id: 'srv-pindah-domisili',
    name: 'Surat Keterangan Pindah Domisili',
    shortName: 'Pindah Domisili',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: false,
    description: 'Surat pengantar perpindahan kependudukan warga ke luar desa atau antar kecamatan/kabupaten guna penerbitan SKPWNI di Dinas Dukcapil.',
    requirements: [
      'KTP Asli & KK Asli',
      'Surat Pengantar RT setempat',
      'Pas foto 4x6 (2 lembar)',
      'Alamat tujuan pindah lengkap'
    ],
    procedures: [
      'Pemeriksaan status domisili dan keluarga yang ikut pindah',
      'Penerbitan surat keterangan pengantar pindah resmi',
      'Pengambilan berkas pengantar untuk dibawa ke Disdukcapil'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'destination_address', label: 'Alamat Lengkap Tujuan Pindah', type: 'textarea', required: true, helper: 'Cantumkan RT/RW, Kelurahan/Desa, Kecamatan, Kabupaten/Kota, Provinsi' },
      { id: 'move_reason', label: 'Alasan Pindah', type: 'select', options: ['Pekerjaan', 'Pendidikan', 'Keamanan', 'Keluarga / Ikut Suami/Istri', 'Perumahan'], required: true },
      { id: 'family_members_moving', label: 'Jumlah Anggota Keluarga yang Pindah', type: 'text', required: true, helper: 'Contoh: 1 Orang (Kepala Keluarga Saja) / Seluruh Keluarga (3 Orang)' }
    ]
  },
  {
    id: 'srv-janda-duda',
    name: 'Surat Keterangan Status Janda / Duda',
    shortName: 'Janda / Duda',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: false,
    description: 'Surat keterangan resmi yang menerangkan status perkawinan berakhir karena perceraian berkekuatan hukum tetap atau meninggal dunia.',
    requirements: [
      'KTP & Kartu Keluarga',
      'Akta Cerai dari Pengadilan Agama (Cerai Hidup) ATAU Akta Kematian (Cerai Mati)',
      'Surat Pengantar RT setempat'
    ],
    procedures: [
      'Validasi akta perceraian atau akta kematian pasangan',
      'Pemeriksaan buku register desa',
      'Penerbitan surat keterangan resmi bertandatangan Kepala Desa'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'marital_condition', label: 'Status Saat Ini', type: 'select', options: ['Janda (Cerai Hidup)', 'Janda (Cerai Mati)', 'Duda (Cerai Hidup)', 'Duda (Cerai Mati)'], required: true },
      { id: 'ex_spouse_name', label: 'Nama Mantan Pasangan / Almarhum(ah)', type: 'text', required: true },
      { id: 'decree_number', label: 'Nomor Akta Cerai / Akta Kematian', type: 'text', required: true },
      { id: 'purpose', label: 'Keperluan Surat', type: 'text', required: true, helper: 'Contoh: Pengurusan Pensiun / Menikah Lagi / Pendataan BPJS' }
    ]
  },
  {
    id: 'srv-9',
    name: 'Surat Pengantar Laporan Kehilangan',
    shortName: 'Kehilangan',
    category: 'CLASS_A',
    letterClass: 'CLASS_A',
    allowDownload: false,
    isMultiPage: false,
    description: 'Surat pengantar resmi dari Pemerintah Desa untuk pengurusan Surat Tanda Penerimaan Laporan Kehilangan (STPLK) di Polsek Pemayung (kehilangan KTP, KK, Ijazah, atau Surat Berharga).',
    requirements: [
      'Fotokopi identitas atau bukti pendukung jika ada',
      'Surat Pengantar RT setempat',
      'Pernyataan kronologi singkat kehilangan'
    ],
    procedures: [
      'Pencatatan kronologi dan barang/dokumen yang hilang',
      'Penerbitan surat pengantar desa',
      'Pemohon membawa surat pengantar fisik ke SPKT Polsek Pemayung'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'lost_item', label: 'Barang / Dokumen yang Hilang', type: 'text', required: true, helper: 'Contoh: KTP Asli / Kartu Keluarga / Buku Tabungan' },
      { id: 'estimated_location', label: 'Perkiraan Lokasi & Waktu Kehilangan', type: 'text', required: true, helper: 'Contoh: Sekitar Pasar Pemayung, 28 Agustus 2026' }
    ]
  },

  // =========================================================================
  // KELAS B (DOKUMEN KETERANGAN UMUM)
  // Aturan: allowDownload = true. Warga dapat mengunduh dan mencetak mandiri
  // dokumen PDF resmi ber-TTE dan ber-QR code validasi dari portal SADEWA.
  // =========================================================================
  {
    id: 'srv-2',
    name: 'Surat Keterangan Domisili (SKD)',
    shortName: 'Domisili / SKD',
    category: 'CLASS_B',
    letterClass: 'CLASS_B',
    allowDownload: true,
    isMultiPage: false,
    description: 'Menerangkan status kependudukan dan tempat tinggal pemohon di wilayah hukum Desa Pulau Betung.',
    requirements: [
      'KTP Pemohon',
      'Kartu Keluarga (KK)',
      'Surat Pengantar RT setempat'
    ],
    procedures: [
      'Pengajuan online dengan mengisi data diri',
      'Verifikasi data kependudukan oleh operator desa',
      'Persetujuan digital Kepala Desa',
      'Unduh file PDF resmi mandiri atau ambil di kantor desa'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'origin_address', label: 'Alamat Asal', type: 'text', required: true },
      { id: 'living_since', label: 'Tinggal di Desa Sejak Tahun', type: 'number', required: true },
      { id: 'purpose', label: 'Keperluan Surat', type: 'text', required: true }
    ]
  },
  {
    id: 'srv-3',
    name: 'Surat Pengantar SKCK Kepolisian',
    shortName: 'SKCK',
    category: 'CLASS_B',
    letterClass: 'CLASS_B',
    allowDownload: true,
    isMultiPage: false,
    description: 'Surat pengantar resmi dari Pemerintah Desa untuk pengurusan Surat Keterangan Catatan Kepolisian di Polsek Pemayung / Polres Batang Hari.',
    requirements: [
      'Fotokopi/Scan KTP dan KK',
      'Pas foto 4x6 latar merah (2 lembar)',
      'Surat Pengantar dari Ketua RT'
    ],
    procedures: [
      'Pengisian formulir permohonan',
      'Pemeriksaan catatan adminduk desa',
      'Persetujuan Kepala Desa ber-TTE',
      'Warga dapat mengunduh PDF pengantar untuk dibawa ke Polsek'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'police_target', label: 'Tujuan Pengurusan SKCK', type: 'text', required: true, helper: 'Contoh: Melamar Pekerjaan / Pendaftaran TNI-Polri / CPNS' }
    ]
  },
  {
    id: 'srv-4',
    name: 'Surat Keterangan Tidak Mampu (SKTM)',
    shortName: 'SKTM',
    category: 'CLASS_B',
    letterClass: 'CLASS_B',
    allowDownload: true,
    isMultiPage: false,
    description: 'Surat resmi untuk warga prasejahtera guna keperluan keringanan biaya pendidikan/sekolah, rumah sakit, atau bantuan sosial.',
    requirements: [
      'KTP & Kartu Keluarga',
      'Surat Keterangan Penghasilan / Keterangan RT',
      'Foto kondisi rumah tampak depan'
    ],
    procedures: [
      'Pengajuan online dengan melampirkan berkas',
      'Pengecekan basis data kemiskinan desa (DTKS) oleh operator sosial',
      'Persetujuan Kepala Desa',
      'Surat PDF resmi siap diunduh'
    ],
    estimatedDays: '1 - 2 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'dependent_name', label: 'Nama Anak / Tanggungan (Jika untuk beasiswa)', type: 'text', required: false },
      { id: 'institution', label: 'Instansi / Kampus / RS Dituju', type: 'text', required: true },
      { id: 'purpose', label: 'Keperluan Rinci', type: 'textarea', required: true }
    ]
  },
  {
    id: 'srv-8',
    name: 'Surat Keterangan Belum Menikah',
    shortName: 'Belum Menikah',
    category: 'CLASS_B',
    letterClass: 'CLASS_B',
    allowDownload: true,
    isMultiPage: false,
    description: 'Surat keterangan resmi yang menerangkan bahwa warga bersangkutan belum pernah menikah/kawin guna keperluan melamar pekerjaan, CPNS, TNI/Polri, atau beasiswa.',
    requirements: [
      'Fotokopi KTP dan KK Pemohon',
      'Surat Pengantar RT yang menyatakan status belum menikah',
      'Pernyataan belum menikah'
    ],
    procedures: [
      'Pengecekan data kependudukan dan buku register pernikahan desa',
      'Penandatanganan digital oleh Kepala Desa',
      'Unduh dokumen resmi langsung dari portal'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'purpose', label: 'Instansi / Keperluan Surat', type: 'text', required: true, helper: 'Contoh: Persyaratan Seleksi CPNS Kemendagri / Rekrutmen BUMN' }
    ]
  },
  {
    id: 'srv-penghasilan-ortu',
    name: 'Surat Keterangan Penghasilan Orang Tua',
    shortName: 'Penghasilan Ortu',
    category: 'CLASS_B',
    letterClass: 'CLASS_B',
    allowDownload: true,
    isMultiPage: false,
    description: 'Surat keterangan yang menerangkan estimasi penghasilan rata-rata orang tua/wali pemohon untuk syarat beasiswa, KIP Kuliah, atau pendaftaran sekolah.',
    requirements: [
      'KTP Orang Tua & KK Pemohon',
      'Surat Pengantar RT setempat yang memuat rincian pekerjaan dan rata-rata penghasilan',
      'Kartu Pelajar / Mahasiswa pemohon'
    ],
    procedures: [
      'Pengisian formulir data orang tua dan nominal penghasilan',
      'Verifikasi oleh staf pelayanan desa',
      'Pengesahan oleh Kepala Desa',
      'Unduh surat PDF resmi mandiri'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'parent_name', label: 'Nama Orang Tua / Wali', type: 'text', required: true },
      { id: 'parent_job', label: 'Pekerjaan Orang Tua', type: 'text', required: true, helper: 'Contoh: Petani Sawit / Buruh Harian / Pedagang' },
      { id: 'monthly_income', label: 'Rata-rata Penghasilan Per Bulan', type: 'text', required: true, helper: 'Contoh: Rp 1.500.000 / bulan' },
      { id: 'dependents_count', label: 'Jumlah Tanggungan Anak', type: 'number', required: true, helper: 'Contoh: 3' },
      { id: 'purpose', label: 'Keperluan Surat', type: 'text', required: true, helper: 'Contoh: Pendaftaran Beasiswa KIP Kuliah di Universitas Jambi' }
    ]
  },
  {
    id: 'srv-5',
    name: 'Surat Keterangan Kelahiran',
    shortName: 'Kelahiran',
    category: 'CLASS_B',
    letterClass: 'CLASS_B',
    allowDownload: true,
    isMultiPage: false,
    description: 'Surat pencatatan kelahiran anak warga desa guna penerbitan Akta Kelahiran dan penambahan anggota keluarga pada KK di Dinas Dukcapil Batang Hari.',
    requirements: [
      'Surat Keterangan Medis dari Bidan Desa / Puskesmas Pemayung',
      'KK dan KTP Ayah & Ibu',
      'Buku Nikah Orang Tua'
    ],
    procedures: [
      'Pelaporan data kelahiran oleh keluarga',
      'Pemeriksaan kesesuaian data nama anak dan orang tua',
      'Penerbitan surat keterangan kelahiran desa ber-TTE',
      'Unduh mandiri berkas PDF'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'child_name', label: 'Nama Lengkap Bayi / Anak', type: 'text', required: true },
      { id: 'child_gender', label: 'Jenis Kelamin', type: 'select', options: ['Laki-laki', 'Perempuan'], required: true },
      { id: 'birth_place', label: 'Tempat Kelahiran', type: 'text', required: true, helper: 'Contoh: Pulau Betung / Puskesmas Jembatan Mas' },
      { id: 'birth_date', label: 'Tanggal & Jam Lahir', type: 'text', required: true, helper: 'Contoh: 14 Agustus 2026, Pukul 08:30 WIB' },
      { id: 'birth_order', label: 'Anak Ke-', type: 'number', required: true, helper: 'Contoh: 2' }
    ]
  },
  {
    id: 'srv-belum-memiliki-rumah',
    name: 'Surat Keterangan Belum Memiliki Rumah',
    shortName: 'Belum Memiliki Rumah',
    category: 'CLASS_B',
    letterClass: 'CLASS_B',
    allowDownload: true,
    isMultiPage: false,
    description: 'Surat keterangan resmi yang menerangkan bahwa warga bersangkutan belum memiliki hunian/rumah pribadi guna permohonan KPR Bersubsidi (FLPP) atau Rusunawa.',
    requirements: [
      'KTP & Kartu Keluarga Pemohon',
      'Surat Pengantar RT setempat yang menyatakan belum memiliki rumah',
      'Surat Pernyataan Belum Memiliki Rumah bermaterai'
    ],
    procedures: [
      'Pengecekan basis data kepemilikan aset dan domisili',
      'Pengesahan oleh Kepala Desa',
      'Unduh surat PDF resmi ber-TTE'
    ],
    estimatedDays: '1 Hari Kerja',
    cost: 'Gratis (Rp 0)',
    isActive: true,
    requiredFields: [
      { id: 'current_living_status', label: 'Status Tempat Tinggal Saat Ini', type: 'select', options: ['Menumpang di Rumah Orang Tua', 'Mengontrak / Sewa', 'Tinggal di Rumah Kerabat / Dinas'], required: true },
      { id: 'bank_name', label: 'Bank / Instansi Penyelenggara KPR', type: 'text', required: true, helper: 'Contoh: Bank BTN Cabang Jambi' },
      { id: 'housing_target', label: 'Lokasi Perumahan yang Dituju', type: 'text', required: true, helper: 'Contoh: Perumahan Griya Pemayung Asri' }
    ]
  }
];

export const INITIAL_SERVICE_REQUESTS: ServiceRequest[] = [
  {
    id: 'req-sku-001',
    trackingCode: 'REQ-PB-2026-001',
    serviceId: 'srv-1',
    serviceName: 'Surat Keterangan Usaha (SKU)',
    citizenName: 'Hendri Saputra',
    citizenNik: '1504011205900004',
    citizenNikMasked: '150401******0004',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '12 Mei 1990',
    phone: '0822-8199-5541',
    addressDusun: 'RT 02 Dusun Betung Indah',
    requestDate: '2026-09-01',
    status: 'selesai',
    notes: 'Permohonan SKU untuk syarat pengajuan Kredit Usaha Rakyat (KUR) Mikro di Bank Jambi.',
    staffNotes: 'Data tempat usaha telah diverifikasi di lapangan. Surat telah diterbitkan dan ditandatangani Kepala Desa.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-02',
    officialLetterNumber: '503 / 001 / SKU / PB-PMY / IX / 2026',
    formData: {
      business_name: 'Toko Kelontong Berkah Tani',
      business_type: 'Perdagangan Sembako & Saprodi Pertanian',
      business_address: 'RT 02 Dusun Betung Indah',
      purpose: 'Pengajuan KUR Mikro Pertanian Bank Jambi'
    }
  },
  {
    id: 'req-dom-002',
    trackingCode: 'REQ-PB-2026-002',
    serviceId: 'srv-2',
    serviceName: 'Surat Keterangan Domisili (SKD)',
    citizenName: 'Ahmad Tarmizi',
    citizenNik: '1504011208900001',
    citizenNikMasked: '150401******0001',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Jambi',
    citizenBirthDate: '12 Agustus 1990',
    phone: '0812-7890-3321',
    addressDusun: 'RT 03 Dusun Betung Indah',
    requestDate: '2026-09-02',
    status: 'selesai',
    notes: 'Keterangan domisili bertempat tinggal tetap di Desa Pulau Betung untuk administrasi perbankan.',
    staffNotes: 'Data kependudukan valid dan telah dicocokkan dengan Kartu Keluarga.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-03',
    officialLetterNumber: '470 / 002 / SK-DOM / PB-PMY / IX / 2026',
    formData: {
      origin_address: 'Desa Pulau Betung RT 03',
      living_since: 2018,
      purpose: 'Persyaratan Administrasi Pembukaan Rekening Bank & Pajak'
    }
  },
  {
    id: 'req-skck-003',
    trackingCode: 'REQ-PB-2026-003',
    serviceId: 'srv-3',
    serviceName: 'Surat Pengantar SKCK Kepolisian',
    citizenName: 'Dewi Lestari',
    citizenNik: '1504015408930099',
    citizenNikMasked: '150401******0099',
    citizenGender: 'Perempuan',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '14 Agustus 1993',
    phone: '0852-6677-8899',
    addressDusun: 'RT 04 Dusun Teluk Melintang',
    requestDate: '2026-09-03',
    status: 'selesai',
    notes: 'Surat pengantar kelakuan baik untuk mengurus SKCK di Polsek Pemayung.',
    staffNotes: 'Pemohon berkelakuan baik, tidak memiliki catatan kriminal di desa. Surat pengantar disahkan.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-03',
    officialLetterNumber: '330 / 003 / SP-SKCK / PB-PMY / IX / 2026',
    formData: {
      police_target: 'Pemberkasan Seleksi Tenaga PPPK Guru Dinas Pendidikan Batang Hari'
    }
  },
  {
    id: 'req-sktm-004',
    trackingCode: 'REQ-PB-2026-004',
    serviceId: 'srv-4',
    serviceName: 'Surat Keterangan Tidak Mampu (SKTM)',
    citizenName: 'Zulkifli',
    citizenNik: '1504012010850029',
    citizenNikMasked: '150401******0029',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Muara Bulian',
    citizenBirthDate: '20 Oktober 1985',
    phone: '0813-7901-4455',
    addressDusun: 'RT 01 Dusun Betung Indah',
    requestDate: '2026-09-04',
    status: 'selesai',
    notes: 'SKTM untuk permohonan keringanan biaya kuliah anak di Universitas Jambi.',
    staffNotes: 'Terdata di DTKS / P3KE kategori desil prasejahtera. Surat diterbitkan resmi.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-05',
    officialLetterNumber: '460 / 004 / SKTM / PB-PMY / IX / 2026',
    formData: {
      dependent_name: 'Muhammad Rizky Pratama (Anak Kandung)',
      institution: 'Universitas Jambi (UNJA)',
      purpose: 'Pengajuan Keringanan Biaya Uang Kuliah Tunggal (UKT) Semester Gasal'
    }
  },
  {
    id: 'req-lahir-005',
    trackingCode: 'REQ-PB-2026-005',
    serviceId: 'srv-5',
    serviceName: 'Surat Keterangan Kelahiran',
    citizenName: 'M. Yusuf (Kepala Keluarga / Ayah)',
    citizenNik: '1504011406890015',
    citizenNikMasked: '150401******0015',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '14 Juni 1989',
    phone: '0821-8899-7711',
    addressDusun: 'RT 03 Dusun Betung Indah',
    requestDate: '2026-09-05',
    status: 'selesai',
    notes: 'Pencatatan kelahiran anak kedua untuk pembuatan Akta Kelahiran di Disdukcapil.',
    staffNotes: 'Surat bidan desa terlampir lengkap, nomor surat kelahiran desa diterbitkan.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-05',
    officialLetterNumber: '474.1 / 005 / SK-LAHIR / PB-PMY / IX / 2026',
    formData: {
      child_name: 'Muhammad Al-Fatih Pratama',
      child_gender: 'Laki-laki',
      birth_place: 'Pulau Betung',
      birth_date: '03 September 2026, Pukul 07:30 WIB',
      birth_order: 2,
      father_name: 'M. Yusuf',
      mother_name: 'Siti Aisyah'
    }
  },
  {
    id: 'req-nikah-006',
    trackingCode: 'REQ-PB-2026-006',
    serviceId: 'srv-6',
    serviceName: 'Paket Pengantar Nikah N1-N4',
    citizenName: 'Rian Pratama',
    citizenNik: '1504011504950035',
    citizenNikMasked: '150401******0035',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '15 April 1995',
    phone: '0821-7712-9900',
    addressDusun: 'RT 03 Dusun Betung Indah',
    requestDate: '2026-09-06',
    status: 'selesai',
    notes: 'Pemberkasan formulir N1 s/d N4 untuk pendaftaran pernikahan di KUA Kecamatan Pemayung.',
    staffNotes: 'Bundel naskah model N1, N2, N3, dan N4 lengkap disahkan.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-07',
    officialLetterNumber: '474.2 / 006 / SP-NIKAH / PB-PMY / IX / 2026',
    formData: {
      partner_name: 'Anisa Rahmawati, S.Pd',
      marital_status: 'Jejaka / Perawan (Belum Menikah)',
      father_name: 'Herman Susanto',
      mother_name: 'Kalsum',
      wedding_plan_date: '25 Oktober 2026',
      wedding_location: 'KUA Kecamatan Pemayung',
      mahar_wali_info: 'Emas Murni 5 Gram & Seperangkat Alat Sholat / Wali Nasab Ayah Kandung'
    }
  },
  {
    id: 'req-beda-007',
    trackingCode: 'REQ-PB-2026-007',
    serviceId: 'srv-7',
    serviceName: 'Surat Keterangan Beda Nama / Identitas',
    citizenName: 'Nurhayati',
    citizenNik: '1504016203880048',
    citizenNikMasked: '150401******0048',
    citizenGender: 'Perempuan',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '22 Maret 1988',
    phone: '0852-9901-2233',
    addressDusun: 'RT 05 Dusun Teluk Melintang',
    requestDate: '2026-09-07',
    status: 'selesai',
    notes: 'Perbedaan penulisan nama antara ejaan di KTP (Nurhayati) dan di Buku Tabungan Bank (Noor Hayati).',
    staffNotes: 'Kesesuaian identitas telah diverifikasi dengan Akta Lahir dan Ijazah asli.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-07',
    officialLetterNumber: '140 / 007 / SK-BEDA / PB-PMY / IX / 2026',
    formData: {
      name_in_ktp: 'Nurhayati',
      name_in_document: 'Noor Hayati',
      document_source: 'Buku Tabungan Bank Jambi & Kartu BPJS Kesehatan',
      purpose: 'Pencairan Bantuan Dana Kelompok Wanita Tani (KWT)'
    }
  },
  {
    id: 'req-bm-008',
    trackingCode: 'REQ-PB-2026-008',
    serviceId: 'srv-8',
    serviceName: 'Surat Keterangan Belum Menikah',
    citizenName: 'Bayu Anggara',
    citizenNik: '1504010807970061',
    citizenNikMasked: '150401******0061',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Jambi',
    citizenBirthDate: '08 Juli 1997',
    phone: '0812-3344-5566',
    addressDusun: 'RT 02 Dusun Betung Indah',
    requestDate: '2026-09-08',
    status: 'selesai',
    notes: 'Surat keterangan belum pernah menikah untuk melengkapi berkas pendaftaran CPNS.',
    staffNotes: 'Register kependudukan desa menyatakan pemohon berstatus lajang/belum kawin.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-08',
    officialLetterNumber: '474.1 / 008 / SK-BELUM-NIKAH / PB-PMY / IX / 2026',
    formData: {
      purpose: 'Persyaratan Registrasi Seleksi CPNS Kementerian PUPR RI'
    }
  },
  {
    id: 'req-hilang-009',
    trackingCode: 'REQ-PB-2026-009',
    serviceId: 'srv-9',
    serviceName: 'Surat Pengantar Laporan Kehilangan',
    citizenName: 'Bambang Irawan',
    citizenNik: '1504011909820085',
    citizenNikMasked: '150401******0085',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '19 September 1982',
    phone: '0822-4455-6677',
    addressDusun: 'RT 01 Dusun Betung Indah',
    requestDate: '2026-09-09',
    status: 'selesai',
    notes: 'Surat pengantar ke Polsek Pemayung atas kehilangan dompet berisi KTP-el dan STNK motor.',
    staffNotes: 'Surat pengantar kehilangan diterbitkan untuk dibawa ke SPKT Polsek Pemayung.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-09',
    officialLetterNumber: '330 / 009 / SP-HILANG / PB-PMY / IX / 2026',
    formData: {
      lost_item: 'KTP-el Asli, SIM C, dan STNK Sepeda Motor Honda Beat BH 4521 XX',
      estimated_location: 'Sekitar Pasar Tradisional Jembatan Mas Pemayung, 08 September 2026'
    }
  },
  {
    id: 'req-waris-010',
    trackingCode: 'REQ-PB-2026-010',
    serviceId: 'srv-ahli-waris',
    serviceName: 'Surat Keterangan Ahli Waris',
    citizenName: 'Hj. Siti Aminah',
    citizenNik: '1504014101680003',
    citizenNikMasked: '150401******0003',
    citizenGender: 'Perempuan',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '01 Januari 1968',
    phone: '0812-7112-3344',
    addressDusun: 'RT 02 Dusun Betung Indah',
    requestDate: '2026-09-09',
    status: 'selesai',
    notes: 'Legalitas silsilah ahli waris keluarga alm. H. Ismail bin Mansyur untuk pengurusan rekening bank & tanah.',
    staffNotes: 'Berita acara kesepakatan silsilah ahli waris bermaterai telah ditandatangani para saksi keluarga.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-10',
    officialLetterNumber: '593 / 010 / SK-WARIS / PB-PMY / IX / 2026',
    formData: {
      deceased_name: 'H. Ismail bin Mansyur',
      death_date: '15 Juli 2026',
      death_place: 'Desa Pulau Betung',
      heirs_list: '1. Hj. Siti Aminah (Istri Kandung)\n2. Budi Setiawan (Anak Kandung Laki-laki)\n3. Rina Rahayu (Anak Kandung Perempuan)',
      purpose: 'Pengurusan Penutupan Rekening Tabungan Pensiun Bank & Pengalihan Hak Waris'
    }
  },
  {
    id: 'req-sporadik-011',
    trackingCode: 'REQ-PB-2026-011',
    serviceId: 'srv-sporadik',
    serviceName: 'Surat Pernyataan Penguasaan Fisik Bidang Tanah (Sporadik)',
    citizenName: 'Usman bin Kadir',
    citizenNik: '1504011804750019',
    citizenNikMasked: '150401******0019',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '18 April 1975',
    phone: '0853-6622-1144',
    addressDusun: 'RT 06 Dusun Teluk Melintang',
    requestDate: '2026-09-10',
    status: 'selesai',
    notes: 'Dokumen sporadik penguasaan tanah perkebunan karet seluas ± 1,25 Hektar untuk pendaftaran sertifikat PTSL di BPN.',
    staffNotes: 'Pemeriksaan lapangan bersama tim batas desa telah selesai, tidak ada sanggahan atau sengketa.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-11',
    officialLetterNumber: '593 / 011 / SK-SPORADIK / PB-PMY / IX / 2026',
    formData: {
      sporadik_mode: 'gps',
      sporadik_method: 'full_wgs84',
      gps_accuracy: '3',
      gps_quality: 'Sangat Akurat (Tinggi)',
      land_location: 'Jalan Usaha Tani RT 06 Dusun Teluk Melintang',
      land_area: '12.500 m² (1,25 Ha)',
      luas_tanah: '12.500 m²',
      border_north: 'Kebun Karet Bapak Hasan Basri',
      border_south: 'Jalan Lingkungan Usaha Tani RT 06',
      border_east: 'Alur Sungai Anak Batang Hari',
      border_west: 'Kebun Sawit Bapak Zulkifli',
      land_source: 'Warisan Turun Temurun Keluarga Sejak Tahun 1998',
      sporadik_boundaries: JSON.stringify([
        {
          direction: 'Utara',
          arah: 'Utara',
          neighbor: 'Kebun Karet Hasan Basri',
          nama_pemilik: 'Kebun Karet Hasan Basri',
          length: '115',
          panjang: '115',
          lat: -1.543210,
          lng: 103.456100,
          coordinateText: '1°32\'35.56"S, 103°27\'21.96"E',
          accuracy: 3,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Timur',
          arah: 'Timur',
          neighbor: 'Alur Sungai Anak Batang Hari',
          nama_pemilik: 'Alur Sungai Anak Batang Hari',
          length: '108',
          panjang: '108',
          lat: -1.543250,
          lng: 103.457150,
          coordinateText: '1°32\'35.70"S, 103°27\'25.74"E',
          accuracy: 2,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Selatan',
          arah: 'Selatan',
          neighbor: 'Jalan Lingkungan Usaha Tani RT 06',
          nama_pemilik: 'Jalan Lingkungan Usaha Tani RT 06',
          length: '118',
          panjang: '118',
          lat: -1.544220,
          lng: 103.457100,
          coordinateText: '1°32\'39.19"S, 103°27\'25.56"E',
          accuracy: 3,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Barat',
          arah: 'Barat',
          neighbor: 'Kebun Sawit Zulkifli',
          nama_pemilik: 'Kebun Sawit Zulkifli',
          length: '105',
          panjang: '105',
          lat: -1.544180,
          lng: 103.456050,
          coordinateText: '1°32\'39.05"S, 103°27\'21.78"E',
          accuracy: 3,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        }
      ])
    }
  },
  {
    id: 'req-pindah-012',
    trackingCode: 'REQ-PB-2026-012',
    serviceId: 'srv-pindah-domisili',
    serviceName: 'Surat Keterangan Pindah Domisili',
    citizenName: 'Ridwan Hakim',
    citizenNik: '1504011003840027',
    citizenNikMasked: '150401******0027',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '10 Maret 1984',
    phone: '0813-6677-2299',
    addressDusun: 'RT 04 Dusun Teluk Melintang',
    requestDate: '2026-09-11',
    status: 'selesai',
    notes: 'Pengantar kepindahan keluarga ke Kelurahan Telanaipura Kota Jambi karena mutasi kerja.',
    staffNotes: 'Surat pengantar perpindahan penduduk antar-kabupaten disahkan.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-12',
    officialLetterNumber: '470 / 012 / SK-PINDAH / PB-PMY / IX / 2026',
    formData: {
      destination_address: 'RT 14 Kelurahan Telanaipura, Kec. Telanaipura, Kota Jambi',
      move_reason: 'Pekerjaan / Mutasi Tugas Dinas',
      family_members_moving: '3 Orang (Kepala Keluarga, Istri, dan 1 Anak)'
    }
  },
  {
    id: 'req-jd-013',
    trackingCode: 'REQ-PB-2026-013',
    serviceId: 'srv-janda-duda',
    serviceName: 'Surat Keterangan Status Janda / Duda',
    citizenName: 'Mardiah',
    citizenNik: '1504015507790018',
    citizenNikMasked: '150401******0018',
    citizenGender: 'Perempuan',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '15 Juli 1979',
    phone: '0852-7788-1122',
    addressDusun: 'RT 05 Dusun Teluk Melintang',
    requestDate: '2026-09-12',
    status: 'selesai',
    notes: 'Keterangan status janda mati untuk keperluan pensiun Taspen dan perubahan kartu keluarga.',
    staffNotes: 'Akta kematian suami terlampir sah, surat keterangan janda mati diterbitkan.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-13',
    officialLetterNumber: '474.3 / 013 / SK-JD / PB-PMY / IX / 2026',
    formData: {
      marital_condition: 'Janda (Cerai Mati)',
      ex_spouse_name: 'Hasan Basri (Almarhum)',
      decree_number: 'Surat Kematian No. 474.2/024/PB-PMY/2024',
      purpose: 'Pengurusan Klaim Manfaat Pensiun Taspen & Pembaruan Kartu Keluarga'
    }
  },
  {
    id: 'req-hasil-014',
    trackingCode: 'REQ-PB-2026-014',
    serviceId: 'srv-penghasilan-ortu',
    serviceName: 'Surat Keterangan Penghasilan Orang Tua',
    citizenName: 'Agus Triono',
    citizenNik: '1504010506760032',
    citizenNikMasked: '150401******0032',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '05 Juni 1976',
    phone: '0822-7711-4455',
    addressDusun: 'RT 06 Dusun Teluk Melintang',
    requestDate: '2026-09-13',
    status: 'selesai',
    notes: 'Keterangan penghasilan orang tua sebagai petani untuk syarat beasiswa KIP Kuliah anak.',
    staffNotes: 'Surat pengantar RT dan slip estimasi penghasilan tani telah diverifikasi.',
    processedBy: 'Siti Rahmawati',
    completedAt: '2026-09-14',
    officialLetterNumber: '470 / 014 / SK-HASIL / PB-PMY / IX / 2026',
    formData: {
      parent_name: 'Agus Triono',
      parent_job: 'Petani Karet & Kelapa Sawit Rakyat',
      monthly_income: 'Rp 2.400.000 / bulan',
      dependents_count: 3,
      purpose: 'Persyaratan Pengajuan Beasiswa KIP Kuliah di UIN Sulthan Thaha Saifuddin Jambi'
    }
  },
  {
    id: 'req-rumah-015',
    trackingCode: 'REQ-PB-2026-015',
    serviceId: 'srv-belum-memiliki-rumah',
    serviceName: 'Surat Keterangan Belum Memiliki Rumah',
    citizenName: 'Eko Prasetyo',
    citizenNik: '1504011409940021',
    citizenNikMasked: '150401******0021',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '14 September 1994',
    phone: '0813-8822-3344',
    addressDusun: 'RT 05 Dusun Teluk Melintang',
    requestDate: '2026-09-14',
    status: 'selesai',
    notes: 'Permohonan surat keterangan belum memiliki rumah pribadi untuk pengajuan KPR Bersubsidi (FLPP).',
    staffNotes: 'Data kepemilikan aset warga dicek di buku desa, pemohon benar belum memiliki hunian pribadi.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-15',
    officialLetterNumber: '640 / 015 / SK-RUMAH / PB-PMY / IX / 2026',
    formData: {
      current_living_status: 'Menumpang di Rumah Orang Tua',
      bank_name: 'Bank BTN Kantor Cabang Syariah Jambi',
      housing_target: 'Perumahan Griya Pemayung Asri Blok C-12'
    }
  },
  {
    id: 'req-mati-016',
    trackingCode: 'REQ-PB-2026-016',
    serviceId: 'srv-kematian',
    serviceName: 'Surat Keterangan Kematian',
    citizenName: 'Hj. Siti Aminah (Pelapor / Istri)',
    citizenNik: '1504014101680003',
    citizenNikMasked: '150401******0003',
    citizenGender: 'Perempuan',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '01 Januari 1968',
    phone: '0812-7112-3344',
    addressDusun: 'RT 02 Dusun Betung Indah',
    requestDate: '2026-09-15',
    status: 'selesai',
    notes: 'Pelaporan kematian almarhum H. Ismail bin Mansyur untuk penerbitan Akta Kematian di Disdukcapil.',
    staffNotes: 'Surat keterangan kematian desa telah diterbitkan berdasarkan laporan keluarga dan saksi.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-16',
    officialLetterNumber: '474.2 / 016 / SK-MATI / PB-PMY / IX / 2026',
    formData: {
      deceased_name: 'H. Ismail bin Mansyur',
      deceased_nik: '1504011203520001',
      death_date: '15 Juli 2026, Pukul 14:20 WIB',
      death_place: 'Kediaman Keluarga RT 02 Dusun Betung Indah',
      death_cause: 'Sakit Usia Lanjut / Wafat Tenang',
      burial_place: 'TPU Muslimin Betung Indah'
    }
  },
  {
    id: 'req-sporadik-017',
    trackingCode: 'REQ-PB-2026-017',
    serviceId: 'srv-sporadik',
    serviceName: 'Surat Pernyataan Penguasaan Fisik Bidang Tanah (Sporadik - Denah Manual)',
    citizenName: 'Hasan Basri',
    citizenNik: '1504011508720044',
    citizenNikMasked: '150401******0044',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '15 Agustus 1972',
    phone: '0852-9988-3322',
    addressDusun: 'RT 05 Dusun Teluk Melintang',
    requestDate: '2026-09-15',
    status: 'selesai',
    notes: 'Sporadik tanah pekarangan rumah seluas 600 m² dengan lembar sketsa format manual (untuk digambar tangan oleh tim juru ukur desa).',
    staffNotes: 'Format lembar sketsa manual disediakan untuk digambar tanda tangan batas oleh saksi sempadan di lapangan.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-16',
    officialLetterNumber: '593 / 017 / SK-SPORADIK / PB-PMY / IX / 2026',
    formData: {
      sporadik_mode: 'manual',
      land_location: 'Jalan Utama Desa RT 05 Dusun Teluk Melintang',
      land_area: '600 m² (20 m x 30 m)',
      luas_tanah: '600 m²',
      border_north: 'Jalan Utama Desa Pulau Betung',
      border_south: 'Tanah Pekarangan Bapak M. Tholib',
      border_east: 'Pekarangan Ibu Rohana',
      border_west: 'Lorong Gang Warga RT 05',
      land_source: 'Jual Beli Sah Tahun 2005'
    }
  },
  {
    id: 'req-sporadik-018',
    trackingCode: 'REQ-PB-2026-018',
    serviceId: 'srv-sporadik',
    serviceName: 'Surat Pernyataan Penguasaan Fisik Bidang Tanah (Sporadik - GPS Satelit Poligon Bebas)',
    citizenName: 'Sutan Baharuddin',
    citizenNik: '1504012403680011',
    citizenNikMasked: '150401******0011',
    citizenGender: 'Laki-laki',
    citizenBirthPlace: 'Pulau Betung',
    citizenBirthDate: '24 Maret 1968',
    phone: '0812-7456-9988',
    addressDusun: 'RT 02 Dusun Betung Indah',
    requestDate: '2026-09-16',
    status: 'selesai',
    notes: 'Pengukuran lahan kebun campuran sudut tidak beraturan (Poligon 6 Patok Bentuk Huruf L / Zig-zag) menggunakan modul perekam koordinat GPS SADEWA Hybrid WGS84.',
    staffNotes: 'Data koordinat satelit 6 titik (T1-T6) tervalidasi dengan deviasi ±2m, panjang sempadan diverifikasi dengan pita ukur meteran baja.',
    processedBy: 'Ahmad Fauzi, S.AP',
    completedAt: '2026-09-16',
    officialLetterNumber: '593 / 018 / SK-SPORADIK / PB-PMY / IX / 2026',
    formData: {
      sporadik_mode: 'gps',
      sporadik_method: 'hybrid_wgs84',
      gps_accuracy: '2',
      gps_quality: 'Sangat Akurat (Tinggi)',
      land_location: 'Rintisan Kebun Campuran Dusun Betung Indah RT 02',
      land_area: '± 4.850 m²',
      luas_tanah: '± 4.850 m²',
      border_north: 'Kebun Karet Pak Syamsuddin (Sisi T1-T2 & T3-T4)',
      border_south: 'Jalan Usaha Tani Lingkungan RT 02 (Sisi T5-T6)',
      border_east: 'Alur Parit Alam Batang Betung (Sisi T2-T3 & T4-T5)',
      border_west: 'Kebun Sawit Bapak M. Jafar (Sisi T6-T1)',
      land_source: 'Pembukaan Lahan Adat Terdaftar Sejak Tahun 1994',
      sporadik_boundaries: JSON.stringify([
        {
          direction: 'Timur Laut (045°)',
          arah: 'Timur Laut',
          neighbor: 'Kebun Karet Syamsuddin',
          nama_pemilik: 'Kebun Karet Syamsuddin',
          length: '65',
          panjang: '65',
          lat: -1.528120,
          lng: 103.314200,
          coordinateText: '1°31\'41.23"S, 103°18\'51.12"E',
          accuracy: 2,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Tenggara (135°)',
          arah: 'Tenggara',
          neighbor: 'Parit Alam Dusun',
          nama_pemilik: 'Parit Alam Dusun',
          length: '48',
          panjang: '48',
          lat: -1.528430,
          lng: 103.314780,
          coordinateText: '1°31\'42.35"S, 103°18\'53.21"E',
          accuracy: 3,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Timur (090°)',
          arah: 'Timur',
          neighbor: 'Batas Tanah Kas Desa',
          nama_pemilik: 'Batas Tanah Kas Desa',
          length: '52',
          panjang: '52',
          lat: -1.528950,
          lng: 103.314520,
          coordinateText: '1°31\'44.22"S, 103°18\'52.27"E',
          accuracy: 2,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Selatan (180°)',
          arah: 'Selatan',
          neighbor: 'Rawa Lindung Sempadan',
          nama_pemilik: 'Rawa Lindung Sempadan',
          length: '70',
          panjang: '70',
          lat: -1.529280,
          lng: 103.315100,
          coordinateText: '1°31\'45.41"S, 103°18\'54.36"E',
          accuracy: 2,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Barat Daya (225°)',
          arah: 'Barat Daya',
          neighbor: 'Jalan Usaha Tani RT 02',
          nama_pemilik: 'Jalan Usaha Tani RT 02',
          length: '95',
          panjang: '95',
          lat: -1.529850,
          lng: 103.314450,
          coordinateText: '1°31\'47.46"S, 103°18\'52.02"E',
          accuracy: 3,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        },
        {
          direction: 'Barat Laut (315°)',
          arah: 'Barat Laut',
          neighbor: 'Kebun Sawit Bapak M. Jafar',
          nama_pemilik: 'Kebun Sawit Bapak M. Jafar',
          length: '110',
          panjang: '110',
          lat: -1.529100,
          lng: 103.313650,
          coordinateText: '1°31\'44.76"S, 103°18\'49.14"E',
          accuracy: 2,
          accuracyQuality: 'Sangat Akurat (Tinggi)'
        }
      ])
    }
  }
];

export const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'cmp-1',
    ticketNumber: 'ADU-PB-2026-001',
    category: 'infrastruktur',
    title: 'Gorong-gorong Jalan Usaha Tani RT 03 Tersumbat',
    content: 'Gorong-gorong saluran pembuangan air di perbatasan RT 03 tertutup material tanah dan sampah kayu hanyut setelah hujan lebat, sehingga air meluap ke badan jalan.',
    reporterName: 'Warga RT 03',
    isAnonymous: true,
    location: 'Jalan Lingkungan RT 03 Dusun Betung Indah',
    createdAt: '2026-08-25',
    status: 'selesai',
    adminResponse: 'Tim TPK dan Satgas Gotong Royong Desa telah membersihkan sumbatan dan memperbaiki dinding gorong-gorong pada tanggal 27 Agustus 2026.',
    respondedBy: 'Ahmad Fauzi, S.AP',
    updatedAt: '2026-08-27'
  },
  {
    id: 'cmp-2',
    ticketNumber: 'ADU-PB-2026-002',
    category: 'pelayanan_desa',
    title: 'Lampu Penerangan Dekat Dermaga Sungai Batang Hari Padam',
    content: 'Ada 2 titik lampu jalan tenaga surya di sekitar dermaga penyeberangan perahu warga padam sudah 4 hari, mohon pengecekan baterai atau lampunya.',
    reporterName: 'M. Ilyas',
    isAnonymous: false,
    reporterContact: '0853-7812-XXXX',
    location: 'Dermaga Penyeberangan Dusun Teluk Melintang',
    createdAt: '2026-09-01',
    status: 'diproses',
    adminResponse: 'Petugas teknis desa telah menjadwalkan pengecekan modul surya dan inverter pada hari Rabu ini.',
    respondedBy: 'Siti Rahmawati',
    updatedAt: '2026-09-02'
  },
  {
    id: 'cmp-3',
    ticketNumber: 'ADU-PB-2026-003',
    category: 'lingkungan',
    title: 'Pembersihan Rumput Liar di Lapangan Sepak Bola Desa',
    content: 'Mohon diadakan kerja bakti pemuda dan warga untuk babat rumput di lapangan desa sebelum turnamen kemerdekaan dimulai.',
    reporterName: 'Pemuda Karang Taruna',
    isAnonymous: false,
    location: 'Lapangan Gelora Pulau Betung',
    createdAt: '2026-09-02',
    status: 'diterima',
    adminResponse: 'Laporan diterima dan dikoordinasikan dengan pengurus Karang Taruna untuk agenda kerja bakti Minggu pagi.'
  }
];

export const INITIAL_NEWS: NewsItem[] = [
  {
    id: 'nws-1',
    title: 'Pemerintah Desa Pulau Betung Sukses Salurkan Bantuan Bibit Karet Unggul Kepada 4 Kelompok Tani',
    slug: 'penyaluran-bibit-karet-unggul-kelompok-tani-2026',
    summary: 'Sebanyak 3.500 batang bibit karet klon unggul PB-260 disalurkan secara transparan guna peremajaan kebun produktif warga di Kecamatan Pemayung.',
    content: `PEMAYUNG — Bertempat di Balai Pertemuan Desa Pulau Betung, Pemerintah Desa bersama Badan Permusyawaratan Desa (BPD) menyalurkan bantuan bibit karet unggul kepada 4 kelompok tani binaan desa pada hari Selasa kemarin.

Program ketahanan pangan dan penguatan ekonomi perkebunan rakyat ini bersumber dari alokasi 20% Dana Desa (DDS) Tahun Anggaran 2026. Kepala Desa Pulau Betung dalam sambutannya menegaskan bahwa karet merupakan salah satu komoditas urat nadi perekonomian masyarakat di sepanjang aliran Sungai Batang Hari.

"Penyaluran ini diawasi langsung oleh Babinsa, Bhabinkamtibmas, dan seluruh pengurus kelompok tani agar penerima tepat sasaran sesuai musyawarah dusun," ujar Kepala Desa.

Selain bibit karet, warga juga mendapatkan pendampingan teknik okulasi dan pemupukan ramah lingkungan dari Balai Penyuluhan Pertanian (BPP) Kecamatan Pemayung.`,
    category: 'pertanian',
    coverImage: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=800&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1592417817098-8f3d69109853?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=600&auto=format&fit=crop&q=80'
    ],
    author: 'Budi Santoso (Editor)',
    publishedAt: '2026-08-28',
    isPublished: true,
    views: 342
  },
  {
    id: 'nws-2',
    title: 'Musyawarah Perencanaan Pembangunan Desa (Musrenbangdes) 2027 Rumuskan 5 Skala Prioritas',
    slug: 'musrenbangdes-2027-skala-prioritas',
    summary: 'Rapat pleno penetapan usulan RKPDes menghasilkan konsensus prioritas pembangunan infrastruktur jalan tani, sarana sanitasi, dan digitalisasi layanan warga.',
    content: `PULAU BETUNG — Musrenbangdes Tahun Perencanaan 2027 dihadiri perwakilan tokoh adat, alim ulama, perwakilan perempuan, kader Posyandu, serta aparat Kecamatan Pemayung.

Dalam forum musyawarah terbuka ini, disepakati lima fokus utama:
1. Peningkatan jalan rabat beton perkebunan sepanjang 1,2 kilometer.
2. Pengadaan sarana air bersih pamsimas dusun terluar.
3. Revitalisasi dermaga sandar perahu tradisional nelayan Sungai Batang Hari.
4. Program pencegahan stunting balita dan gizi ibu hamil melalui Posyandu terpadu.
5. Peningkatan anjungan pelayanan digital desa agar warga dapat mengurus surat dari ponsel.`,
    category: 'pemerintahan',
    coverImage: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80',
    author: 'Ahmad Fauzi, S.AP',
    publishedAt: '2026-08-20',
    isPublished: true,
    views: 512
  },
  {
    id: 'nws-3',
    title: 'Pelatihan Olahan Hasil Ikan Sungai Batang Hari Tingkatkan Nilai Tambah Ibu-Ibu PKK',
    slug: 'pelatihan-olahan-ikan-sungai-batang-hari',
    summary: 'Pengolahan ikan patin dan baung asap menjadi abon dan kerupuk kemplang khas Pemayung memperkuat sentra UMKM kuliner Desa Pulau Betung.',
    content: `BATANG HARI — TP PKK Desa Pulau Betung menggelar pelatihan diversifikasi olahan hasil tangkapan sungai. Ikan air tawar yang melimpah di wilayah desa kini tidak hanya dijual basah, namun diolah menjadi produk kemasan bernilai jual tinggi.

Ketua TP PKK Desa mengungkapkan produk olahan ini mulai dipasarkan pada etalase UMKM digital desa dan toko oleh-oleh lintas Muara Bulian - Jambi.`,
    category: 'kemasyarakatan',
    coverImage: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&auto=format&fit=crop&q=80',
    author: 'Budi Santoso',
    publishedAt: '2026-08-15',
    isPublished: true,
    views: 280
  }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'anc-1',
    title: 'Jadwal Pelayanan Posyandu Balita dan Lansia Serentak Bulan September 2026',
    content: 'Diberitahukan kepada seluruh warga Desa Pulau Betung yang memiliki anak usia 0-5 tahun dan anggota keluarga lanjut usia, posyandu serentak dilaksanakan pada Sabtu, 6 September 2026 pukul 08.30 WIB di Poskesdes Dusun Betung Indah dan Posyandu Melati Dusun Teluk Melintang.',
    publishedAt: '2026-09-01',
    validUntil: '2026-09-07',
    priority: 'penting',
    isActive: true,
    attachmentName: 'Jadwal_Posyandu_September_2026.pdf'
  },
  {
    id: 'anc-2',
    title: 'Himbauan Waspada Kenaikan Debit Sungai Batang Hari Saat Musim Hujan',
    content: 'Mengingat curah hujan tinggi di hulu sungai, warga bantaran sungai diimbau mengamankan perahu tambatan, memperhatikan anak-anak yang bermain di tepian sungai, serta mematikan stopkontak pada bangunan panggung yang rawan rembesan air.',
    publishedAt: '2026-08-29',
    validUntil: '2026-09-15',
    priority: 'mendesak',
    isActive: true
  },
  {
    id: 'anc-3',
    title: 'Pemutakhiran Data Warga Calon Penerima Bantuan Sosial Pangan Tahap IV',
    content: 'Pemerintah Desa membuka loket verifikasi faktual data keluarga kurang mampu di Kantor Desa setiap jam kerja hingga 10 September 2026. Harap membawa KK dan KTP asli.',
    publishedAt: '2026-08-26',
    validUntil: '2026-09-10',
    priority: 'normal',
    isActive: true
  }
];

export const INITIAL_AGENDAS: AgendaItem[] = [
  {
    id: 'agd-1',
    title: 'Posyandu Terpadu & Imunisasi Balita',
    description: 'Pemeriksaan rutin berat badan, tinggi badan, pemberian vitamin A, dan konsultasi gizi balita.',
    date: '2026-09-06',
    time: '08:30 - 12:00 WIB',
    location: 'Poskesdes Desa Pulau Betung',
    organizer: 'Bidan Desa & Kader Posyandu',
    status: 'akan_datang'
  },
  {
    id: 'agd-2',
    title: 'Gotong Royong Kebersihan Saluran Pemukiman Warga',
    description: 'Aksi Jumat Bersih membersihkan saluran air dan pekarangan desa bersama RT 01 s/d RT 06.',
    date: '2026-09-11',
    time: '07:30 - 10:30 WIB',
    location: 'Sepanjang Jalan Utama Desa',
    organizer: 'Lembaga Pemberdayaan Masyarakat (LPM)',
    status: 'akan_datang'
  },
  {
    id: 'agd-3',
    title: 'Pengajian Rutin Badan Kontak Majelis Taklim (BKMT)',
    description: 'Kajian agama bulanan ibu-ibu warga desa dipimpin oleh penceramah dari Kecamatan Pemayung.',
    date: '2026-09-13',
    time: '14:00 - 16:30 WIB',
    location: 'Masjid Nurul Huda Pulau Betung',
    organizer: 'BKMT Desa Pulau Betung',
    status: 'akan_datang'
  }
];

export const INITIAL_GALLERY: GalleryItem[] = [
  {
    id: 'gal-1',
    title: 'Gotong Royong Perbaikan Jembatan Penyeberangan',
    description: 'Kekompakan warga Pulau Betung memperbaiki titian kayu akses ke kebun karet bersama Babinsa.',
    category: 'gotong_royong',
    mediaUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&auto=format&fit=crop&q=80',
    mediaType: 'image',
    date: '2026-08-18'
  },
  {
    id: 'gal-2',
    title: 'Panen Padi Sawah Lebak Tradisional',
    description: 'Momen panen raya padi sawah lebak di hamparan sawah warga tepi Sungai Batang Hari.',
    category: 'tradisi',
    mediaUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80',
    mediaType: 'image',
    date: '2026-07-25'
  },
  {
    id: 'gal-3',
    title: 'Pembangunan Jalan Rabat Beton Dusun Betung Indah',
    description: 'Pengerjaan cor beton jalan usaha tani yang didanai melalui Dana Desa (DDS) TA 2026.',
    category: 'pembangunan',
    mediaUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=800&auto=format&fit=crop&q=80',
    mediaType: 'image',
    date: '2026-08-10'
  },
  {
    id: 'gal-4',
    title: 'Pemandangan Aliran Sungai Batang Hari Kala Senja',
    description: 'Lanskap alami perairan Batang Hari yang melintasi bibir Desa Pulau Betung, Pemayung.',
    category: 'wisata',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    mediaType: 'image',
    date: '2026-08-01'
  }
];

export const INITIAL_BUDGET: BudgetYearData = {
  id: 'apbdes-2026-murni',
  year: 2026,
  documentType: 'murni',
  status: 'BERLAKU',
  legalRefNumber: 'Perdes No. 02 Tahun 2026',
  enactmentDate: '15 Januari 2026',
  totalIncome: 1285400000, // Rp 1,285 Miliar
  totalIncomeRealized: 0,
  totalExpenditure: 1248900000,
  totalExpenditureRealized: 0,
  totalFinancing: 36500000,
  totalFinancingRealized: 0,
  realizationPercentage: 0,
  incomeBreakdown: [
    { category: 'Dana Desa (DDS / APBN)', amount: 792400000, realizedAmount: 0, description: 'Alokasi pokok APBN Kementerian Desa' },
    { category: 'Alokasi Dana Desa (ADD / APBD Kab)', amount: 418000000, realizedAmount: 0, description: 'Bantuan keuangan dari Pemkab Batang Hari' },
    { category: 'Bagi Hasil Pajak & Retribusi Daerah', amount: 42000000, realizedAmount: 0, description: 'Bagi hasil pajak daerah Kabupaten Batang Hari' },
    { category: 'Pendapatan Asli Desa (PADes)', amount: 33000000, realizedAmount: 0, description: 'Hasil tanah kas desa dan retribusi pasar desa' }
  ],
  expenditureBreakdown: [
    { category: 'Bidang Penyelenggaraan Pemerintahan Desa', amount: 425600000, percentage: 34, realizedAmount: 0 },
    { category: 'Bidang Pelaksanaan Pembangunan Desa', amount: 512300000, percentage: 41, realizedAmount: 0 },
    { category: 'Bidang Pembinaan Kemasyarakatan', amount: 112000000, percentage: 9, realizedAmount: 0 },
    { category: 'Bidang Pemberdayaan Masyarakat Desa', amount: 145000000, percentage: 12, realizedAmount: 0 },
    { category: 'Bidang Penanggulangan Bencana & Darurat', amount: 54000000, percentage: 4, realizedAmount: 0 }
  ],
  incomeItems: [
    { id: 'inc-1', code: '4.1', category: 'Dana Desa (DDS)', source: 'APBN (Kemendes)', targetBudget: 792400000, realizedBudget: 0, description: 'Pencairan Tahap I & II Dana Desa' },
    { id: 'inc-2', code: '4.2', category: 'Alokasi Dana Desa (ADD)', source: 'APBD Kab. Batang Hari', targetBudget: 418000000, realizedBudget: 0, description: 'Siltap & Operasional Kantor Desa' },
    { id: 'inc-3', code: '4.3', category: 'Bagi Hasil Pajak & Retribusi', source: 'APBD Kab. Batang Hari', targetBudget: 42000000, realizedBudget: 0, description: 'Bagi Hasil PBB & Pajak Daerah' },
    { id: 'inc-4', code: '4.4', category: 'Pendapatan Asli Desa (PADes)', source: 'Kas/Aset Desa', targetBudget: 33000000, realizedBudget: 0, description: 'Sewa Kios Pasar & Hasil Kas Desa' }
  ],
  expenditureItems: [
    { id: 'exp-1', code: '5.1', category: 'Penyelenggaraan Pemerintahan Desa', source: 'ADD & DDS', targetBudget: 425600000, realizedBudget: 0, description: 'Gaji Siltap, Operasional, Peralatan Kantor' },
    { id: 'exp-2', code: '5.2', category: 'Pelaksanaan Pembangunan Desa', source: 'DDS & BKK', targetBudget: 512300000, realizedBudget: 0, description: 'Jalan Rabat Beton, Air Bersih, Turap' },
    { id: 'exp-3', code: '5.3', category: 'Pembinaan Kemasyarakatan', source: 'ADD & PADes', targetBudget: 112000000, realizedBudget: 0, description: 'Kegiatan Pemuda, Lembaga Adat, Keagamaan' },
    { id: 'exp-4', code: '5.4', category: 'Pemberdayaan Masyarakat Desa', source: 'DDS', targetBudget: 145000000, realizedBudget: 0, description: 'Pelatihan UMKM, Pertanian & Ketahanan Pangan' },
    { id: 'exp-5', code: '5.5', category: 'Penanggulangan Bencana & Darurat', source: 'DDS', targetBudget: 54000000, realizedBudget: 0, description: 'Posko Siaga Banjir Batang Hari & BLT-DD' }
  ],
  financingItems: [
    { id: 'fin-1', code: '6.1', category: 'Penerimaan Pembiayaan (SILPA Tahun Lalu)', source: 'SILPA TA 2025', targetBudget: 36500000, realizedBudget: 0, description: 'Sisa Lebih Perhitungan Anggaran TA 2025' },
    { id: 'fin-2', code: '6.2', category: 'Pengeluaran Pembiayaan (Penyertaan BUMDes)', source: 'Kas Desa', targetBudget: 0, realizedBudget: 0, description: 'Modal BUMDes Pulau Betung' }
  ],
  publicDocuments: [
    {
      id: 'doc-1',
      title: 'Peraturan Desa Pulau Betung No. 02 Tahun 2026 tentang APBDes TA 2026',
      category: 'Peraturan Desa',
      fileSize: '2.4 MB',
      uploadDate: '2026-01-15',
      downloadUrl: '#'
    },
    {
      id: 'doc-2',
      title: 'Laporan Realisasi Semester I APBDes Desa Pulau Betung TA 2026',
      category: 'Laporan Keuangan',
      fileSize: '1.8 MB',
      uploadDate: '2026-07-10',
      downloadUrl: '#'
    },
    {
      id: 'doc-3',
      title: 'Rencana Kerja Pemerintah Desa (RKPDes) Tahun 2026',
      category: 'Dokumen Perencanaan',
      fileSize: '3.1 MB',
      uploadDate: '2025-12-28',
      downloadUrl: '#'
    },
    {
      id: 'doc-4',
      title: 'Daftar Aset dan Inventaris Milik Desa Pulau Betung',
      category: 'Transparansi Aset',
      fileSize: '1.2 MB',
      uploadDate: '2026-02-05',
      downloadUrl: '#'
    }
  ]
};

export const INITIAL_BUDGET_HISTORY: BudgetYearData[] = [
  INITIAL_BUDGET,
  {
    id: 'apbdes-2026-perubahan',
    year: 2026,
    documentType: 'perubahan',
    status: 'BERLAKU',
    legalRefNumber: 'Perdes No. 05 Tahun 2026 (APBDes-P)',
    enactmentDate: '28 Agustus 2026',
    totalIncome: 1340000000,
    totalIncomeRealized: 910000000,
    totalExpenditure: 1303500000,
    totalExpenditureRealized: 873500000,
    totalFinancing: 36500000,
    totalFinancingRealized: 36500000,
    realizationPercentage: 67.0,
    incomeBreakdown: [
      { category: 'Dana Desa (DDS / APBN)', amount: 792400000, realizedAmount: 554680000, description: 'Alokasi pokok APBN Kementerian Desa' },
      { category: 'Alokasi Dana Desa (ADD / APBD Kab)', amount: 418000000, realizedAmount: 271700000, description: 'Bantuan keuangan dari Pemkab Batang Hari' },
      { category: 'Bantuan Keuangan Khusus Provinsi (BKK)', amount: 54600000, realizedAmount: 54600000, description: 'Tambahan BKK Provinsi Jambi' },
      { category: 'Bagi Hasil Pajak & Retribusi Daerah', amount: 42000000, realizedAmount: 29400000, description: 'Bagi hasil pajak daerah Kabupaten Batang Hari' },
      { category: 'Pendapatan Asli Desa (PADes)', amount: 33000000, realizedAmount: 23420000, description: 'Hasil tanah kas desa dan retribusi pasar desa' }
    ],
    expenditureBreakdown: [
      { category: 'Bidang Penyelenggaraan Pemerintahan Desa', amount: 435600000, percentage: 33, realizedAmount: 302000000 },
      { category: 'Bidang Pelaksanaan Pembangunan Desa', amount: 552300000, percentage: 42, realizedAmount: 375000000 },
      { category: 'Bidang Pembinaan Kemasyarakatan', amount: 116000000, percentage: 9, realizedAmount: 78000000 },
      { category: 'Bidang Pemberdayaan Masyarakat Desa', amount: 145600000, percentage: 11, realizedAmount: 81500000 },
      { category: 'Bidang Penanggulangan Bencana & Darurat', amount: 54000000, percentage: 4, realizedAmount: 37000000 }
    ],
    incomeItems: [
      { id: 'inc-p1', code: '4.1', category: 'Dana Desa (DDS)', source: 'APBN (Kemendes)', targetBudget: 792400000, realizedBudget: 554680000, description: 'Dana Desa APBN' },
      { id: 'inc-p2', code: '4.2', category: 'Alokasi Dana Desa (ADD)', source: 'APBD Kab. Batang Hari', targetBudget: 418000000, realizedBudget: 271700000, description: 'ADD Pemkab Batang Hari' },
      { id: 'inc-p3', code: '4.3', category: 'Bantuan Keuangan Provinsi (BKK)', source: 'APBD Prov. Jambi', targetBudget: 54600000, realizedBudget: 54600000, description: 'Bantuan Khusus Provinsi Jambi' },
      { id: 'inc-p4', code: '4.4', category: 'Bagi Hasil Pajak & Retribusi', source: 'APBD Kab. Batang Hari', targetBudget: 42000000, realizedBudget: 29400000, description: 'Bagi Hasil Pajak Daerah' },
      { id: 'inc-p5', code: '4.5', category: 'Pendapatan Asli Desa (PADes)', source: 'Kas/Aset Desa', targetBudget: 33000000, realizedBudget: 23420000, description: 'Hasil Tanah Kas Desa' }
    ],
    expenditureItems: [
      { id: 'exp-p1', code: '5.1', category: 'Penyelenggaraan Pemerintahan Desa', source: 'ADD & DDS', targetBudget: 435600000, realizedBudget: 302000000, description: 'Gaji, Operasional, Peningkatan Sarana' },
      { id: 'exp-p2', code: '5.2', category: 'Pelaksanaan Pembangunan Desa', source: 'DDS & BKK', targetBudget: 552300000, realizedBudget: 375000000, description: 'Rabat Beton & Sarana Infrastruktur BKK' },
      { id: 'exp-p3', code: '5.3', category: 'Pembinaan Kemasyarakatan', source: 'ADD', targetBudget: 116000000, realizedBudget: 78000000, description: 'Kegiatan Adat & Kemasyarakatan' },
      { id: 'exp-p4', code: '5.4', category: 'Pemberdayaan Masyarakat Desa', source: 'DDS', targetBudget: 145600000, realizedBudget: 81500000, description: 'Program Ketahanan Pangan & UMKM' },
      { id: 'exp-p5', code: '5.5', category: 'Penanggulangan Bencana & Darurat', source: 'DDS', targetBudget: 54000000, realizedBudget: 37000000, description: 'Siaga Bencana & BLT-DD' }
    ],
    publicDocuments: [
      {
        id: 'doc-p1',
        title: 'Peraturan Desa No. 05 Tahun 2026 tentang Perubahan APBDes TA 2026',
        category: 'Peraturan Desa Perubahan',
        fileSize: '2.8 MB',
        uploadDate: '2026-08-28',
        downloadUrl: '#'
      }
    ]
  },
  {
    id: 'apbdes-2025-murni',
    year: 2025,
    documentType: 'murni',
    status: 'BERLAKU',
    legalRefNumber: 'Perdes No. 01 Tahun 2025',
    enactmentDate: '10 Januari 2025',
    totalIncome: 1210000000,
    totalIncomeRealized: 1210000000,
    totalExpenditure: 1185000000,
    totalExpenditureRealized: 1185000000,
    totalFinancing: 25000000,
    totalFinancingRealized: 25000000,
    realizationPercentage: 100.0,
    incomeBreakdown: [
      { category: 'Dana Desa (DDS / APBN)', amount: 750000000, realizedAmount: 750000000, description: 'APBN Kementerian Desa' },
      { category: 'Alokasi Dana Desa (ADD / APBD Kab)', amount: 390000000, realizedAmount: 390000000, description: 'Pemkab Batang Hari' },
      { category: 'Bagi Hasil Pajak & Retribusi', amount: 40000000, realizedAmount: 40000000, description: 'Bagi Hasil Pajak Daerah' },
      { category: 'Pendapatan Asli Desa (PADes)', amount: 30000000, realizedAmount: 30000000, description: 'Hasil Tanah Kas Desa' }
    ],
    expenditureBreakdown: [
      { category: 'Bidang Penyelenggaraan Pemerintahan Desa', amount: 410000000, percentage: 35, realizedAmount: 410000000 },
      { category: 'Bidang Pelaksanaan Pembangunan Desa', amount: 485000000, percentage: 41, realizedAmount: 485000000 },
      { category: 'Bidang Pembinaan Kemasyarakatan', amount: 105000000, percentage: 9, realizedAmount: 105000000 },
      { category: 'Bidang Pemberdayaan Masyarakat Desa', amount: 135000000, percentage: 11, realizedAmount: 135000000 },
      { category: 'Bidang Penanggulangan Bencana & Darurat', amount: 50000000, percentage: 4, realizedAmount: 50000000 }
    ],
    publicDocuments: [
      {
        id: 'doc-2025',
        title: 'Laporan Pertanggungjawaban (LPJ) Keuangan Desa Pulau Betung TA 2025',
        category: 'Laporan Akhir Tahun',
        fileSize: '4.2 MB',
        uploadDate: '2026-01-08',
        downloadUrl: '#'
      }
    ]
  }
];

export const INITIAL_DEVELOPMENT_PROJECTS: DevelopmentProject[] = [
  {
    id: 'prj-1',
    title: 'Pembangunan Jalan Rabat Beton Usaha Tani RT 03',
    location: 'RT 03 Dusun Betung Indah',
    fiscalYear: 2026,
    budget: 168500000,
    fundingSource: 'Dana Desa (DDS)',
    contractor: 'Tim Pelaksana Kegiatan (TPK) Desa',
    status: 'selesai',
    progressPercent: 100,
    startDate: '2026-04-10',
    targetEndDate: '2026-06-25',
    description: 'Pengecoran jalan usaha tani sepanjang 450 meter dengan lebar 2,5 meter tebal 15 cm untuk kelancaran transportasi hasil karet dan sawit warga.',
    beforeImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
    inProgressImage: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=600&auto=format&fit=crop&q=80',
    completedImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80',
    isExifVerified: true,
    exifGpsLocation: '1°32\'38.4"S 103°27\'18.2"E',
    isBpdVerified: true,
    verifiedByBpdName: 'Tim Audit BPD & Inspektorat Desa',
    likesCount: 38,
    citizenDisputeCount: 0,
    comments: [
      {
        id: 'cm-1',
        authorName: 'Hasan Basri',
        rtRwLocation: 'RT 03 Betung Indah',
        content: 'Alhamdulillah jalan usaha tani sudah dicor mulus! Sekarang angkut hasil panen sawit dan karet tidak becek lagi kalau hujan.',
        createdAt: '2026-06-26 14:20',
        type: 'apresiasi',
        likesCount: 12
      },
      {
        id: 'cm-2',
        authorName: 'Siti Fatimah',
        rtRwLocation: 'RT 03 Betung Indah',
        content: 'Terima kasih TPK Desa dan Pak Kades, pengerjaannya cepat dan hasilnya sangat rapi.',
        createdAt: '2026-06-27 09:15',
        type: 'apresiasi',
        likesCount: 8
      }
    ]
  },
  {
    id: 'prj-2',
    title: 'Pembangunan Sarana Air Bersih Pamsimas & Bak Penampung',
    location: 'RT 05 Dusun Teluk Melintang',
    fiscalYear: 2026,
    budget: 142000000,
    fundingSource: 'Dana Desa (DDS)',
    contractor: 'Kelompok Pengelola Air Minum (KP-SPAMS)',
    status: 'sedang_berjalan',
    progressPercent: 75,
    startDate: '2026-06-01',
    targetEndDate: '2026-09-30',
    description: 'Pengeboran sumur dalam (deep well) 60 meter, instalasi tandon filter air bersih kapasitas 5.000 liter, dan pipa sambungan ke 65 kepala keluarga.',
    beforeImage: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600&auto=format&fit=crop&q=80',
    inProgressImage: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=600&auto=format&fit=crop&q=80',
    isExifVerified: true,
    exifGpsLocation: '1°32\'45.1"S 103°27\'32.8"E',
    isBpdVerified: true,
    verifiedByBpdName: 'Pengawasan BPD Sektor II',
    likesCount: 24,
    citizenDisputeCount: 1,
    disputeNotes: [
      '[RT 05 Teluk Melintang] Warga RT 05: Pipa penyambung ke RT 05 sektor barat belum terpasang penuh, mohon dikonfirmasi jadwal pengerjaan susulannya.'
    ],
    comments: [
      {
        id: 'cm-3',
        authorName: 'Pak Supri',
        rtRwLocation: 'RT 05 Teluk Melintang',
        content: 'Mohon tandon air filter ditinggikan sedikit agar tekanan air ke rumah warga RT 05 yang di bagian hilir lebih deras.',
        createdAt: '2026-08-10 10:30',
        type: 'pertanyaan',
        likesCount: 6
      },
      {
        id: 'cm-4',
        authorName: 'Warga RT 05 Sektor Barat',
        rtRwLocation: 'RT 05 Teluk Melintang',
        content: 'Pipa penyambung ke RT 05 sektor barat belum terpasang penuh di lapangan padahal diklaim sudah 75%. Mohon TPK segera turun mengecek.',
        createdAt: '2026-08-15 16:45',
        type: 'sanggahan',
        likesCount: 14
      }
    ]
  },
  {
    id: 'prj-3',
    title: 'Penguatan Turap Pengaman Tebing Penahan Erosi Batang Hari',
    location: 'Tepian Sungai RT 01',
    fiscalYear: 2026,
    budget: 85000000,
    fundingSource: 'Bantuan Keuangan Provinsi',
    contractor: 'TPK Desa bersama Warga',
    status: 'sedang_berjalan',
    progressPercent: 45,
    startDate: '2026-07-15',
    targetEndDate: '2026-10-15',
    description: 'Pemasangan bronjong batu kawat penahan gerusan air pasang surut sungai Batang Hari guna melindungi jalan utama desa dan pemukiman warga.',
    beforeImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
    inProgressImage: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80',
    isExifVerified: true,
    exifGpsLocation: '1°32\'20.0"S 103°27\'05.5"E',
    isBpdVerified: true,
    verifiedByBpdName: 'BPD Komisi Pembangunan',
    likesCount: 19,
    citizenDisputeCount: 2,
    disputeNotes: [
      '[RT 01 Tepian Sungai] Pemuda Karang Taruna: Ada 2 titik kawat bronjong di sektor utara yang longgar dan belum dikunci sempurna. Harap diperiksa TPK.'
    ],
    comments: [
      {
        id: 'cm-5',
        authorName: 'Zulkifli',
        rtRwLocation: 'RT 01 Tepian Sungai',
        content: 'Turap bronjong sangat membantu menahan abrasi tebing Batang Hari saat air sungai naik pasang.',
        createdAt: '2026-08-20 11:10',
        type: 'apresiasi',
        likesCount: 5
      },
      {
        id: 'cm-6',
        authorName: 'Karang Taruna RT 01',
        rtRwLocation: 'RT 01 Tepian Sungai',
        content: 'Ada 2 titik kawat bronjong di sektor utara yang longgar dan belum dikunci sempurna. Mohon diperbaiki sebelum debit air naik lagi.',
        createdAt: '2026-08-28 08:30',
        type: 'sanggahan',
        likesCount: 11
      }
    ]
  }
];

export const INITIAL_POTENTIALS: VillagePotential[] = [
  {
    id: 'pot-1',
    name: 'Perkebunan Karet & Kelapa Sawit Rakyat',
    category: 'perkebunan',
    description: 'Merupakan komoditas penopang utama ekonomi masyarakat Pulau Betung dengan luasan kebun produktif rakyat mencapai lebih dari 650 hektar.',
    highlightStat: '650+ Hektar Lahan Produktif',
    imageUrl: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop&q=80',
    keyCommodities: ['Karet Lembaran Sit (Lateks)', 'Kelapa Sawit TBS', 'Bibit Okulasi Unggul']
  },
  {
    id: 'pot-2',
    name: 'Perikanan Air Tawar Sungai Batang Hari',
    category: 'perikanan',
    description: 'Letak geografis di tepi Sungai Batang Hari memberikan anugerah perikanan air tawar alami seperti ikan baung, patin liar, tapah, dan budidaya keramba apung.',
    highlightStat: '12 Ton Hasil Tangkapan / Tahun',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80',
    keyCommodities: ['Ikan Baung Sungai', 'Ikan Patin Khas Jambi', 'Ikan Baung Asap (Salai)']
  },
  {
    id: 'pot-3',
    name: 'Pertanian Padi Sawah Lebak Ramah Lingkungan',
    category: 'pertanian',
    description: 'Pemanfaatan sistem pasang surut alami tanah lebak tepian sungai untuk penanaman padi lokal organik dengan cita rasa pulen khas Melayu Jambi.',
    highlightStat: '180 Hektar Sawah Lebak',
    imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&auto=format&fit=crop&q=80',
    keyCommodities: ['Beras Lokal Pemayung', 'Sayuran Palawija', 'Jagung Manis']
  },
  {
    id: 'pot-4',
    name: 'Kerajinan Anyaman Purun & Serat Alam Tradisional',
    category: 'kerajinan',
    description: 'Keahlian turun-temurun kaum perempuan desa dalam mengolah tanaman purun rawa menjadi tikar, bakul, tas jinjing, dan cenderamata khas Batang Hari.',
    highlightStat: '2 Kelompok Pengrajin Aktif',
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',
    keyCommodities: ['Tikar Anyaman Purun', 'Tas Anyam Etnik', 'Wadah Keranjang Tradisional']
  }
];

export const INITIAL_UMKM: UmkmItem[] = [
  {
    id: 'umkm-1',
    name: 'Kemplang & Ikan Asap Salai Betung',
    ownerName: 'Ibu Nurbaiti (Kelompok Melati)',
    category: 'kuliner',
    description: 'Produksi rumahan olahan ikan baung dan patin asap asap aroma kayu bakar tradisional serta kemplang renyah tanpa bahan pengawet.',
    products: ['Ikan Salai Baung (1 kg)', 'Kemplang Ikan Panggang', 'Sambal Terasi Asap'],
    imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80',
    location: 'RT 02 Dusun Betung Indah',
    whatsappContact: '0812-7489-2231',
    isVerified: true
  },
  {
    id: 'umkm-2',
    name: 'Madu Hutan Liar Sialang Batang Hari',
    ownerName: 'Pak Syahril',
    category: 'hasil_tani',
    description: 'Madu murni alami 100% dipanen dari pohon sialang hutan sekitar wilayah Pemayung. Memiliki kadar air rendah dan khasiat kesehatan tinggi.',
    products: ['Madu Hutan Sialang 500ml', 'Madu Klanceng 250ml', 'Pollen Alami'],
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
    location: 'RT 04 Dusun Teluk Melintang',
    whatsappContact: '0853-6621-9980',
    isVerified: true
  },
  {
    id: 'umkm-3',
    name: 'Anyaman Purun Kreatif Pulau Betung',
    ownerName: 'Ibu Halimah',
    category: 'kerajinan',
    description: 'Produk kerajinan tangan dari serat purun rawa pilihan, dipadukan dengan pewarna alami untuk tas belanja ramah lingkungan dan souvenir.',
    products: ['Tas Jinjing Purun Modern', 'Tikar Lipat Sembayang', 'Kotak Tisu Etnik'],
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',
    location: 'RT 01 Dusun Betung Indah',
    whatsappContact: '0821-8832-1145',
    isVerified: true
  }
];

export const INITIAL_OFFICIALS: VillageOfficial[] = [
  {
    id: 'off-1',
    name: 'H. Sudirman',
    position: 'Kepala Desa Pulau Betung',
    section: 'kepala_desa',
    nip: 'NIAP. 19780412 201201 1 004',
    bio: 'Menjabat sebagai Kepala Desa dengan komitmen mewujudkan Desa Pulau Betung yang maju, mandiri, religius, berkeadilan sosial, dan berbasis tata kelola digital terpercaya.',
    imageUrl: '',
    tenure: 'Periode 2022 - 2028',
    isActive: true,
    displayOrder: 1,
    hasAdminAccess: true,
    adminRole: 'super_admin',
    adminUsername: 'kades.sudirman',
    allowedModules: ['all']
  },
  {
    id: 'off-2',
    name: 'Ahmad Fauzi, S.AP',
    position: 'Sekretaris Desa',
    section: 'sekretariat',
    nip: 'Pegawai Desa Terakreditasi',
    bio: 'Bertanggung jawab dalam pengelolaan administrasi ketatausahaan, keuangan desa, koordinasi perangkat, dan pelayanan umum.',
    imageUrl: '',
    tenure: 'Aktif Sejak 2020',
    isActive: true,
    displayOrder: 2,
    hasAdminAccess: true,
    adminRole: 'admin_desa',
    adminUsername: 'sekdes.fauzi',
    allowedModules: ['services', 'complaints', 'apbdes', 'news', 'officials', 'territories']
  },
  {
    id: 'off-3',
    name: 'Zainal Abidin',
    position: 'Kasi Pemerintahan',
    section: 'kasi',
    bio: 'Membidangi administrasi kependudukan, pertanahan, ketentraman dan ketertiban umum serta pemilihan RT/RW.',
    imageUrl: '',
    tenure: 'Aktif',
    isActive: true,
    displayOrder: 3,
    hasAdminAccess: true,
    adminRole: 'operator',
    adminUsername: 'pem.zainal',
    allowedModules: ['webgis', 'services', 'territories']
  },
  {
    id: 'off-4',
    name: 'Siti Rahmawati',
    position: 'Kasi Pelayanan & Kesejahteraan',
    section: 'kasi',
    bio: 'Melayani penerbitan surat keterangan warga, pengelolaan bantuan sosial, program stunting, serta pembinaan pemuda.',
    imageUrl: '',
    tenure: 'Aktif',
    isActive: true,
    displayOrder: 4,
    hasAdminAccess: true,
    adminRole: 'operator',
    adminUsername: 'pelayanan.siti',
    allowedModules: ['services', 'complaints', 'posyandu', 'announcements']
  },
  {
    id: 'off-5',
    name: 'M. Ilyas, S.E',
    position: 'Kaur Keuangan',
    section: 'kaur',
    bio: 'Mengelola penatausahaan APBDes, kas desa, pencairan dana proyek, dan penyusunan laporan pertanggungjawaban APBDes.',
    imageUrl: '',
    tenure: 'Aktif',
    isActive: true,
    displayOrder: 5
  },
  {
    id: 'off-6',
    name: 'Drs. H. Syamsudin',
    position: 'Ketua BPD (Badan Permusyawaratan Desa)',
    section: 'bpd',
    bio: 'Memimpin lembaga legislatif desa dalam menyerap aspirasi masyarakat dan mengawasi pelaksanaan kebijakan Pemerintah Desa.',
    imageUrl: '',
    tenure: 'Periode 2021 - 2027',
    isActive: true,
    displayOrder: 6
  }
];

export const INITIAL_FACILITIES: MapFacility[] = [
  {
    id: 'fac-1',
    name: 'Kantor Kepala Desa & Balai Desa Pulau Betung',
    category: 'kantor_desa',
    address: 'Jl. Utama Desa Pulau Betung No. 01',
    dusun: 'Dusun Betung Indah',
    coordinatesLabel: '-1.5284°, 103.3142°',
    coordinates: [-1.5284, 103.3142],
    imageUrl: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80',
    contact: '(0743) 21000 - Kantor Desa',
    description: 'Pusat administrasi pemerintahan, pelayanan surat terpadu, dan musyawarah desa.'
  },
  {
    id: 'fac-2',
    name: 'Poskesdes & Posyandu Melati',
    category: 'kesehatan',
    address: 'Samping Balai Desa, RT 02',
    dusun: 'Dusun Betung Indah',
    coordinatesLabel: '-1.5290°, 103.3150°',
    coordinates: [-1.5290, 103.3150],
    imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80',
    contact: '0812-7400-XXXX (Bidan Desa)',
    description: 'Pelayanan kesehatan tingkat pertama warga, pemeriksaan ibu hamil, balita, dan lansia.'
  },
  {
    id: 'fac-3',
    name: 'Masjid Jami Nurul Huda',
    category: 'ibadah',
    address: 'Jalan Lintas Dusun RT 03',
    dusun: 'Dusun Betung Indah',
    coordinatesLabel: '-1.5302°, 103.3168°',
    coordinates: [-1.5302, 103.3168],
    imageUrl: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=800&auto=format&fit=crop&q=80',
    description: 'Pusat kegiatan ibadah keagamaan, pengajian bulanan BKMT, dan peringatan hari besar Islam.'
  },
  {
    id: 'fac-4',
    name: 'SD Negeri No. 45/I Pulau Betung',
    category: 'pendidikan',
    address: 'Jl. Pendidikan RT 04',
    dusun: 'Dusun Teluk Melintang',
    coordinatesLabel: '-1.5325°, 103.3185°',
    coordinates: [-1.5325, 103.3185],
    imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80',
    description: 'Fasilitas pendidikan dasar formal bagi anak-anak Desa Pulau Betung dan sekitarnya.'
  },
  {
    id: 'fac-5',
    name: 'Dermaga Tambatan Perahu Sungai Batang Hari',
    category: 'infrastruktur',
    address: 'Tepian Sungai Batang Hari RT 01',
    dusun: 'Dusun Betung Indah',
    coordinatesLabel: '-1.5265°, 103.3130°',
    coordinates: [-1.5265, 103.3130],
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80',
    description: 'Dermaga penyeberangan perahu ketek dan bongkar muat hasil pertanian sungai warga.'
  },
  {
    id: 'fac-6',
    name: 'Pasar Tradisional Mingguan & Kios BUMDes',
    category: 'ekonomi',
    address: 'Simpang Tiga Desa RT 03',
    dusun: 'Dusun Betung Indah',
    coordinatesLabel: '-1.5295°, 103.3155°',
    coordinates: [-1.5295, 103.3155],
    imageUrl: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop&q=80',
    description: 'Pusat transaksi niaga mingguan hasil bumi, karet, sayuran, dan sembako.'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    userId: 'usr-1',
    userName: 'Admin SADEWA',
    userRole: 'super_admin',
    action: 'SYSTEM_BOOTSTRAP',
    module: 'Sistem',
    details: 'Sistem Pelayanan Digital Desa Pulau Betung aktif dengan modul RBAC terpasang.',
    timestamp: '2026-09-02 08:30:00',
    level: 'info'
  },
  {
    id: 'log-2',
    userId: 'usr-3',
    userName: 'Siti Rahmawati',
    userRole: 'operator',
    action: 'SERVICE_STATUS_UPDATED',
    module: 'Pelayanan Masyarakat',
    details: 'Memperbarui status permohonan REQ-PB-2026-001 menjadi [selesai].',
    timestamp: '2026-08-31 11:20:15',
    level: 'warning'
  },
  {
    id: 'log-3',
    userId: 'usr-2',
    userName: 'Ahmad Fauzi, S.AP',
    userRole: 'admin_desa',
    action: 'COMPLAINT_RESPONDED',
    module: 'Pengaduan',
    details: 'Menambahkan catatan respon tindak lanjut pada tiket pengaduan ADU-PB-2026-001.',
    timestamp: '2026-08-27 15:45:10',
    level: 'info'
  },
  {
    id: 'log-4',
    userId: 'usr-1',
    userName: 'Admin SADEWA',
    userRole: 'super_admin',
    action: 'BUDGET_REALIZATION_RESET',
    module: 'Transparansi APBDes',
    details: 'Mereset nilai realisasi belanja dan pendapatan APBDes T.A 2026 ke Rp 0 untuk rekonsiliasi.',
    timestamp: '2026-08-25 10:14:00',
    level: 'critical'
  },
  {
    id: 'log-5',
    userId: 'usr-2',
    userName: 'Ahmad Fauzi, S.AP',
    userRole: 'admin_desa',
    action: 'PROJECT_DELETED',
    module: 'Pembangunan & TPK',
    details: 'Menghapus data proyek pembangunan sarana air bersih yang dibatalkan.',
    timestamp: '2026-08-20 14:02:30',
    level: 'error'
  }
];
