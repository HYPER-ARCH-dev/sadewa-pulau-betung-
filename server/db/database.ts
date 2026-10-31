import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:\[([^\]]+)\]@/, ':$1@');
}
import { hashPassword, generateSalt } from '../auth';
import { executeDualWriteSync } from './sync/syncEngine';
import {
  INITIAL_USERS,
  INITIAL_SERVICES,
  INITIAL_SERVICE_REQUESTS,
  INITIAL_COMPLAINTS,
  INITIAL_NEWS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AGENDAS,
  INITIAL_DEVELOPMENT_PROJECTS as INITIAL_PROJECTS,
  INITIAL_BUDGET,
  INITIAL_OFFICIALS,
  INITIAL_POTENTIALS,
  INITIAL_UMKM,
  INITIAL_FACILITIES,
  INITIAL_GALLERY,
  INITIAL_AUDIT_LOGS
} from '../../src/data/initialData';
import { DusunRecord, RWRecord, RTRecord } from '../../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pulau_betung_db.json');

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: 'super_admin' | 'admin_desa' | 'operator' | 'editor' | 'admin_posyandu';
  roleTitle: string;
  phone: string;
  gender?: 'Laki-laki' | 'Perempuan';
  birthDate?: string;
  isActive: boolean;
  lastLogin?: string;
  officialId?: string;
  permissions?: string[];
  createdAt: string;
  // --- FITUR KEAMANAN: PROTEKSI BRUTE-FORCE ---
  // failedLoginCount: Melacak berapa kali percobaan login gagal berturut-turut.
  failedLoginCount?: number;
  // lockoutUntil: Menyimpan stempel waktu (ISO) sampai kapan akun dikunci jika mencapai ambang batas gagal login.
  lockoutUntil?: string | null;
}

export interface VillageProfileRecord {
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
  vision: string;
  mission: string[];
  history: string;
  totalPopulation: number;
  totalFamilies: number;
  areaSqKm: number;
  borders: {
    north: string;
    south: string;
    east: string;
    west: string;
  };
  officeLocation?: {
    lat: number;
    lng: number;
    radius: number;
  };
  // Sambutan & Identitas Kades
  kadesName?: string;
  kadesNip?: string;
  kadesPhotoUrl?: string;
  kadesGreetingTitle?: string;
  kadesGreeting?: string;
  // Scan / Foto Tanda Tangan Resmi
  officialSignatureUrl?: string;
  // Master Hero & Beranda
  heroTitle?: string;
  heroSubtitle?: string;
  heroBackgroundUrl?: string;
  heroBadgeText?: string;
  heroIsActive?: boolean;
  // SADEWA System Identity
  sadewaLogoUrl?: string;
  // Master Kontak & Jam Operasional
  whatsappCenter?: string;
  operatingHours?: {
    weekdays: string;
    friday: string;
    weekend: string;
  };
  emergencyContacts?: {
    title: string;
    phone: string;
    desc: string;
  }[];
  lastUpdated: string;
  updatedBy?: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  services: any[];
  serviceRequests: any[];
  complaints: any[];
  news: any[];
  announcements: any[];
  agendas: any[];
  developmentProjects: any[];
  budget: any;
  officials: any[];
  potentials: any[];
  umkm: any[];
  facilities: any[];
  gallery: any[];
  auditLogs: any[];
  attendance: any[];
  deletedServiceRequests: any[];
  villageProfile: VillageProfileRecord;
  territories: DusunRecord[];
}

let dbInstance: DatabaseSchema | null = null;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export const INITIAL_VILLAGE_PROFILE: VillageProfileRecord = {
  villageName: 'Desa Pulau Betung',
  district: 'Kecamatan Pemayung',
  regency: 'Kabupaten Batang Hari',
  province: 'Provinsi Jambi',
  postalCode: '36657',
  addressStreet: 'Jalan Lintas Jambi - Muara Bulian KM. 32, Desa Pulau Betung',
  email: 'kontak@pulaubetung.desa.id',
  phone: '0812-7489-0001',
  website: 'pulau-betung.desa.id',
  villageLogoUrl: '',
  regencyLogoUrl: '',
  letterCodePrefix: 'PB-PMY',
  motto: 'Serentak Bak Regam',
  vision: 'Terwujudnya Desa Pulau Betung yang Maju, Mandiri, Agamis, Sejahtera, dan Berkeadilan Berbasis Pertanian dan Kearifan Lokal.',
  mission: [
    'Meningkatkan tata kelola pemerintahan desa yang bersih, transparan, dan akuntabel berbasis digital.',
    'Mendorong optimalisasi produktivitas perkebunan karet, kelapa sawit, dan perikanan air tawar warga.',
    'Meningkatkan mutu pembangunan infrastruktur dasar jalan usaha tani dan fasilitas publik desa.',
    'Memperkuat pelayanan sosial, kesehatan dasar balita dan lansia, serta mutu pendidikan.',
    'Melestarikan nilai adat budaya Melayu Jambi dan kerukunan kehidupan bermasyarakat.'
  ],
  history: 'Desa Pulau Betung merupakan salah satu desa bersejarah di sepanjang aliran Sungai Batang Hari, Kecamatan Pemayung. Nama Pulau Betung diambil dari keberadaan rumpun bambu betung rimbun di tepi tanjung pulau sungai tempat singgah para pedagang dan perahu ketek zaman dahulu.',
  totalPopulation: 1842,
  totalFamilies: 524,
  areaSqKm: 18.5,
  borders: {
    north: 'Sungai Batang Hari / Desa Teluk',
    south: 'Desa Tebing Tinggi',
    east: 'Desa Simpang Kubu Kandang',
    west: 'Desa Kuap'
  },
  officeLocation: {
    lat: -1.5562,
    lng: 103.4475,
    radius: 100
  },
  kadesName: 'H. Sudirman',
  kadesNip: 'NIAP. 19780412 201201 1 004',
  kadesPhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
  kadesGreetingTitle: 'Sambutan Kepala Desa Pulau Betung',
  kadesGreeting: 'Assalamu’alaikum Warahmatullahi Wabarakatuh. Selamat datang di Portal Digital Resmi Desa Pulau Betung, Kecamatan Pemayung, Kabupaten Batang Hari. Website ini kami dedikasikan sebagai wujud nyata komitmen transparansi tata kelola anggaran, kemudahan akses administrasi surat-menyurat tanpa perantara, serta media aspirasi yang transparan bagi segenap warga desa dan perantau.',
  officialSignatureUrl: '',
  heroTitle: 'Portal Resmi Desa Pulau Betung',
  heroSubtitle: 'Kecamatan Pemayung, Kabupaten Batang Hari, Provinsi Jambi — Melayani dengan Integritas, Transparansi APBDes, dan Akses Pelayanan Publik Digital Bebas Pungli.',
  heroBackgroundUrl: '',
  heroBadgeText: 'Portal Pelayanan Publik Desa Mandiri',
  heroIsActive: true,
  sadewaLogoUrl: '',
  whatsappCenter: '0821-7654-3210',
  operatingHours: {
    weekdays: '08.00 - 15.00 WIB',
    friday: '08.00 - 11.30 WIB',
    weekend: 'Libur Pelayanan Tatap Muka (Layanan Surat Online Tetap Buka 24 Jam)'
  },
  emergencyContacts: [
    { title: 'Bhabinkamtibmas Polsek Pemayung (Aipda M. Nasir)', phone: '0812-7890-1122', desc: 'Keamanan, ketertiban umum, dan tindak pidana' },
    { title: 'Babinsa Koramil 0415-04/Pemayung (Sertu Hendra)', phone: '0813-6655-4433', desc: 'Kesiapsiagaan bencana & teritorial kewilayahan' },
    { title: 'UGD Puskesmas Pemayung (Ambulans Desa)', phone: '0852-6611-9988', desc: 'Pelayanan gawat darurat medis & rujukan bersalin' },
    { title: 'Pemadam Kebakaran Kab. Batang Hari', phone: '0743-21113', desc: 'Penanganan kebakaran pemukiman & lahan' }
  ],
  lastUpdated: new Date().toISOString()
};

export const INITIAL_TERRITORIES: DusunRecord[] = [
  {
    id: 'dus-1',
    name: 'Dusun Betung Indah',
    leaderName: 'M. Yusuf (Kepala Dusun)',
    isActive: true,
    rws: [
      {
        id: 'rw-1',
        name: 'RW 01',
        dusunId: 'dus-1',
        leaderName: 'H. Bakar',
        isActive: true,
        rts: [
          { id: 'rt-1', name: 'RT 01', rwId: 'rw-1', dusunId: 'dus-1', leaderName: 'Usman', isActive: true },
          { id: 'rt-2', name: 'RT 02', rwId: 'rw-1', dusunId: 'dus-1', leaderName: 'Herman', isActive: true },
          { id: 'rt-3', name: 'RT 03', rwId: 'rw-1', dusunId: 'dus-1', leaderName: 'Marzuki', isActive: true }
        ]
      }
    ]
  },
  {
    id: 'dus-2',
    name: 'Dusun Teluk Melintang',
    leaderName: 'Zulkifli (Kepala Dusun)',
    isActive: true,
    rws: [
      {
        id: 'rw-2',
        name: 'RW 02',
        dusunId: 'dus-2',
        leaderName: 'Samsuri',
        isActive: true,
        rts: [
          { id: 'rt-4', name: 'RT 04', rwId: 'rw-2', dusunId: 'dus-2', leaderName: 'Samsul', isActive: true },
          { id: 'rt-5', name: 'RT 05', rwId: 'rw-2', dusunId: 'dus-2', leaderName: 'Rusli', isActive: true },
          { id: 'rt-6', name: 'RT 06', rwId: 'rw-2', dusunId: 'dus-2', leaderName: 'Baharudin', isActive: true }
        ]
      }
    ]
  }
];

export function seedInitialData(): DatabaseSchema {
  // FIX 1: Ambil password seed dari env SEED_DEFAULT_PASSWORD, atau buat acak
  let defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
  let isGenerated = false;
  
  if (!defaultPassword) {
    defaultPassword = crypto.randomBytes(6).toString('hex'); // 12 chars hex
    isGenerated = true;
  }

  if (isGenerated) {
    console.log('--------------------------------------------------');
    console.log('🛡️ SECURITY: Generated random seed password:', defaultPassword);
    console.log('--------------------------------------------------');
  }

  // Create default password hash for initial users
  const seededUsers: UserRecord[] = INITIAL_USERS.map((u) => {
    const salt = generateSalt();
    const passwordHash = hashPassword(defaultPassword!, salt);
    return {
      id: u.id,
      name: u.name,
      username: u.username || u.email.split('@')[0],
      email: u.email,
      passwordHash,
      salt,
      role: u.role,
      roleTitle: u.roleTitle,
      phone: u.phone || '',
      isActive: true,
      createdAt: new Date().toISOString()
    };
  });

  const initialDb: DatabaseSchema = {
    users: seededUsers,
    services: JSON.parse(JSON.stringify(INITIAL_SERVICES)),
    serviceRequests: JSON.parse(JSON.stringify(INITIAL_SERVICE_REQUESTS)),
    complaints: JSON.parse(JSON.stringify(INITIAL_COMPLAINTS)),
    news: JSON.parse(JSON.stringify(INITIAL_NEWS)),
    announcements: JSON.parse(JSON.stringify(INITIAL_ANNOUNCEMENTS)),
    agendas: JSON.parse(JSON.stringify(INITIAL_AGENDAS)),
    developmentProjects: JSON.parse(JSON.stringify(INITIAL_PROJECTS)),
    budget: JSON.parse(JSON.stringify(INITIAL_BUDGET)),
    officials: JSON.parse(JSON.stringify(INITIAL_OFFICIALS)),
    potentials: JSON.parse(JSON.stringify(INITIAL_POTENTIALS)),
    umkm: JSON.parse(JSON.stringify(INITIAL_UMKM)),
    facilities: JSON.parse(JSON.stringify(INITIAL_FACILITIES)),
    gallery: JSON.parse(JSON.stringify(INITIAL_GALLERY)),
    auditLogs: JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS)),
    attendance: [],
    deletedServiceRequests: [],
    villageProfile: JSON.parse(JSON.stringify(INITIAL_VILLAGE_PROFILE)),
    territories: JSON.parse(JSON.stringify(INITIAL_TERRITORIES))
  };

  return initialDb;
}

export function getDb(): DatabaseSchema {
  if (dbInstance) {
    return dbInstance;
  }

  ensureDataDirectory();

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbInstance = JSON.parse(raw);

      // Auto-migrate: ensure any newly added default services are present in the database
      let hasUpdates = false;
      if (Array.isArray(dbInstance!.services)) {
        const existingServiceIds = new Set(dbInstance!.services.map((s: any) => s.id));
        INITIAL_SERVICES.forEach((is) => {
          if (!existingServiceIds.has(is.id)) {
            dbInstance!.services.push(JSON.parse(JSON.stringify(is)));
            hasUpdates = true;
          }
        });
      } else {
        dbInstance!.services = JSON.parse(JSON.stringify(INITIAL_SERVICES));
        hasUpdates = true;
      }

      // Auto-migrate: ensure initial sample requests for new services are present
      if (Array.isArray(dbInstance!.serviceRequests)) {
        const existingReqIds = new Set(dbInstance!.serviceRequests.map((r: any) => r.id));
        INITIAL_SERVICE_REQUESTS.forEach((ir) => {
          if (!existingReqIds.has(ir.id)) {
            dbInstance!.serviceRequests.push(JSON.parse(JSON.stringify(ir)));
            hasUpdates = true;
          }
        });
      }

      // Auto-migrate: ensure attendance table exists
      if (!dbInstance!.attendance) {
        dbInstance!.attendance = [];
        hasUpdates = true;
      }

      // Auto-migrate: ensure deletedServiceRequests table exists
      if (!dbInstance!.deletedServiceRequests || !Array.isArray(dbInstance!.deletedServiceRequests)) {
        dbInstance!.deletedServiceRequests = [];
        hasUpdates = true;
      }

      // Auto-migrate: ensure villageProfile has all standard identity and kop fields
      if (!dbInstance!.villageProfile) {
        dbInstance!.villageProfile = JSON.parse(JSON.stringify(INITIAL_VILLAGE_PROFILE));
        hasUpdates = true;
      } else {
        const vp = dbInstance!.villageProfile;
        if (!vp.addressStreet) { vp.addressStreet = 'Jalan Lintas Jambi - Muara Bulian KM. 32, Desa Pulau Betung'; hasUpdates = true; }
        if (!vp.email) { vp.email = 'kontak@pulaubetung.desa.id'; hasUpdates = true; }
        if (!vp.phone) { vp.phone = '0812-7489-0001'; hasUpdates = true; }
        if (!vp.website) { vp.website = 'pulau-betung.desa.id'; hasUpdates = true; }
        if (vp.villageLogoUrl === undefined) { vp.villageLogoUrl = ''; hasUpdates = true; }
        if (vp.regencyLogoUrl === undefined) { vp.regencyLogoUrl = ''; hasUpdates = true; }
        if (!vp.letterCodePrefix) { vp.letterCodePrefix = 'PB-PMY'; hasUpdates = true; }
        if (!vp.motto) { vp.motto = 'Serentak Bak Regam'; hasUpdates = true; }
        if (vp.kadesName === undefined) { vp.kadesName = INITIAL_VILLAGE_PROFILE.kadesName; hasUpdates = true; }
        if (vp.kadesNip === undefined) { vp.kadesNip = INITIAL_VILLAGE_PROFILE.kadesNip; hasUpdates = true; }
        if (vp.kadesPhotoUrl === undefined) { vp.kadesPhotoUrl = INITIAL_VILLAGE_PROFILE.kadesPhotoUrl; hasUpdates = true; }
        if (vp.kadesGreetingTitle === undefined) { vp.kadesGreetingTitle = INITIAL_VILLAGE_PROFILE.kadesGreetingTitle; hasUpdates = true; }
        if (vp.kadesGreeting === undefined) { vp.kadesGreeting = INITIAL_VILLAGE_PROFILE.kadesGreeting; hasUpdates = true; }
        if (vp.officialSignatureUrl === undefined) { vp.officialSignatureUrl = ''; hasUpdates = true; }
        if (vp.heroTitle === undefined) { vp.heroTitle = INITIAL_VILLAGE_PROFILE.heroTitle; hasUpdates = true; }
        if (vp.heroSubtitle === undefined) { vp.heroSubtitle = INITIAL_VILLAGE_PROFILE.heroSubtitle; hasUpdates = true; }
        if (vp.heroBackgroundUrl === undefined) { vp.heroBackgroundUrl = ''; hasUpdates = true; }
        if (vp.heroBadgeText === undefined) { vp.heroBadgeText = INITIAL_VILLAGE_PROFILE.heroBadgeText; hasUpdates = true; }
        if (vp.heroIsActive === undefined) { vp.heroIsActive = true; hasUpdates = true; }
        if (vp.whatsappCenter === undefined) { vp.whatsappCenter = INITIAL_VILLAGE_PROFILE.whatsappCenter; hasUpdates = true; }
        if (!vp.operatingHours) { vp.operatingHours = INITIAL_VILLAGE_PROFILE.operatingHours; hasUpdates = true; }
        if (!vp.emergencyContacts || !Array.isArray(vp.emergencyContacts)) { vp.emergencyContacts = INITIAL_VILLAGE_PROFILE.emergencyContacts; hasUpdates = true; }
      }

      // Auto-migrate: ensure territories (Dusun -> RW -> RT) exist
      if (!dbInstance!.territories || !Array.isArray(dbInstance!.territories) || dbInstance!.territories.length === 0) {
        dbInstance!.territories = JSON.parse(JSON.stringify(INITIAL_TERRITORIES));
        hasUpdates = true;
      }

      // Auto-migrate: ensure officials have isActive and displayOrder
      if (Array.isArray(dbInstance!.officials)) {
        dbInstance!.officials.forEach((off: any, idx: number) => {
          if (off.isActive === undefined) {
            off.isActive = true;
            hasUpdates = true;
          }
          if (off.displayOrder === undefined) {
            off.displayOrder = idx + 1;
            hasUpdates = true;
          }
        });
      }

      if (hasUpdates) {
        saveDb(dbInstance!);
      }

      return dbInstance!;
    } catch (err) {
      console.error('Gagal membaca pulau_betung_db.json, memulihkan ke seed database:', err);
    }
  }

  // If not exists or invalid, initialize and save
  dbInstance = seedInitialData();
  saveDb(dbInstance);
  return dbInstance;
}

let syncDebounceTimer: NodeJS.Timeout | null = null;

export function saveDb(db: DatabaseSchema): void {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ CRITICAL WARNING: Using ephemeral JSON file storage in production. Data WILL BE LOST on container restart!');
  }
  ensureDataDirectory();
  dbInstance = db;
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);

  // Dual-Write / Sync ke Supabase jika dalam PHASE_2_DUAL_WRITE atau PHASE_3_SUPABASE_ONLY
  if (process.env.MIGRATION_PHASE === 'PHASE_2_DUAL_WRITE' || process.env.MIGRATION_PHASE === 'PHASE_3_SUPABASE_ONLY') {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      executeDualWriteSync(db).catch((err) => {
        console.error('⚠️ [SYNC] Unhandled background sync error:', err);
      });
    }, 1000);
  }
}

// Helper to record audit log
export function recordAuditLog(
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  module: string,
  details: string,
  ipAddress: string = '127.0.0.1'
) {
  const db = getDb();
  const newLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userName,
    userRole,
    action,
    module,
    details,
    ipAddress
  };
  db.auditLogs.unshift(newLog);
  // Keep last 500 logs
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDb(db);
  return newLog;
}

// ============================================================================
// DATABASE ADAPTER ABSTRACTION (PREPARATION FOR CLOUD SQL / POSTGRESQL)
// ============================================================================

export interface IDatabaseAdapter {
  getDb(): Promise<DatabaseSchema>;
  saveDb(db: DatabaseSchema): Promise<void>;
  
  // Future CRUD Methods to replace direct array mutations:
  // findUserByUsername(username: string): Promise<UserRecord | undefined>;
  // updateServiceRequest(id: string, update: Partial<any>): Promise<boolean>;
  // ...
}

export class JsonFileDatabaseAdapter implements IDatabaseAdapter {
  async getDb(): Promise<DatabaseSchema> {
    return getDb(); // Wraps existing sync function
  }
  
  async saveDb(db: DatabaseSchema): Promise<void> {
    saveDb(db); // Wraps existing sync function
  }
}

export class PostgresPrismaAdapter implements IDatabaseAdapter {
  private fallback = new JsonFileDatabaseAdapter();

  async getDb(): Promise<DatabaseSchema> {
    if (!process.env.DATABASE_URL) {
      return this.fallback.getDb();
    }

    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        const [
          users,
          services,
          serviceRequests,
          complaints,
          news,
          announcements,
          agendas,
          developmentProjects,
          budget,
          officials,
          potentials,
          umkm,
          facilities,
          gallery,
          auditLogs,
          attendance,
          villageProfile,
          territories
        ] = await Promise.all([
          prisma.user.findMany(),
          prisma.villageService.findMany(),
          prisma.serviceRequest.findMany(),
          prisma.complaint.findMany(),
          prisma.newsItem.findMany(),
          prisma.announcement.findMany(),
          prisma.agendaItem.findMany(),
          prisma.developmentProject.findMany(),
          prisma.budgetYearData.findFirst({ where: { year: 2026 } }),
          prisma.villageOfficial.findMany(),
          prisma.villagePotential.findMany(),
          prisma.umkmItem.findMany(),
          prisma.mapFacility.findMany(),
          prisma.galleryItem.findMany(),
          prisma.auditLog.findMany({ take: 500, orderBy: { timestamp: 'desc' } }),
          prisma.attendanceLog.findMany(),
          prisma.villageProfile.findUnique({ where: { id: 'default' } }),
          prisma.dusun.findMany({ include: { rws: { include: { rts: true } } } })
        ]);

        await prisma.$disconnect();

        if (users.length === 0 && !villageProfile) {
          console.log('📦 PostgreSQL tables empty. Returning JSON database fallback...');
          return this.fallback.getDb();
        }

        return {
          users: users.map((u: any) => ({
            id: u.id,
            name: u.name,
            username: u.username,
            email: u.email,
            passwordHash: u.passwordHash,
            salt: u.salt,
            role: u.role as any,
            roleTitle: u.roleTitle,
            phone: u.phone || '',
            gender: (u.gender as any) || undefined,
            birthDate: u.birthDate || undefined,
            isActive: u.isActive,
            officialId: u.officialId || undefined,
            permissions: (u.permissions as string[]) || undefined,
            lastLogin: u.lastLogin ? u.lastLogin.toISOString() : undefined,
            createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString()
          })),
          services: services.map((s: any) => ({
            id: s.id,
            name: s.name,
            category: s.category as any,
            letterClass: (s.letterClass as any) || undefined,
            allowDownload: s.allowDownload,
            isMultiPage: s.isMultiPage,
            pageCount: s.pageCount,
            shortName: s.shortName || undefined,
            description: s.description,
            requirements: (s.requirements as string[]) || [],
            procedures: (s.procedures as string[]) || [],
            estimatedDays: s.estimatedDays,
            cost: s.cost,
            isActive: s.isActive,
            requiredFields: (s.requiredFields as any[]) || []
          })),
          serviceRequests: serviceRequests.map((r: any) => ({
            id: r.id,
            trackingCode: r.trackingCode,
            serviceId: r.serviceId,
            serviceName: r.serviceName,
            citizenName: r.citizenName,
            citizenNik: r.citizenNik || undefined,
            citizenNikMasked: r.citizenNikMasked,
            phone: r.phone,
            addressDusun: r.addressDusun,
            citizenGender: (r.citizenGender as any) || undefined,
            citizenBirthPlace: r.citizenBirthPlace || undefined,
            citizenBirthDate: r.citizenBirthDate || undefined,
            dusunId: r.dusunId || undefined,
            rwId: r.rwId || undefined,
            rtId: r.rtId || undefined,
            requestDate: r.requestDate ? r.requestDate.toISOString() : new Date().toISOString(),
            status: r.status as any,
            notes: r.notes || undefined,
            staffNotes: r.staffNotes || undefined,
            processedBy: r.processedBy || undefined,
            completedAt: r.completedAt ? r.completedAt.toISOString() : undefined,
            fileAttachmentName: r.fileAttachmentName || undefined,
            fileAttachmentUrl: r.fileAttachmentUrl || undefined,
            ktpAttachmentUrl: r.ktpAttachmentUrl || undefined,
            officialLetterNumber: r.officialLetterNumber || undefined,
            formData: (r.formData as any) || {},
            letterheadSnapshot: (r.letterheadSnapshot as any) || undefined
          })),
          complaints: complaints.map((c: any) => ({
            id: c.id,
            ticketNumber: c.ticketNumber,
            category: c.category as any,
            title: c.title,
            content: c.content,
            reporterName: c.reporterName,
            isAnonymous: c.isAnonymous,
            reporterContact: c.reporterContact || undefined,
            location: c.location,
            createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
            status: c.status as any,
            adminResponse: c.adminResponse || undefined,
            respondedBy: c.respondedBy || undefined,
            updatedAt: c.updatedAt ? c.updatedAt.toISOString() : undefined,
            fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian || undefined,
            catatanTindakLanjut: c.catatanTindakLanjut || undefined
          })),
          news: news.map((n: any) => ({
            id: n.id,
            title: n.title,
            slug: n.slug,
            content: n.content,
            summary: n.summary,
            category: n.category as any,
            coverImage: n.coverImage,
            gallery: (n.gallery as string[]) || [],
            author: n.author,
            publishedAt: n.publishedAt ? n.publishedAt.toISOString() : new Date().toISOString(),
            isPublished: n.isPublished,
            views: n.views
          })),
          announcements: announcements.map((a: any) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            publishedAt: a.publishedAt ? a.publishedAt.toISOString() : new Date().toISOString(),
            validUntil: a.validUntil ? a.validUntil.toISOString() : new Date().toISOString(),
            priority: a.priority as any,
            isActive: a.isActive,
            attachmentUrl: a.attachmentUrl || undefined,
            attachmentName: a.attachmentName || undefined
          })),
          agendas: agendas.map((ag: any) => ({
            id: ag.id,
            title: ag.title,
            description: ag.description,
            date: ag.date ? ag.date.toISOString() : new Date().toISOString(),
            time: ag.time,
            location: ag.location,
            organizer: ag.organizer,
            category: ag.category || undefined,
            status: ag.status as any
          })),
          developmentProjects: developmentProjects.map((p: any) => ({
            id: p.id,
            title: p.title,
            location: p.location,
            fiscalYear: p.fiscalYear,
            budget: p.budget,
            fundingSource: p.fundingSource as any,
            contractor: p.contractor,
            status: p.status as any,
            progressPercent: p.progressPercent,
            startDate: p.startDate ? p.startDate.toISOString() : new Date().toISOString(),
            targetEndDate: p.targetEndDate ? p.targetEndDate.toISOString() : new Date().toISOString(),
            description: p.description,
            beforeImage: p.beforeImage,
            inProgressImage: p.inProgressImage,
            completedImage: p.completedImage || undefined
          })),
          budget: budget ? {
            id: budget.id,
            year: budget.year,
            documentType: (budget.documentType as any) || 'murni',
            status: (budget.status as any) || 'BERLAKU',
            legalRefNumber: budget.legalRefNumber || undefined,
            enactmentDate: budget.enactmentDate ? budget.enactmentDate.toISOString() : undefined,
            totalIncome: budget.totalIncome,
            totalIncomeRealized: budget.totalIncomeRealized,
            totalExpenditure: budget.totalExpenditure,
            totalExpenditureRealized: budget.totalExpenditureRealized,
            totalFinancing: budget.totalFinancing,
            totalFinancingRealized: budget.totalFinancingRealized,
            realizationPercentage: budget.realizationPercentage,
            incomeBreakdown: (budget.incomeBreakdown as any) || [],
            expenditureBreakdown: (budget.expenditureBreakdown as any) || [],
            incomeItems: (budget.incomeItems as any) || [],
            expenditureItems: (budget.expenditureItems as any) || [],
            financingItems: (budget.financingItems as any) || [],
            publicDocuments: (budget.publicDocuments as any) || []
          } : (this.fallback.getDb() as any).budget,
          officials: officials.map((off: any) => ({
            id: off.id,
            name: off.name,
            position: off.position,
            section: off.section as any,
            nip: off.nip || undefined,
            bio: off.bio,
            imageUrl: off.imageUrl,
            tenure: off.tenure,
            phone: off.phone || undefined,
            gender: (off.gender as any) || undefined,
            birthDate: off.birthDate || undefined,
            isActive: off.isActive,
            displayOrder: off.displayOrder,
            hasAdminAccess: off.hasAdminAccess,
            adminRole: (off.adminRole as any) || undefined,
            adminUsername: off.adminUsername || undefined,
            allowedModules: (off.allowedModules as string[]) || undefined
          })),
          potentials: potentials.map((pot: any) => ({
            id: pot.id,
            name: pot.name,
            category: pot.category as any,
            description: pot.description,
            highlightStat: pot.highlightStat,
            imageUrl: pot.imageUrl,
            keyCommodities: (pot.keyCommodities as string[]) || [],
            keyOpportunities: (pot.keyOpportunities as string[]) || undefined
          })),
          umkm: umkm.map((u: any) => ({
            id: u.id,
            name: u.name,
            ownerName: u.ownerName,
            category: u.category as any,
            description: u.description,
            products: (u.products as string[]) || [],
            imageUrl: u.imageUrl,
            location: u.location,
            whatsappContact: u.whatsappContact,
            phone: u.phone || undefined,
            priceRange: u.priceRange || undefined,
            isVerified: u.isVerified,
            verified: u.isVerified
          })),
          facilities: facilities.map((fac: any) => ({
            id: fac.id,
            name: fac.name,
            category: fac.category as any,
            address: fac.address,
            dusun: fac.dusun,
            coordinatesLabel: fac.coordinatesLabel,
            description: fac.description,
            coordinates: (fac.coordinates as [number, number]) || [0, 0],
            imageUrl: fac.imageUrl || undefined,
            contact: fac.contact || undefined
          })),
          gallery: gallery.map((gal: any) => ({
            id: gal.id,
            title: gal.title,
            description: gal.description,
            category: gal.category as any,
            mediaUrl: gal.mediaUrl,
            mediaType: gal.mediaType as any,
            date: gal.date ? gal.date.toISOString() : new Date().toISOString(),
            type: gal.mediaType as any,
            url: gal.mediaUrl
          })),
          auditLogs: auditLogs.map((l: any) => ({
            id: l.id,
            userId: l.userId,
            userName: l.userName,
            userRole: l.userRole,
            action: l.action,
            module: l.module,
            details: l.details,
            timestamp: l.timestamp ? l.timestamp.toISOString() : new Date().toISOString(),
            ipAddress: l.ipAddress,
            level: (l.level as any) || 'info'
          })),
          attendance: attendance.map((at: any) => ({
            id: at.id,
            officialId: at.officialId,
            officialName: at.officialName,
            type: at.type as any,
            timestamp: at.timestamp ? at.timestamp.toISOString() : new Date().toISOString(),
            date: at.date,
            location: (at.location as any) || undefined,
            status: at.status as any,
            notes: at.notes || undefined,
            deviceId: at.deviceId || undefined,
            selfieUrl: at.selfieUrl || undefined
          })),
          deletedServiceRequests: [],
          villageProfile: villageProfile ? {
            villageName: villageProfile.villageName,
            district: villageProfile.district,
            regency: villageProfile.regency,
            province: villageProfile.province,
            postalCode: villageProfile.postalCode,
            addressStreet: villageProfile.addressStreet || undefined,
            email: villageProfile.email || undefined,
            phone: villageProfile.phone || undefined,
            website: villageProfile.website || undefined,
            villageLogoUrl: villageProfile.villageLogoUrl || undefined,
            regencyLogoUrl: villageProfile.regencyLogoUrl || undefined,
            letterCodePrefix: villageProfile.letterCodePrefix || undefined,
            motto: villageProfile.motto || undefined,
            vision: villageProfile.vision,
            mission: (villageProfile.mission as string[]) || [],
            history: villageProfile.history,
            totalPopulation: villageProfile.totalPopulation,
            totalFamilies: villageProfile.totalFamilies,
            areaSqKm: villageProfile.areaSqKm,
            borders: (villageProfile.borders as any) || {},
            officeLocation: (villageProfile.officeLocation as any) || undefined,
            kadesName: villageProfile.kadesName || undefined,
            kadesNip: villageProfile.kadesNip || undefined,
            kadesPhotoUrl: villageProfile.kadesPhotoUrl || undefined,
            kadesGreetingTitle: villageProfile.kadesGreetingTitle || undefined,
            kadesGreeting: villageProfile.kadesGreeting || undefined,
            officialSignatureUrl: villageProfile.officialSignatureUrl || undefined,
            heroTitle: villageProfile.heroTitle || undefined,
            heroSubtitle: villageProfile.heroSubtitle || undefined,
            heroBackgroundUrl: villageProfile.heroBackgroundUrl || undefined,
            heroBadgeText: villageProfile.heroBadgeText || undefined,
            heroIsActive: villageProfile.heroIsActive,
            sadewaLogoUrl: villageProfile.sadewaLogoUrl || undefined,
            whatsappCenter: villageProfile.whatsappCenter || undefined,
            operatingHours: (villageProfile.operatingHours as any) || undefined,
            emergencyContacts: (villageProfile.emergencyContacts as any) || undefined,
            lastUpdated: villageProfile.lastUpdated ? villageProfile.lastUpdated.toISOString() : new Date().toISOString(),
            updatedBy: villageProfile.updatedBy || undefined
          } : INITIAL_VILLAGE_PROFILE,
          territories: territories.map((d: any) => ({
            id: d.id,
            number: d.number || undefined,
            customName: d.customName || undefined,
            name: d.name,
            leaderName: d.leaderName || undefined,
            isActive: d.isActive,
            rws: d.rws.map((rw: any) => ({
              id: rw.id,
              name: rw.name,
              dusunId: rw.dusunId,
              leaderName: rw.leaderName || undefined,
              isActive: rw.isActive,
              rts: rw.rts.map((rt: any) => ({
                id: rt.id,
                name: rt.name,
                rwId: rt.rwId,
                dusunId: rt.dusunId,
                leaderName: rt.leaderName || undefined,
                isActive: rt.isActive
              }))
            }))
          }))
        };
      } catch (dbErr) {
        await prisma.$disconnect();
        console.warn('⚠️ Prisma query failed, falling back to JSON storage:', dbErr);
        return this.fallback.getDb();
      }
    } catch (err) {
      console.warn('⚠️ Unable to connect to PostgreSQL Prisma adapter, falling back to JSON:', err);
      return this.fallback.getDb();
    }
  }

  async saveDb(db: DatabaseSchema): Promise<void> {
    await this.fallback.saveDb(db);
  }
}

// Determine active adapter. 
// Once migrated, all route handlers will use `activeDatabase` instead of `getDb()` directly.
export const activeDatabase: IDatabaseAdapter = process.env.DATABASE_URL 
  ? new PostgresPrismaAdapter() 
  : new JsonFileDatabaseAdapter();

