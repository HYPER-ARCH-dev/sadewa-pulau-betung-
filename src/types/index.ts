// Definisi tipe data lengkap untuk Sistem Informasi & Pelayanan Desa Pulau Betung

export type RoleType = 'super_admin' | 'admin_desa' | 'operator' | 'editor' | 'admin_posyandu';

export interface User {
  id: string;
  userId?: string;
  name: string;
  username?: string;
  phone?: string;
  email: string;
  role: RoleType;
  roleTitle: string;
  avatar?: string;
  lastLogin?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  birthDate?: string;
  officialId?: string;
  permissions?: any;
}

export type PriorityLevel = 'normal' | 'penting' | 'mendesak';

export type ServiceStatus = 'draft' | 'diajukan' | 'diverifikasi' | 'diproses' | 'perlu_perbaikan' | 'disetujui' | 'selesai' | 'ditolak';

export type ComplaintStatus = 'diterima' | 'diverifikasi' | 'diproses' | 'selesai' | 'ditolak';

export type ProjectStatus = 'perencanaan' | 'proses_lelang' | 'sedang_berjalan' | 'selesai' | 'pemeliharaan';

// Pelayanan Masyarakat
export type LetterCategory = 'CLASS_A' | 'CLASS_B';

export interface VillageService {
  id: string;
  name: string;
  category: 'kependudukan' | 'pertanahan' | 'sosial' | 'usaha' | 'umum' | LetterCategory | string;
  letterClass?: LetterCategory;
  allowDownload?: boolean;
  isMultiPage?: boolean;
  pageCount?: number;
  shortName?: string;
  description: string;
  requirements: string[];
  procedures: string[];
  estimatedDays: string;
  cost: string; // 'Gratis' atau nominal resmi jika ada
  isActive: boolean;
  requiredFields: {
    id: string;
    label: string;
    type: 'text' | 'number' | 'file' | 'textarea' | 'select';
    options?: string[];
    required: boolean;
    helper?: string;
    defaultValue?: string;
  }[];
  /** Template naskah dinas dinamis (Markdown/HTML dengan placeholder {{key}}) */
  templateContent?: string;
}

export interface ServiceRequest {
  id: string;
  trackingCode: string; // Contoh: REQ-PB-2026-001
  serviceId: string;
  serviceName: string;
  // Minimisasi data privasi:
  citizenName: string;
  citizenNik?: string;
  citizenNikMasked: string; // Misal: 150401******0001
  phone: string;
  addressDusun: string; // Dusun / RT di Pulau Betung
  // Data Demografi & Domisili Pemohon
  citizenGender?: 'Laki-laki' | 'Perempuan';
  citizenBirthPlace?: string;
  citizenBirthDate?: string;
  dusunId?: string;
  rwId?: string;
  rtId?: string;
  requestDate: string;
  status: ServiceStatus;
  notes?: string;
  staffNotes?: string;
  processedBy?: string;
  completedAt?: string;
  fileAttachmentName?: string;
  fileAttachmentUrl?: string;
  ktpAttachmentUrl?: string;
  officialLetterNumber?: string;
  formData?: Record<string, unknown>;
  letterheadSnapshot?: LetterheadSnapshot;
}

export interface LetterheadSnapshot {
  villageName: string;
  district: string;
  regency: string;
  province: string;
  postalCode: string;
  addressStreet: string;
  email: string;
  phone: string;
  domain: string;
  villageLogoUrl?: string;
  regencyLogoUrl?: string;
  officialSignatureUrl?: string;
  kadesName?: string;
  kadesNip?: string;
  capturedAt: string;
}

// Log & Audit Penghapusan / Pembatalan Surat
export interface DeletedServiceRequestRecord {
  id: string; // ID unik record log
  requestId: string;
  trackingCode: string; // No Resi (Contoh: REQ-PB-2026-001)
  serviceId?: string;
  serviceName: string; // Jenis Surat
  officialLetterNumber?: string; // No Surat jika sudah ada
  citizenName: string; // Yang mengajukan
  citizenNikMasked: string; // NIK pemohon tersensor
  phone?: string;
  addressDusun?: string;
  requestDate: string;
  lastStatus: ServiceStatus;
  deletedAt: string; // Tanggal & Jam penghapusan
  deletedByUserId?: string;
  deletedByUserName: string; // Nama petugas yang menghapus
  deletedByUserRole: string; // Role petugas (Super Admin, Operator, dll)
  deletionReason: string; // Alasan penghapusan (misal: Uji Coba Sistem, Batal, Dobel)
  fullRequestSnapshot: ServiceRequest; // Snapshot data lengkap untuk opsi Pulihkan (Restore)
}

// Master Struktur Wilayah Hirarki: Dusun -> RW -> RT
export interface RTRecord {
  id: string;
  name: string; // Contoh: "RT 01"
  rwId: string;
  dusunId: string;
  leaderName?: string;
  isActive: boolean;
}

export interface RWRecord {
  id: string;
  name: string; // Contoh: "RW 01"
  dusunId: string;
  leaderName?: string;
  isActive: boolean;
  rts: RTRecord[];
}

export interface DusunRecord {
  id: string;
  number?: number; // Contoh: 1, 2, 3
  customName?: string; // Contoh: "Betung Indah" (opsional)
  name: string; // Dynamic label, Contoh: "Dusun 1" atau "Dusun 1 Betung Indah"
  leaderName?: string;
  isActive: boolean;
  rws: RWRecord[];
}

// Pengaduan & Aspirasi Masyarakat
export interface Complaint {
  id: string;
  ticketNumber: string; // Contoh: ADU-PB-2026-001
  category: 'infrastruktur' | 'pelayanan_desa' | 'sosial_bantuan' | 'lingkungan' | 'ketertiban' | 'lainnya';
  title: string;
  content: string;
  reporterName: string; // Bisa "Warga RT 02" atau nama warga (opsi anonim)
  isAnonymous: boolean;
  reporterContact?: string;
  location: string;
  createdAt: string;
  status: ComplaintStatus;
  adminResponse?: string;
  respondedBy?: string;
  updatedAt?: string;
  // Proof of Work
  fotoBuktiPenyelesaian?: string;
  catatanTindakLanjut?: string;
}

// Berita Desa
export interface NewsComment {
  id: string;
  authorName: string;
  authorNikMasked?: string;
  isVerifiedResident?: boolean;
  content: string;
  createdAt: string;
  likesCount?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string;
  category: 'pemerintahan' | 'pembangunan' | 'kemasyarakatan' | 'budaya' | 'kesehatan' | 'pertanian' | string;
  coverImage: string;
  gallery?: string[];
  author: string;
  publishedAt: string;
  isPublished: boolean;
  views: number;
  tags?: string[];
  likesCount?: number;
  comments?: NewsComment[];
}

// Pengumuman Resmi
export interface Announcement {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  validUntil: string;
  priority: PriorityLevel;
  isActive: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
}

// Agenda Kegiatan
export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  category?: string;
  status: 'akan_datang' | 'berlangsung' | 'selesai' | 'dibatalkan';
}

// Galeri Dokumentasi
export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  category: 'kegiatan' | 'pembangunan' | 'tradisi' | 'wisata' | 'gotong_royong';
  mediaUrl: string;
  mediaType: 'image' | 'video';
  date: string;
  type?: 'image' | 'video';
  url?: string;
}

// Transparansi APBDes
export interface ApbdesItem {
  id: string;
  code?: string; // e.g. "4.1", "5.2"
  category: string; // e.g. "Dana Desa (DDS)", "Bidang Pembangunan Desa"
  source?: string; // e.g. "APBN", "APBD Kab", "PADes"
  targetBudget: number; // Pagu Anggaran (Rp)
  realizedBudget: number; // Realisasi Lapangan (Rp)
  description?: string;
}

export interface BudgetYearData {
  id?: string;
  year: number;
  documentType?: 'murni' | 'perubahan'; // APBDes Murni vs APBDes Perubahan (APBDes-P)
  status?: 'DRAFT' | 'DIPROSES' | 'DISAHKAN_BPD' | 'BERLAKU';
  legalRefNumber?: string; // e.g. "Perdes No. 02 Tahun 2026"
  enactmentDate?: string; // Tanggal Pengesahan oleh Kades & BPD
  totalIncome: number;
  totalIncomeRealized?: number;
  totalExpenditure: number;
  totalExpenditureRealized?: number;
  totalFinancing: number;
  totalFinancingRealized?: number;
  realizationPercentage: number;
  incomeBreakdown: { category: string; amount: number; description: string; realizedAmount?: number }[];
  expenditureBreakdown: { category: string; amount: number; percentage: number; realizedAmount?: number }[];
  incomeItems?: ApbdesItem[];
  expenditureItems?: ApbdesItem[];
  financingItems?: ApbdesItem[];
  publicDocuments: {
    id: string;
    title: string;
    category: string;
    fileSize: string;
    uploadDate: string;
    downloadUrl: string;
  }[];
}

export interface ProjectComment {
  id: string;
  authorName: string;
  authorNikMasked?: string;
  isVerifiedResident?: boolean;
  rtRwLocation?: string;
  content: string;
  createdAt: string;
  type: 'apresiasi' | 'pertanyaan' | 'sanggahan';
  likesCount?: number;
}

// Pembangunan Desa
export interface DevelopmentProject {
  id: string;
  title: string;
  location: string; // Dusun / RT
  fiscalYear: number;
  budget: number;
  fundingSource: 'Dana Desa (DDS)' | 'Alokasi Dana Desa (ADD)' | 'Bagi Hasil Pajak' | 'Swadaya Masyarakat' | 'Bantuan Keuangan Provinsi';
  contractor: string; // Tim Pelaksana Kegiatan (TPK) Desa
  status: ProjectStatus;
  progressPercent: number;
  startDate: string;
  targetEndDate: string;
  description: string;
  beforeImage: string;
  inProgressImage: string;
  completedImage?: string;
  // Anti-Fraud & Verifikasi AI
  isExifVerified?: boolean;
  exifGpsLocation?: string;
  isBpdVerified?: boolean;
  verifiedByBpdName?: string;
  citizenDisputeCount?: number;
  disputeNotes?: string[];
  likesCount?: number;
  comments?: ProjectComment[];
}

// Potensi Desa
export interface VillagePotential {
  id: string;
  name: string;
  category: 'pertanian' | 'perkebunan' | 'perikanan' | 'pariwisata' | 'kerajinan' | 'energi';
  description: string;
  highlightStat: string;
  imageUrl: string;
  keyCommodities: string[];
  keyOpportunities?: string[];
}

// UMKM Masyarakat
export interface UmkmItem {
  id: string;
  name: string;
  ownerName: string;
  category: 'kuliner' | 'kerajinan' | 'hasil_tani' | 'jasa' | 'fashion';
  description: string;
  products: string[];
  imageUrl: string;
  location: string;
  whatsappContact: string;
  phone?: string;
  priceRange?: string;
  isVerified: boolean;
  verified?: boolean;
  price?: string;
  addressDusun?: string;
}

// Profil & Struktur Aparatur
export interface VillageOfficial {
  id: string;
  name: string;
  position: string;
  section: 'kepala_desa' | 'sekretariat' | 'kasi' | 'kaur' | 'kadus' | 'rt_rw' | 'bpd' | 'lpm' | 'karang_taruna' | 'pkk' | 'posyandu' | 'lainnya';
  nip?: string;
  bio: string;
  imageUrl: string;
  tenure: string;
  phone?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  birthDate?: string;
  isActive?: boolean;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  hasAdminAccess?: boolean;
  adminRole?: RoleType;
  adminUsername?: string;
  allowedModules?: string[];
}

// Konfigurasi Identitas & Profil Pemerintahan Desa
export interface VillageProfile {
  id?: string;
  villageName: string;
  district: string;
  regency: string;
  province: string;
  postalCode: string;
  addressStreet?: string;
  email?: string;
  phone?: string;
  website?: string;
  villageLogoUrl?: string;
  regencyLogoUrl?: string;
  letterCodePrefix?: string;
  motto?: string;
  vision?: string;
  mission?: string[];
  history?: string;
  totalPopulation?: number;
  totalFamilies?: number;
  malePopulation?: number;
  femalePopulation?: number;
  areaSqKm?: number;
  borders?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
  // Sambutan & Identitas Kepala Desa Aktif
  kadesName?: string;
  kadesNip?: string;
  kadesPhotoUrl?: string;
  kadesGreetingTitle?: string;
  kadesGreeting?: string;
  bpdName?: string;
  // Scan / Gambar Tanda Tangan Resmi Kades (JPG / PNG / WebP)
  officialSignatureUrl?: string;
  // Master Hero & Beranda
  heroTitle?: string;
  heroSubtitle?: string;
  heroBackgroundUrl?: string;
  heroBadgeText?: string;
  heroIsActive?: boolean;
  // SADEWA System Identity
  sadewaLogoUrl?: string;
  sadewaIconUrl?: string;
  // Master Layanan, Jam Operasional & Kontak Darurat
  whatsappCenter?: string;
  operatingHours?: {
    weekdays?: string;
    friday?: string;
    weekend?: string;
  };
  emergencyContacts?: {
    title: string;
    phone: string;
    desc: string;
  }[];
  lastUpdated?: string;
  updatedBy?: string;
  settings?: Record<string, unknown>;
  officeLocation?: {
    lat?: number;
    lng?: number;
    radius?: number; // in meters, default 50m
  };
}

export interface SporadikFormData {
  mode: 'manual' | 'gps';
  boundaries: {
    direction: string;
    neighbor: string;
    length: string;
    latitude?: string;
    longitude?: string;
  }[];
  landLocation: string;
  landArea: string;
  landSource: string;
}

// Peta Titik Fasilitas
export interface MapFacility {
  id: string;
  name: string;
  category: 'kantor_desa' | 'pendidikan' | 'kesehatan' | 'ibadah' | 'infrastruktur' | 'ekonomi' | 'wisata' | 'olahraga' | 'lainnya';
  address: string;
  dusun: string;
  coordinatesLabel: string;
  description: string;
  coordinates?: [number, number];
  imageUrl?: string;
  contact?: string;
}

// Audit Log Sistem
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  level?: 'info' | 'warning' | 'error' | 'critical';
}

export interface AttendanceLog {
  id: string;
  officialId: string;
  officialName: string;
  type: 'masuk' | 'pulang';
  timestamp: string;
  date: string; // YYYY-MM-DD
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  status: 'hadir' | 'terlambat' | 'pulang_awal' | 'lembur';
  notes?: string;
  deviceId?: string;
  selfieUrl?: string;
}

// UI & View Types
export type PublicViewType =
  | 'beranda'
  | 'profil'
  | 'pemerintahan'
  | 'berita'
  | 'pengumuman'
  | 'layanan'
  | 'bansos'
  | 'pengaduan'
  | 'transparansi'
  | 'pembangunan'
  | 'potensi'
  | 'umkm'
  | 'agenda'
  | 'galeri'
  | 'peta'
  | 'posyandu'
  | 'kontak';

export type AdminViewType =
  | 'admin'
  | 'admin_dashboard'
  | 'admin_services'
  | 'admin_bansos'
  | 'admin_complaints'
  | 'admin_webgis'
  | 'admin_posyandu'
  | 'admin_news'
  | 'admin_announcements'
  | 'admin_agendas'
  | 'admin_gallery'
  | 'admin_development'
  | 'admin_transparency'
  | 'admin_potential'
  | 'admin_umkm'
  | 'admin_government'
  | 'admin_users'
  | 'admin_logs';

export type ViewType = PublicViewType | AdminViewType;

export * from './bansos';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

// Aliases for component convenience
export type NewsArticle = NewsItem & {
  tags?: string[];
};

export type UmkmProduct = UmkmItem & {
  price?: string;
  phone?: string;
  addressDusun?: string;
  verified?: boolean;
};

export type FacilityPoint = MapFacility & {
  imageUrl?: string;
  contact?: string;
  coordinates?: [number, number];
};

