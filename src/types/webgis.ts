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

// ============================================================================
// UNIVERSAL MULTI-TENANT GIS FOUNDATION TYPES
// ============================================================================

export type MapMode = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

export type BoundaryVerificationStatus = 'BELUM_TERVERIFIKASI' | 'PERLU_VERIFIKASI' | 'TERVERIFIKASI';

export type BoundarySourceType =
  | 'OFFICIAL_BIG'
  | 'PEMDA'
  | 'ADMIN_DIGITIZED'
  | 'IMPORTED_GEOJSON'
  | 'SURVEY_LAPANGAN'
  | 'UNKNOWN';

export interface GeoJsonPolygonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

/** Standard RFC 7946 GeoJSON bbox: [minLng, minLat, maxLng, maxLat] */
export type GisBoundingBox = [number, number, number, number];

export type BoundaryRole = 'MAIN_VILLAGE' | 'NEIGHBOR_VILLAGE';

export interface GisVillageBoundary {
  id: string;
  villageId?: string | null;
  villageName?: string | null;
  boundaryRole?: BoundaryRole;
  showOnMap?: boolean;
  fillColor?: string | null;
  regionCode?: string | null;
  status: BoundaryVerificationStatus;
  sourceType: BoundarySourceType;
  sourceName?: string | null;
  sourceYear?: number | null;
  licenseNote?: string | null;
  geometryGeoJson: GeoJsonPolygonGeometry;
  bbox?: GisBoundingBox | null;
  centroidLat?: number | null;
  centroidLng?: number | null;
  areaSqM?: number | null;
  perimeterMeters?: number | null;
  isActive: boolean;
  importJobId?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateVillageBoundaryInput {
  villageName?: string | null;
  boundaryRole?: BoundaryRole;
  showOnMap?: boolean;
  fillColor?: string | null;
  regionCode?: string | null;
  status?: BoundaryVerificationStatus;
  sourceType: BoundarySourceType;
  sourceName?: string | null;
  sourceYear?: number | null;
  licenseNote?: string | null;
  geometryGeoJson: GeoJsonPolygonGeometry;
  isActive?: boolean;
  verificationNotes?: string | null;
}

export interface UpdateVillageBoundaryInput {
  villageName?: string | null;
  boundaryRole?: BoundaryRole;
  showOnMap?: boolean;
  fillColor?: string | null;
  regionCode?: string | null;
  sourceType?: BoundarySourceType;
  sourceName?: string | null;
  sourceYear?: number | null;
  licenseNote?: string | null;
  geometryGeoJson?: GeoJsonPolygonGeometry;
  isActive?: boolean;
  verificationNotes?: string | null;
}

export interface GisTenantConfig {
  id?: string;
  regionCode?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  defaultZoom: number;
  bbox?: GisBoundingBox | null;
  defaultMapMode: MapMode;
  activeProviderId?: string | null;
  showVillageBoundary: boolean;
  boundaryColor: string;
  customSatelliteTileUrl?: string | null;
}

export interface GisBootstrapPayload {
  tenantId: string;
  villageName: string;
  regionCode?: string | null;
  config: GisTenantConfig;
  activeBoundary: GisVillageBoundary | null;
  visibleBoundaries?: GisVillageBoundary[];
  hasVerifiedBoundary: boolean;
  dataSource: 'database' | 'derived_profile' | 'neutral_fallback';
}


