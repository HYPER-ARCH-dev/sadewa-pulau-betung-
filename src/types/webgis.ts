export type LandUseCategory =
  | 'PEMUKIMAN'
  | 'PERKEBUNAN_SAWIT'
  | 'PERKEBUNAN_KARET'
  | 'SAWAH_PERTANIAN'
  | 'FASILITAS_UMUM'
  | 'PERDAGANGAN_JASA';

export type PbbStatus = 'LUNAS' | 'BELUM_LUNAS' | 'BEBAS_PAJAK';

export type SporadikStatus = 'BELUM_TERDAFTAR' | 'DRAF_SURVEI' | 'TERVERIFIKASI' | 'SPORADIK_TERBIT';

export interface LandBoundarySegment {
  direction: 'UTARA' | 'SELATAN' | 'TIMUR' | 'BARAT';
  neighborName: string; // Nama pemilik / fasilitas tetangga berbatasan
  neighborNik?: string;
  distanceMeters: number;
}

export interface LandParcel {
  id: string; // ID unik internal (e.g. PARCEL-PB-001)
  nop: string; // Nomor Objek Pajak PBB-P2 (e.g. 15.04.010.001.002-0012.0)
  ownerName: string; // Nama Pemilik / Wajib Pajak
  ownerNik: string; // NIK Wajib Pajak
  phone?: string;
  addressDusun: string; // e.g. "Dusun Betung Indah RT 02"
  landUseCategory: LandUseCategory;
  
  // Data Geometri & Hasil Ukur Shoelace
  landAreaSqM: number; // Luas Hasil Ukur Shoelace (m²)
  landAreaHectares: number; // Luas dalam Ha
  buildingAreaSqM: number; // Luas Bangunan (m²)
  coordinates: [number, number][]; // Array koordinat [lat, lng] poligon
  boundaries: LandBoundarySegment[];

  // Data PBB-P2 (Pajak Bumi & Bangunan)
  njopLandPerSqM: number; // NJOP Tanah per m² (Rp)
  njopBuildingPerSqM: number; // NJOP Bangunan per m² (Rp)
  pbbTaxAmount: number; // Tagihan PBB-P2 Tahun Berjalan (Rp)
  pbbStatus: PbbStatus;
  pbbPaymentDate?: string;
  pbbReceiptNumber?: string;

  // Data SPORADIK (Kelas A - Penguasaan Fisik Tanah)
  sporadikStatus: SporadikStatus;
  sporadikRequestCode?: string; // Kode Resi Pengajuan SADEWA (e.g. REQ-PB-2026-088)
  sporadikCertificateNumber?: string; // Nomor Surat Keterangan Sporadik Resmi Desa
  sporadikIssuedDate?: string;
  surveyorName?: string; // Nama Petugas Ukur / Kadus
  witnesses?: string[]; // Nama saksi-saksi batas tanah

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DusunSpatialBoundary {
  dusunId: string;
  name: string;
  color: string;
  leaderName: string;
  coordinates: [number, number][];
}

export interface WebGisSummary {
  totalParcels: number;
  totalAreaSqM: number;
  totalAreaHectares: number;
  totalPbbPotential: number;
  totalPbbPaid: number;
  complianceRatePercent: number;
  totalSporadikVerified: number;
  totalSporadikDraft: number;
}
