/**
 * SISTEM FORM INPUT DINAMIS SURAT DESA PULAU BETUNG
 * Modul pemetaan schema input dinamis per jenis surat berdasarkan slug/code.
 * 
 * Keyword: DYNAMIC_FORM_SCHEMA, LETTER_FIELDS, SADEWA
 */

export type FormFieldType = 
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'textarea'
  | 'radio'
  | 'currency'
  | 'array';

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldSchema {
  id: string; // Kunci properti pada payload JSON formData (misal: "nikAlmarhum")
  label: string;
  type: FormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[]; // Untuk select/radio
  defaultValue?: any;
  helpText?: string;
  unit?: string; // e.g. "m²", "Orang", "Rupiah", "Tahun"
  gridCol?: 'full' | 'half' | 'third'; // Layout responsive grid
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternMessage?: string;
  };
  // Khusus tipe 'array' (repeater untuk tabel/daftar dinamis seperti Ahli Waris)
  arrayFields?: FormFieldSchema[];
  arrayMinItems?: number;
  arrayMaxItems?: number;
  arrayItemLabel?: string; // e.g. "Ahli Waris Ke-{index}"
}

export interface LetterFormGroup {
  groupTitle?: string;
  groupDescription?: string;
  fields: FormFieldSchema[];
}

export interface LetterFormSchema {
  letterCode: string; // Slug/kode utama
  aliases?: string[]; // Variasi slug yang cocok
  title: string;
  description?: string;
  iconName?: string;
  groups: LetterFormGroup[];
}

/**
 * MASTER KATALOG SCHEMA FORM SURAT DESA PULAU BETUNG
 */
export const LETTER_FORM_SCHEMAS: LetterFormSchema[] = [
  // 1. SURAT KEMATIAN
  {
    letterCode: 'surat-kematian',
    aliases: ['sk-kematian', 'kematian', 'skk', 'surat-keterangan-kematian'],
    title: 'Surat Keterangan Kematian',
    description: 'Input data jenazah/almarhum untuk penerbitan Akta/Surat Keterangan Kematian',
    iconName: 'UserX',
    groups: [
      {
        groupTitle: 'Data Identitas Almarhum / Almarhumah',
        groupDescription: 'Isi data identitas lengkap almarhum/almarhumah sesuai KTP atau KK',
        fields: [
          {
            id: 'nikAlmarhum',
            label: 'NIK Almarhum / Almarhumah',
            type: 'text',
            placeholder: '16 digit NIK almarhum',
            required: true,
            gridCol: 'half',
            validation: {
              pattern: '^[0-9]{16}$',
              patternMessage: 'NIK harus berupa 16 digit angka'
            }
          },
          {
            id: 'namaAlmarhum',
            label: 'Nama Lengkap Almarhum / Almarhumah',
            type: 'text',
            placeholder: 'Nama sesuai KTP/KK',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'jenisKelaminAlmarhum',
            label: 'Jenis Kelamin',
            type: 'select',
            required: true,
            gridCol: 'third',
            options: [
              { label: 'Laki-laki', value: 'Laki-laki' },
              { label: 'Perempuan', value: 'Perempuan' }
            ]
          },
          {
            id: 'umurAlmarhum',
            label: 'Umur Saat Meninggal',
            type: 'number',
            placeholder: 'Contoh: 65',
            unit: 'Tahun',
            required: true,
            gridCol: 'third'
          },
          {
            id: 'hubunganPemohon',
            label: 'Hubungan Pemohon dengan Almarhum',
            type: 'select',
            required: true,
            gridCol: 'third',
            options: [
              { label: 'Anak Kandung', value: 'Anak Kandung' },
              { label: 'Suami / Istri', value: 'Suami / Istri' },
              { label: 'Orang Tua', value: 'Orang Tua' },
              { label: 'Saudara Kandung', value: 'Saudara Kandung' },
              { label: 'Cucu / Famili Lain', value: 'Cucu / Famili Lain' }
            ]
          }
        ]
      },
      {
        groupTitle: 'Rincian Waktu, Tempat & Penyebab Meninggal',
        groupDescription: 'Lengkapi keterangan kronologis meninggal dunia',
        fields: [
          {
            id: 'tanggalMeninggal',
            label: 'Tanggal Meninggal Dunia',
            type: 'date',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'jamMeninggal',
            label: 'Jam / Waktu Meninggal',
            type: 'time',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'penyebabMeninggal',
            label: 'Penyebab Meninggal',
            type: 'select',
            required: true,
            gridCol: 'half',
            options: [
              { label: 'Sakit Biasa / Usia Lanjut', value: 'Sakit Biasa / Usia Lanjut' },
              { label: 'Sakit Menahun di Rumah Sakit', value: 'Sakit Menahun di Rumah Sakit' },
              { label: 'Kecelakaan Lalu Lintas / Kerja', value: 'Kecelakaan' },
              { label: 'Wabah / Penyakit Menular', value: 'Wabah / Penyakit Menular' },
              { label: 'Lainnya', value: 'Lainnya' }
            ]
          },
          {
            id: 'tempatMeninggal',
            label: 'Tempat Meninggal Dunia',
            type: 'text',
            placeholder: 'Rumah Duka RT 03 Dusun I / RSUD Muaro Jambi / dll',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'tempatPemakaman',
            label: 'Tempat Pemakaman / TPU',
            type: 'text',
            placeholder: 'TPU Desa Pulau Betung / TPU Dusun II / dll',
            required: true,
            gridCol: 'full'
          }
        ]
      }
    ]
  },

  // 2. SPORADIK / SURAT KETERANGAN TANAH
  {
    letterCode: 'sporadik',
    aliases: ['surat-sporadik', 'sk-tanah', 'keterangan-tanah', 'sk-sporadik', 'pertanahan', 'sk-penguasaan-tanah'],
    title: 'Surat Pernyataan Penguasaan Fisik Bidang Tanah (Sporadik)',
    description: 'Formulir pengisian rincian lokasi, luas, dan batas-batas tanah di Desa Pulau Betung',
    iconName: 'MapPin',
    groups: [
      {
        groupTitle: 'Spesifikasi & Identitas Objek Tanah',
        groupDescription: 'Data teknis bidang tanah yang dikuasai',
        fields: [
          {
            id: 'lokasiTanah',
            label: 'Lokasi / Dusun / RT Bidang Tanah',
            type: 'text',
            placeholder: 'Dusun II RT 04 Desa Pulau Betung',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'luasTanah',
            label: 'Luas Bidang Tanah',
            type: 'number',
            placeholder: 'Contoh: 500',
            unit: 'm²',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'statusKepemilikan',
            label: 'Status / Asal Usul Tanah',
            type: 'select',
            required: true,
            gridCol: 'half',
            options: [
              { label: 'Penguasaan Fisik Garapan Sejak Lama', value: 'Penguasaan Fisik Garapan' },
              { label: 'Warisan Keluarga', value: 'Warisan Keluarga' },
              { label: 'Jual Beli Bawah Tangan / Kuitansi', value: 'Jual Beli' },
              { label: 'Hibah / Pemberian', value: 'Hibah' },
              { label: 'Pembukaan Lahan Baru', value: 'Pembukaan Lahan' }
            ]
          },
          {
            id: 'nomorPersil',
            label: 'Nomor Persil / Blok / SPPT PBB (Jika ada)',
            type: 'text',
            placeholder: 'Blok 012 / Persil No. 45',
            required: false,
            gridCol: 'half'
          },
          {
            id: 'tahunMulaiDikuasai',
            label: 'Tahun Mulai Dikuasai / Digarap',
            type: 'number',
            placeholder: 'Contoh: 1998',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'peruntukanTanah',
            label: 'Peruntukan / Penggunaan Tanah',
            type: 'select',
            required: true,
            gridCol: 'half',
            options: [
              { label: 'Perumahan / Pekarangan', value: 'Perumahan / Pekarangan' },
              { label: 'Perkebunan Kelapa Sawit / Karet', value: 'Perkebunan Kelapa Sawit / Karet' },
              { label: 'Sawah / Pertanian', value: 'Sawah / Pertanian' },
              { label: 'Kolam Ikan / Perikanan', value: 'Kolam Ikan' },
              { label: 'Bangunan Tempat Usaha / Ruko', value: 'Tempat Usaha' }
            ]
          }
        ]
      },
      {
        groupTitle: 'Batas-Batas Sempadan Tanah',
        groupDescription: 'Sebutkan pemilik atau pemegang hak batas di sekeliling tanah',
        fields: [
          {
            id: 'batasUtara',
            label: 'Batas Sebelah Utara',
            type: 'text',
            placeholder: 'Berbatasan dengan Tanah / Jalan / Sungai...',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'batasSelatan',
            label: 'Batas Sebelah Selatan',
            type: 'text',
            placeholder: 'Berbatasan dengan Tanah / Sempadan...',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'batasTimur',
            label: 'Batas Sebelah Timur',
            type: 'text',
            placeholder: 'Berbatasan dengan Rumah / Lahan...',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'batasBarat',
            label: 'Batas Sebelah Barat',
            type: 'text',
            placeholder: 'Berbatasan dengan Parit / Lahan...',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'saksiBatas',
            label: 'Nama Saksi-Saksi Batas & Tokoh Masyarakat',
            type: 'textarea',
            placeholder: '1. Ahmad (Batas Utara)\n2. Budi (Batas Selatan)\n3. Ketua RT 04',
            required: false,
            gridCol: 'full'
          }
        ]
      }
    ]
  },

  // 3. SURAT KETERANGAN BEDA NAMA
  {
    letterCode: 'sk-beda-nama',
    aliases: ['beda-nama', 'perbedaan-nama', 'surat-keterangan-beda-nama', 'klarifikasi-nama'],
    title: 'Surat Keterangan Perbedaan / Beda Nama',
    description: 'Surat klarifikasi resmi untuk perbedaan penulisan nama di KTP/KK dengan ijazah/sertifikat/buku nikah',
    iconName: 'FileText',
    groups: [
      {
        groupTitle: 'Identitas & Perbedaan Dokumen',
        groupDescription: 'Sebutkan rincian nama yang tertulis pada dokumen yang berbeda',
        fields: [
          {
            id: 'namaDiKTP',
            label: 'Nama Tercantum pada KTP / KK Pemohon',
            type: 'text',
            placeholder: 'Nama lengkap sesuai KTP/KK',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'nikKTP',
            label: 'NIK Sesuai KTP',
            type: 'text',
            placeholder: '16 digit NIK',
            required: true,
            gridCol: 'half',
            validation: {
              pattern: '^[0-9]{16}$',
              patternMessage: 'NIK harus 16 digit'
            }
          },
          {
            id: 'jenisDokumenLain',
            label: 'Jenis Dokumen yang Berbeda Nama',
            type: 'select',
            required: true,
            gridCol: 'half',
            options: [
              { label: 'Sertifikat Tanah / Hak Milik', value: 'Sertifikat Tanah' },
              { label: 'Ijazah / STTB Sekolah', value: 'Ijazah Sekolah' },
              { label: 'Buku Nikah / Akta Perkawinan', value: 'Buku Nikah' },
              { label: 'Akta Kelahiran', value: 'Akta Kelahiran' },
              { label: 'Buku Rekening Bank / Tabungan', value: 'Buku Rekening Bank' },
              { label: 'Kartu BPJS Kesehatan / Ketenagakerjaan', value: 'Kartu BPJS' },
              { label: 'Paspor / Dokumen Imigrasi', value: 'Paspor' },
              { label: 'Lainnya', value: 'Dokumen Lain' }
            ]
          },
          {
            id: 'namaDiDokumenLain',
            label: 'Nama yang Tercantum pada Dokumen Tersebut',
            type: 'text',
            placeholder: 'Nama persis sesuai tulisan di sertifikat/ijazah',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'nomorDokumenLain',
            label: 'Nomor Dokumen yang Berbeda',
            type: 'text',
            placeholder: 'Contoh: No. Sertifikat / No. Ijazah / No. Akta Nikah',
            required: false,
            gridCol: 'half'
          },
          {
            id: 'namaYangBenar',
            label: 'Nama yang Dinyatakan BENAR & Digunakan',
            type: 'text',
            placeholder: 'Nama sah yang digunakan dalam administrasi',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'alasanPerbedaan',
            label: 'Alasan / Keterangan Singkat Perbedaan',
            type: 'textarea',
            placeholder: 'Contoh: Terjadi kesalahan penulisan ejaan nama pada saat penerbitan Ijazah SD tahun 2005...',
            required: true,
            gridCol: 'full'
          }
        ]
      }
    ]
  },

  // 4. SKTM / SURAT KETERANGAN TIDAK MAMPU & PENGHASILAN
  {
    letterCode: 'sktm',
    aliases: ['sk-sktm', 'keterangan-tidak-mampu', 'keterangan-penghasilan', 'sk-penghasilan', 'sktm-sekolah', 'sktm-pengobatan'],
    title: 'Surat Keterangan Tidak Mampu / Penghasilan Orang Tua',
    description: 'Formulir data kondisi sosial ekonomi keluarga untuk KIP Kuliah, beasiswa, atau bantuan kesehatan',
    iconName: 'DollarSign',
    groups: [
      {
        groupTitle: 'Profil Ekonomi & Pekerjaan Pemohon',
        groupDescription: 'Data statistik mata pencaharian dan pendapatan keluarga',
        fields: [
          {
            id: 'pekerjaanPemohon',
            label: 'Pekerjaan / Mata Pencaharian Utama',
            type: 'text',
            placeholder: 'Buruh Tani / Petani Sawit / Pedagang Kecil / dll',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'nominalPenghasilan',
            label: 'Estimasi Penghasilan Rata-Rata per Bulan',
            type: 'currency',
            placeholder: 'Contoh: 1500000',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'jumlahTanggungan',
            label: 'Jumlah Tanggungan Keluarga',
            type: 'number',
            placeholder: 'Jumlah jiwa yang ditanggung',
            unit: 'Orang',
            required: true,
            gridCol: 'third'
          },
          {
            id: 'sumberPenghasilan',
            label: 'Kategori Sumber Pendapatan',
            type: 'select',
            required: true,
            gridCol: 'third',
            options: [
              { label: 'Buruh Harian / Tani', value: 'Buruh Harian / Tani' },
              { label: 'Petani Gurandal / Garapan', value: 'Petani Garapan' },
              { label: 'Pedagang Kecil / Warung Kelontong', value: 'Pedagang Kecil' },
              { label: 'Serabutan / Tidak Tetap', value: 'Serabutan' },
              { label: 'Lainnya', value: 'Lainnya' }
            ]
          },
          {
            id: 'statusRumah',
            label: 'Status Kepemilikan Tempat Tinggal',
            type: 'select',
            required: true,
            gridCol: 'third',
            options: [
              { label: 'Milik Sendiri (Sederhana)', value: 'Milik Sendiri' },
              { label: 'Menumpang di Rumah Orang Tua/Famili', value: 'Menumpang' },
              { label: 'Sewa / Kontrak', value: 'Sewa' }
            ]
          }
        ]
      },
      {
        groupTitle: 'Anggota Keluarga yang Ditanggung & Keperluan Pengajuan',
        groupDescription: 'Rincian nama anak/tanggungan dan instansi tujuan surat',
        fields: [
          {
            id: 'namaAnak',
            label: 'Nama Anak / Anggota Keluarga yang Ditanggung',
            type: 'text',
            placeholder: 'Isi jika SKTM diajukan untuk anak/keluarga',
            required: false,
            gridCol: 'half'
          },
          {
            id: 'sekolahInstansi',
            label: 'Nama Sekolah / Perguruan Tinggi / Rumah Sakit Tujuan',
            type: 'text',
            placeholder: 'Contoh: Universitas Jambi / SMA Negeri 1 / RSUD Muaro Jambi',
            required: false,
            gridCol: 'half'
          },
          {
            id: 'keperluan',
            label: 'Keperluan Lengkap Pengajuan Surat',
            type: 'textarea',
            placeholder: 'Contoh: Persyaratan pendaftaran Kartu Indonesia Pintar (KIP) Kuliah tahun akademik 2026/2027...',
            required: true,
            gridCol: 'full'
          }
        ]
      }
    ]
  },

  // 5. AHLI WARIS / KETERANGAN WARIS
  {
    letterCode: 'sk-ahli-waris',
    aliases: ['ahli-waris', 'surat-waris', 'keterangan-ahli-waris', 'sk-waris'],
    title: 'Surat Keterangan Ahli Waris',
    description: 'Pencatatan silsilah keluarga almarhum/pewaris serta daftar lengkap seluruh para ahli waris yang sah',
    iconName: 'Users',
    groups: [
      {
        groupTitle: 'Data Pewaris (Almarhum / Almarhumah)',
        groupDescription: 'Identitas lengkap almarhum/pewaris pemilik harta warisan',
        fields: [
          {
            id: 'namaPewaris',
            label: 'Nama Lengkap Almarhum (Pewaris)',
            type: 'text',
            placeholder: 'Nama pewaris sesuai KTP/KK',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'nikPewaris',
            label: 'NIK Pewaris',
            type: 'text',
            placeholder: '16 digit NIK pewaris',
            required: false,
            gridCol: 'half'
          },
          {
            id: 'tanggalMeninggalPewaris',
            label: 'Tanggal Meninggal Pewaris',
            type: 'date',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'tempatMeninggalPewaris',
            label: 'Tempat Meninggal Pewaris',
            type: 'text',
            placeholder: 'Rumah duka Desa Pulau Betung / RSUD / dll',
            required: true,
            gridCol: 'half'
          }
        ]
      },
      {
        groupTitle: 'Daftar Lengkap Para Ahli Waris yang Sah',
        groupDescription: 'Tambahkan seluruh anggota keluarga yang berhak menjadi ahli waris',
        fields: [
          {
            id: 'daftarAhliWaris',
            label: 'Daftar Nama Ahli Waris',
            type: 'array',
            required: true,
            arrayMinItems: 1,
            arrayItemLabel: 'Ahli Waris Ke-{index}',
            arrayFields: [
              {
                id: 'nama',
                label: 'Nama Lengkap Ahli Waris',
                type: 'text',
                placeholder: 'Nama sesuai KTP',
                required: true,
                gridCol: 'half'
              },
              {
                id: 'nik',
                label: 'NIK Ahli Waris',
                type: 'text',
                placeholder: '16 digit NIK',
                required: true,
                gridCol: 'half',
                validation: {
                  pattern: '^[0-9]{16}$',
                  patternMessage: 'NIK harus 16 digit'
                }
              },
              {
                id: 'tempatTanggalLahir',
                label: 'Tempat, Tanggal Lahir',
                type: 'text',
                placeholder: 'Pulau Betung, 12-05-1990',
                required: true,
                gridCol: 'half'
              },
              {
                id: 'hubunganKeluarga',
                label: 'Hubungan dengan Pewaris',
                type: 'select',
                required: true,
                gridCol: 'half',
                options: [
                  { label: 'Anak Kandung', value: 'Anak Kandung' },
                  { label: 'Istri (Janda Pewaris)', value: 'Istri' },
                  { label: 'Suami (Duda Pewaris)', value: 'Suami' },
                  { label: 'Orang Tua (Ayah/Ibu)', value: 'Orang Tua' },
                  { label: 'Cucu Kandung', value: 'Cucu' }
                ]
              },
              {
                id: 'pekerjaan',
                label: 'Pekerjaan',
                type: 'text',
                placeholder: 'Wiraswasta / Buruh / dll',
                required: false,
                gridCol: 'half'
              },
              {
                id: 'alamat',
                label: 'Alamat Domisili Sekarang',
                type: 'text',
                placeholder: 'Dusun I RT 02 Desa Pulau Betung',
                required: false,
                gridCol: 'half'
              }
            ]
          }
        ]
      },
      {
        groupTitle: 'Keperluan & Objek Peninggalan',
        groupDescription: 'Tujuan penerbitan surat ahli waris',
        fields: [
          {
            id: 'keperluanAhliWaris',
            label: 'Maksud & Keperluan Pengajuan Surat Waris',
            type: 'textarea',
            placeholder: 'Contoh: Pengurusan balik nama sertifikat hak milik tanah atas nama almarhum / Penutupan tabungan bank / Klaim asuransi jiwa...',
            required: true,
            gridCol: 'full'
          }
        ]
      }
    ]
  },

  // 6. SURAT KETERANGAN USAHA (SKU)
  {
    letterCode: 'sku',
    aliases: ['sk-usaha', 'keterangan-usaha', 'surat-keterangan-usaha', 'sk-umkm'],
    title: 'Surat Keterangan Usaha (SKU)',
    description: 'Legalisasi usaha mikro/kecil warga Desa Pulau Betung untuk perbankan, KUR, atau izin usaha',
    iconName: 'Briefcase',
    groups: [
      {
        groupTitle: 'Spesifikasi & Detail Tempat Usaha',
        groupDescription: 'Isi identitas operasional kegiatan usaha',
        fields: [
          {
            id: 'namaUsaha',
            label: 'Nama Usaha / Toko / UMKM',
            type: 'text',
            placeholder: 'Contoh: Toko Sembako Berkah / Bengkel Mandiri',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'jenisUsaha',
            label: 'Bidang / Jenis Kegiatan Usaha',
            type: 'text',
            placeholder: 'Contoh: Perdagangan Sembako, Peternakan Ayam, Perkebunan Kelapa Sawit',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'tahunBerdiri',
            label: 'Tahun Mulai Beroperasi',
            type: 'number',
            placeholder: 'Contoh: 2018',
            required: true,
            gridCol: 'third'
          },
          {
            id: 'omsetBulanan',
            label: 'Estimasi Omset per Bulan',
            type: 'currency',
            placeholder: 'Contoh: 5000000',
            required: false,
            gridCol: 'third'
          },
          {
            id: 'jumlahKaryawan',
            label: 'Jumlah Pekerja / Karyawan',
            type: 'number',
            placeholder: '0 jika dikelola sendiri',
            unit: 'Orang',
            required: false,
            gridCol: 'third'
          },
          {
            id: 'alamatUsaha',
            label: 'Alamat / Lokasi Tempat Usaha',
            type: 'text',
            placeholder: 'Jalan Raya Lintas Desa Pulau Betung RT 03 Dusun II',
            required: true,
            gridCol: 'full'
          },
          {
            id: 'keperluanSKU',
            label: 'Keperluan Pengajuan SKU',
            type: 'textarea',
            placeholder: 'Contoh: Syarat pengajuan Kredit Usaha Rakyat (KUR) di Bank BRI / Pengurusan Izin Usaha NIB / Bantuan UMKM...',
            required: true,
            gridCol: 'full'
          }
        ]
      }
    ]
  },

  // 7. SURAT KETERANGAN DOMISILI
  {
    letterCode: 'domisili',
    aliases: ['sk-domisili', 'keterangan-domisili', 'surat-domisili'],
    title: 'Surat Keterangan Domisili',
    description: 'Keterangan alamat tempat tinggal atau domisili usaha sementara/tetap di Desa Pulau Betung',
    iconName: 'Home',
    groups: [
      {
        groupTitle: 'Rincian Alamat Domisili',
        groupDescription: 'Data domisili pemohon saat ini',
        fields: [
          {
            id: 'alamatDomisili',
            label: 'Alamat Lengkap Tempat Tinggal Saat Ini',
            type: 'text',
            placeholder: 'Dusun I RT 02 Desa Pulau Betung Kec. Pemayung',
            required: true,
            gridCol: 'full'
          },
          {
            id: 'sejakTanggal',
            label: 'Berdomisili Sejak',
            type: 'date',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'statusBangunan',
            label: 'Status Tempat Tinggal',
            type: 'select',
            required: true,
            gridCol: 'half',
            options: [
              { label: 'Milik Sendiri', value: 'Milik Sendiri' },
              { label: 'Sewa / Kontrak Rumah', value: 'Sewa' },
              { label: 'Menumpang Famili', value: 'Menumpang' },
              { label: 'Mess / Asrama Pekerja', value: 'Mess Pekerja' }
            ]
          },
          {
            id: 'keperluanDomisili',
            label: 'Maksud & Keperluan Pengajuan Surat Domisili',
            type: 'textarea',
            placeholder: 'Contoh: Syarat melamar pekerjaan di PT X / Pembukaan rekening bank / Persyaratan izin operasional...',
            required: true,
            gridCol: 'full'
          }
        ]
      }
    ]
  },

  // 8. SURAT PENGANTAR NIKAH (N1 - N4)
  {
    letterCode: 'nikah',
    aliases: ['pengantar-nikah', 'sk-nikah', 'n1-n4', 'surat-nikah', 'pengantar-kua'],
    title: 'Surat Pengantar Nikah (Model N1-N4)',
    description: 'Pencatatan formulir rekomendasi pernikahan warga untuk dikirimkan ke KUA',
    iconName: 'Heart',
    groups: [
      {
        groupTitle: 'Status Pemohon & Identitas Calon Pasangan',
        groupDescription: 'Isi data calon suami/istri yang akan dilangsungkan akad pernikahan',
        fields: [
          {
            id: 'statusPernikahanPemohon',
            label: 'Status Pernikahan Pemohon Saat Ini',
            type: 'select',
            required: true,
            gridCol: 'half',
            options: [
              { label: 'Jejaka', value: 'Jejaka' },
              { label: 'Perawan', value: 'Perawan' },
              { label: 'Duda (Cerai Mati / Hidup)', value: 'Duda' },
              { label: 'Janda (Cerai Mati / Hidup)', value: 'Janda' }
            ]
          },
          {
            id: 'namaCalonPasangan',
            label: 'Nama Lengkap Calon Suami / Istri',
            type: 'text',
            placeholder: 'Nama lengkap pasangan',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'nikCalonPasangan',
            label: 'NIK Calon Pasangan',
            type: 'text',
            placeholder: '16 digit NIK calon pasangan',
            required: false,
            gridCol: 'half'
          },
          {
            id: 'tempatTanggalLahirPasangan',
            label: 'Tempat, Tanggal Lahir Pasangan',
            type: 'text',
            placeholder: 'Jambi, 18 Agustus 1996',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'alamatCalonPasangan',
            label: 'Alamat Lengkap Calon Pasangan',
            type: 'text',
            placeholder: 'Desa/Kelurahan, Kecamatan, Kabupaten/Kota',
            required: true,
            gridCol: 'full'
          },
          {
            id: 'rencanaTanggalNikah',
            label: 'Rencana Tanggal Akad Nikah',
            type: 'date',
            required: true,
            gridCol: 'half'
          },
          {
            id: 'lokasiKuaTujuan',
            label: 'KUA Kecamatan Tujuan',
            type: 'text',
            placeholder: 'Contoh: KUA Kecamatan Pemayung',
            required: true,
            gridCol: 'half'
          }
        ]
      }
    ]
  }
];

/**
 * SCHEMA FALLBACK GENERAL UNTUK SURAT LAIN YANG BELUM MEMILIKI SCHEMA SPESIFIK
 */
export const DEFAULT_LETTER_FORM_SCHEMA: LetterFormSchema = {
  letterCode: 'default-general',
  title: 'Formulir Keterangan Pengajuan Surat',
  description: 'Isi informasi pendukung dan maksud pengajuan surat',
  groups: [
    {
      groupTitle: 'Maksud & Keperluan Pengajuan',
      groupDescription: 'Lengkapi keterangan keperluan dokumen',
      fields: [
        {
          id: 'keperluanSurat',
          label: 'Maksud & Keperluan Pengajuan Surat',
          type: 'textarea',
          placeholder: 'Jelaskan secara singkat untuk apa surat ini digunakan...',
          required: true,
          gridCol: 'full'
        },
        {
          id: 'keteranganTambahan',
          label: 'Catatan / Keterangan Tambahan (Opsional)',
          type: 'textarea',
          placeholder: 'Isi informasi pendukung lain jika ada...',
          required: false,
          gridCol: 'full'
        }
      ]
    }
  ]
};

/**
 * HELPER: Mendapatkan Form Schema berdasarkan kode / slug surat
 */
export function getLetterFormSchema(letterCodeOrSlug?: string): LetterFormSchema {
  if (!letterCodeOrSlug) {
    return DEFAULT_LETTER_FORM_SCHEMA;
  }

  const normalized = letterCodeOrSlug.toLowerCase().trim();

  const found = LETTER_FORM_SCHEMAS.find((s) => {
    if (s.letterCode.toLowerCase() === normalized) return true;
    if (s.aliases && s.aliases.some((a) => a.toLowerCase() === normalized)) return true;
    return false;
  });

  return found || DEFAULT_LETTER_FORM_SCHEMA;
}

/**
 * HELPER: Mengenerate nilai default awal dari sebuah schema
 */
export function getDefaultFormData(schema: LetterFormSchema): Record<string, any> {
  const result: Record<string, any> = {};

  schema.groups.forEach((group) => {
    group.fields.forEach((field) => {
      if (field.type === 'array') {
        const minItems = field.arrayMinItems || 1;
        const initialArray: Record<string, any>[] = [];
        for (let i = 0; i < minItems; i++) {
          const itemObj: Record<string, any> = {};
          if (field.arrayFields) {
            field.arrayFields.forEach((subF) => {
              itemObj[subF.id] = subF.defaultValue || '';
            });
          }
          initialArray.push(itemObj);
        }
        result[field.id] = initialArray;
      } else {
        result[field.id] = field.defaultValue !== undefined ? field.defaultValue : '';
      }
    });
  });

  return result;
}

/**
 * HELPER: Validasi data input terhadap schema
 * Mengembalikan object error per field (key = field.id, value = pesan error)
 */
export function validateFormData(
  schema: LetterFormSchema,
  data: Record<string, any>
): Record<string, string> {
  const errors: Record<string, string> = {};

  schema.groups.forEach((group) => {
    group.fields.forEach((field) => {
      const val = data[field.id];

      if (field.type === 'array') {
        const arr = Array.isArray(val) ? val : [];
        if (field.required && arr.length === 0) {
          errors[field.id] = `${field.label} wajib diisi setidaknya 1 data`;
        } else if (field.arrayMinItems && arr.length < field.arrayMinItems) {
          errors[field.id] = `${field.label} minimal ${field.arrayMinItems} data`;
        }

        // Validasi tiap elemen array jika ada
        arr.forEach((item, idx) => {
          if (field.arrayFields) {
            field.arrayFields.forEach((subF) => {
              const subVal = item[subF.id];
              if (subF.required && (!subVal || String(subVal).trim() === '')) {
                errors[`${field.id}.${idx}.${subF.id}`] = `${subF.label} wajib diisi`;
              } else if (subVal && subF.validation?.pattern) {
                const reg = new RegExp(subF.validation.pattern);
                if (!reg.test(String(subVal))) {
                  errors[`${field.id}.${idx}.${subF.id}`] = subF.validation.patternMessage || 'Format tidak valid';
                }
              }
            });
          }
        });
      } else {
        // Validation for single field
        const isEmpty = val === undefined || val === null || String(val).trim() === '';

        if (field.required && isEmpty) {
          errors[field.id] = `${field.label} wajib diisi`;
        } else if (!isEmpty) {
          if (field.validation?.pattern) {
            const reg = new RegExp(field.validation.pattern);
            if (!reg.test(String(val))) {
              errors[field.id] = field.validation.patternMessage || `${field.label} format tidak valid`;
            }
          }

          if (field.type === 'number') {
            const numVal = Number(val);
            if (isNaN(numVal)) {
              errors[field.id] = `${field.label} harus berupa angka`;
            } else {
              if (field.validation?.min !== undefined && numVal < field.validation.min) {
                errors[field.id] = `${field.label} minimal ${field.validation.min}`;
              }
              if (field.validation?.max !== undefined && numVal > field.validation.max) {
                errors[field.id] = `${field.label} maksimal ${field.validation.max}`;
              }
            }
          }
        }
      }
    });
  });

  return errors;
}
