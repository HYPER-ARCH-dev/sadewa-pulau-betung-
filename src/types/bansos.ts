export type BansosProgramType = 
  | 'BLT_DD'      // Bantuan Langsung Tunai Dana Desa
  | 'PKH'         // Program Keluarga Harapan (Kemensos)
  | 'BPNT'        // Bantuan Pangan Non Tunai / Sembako
  | 'BERAS_CPP'   // Cadangan Pangan Pemerintah (Bapanas / Bulog)
  | 'KIS_PBI'     // Kartu Indonesia Sehat Penerima Bantuan Iuran
  | 'BST'         // Bantuan Sosial Tunai
  | 'LAINNYA';

export type BansosStatus = 
  | 'tersalurkan'      // Dana/Barang sudah diterima KPM
  | 'siap_diambil'     // Surat undangan terbit, siap diambil di kantor desa
  | 'proses_verifikasi'// Dalam tahap validasi data DTKS / Musdesus
  | 'ditangguhkan';    // Dihentikan sementara karena mutasi/meninggal/mampu

export interface BansosRecipient {
  id: string;
  nik: string;              // 16 Digit NIK lengkap (disimpan aman)
  nikMasked: string;        // Misal: 150401******0001
  noKk: string;             // No Kartu Keluarga
  noKkMasked: string;       // Misal: 150401******0008
  name: string;             // Nama Lengkap Kepala Keluarga / Penerima
  nameMasked: string;       // Misal: Ahmad T***
  gender: 'Laki-laki' | 'Perempuan';
  dusun: string;            // Dusun 1, Dusun 2, Dusun 3
  rt: string;               // e.g. "01", "02"
  rw?: string;
  programType: BansosProgramType;
  programName: string;      // Contoh: "BLT Dana Desa (BLT-DD) TA 2026"
  period: string;           // Contoh: "Tahap 1 (Januari - Maret 2026)"
  nominalOrItem: string;    // Contoh: "Rp 900.000 (Rp 300rb/bln)" atau "10 Kg Beras Medium"
  status: BansosStatus;
  distributionDate?: string;// Tanggal jadwal penyaluran (YYYY-MM-DD)
  distributionTime?: string;// Jam pelayanan, misal "08:30 - 14:00 WIB"
  distributionLocation?: string; // e.g. "Aula Kantor Desa Pulau Betung"
  requirements?: string[];  // e.g. ["KTP-el Asli", "Kartu Keluarga Asli", "Surat Undangan dari Ketua RT"]
  keterangan?: string;
  receivedAt?: string;      // Tanggal realisasi diterima
  officerName?: string;     // Petugas penyalur
  verifiedByKades?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface BansosProgramInfo {
  type: BansosProgramType;
  name: string;
  shortName: string;
  source: string;           // APBDes / APBN Kemensos / Bapanas
  description: string;
  criteria: string[];
  color: string;
  badgeBg: string;
}

export interface BansosComplaint {
  id: string;
  type: 'usulan_baru' | 'sanggahan_tidak_layak' | 'keluhan_penyaluran';
  nikPelapor: string;
  namaPelapor: string;
  phonePelapor: string;
  dusun: string;
  rt: string;
  targetNikOrName?: string; // Nama/NIK yang disanggah (jika sanggahan)
  programTarget: BansosProgramType | 'SEMUA';
  alasan: string;
  fotoKondisiRumahUrl?: string;
  status: 'menunggu_musdes' | 'diverifikasi' | 'disetujui' | 'ditolak';
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BansosStatistics {
  totalKpm: number;
  totalDanaTersalur: number;
  totalBerasKg: number;
  byProgram: {
    program: BansosProgramType;
    label: string;
    count: number;
    nominalStr: string;
  }[];
  byDusun: {
    dusun: string;
    count: number;
  }[];
}
