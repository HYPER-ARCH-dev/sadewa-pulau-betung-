import { STORAGE_MODULES, StorageModuleKey, getStorageArchitectureSummary } from './storageRegistry';

export interface AdminPanelSpec {
  tabId: string;
  label: string;
  category:
    | 'OPERASIONAL UTAMA'
    | 'MODUL TEMATIK DESA'
    | 'INFORMASI & PUBLIKASI'
    | 'DATA MASTER & KELOLA'
    | 'SISTEM & KEAMANAN';
  frontendComponent: string;
  dataSource: string;
  apiEndpoints: string[];
  prismaModels: string[];
  storageModule: StorageModuleKey | null;
  allowedRoles: string[];
}

export const ADMIN_MODULE_REGISTRY: AdminPanelSpec[] = [
  {
    tabId: 'overview',
    label: 'Ikhtisar Ringkas',
    category: 'OPERASIONAL UTAMA',
    frontendComponent: 'AdminDashboard.tsx',
    dataSource: 'DataContext + GET /api/admin/stats',
    apiEndpoints: ['GET /api/admin/stats', 'GET /api/admin/panel-map'],
    prismaModels: ['ServiceRequest', 'Complaint', 'NewsItem', 'DevelopmentProject', 'Resident', 'AuditLog'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa', 'operator']
  },
  {
    tabId: 'analytics',
    label: 'Analisis & Sensus Digital',
    category: 'OPERASIONAL UTAMA',
    frontendComponent: 'AnalyticsDashboard.tsx',
    dataSource: 'useVillageAnalytics + useResidents + DataContext',
    apiEndpoints: ['GET /api/admin/residents', 'GET /api/admin/requests', 'GET /api/admin/land-parcels'],
    prismaModels: ['Resident', 'ServiceRequest', 'UmkmItem', 'LandParcel', 'Dusun'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa', 'operator', 'admin_posyandu']
  },
  {
    tabId: 'services',
    label: 'Buku Arsip & Surat',
    category: 'OPERASIONAL UTAMA',
    frontendComponent: 'LetterArchivesManager.tsx',
    dataSource: 'DataContext (api.getAdminRequests / Deleted)',
    apiEndpoints: [
      'GET /api/admin/requests',
      'PUT /api/admin/requests/:id/status',
      'DELETE /api/admin/requests/:id',
      'POST /api/admin/requests/bulk-delete',
      'GET /api/admin/requests/deleted',
      'POST /api/admin/requests/deleted/:id/restore',
      'DELETE /api/admin/requests/deleted/:id',
      'POST /api/admin/requests/deleted/clear-all'
    ],
    prismaModels: ['ServiceRequest', 'DeletedServiceRequest', 'VillageService'],
    storageModule: 'citizen-letters',
    allowedRoles: ['super_admin', 'admin_desa', 'operator']
  },
  {
    tabId: 'complaints',
    label: 'Aduan Warga',
    category: 'OPERASIONAL UTAMA',
    frontendComponent: 'AdminDashboard.tsx (tab complaints)',
    dataSource: 'DataContext + api.respondComplaint / toggleComplaintVisibility',
    apiEndpoints: [
      'GET /api/admin/complaints',
      'PUT /api/admin/complaints/:id/respond',
      'PUT /api/admin/complaints/:id/visibility'
    ],
    prismaModels: ['Complaint'],
    storageModule: 'complaints',
    allowedRoles: ['super_admin', 'admin_desa', 'operator']
  },
  {
    tabId: 'attendance',
    label: 'Kehadiran Perangkat',
    category: 'OPERASIONAL UTAMA',
    frontendComponent: 'AttendanceLogManager.tsx',
    dataSource: 'api.getAttendanceLogs()',
    apiEndpoints: ['GET /api/admin/attendance/all'],
    prismaModels: ['AttendanceLog', 'VillageOfficial'],
    storageModule: 'attendance-selfie',
    allowedRoles: ['super_admin', 'admin_desa', 'operator']
  },
  {
    tabId: 'bansos',
    label: 'Bantuan Sosial & KPM Desa',
    category: 'MODUL TEMATIK DESA',
    frontendComponent: 'BansosManager.tsx',
    dataSource: 'DataContext + api.getKpmData / addKpm / updateKpm / deleteKpm',
    apiEndpoints: [
      'GET /api/admin/kpm',
      'POST /api/admin/kpm',
      'PUT /api/admin/kpm/:id',
      'DELETE /api/admin/kpm/:id',
      'GET /api/admin/bansos',
      'POST /api/admin/bansos'
    ],
    prismaModels: ['BansosRecipient', 'Resident'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa', 'operator']
  },
  {
    tabId: 'webgis',
    label: 'WebGIS & Peta Spasial (PBB/SPORADIK)',
    category: 'MODUL TEMATIK DESA',
    frontendComponent: 'WebGisManager.tsx',
    dataSource: 'DataContext + api.getLandParcels / addLandParcel / updateLandParcel / deleteLandParcel',
    apiEndpoints: [
      'GET /api/admin/land-parcels',
      'POST /api/admin/land-parcels',
      'PUT /api/admin/land-parcels/:id',
      'DELETE /api/admin/land-parcels/:id'
    ],
    prismaModels: ['LandParcel'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa', 'operator']
  },
  {
    tabId: 'posyandu',
    label: 'ePosyandu & Stunting TPK',
    category: 'MODUL TEMATIK DESA',
    frontendComponent: 'PosyanduManager.tsx',
    dataSource: 'useToddlers + useResidents + api.addToddler / updateToddler / deleteToddler',
    apiEndpoints: [
      'GET /api/admin/toddlers',
      'POST /api/admin/toddlers',
      'PUT /api/admin/toddlers/:id',
      'DELETE /api/admin/toddlers/:id',
      'POST /api/admin/toddlers/measurements'
    ],
    prismaModels: ['ToddlerRecord', 'ToddlerMeasurement', 'PosyanduSchedule'],
    storageModule: 'posyandu-kia',
    allowedRoles: ['super_admin', 'admin_desa', 'operator', 'admin_posyandu']
  },
  {
    tabId: 'apbdes',
    label: 'eTransparansi & Baliho (APBDes & Proyek)',
    category: 'MODUL TEMATIK DESA',
    frontendComponent: 'ApbdesManager.tsx + ProjectsManager.tsx',
    dataSource: 'DataContext + api.getBudgets / updateBudget + api.addProject / updateProject / deleteProject',
    apiEndpoints: [
      'GET /api/admin/budget',
      'PUT /api/admin/budget',
      'POST /api/admin/projects',
      'PUT /api/admin/projects/:id',
      'DELETE /api/admin/projects/:id'
    ],
    prismaModels: ['BudgetYearData', 'DevelopmentProject'],
    storageModule: 'projects',
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'potential',
    label: 'Manajemen Potensi Desa',
    category: 'MODUL TEMATIK DESA',
    frontendComponent: 'PotentialManager.tsx',
    dataSource: 'DataContext + api.addPotential / updatePotential / deletePotential',
    apiEndpoints: [
      'POST /api/admin/potentials',
      'PUT /api/admin/potentials/:id',
      'DELETE /api/admin/potentials/:id'
    ],
    prismaModels: ['VillagePotential'],
    storageModule: 'media-public',
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'news',
    label: 'Manajemen Berita & Warta',
    category: 'INFORMASI & PUBLIKASI',
    frontendComponent: 'NewsManager.tsx',
    dataSource: 'DataContext + api.addNews / updateNews / deleteNews',
    apiEndpoints: [
      'GET /api/admin/news',
      'POST /api/admin/news',
      'PUT /api/admin/news/:id',
      'DELETE /api/admin/news/:id'
    ],
    prismaModels: ['NewsItem'],
    storageModule: 'news',
    allowedRoles: ['super_admin', 'admin_desa', 'operator', 'editor']
  },
  {
    tabId: 'announcements',
    label: 'Pengumuman & Agenda',
    category: 'INFORMASI & PUBLIKASI',
    frontendComponent: 'AnnouncementsManager.tsx',
    dataSource: 'DataContext + api.addAnnouncement / updateAnnouncement / deleteAnnouncement / addAgenda / updateAgenda / deleteAgenda',
    apiEndpoints: [
      'POST /api/admin/announcements',
      'PUT /api/admin/announcements/:id',
      'DELETE /api/admin/announcements/:id',
      'POST /api/admin/agendas',
      'PUT /api/admin/agendas/:id',
      'DELETE /api/admin/agendas/:id'
    ],
    prismaModels: ['Announcement', 'AgendaItem'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa', 'operator', 'editor']
  },
  {
    tabId: 'umkm',
    label: 'Katalog UMKM',
    category: 'INFORMASI & PUBLIKASI',
    frontendComponent: 'UmkmManager.tsx',
    dataSource: 'DataContext + api.addUmkm / updateUmkm / toggleUmkm / deleteUmkm',
    apiEndpoints: [
      'POST /api/admin/umkm',
      'PUT /api/admin/umkm/:id',
      'PUT /api/admin/umkm/:id/verify',
      'DELETE /api/admin/umkm/:id'
    ],
    prismaModels: ['UmkmItem'],
    storageModule: 'media-public',
    allowedRoles: ['super_admin', 'admin_desa', 'operator', 'editor']
  },
  {
    tabId: 'residents',
    label: 'Buku Induk Penduduk (SSOT)',
    category: 'DATA MASTER & KELOLA',
    frontendComponent: 'PopulationManager.tsx',
    dataSource: 'useResidents + api.getResidents / addResident / updateResident / deleteResident / syncResidentProfile',
    apiEndpoints: [
      'GET /api/admin/residents',
      'POST /api/admin/residents',
      'PUT /api/admin/residents/:id',
      'DELETE /api/admin/residents/:id',
      'POST /api/admin/residents/sync-profile'
    ],
    prismaModels: ['Resident', 'Dusun', 'RW', 'RT', 'VillageProfile'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa', 'operator']
  },
  {
    tabId: 'profile',
    label: 'Identitas & Kop Surat',
    category: 'DATA MASTER & KELOLA',
    frontendComponent: 'VillageProfileManager.tsx',
    dataSource: 'DataContext + api.getVillageProfile / updateVillageProfile',
    apiEndpoints: ['GET /api/admin/profile', 'PUT /api/admin/profile'],
    prismaModels: ['VillageProfile'],
    storageModule: 'village-profile',
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'territories',
    label: 'Master Wilayah (Dusun/RW/RT)',
    category: 'DATA MASTER & KELOLA',
    frontendComponent: 'TerritoriesManager.tsx',
    dataSource: 'DataContext + api.getTerritories / updateTerritories',
    apiEndpoints: ['GET /api/admin/territories', 'PUT /api/admin/territories'],
    prismaModels: ['Dusun', 'RW', 'RT'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'officials',
    label: 'Aparatur & RT/Lembaga',
    category: 'DATA MASTER & KELOLA',
    frontendComponent: 'OfficialsManager.tsx',
    dataSource: 'DataContext + api.addOfficial / updateOfficial / deleteOfficial',
    apiEndpoints: [
      'POST /api/admin/officials',
      'PUT /api/admin/officials/:id',
      'DELETE /api/admin/officials/:id'
    ],
    prismaModels: ['VillageOfficial'],
    storageModule: 'officials',
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'facilities',
    label: 'Fasilitas & Peta',
    category: 'DATA MASTER & KELOLA',
    frontendComponent: 'FacilitiesManager.tsx',
    dataSource: 'DataContext + api.addFacility / updateFacility / deleteFacility',
    apiEndpoints: [
      'POST /api/admin/facilities',
      'PUT /api/admin/facilities/:id',
      'DELETE /api/admin/facilities/:id'
    ],
    prismaModels: ['MapFacility'],
    storageModule: 'media-public',
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'users',
    label: 'Manajemen Pengguna',
    category: 'SISTEM & KEAMANAN',
    frontendComponent: 'UserManager.tsx',
    dataSource: 'api.getUsers / createUser / updateUser / deleteUser / changePassword',
    apiEndpoints: [
      'GET /api/admin/users',
      'POST /api/admin/users',
      'PUT /api/admin/users/:id',
      'DELETE /api/admin/users/:id',
      'PUT /api/admin/users/:id/password'
    ],
    prismaModels: ['User'],
    storageModule: null,
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'audit',
    label: 'Log Audit Keamanan & Branding',
    category: 'SISTEM & KEAMANAN',
    frontendComponent: 'AdminDashboard.tsx + MasterResetTool.tsx',
    dataSource: 'api.getAuditLogs + api.updateVillageProfile + api.resetDatabase',
    apiEndpoints: [
      'GET /api/admin/audit-logs',
      'PUT /api/admin/profile',
      'POST /api/admin/reset-data',
      'POST /api/admin/reset-database'
    ],
    prismaModels: ['AuditLog', 'VillageProfile'],
    storageModule: 'village-profile',
    allowedRoles: ['super_admin', 'admin_desa']
  },
  {
    tabId: 'backup',
    label: 'Pemeliharaan & Backup',
    category: 'SISTEM & KEAMANAN',
    frontendComponent: 'BackupManager.tsx',
    dataSource: 'api.getBackups / runBackup / deleteBackup + downloadAuthorizedFile',
    apiEndpoints: [
      'GET /api/admin/maintenance/backups',
      'POST /api/admin/maintenance/backups/run',
      'GET /api/admin/maintenance/backups/download/:filename',
      'DELETE /api/admin/maintenance/backups/:filename',
      'GET /api/admin/storage-map',
      'GET /api/admin/panel-map'
    ],
    prismaModels: ['AuditLog'],
    storageModule: null,
    allowedRoles: ['super_admin']
  }
];

export function getAdminArchitectureMap() {
  const storageSummary = getStorageArchitectureSummary();
  return {
    totalAdminPanels: ADMIN_MODULE_REGISTRY.length,
    databaseEngine: 'Prisma ORM -> PostgreSQL (Supabase schema: sadewa) + Local JSON Fallback',
    panels: ADMIN_MODULE_REGISTRY.map((panel) => ({
      ...panel,
      storageZone: panel.storageModule
        ? {
            module: panel.storageModule,
            visibility: STORAGE_MODULES[panel.storageModule].visibility,
            prefix: `${STORAGE_MODULES[panel.storageModule].visibility}/${STORAGE_MODULES[panel.storageModule].subfolder}/`
          }
        : null
    })),
    storage: storageSummary
  };
}
