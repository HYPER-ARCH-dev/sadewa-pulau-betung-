import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  ProjectComment,
  VillagePotential,
  UmkmItem,
  VillageOfficial,
  MapFacility,
  AuditLog,
  ServiceStatus,
  ComplaintStatus,
  VillageProfile,
  DusunRecord,
  RoleType,
  DeletedServiceRequestRecord,
  BansosRecipient,
  BansosComplaint,
  BansosStatus
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_SERVICES,
  INITIAL_SERVICE_REQUESTS,
  INITIAL_COMPLAINTS,
  INITIAL_NEWS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AGENDAS,
  INITIAL_GALLERY,
  INITIAL_BUDGET,
  INITIAL_BUDGET_HISTORY,
  INITIAL_DEVELOPMENT_PROJECTS,
  INITIAL_POTENTIALS,
  INITIAL_UMKM,
  INITIAL_OFFICIALS,
  INITIAL_FACILITIES,
  INITIAL_AUDIT_LOGS,
  INITIAL_TERRITORIES
} from '../data/initialData';
import {
  INITIAL_BANSOS_RECIPIENTS,
  INITIAL_BANSOS_COMPLAINTS
} from '../data/bansosData';
import { normalizeTerritories } from '../utils/territory';
import { api } from '../services/api';
import { generateOfficialLetterNumber } from '../utils/letterNumbering';
import { VILLAGE_INFO } from '../constants/village';
import { LandParcel, LandUseCategory } from '../types/webgis';
import { INITIAL_LAND_PARCELS } from '../data/initialWebGisData';
import { calculatePolygonAreaShoelace } from '../utils/geometryEngine';
import { useQueryClient } from '@tanstack/react-query';
import { useServiceRequests } from '../hooks/useServiceRequests';

const LOCAL_STORAGE_PREFIX = 'pulau_betung_';

function loadStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveStored<T>(key: string, data: T) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {}
}

/**
 * Helper robust generator ID untuk mencegah duplikasi key di React (FIX 8)
 * Menggabungkan timestamp dengan random string 7 karakter.
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface DataContextType {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  users: User[];
  services: VillageService[];
  serviceRequests: ServiceRequest[];
  setServiceRequests: React.Dispatch<React.SetStateAction<ServiceRequest[]>>;
  deletedRequests: DeletedServiceRequestRecord[];
  complaints: Complaint[];
  news: NewsItem[];
  announcements: Announcement[];
  agendas: AgendaItem[];
  gallery: GalleryItem[];
  budget: BudgetYearData;
  budgetHistory: BudgetYearData[];
  developmentProjects: DevelopmentProject[];
  potentials: VillagePotential[];
  umkm: UmkmItem[];
  officials: VillageOfficial[];
  facilities: MapFacility[];
  auditLogs: AuditLog[];
  villageProfile: VillageProfile;
  territories: DusunRecord[];
  webGisData: LandParcel[];
  setWebGisData: React.Dispatch<React.SetStateAction<LandParcel[]>>;
  bansosRecipients: BansosRecipient[];
  bansosComplaints: BansosComplaint[];
  userLikedItems: string[];
  isItemLiked: (id: string) => boolean;
  
  // Actions
  reloadServerData: () => Promise<void>;
  updateBudget: (data: BudgetYearData) => void;
  submitServiceRequest: (data: Omit<ServiceRequest, 'id' | 'trackingCode' | 'requestDate' | 'status'>) => string;
  updateServiceRequestStatus: (id: string, status: ServiceStatus, staffNotes: string) => void;
  deleteServiceRequest: (id: string, reason?: string) => void;
  bulkDeleteServiceRequests: (ids: string[], reason?: string) => void;
  restoreDeletedServiceRequest: (id: string) => Promise<boolean>;
  findRequestByCode: (code: string) => Promise<ServiceRequest | null>;
  permanentlyDeleteServiceRequestLog: (id: string) => Promise<boolean>;
  clearAllDeletedServiceRequests: () => Promise<boolean>;
  submitComplaint: (data: Omit<Complaint, 'id' | 'ticketNumber' | 'createdAt' | 'status'>) => string;
  respondToComplaint: (id: string, status: ComplaintStatus, adminResponse: string, fotoBuktiPenyelesaian?: string, catatanTindakLanjut?: string) => void;
  updateVillageProfile: (profile: Partial<VillageProfile>) => Promise<void>;
  updateTerritories: (territories: DusunRecord[]) => Promise<void>;
  addBansosRecipient: (item: Omit<BansosRecipient, 'id' | 'createdAt'>) => void;
  bulkAddBansosRecipients: (items: Omit<BansosRecipient, 'id' | 'createdAt'>[]) => Promise<number>;
  replaceBansosRecipients: (items: Omit<BansosRecipient, 'id' | 'createdAt'>[]) => Promise<number>;
  updateBansosRecipient: (id: string, item: Partial<BansosRecipient>) => void;
  deleteBansosRecipient: (id: string) => void;
  submitBansosComplaint: (data: Omit<BansosComplaint, 'id' | 'createdAt' | 'status'>) => Promise<string>;
  updateBansosComplaintStatus: (id: string, status: BansosComplaint['status'], adminNotes?: string) => void;
  addNewsItem: (item: Omit<NewsItem, 'id' | 'views'>) => void;
  updateNewsItem: (id: string, item: Partial<NewsItem>) => void;
  deleteNewsItem: (id: string) => void;
  likeNewsArticle: (newsId: string) => boolean;
  addNewsComment: (newsId: string, comment: Omit<import('../types').NewsComment, 'id' | 'createdAt'>) => void;
  likeNewsComment: (newsId: string, commentId: string) => boolean;
  addAnnouncement: (item: Omit<Announcement, 'id'>) => void;
  updateAnnouncement: (id: string, item: Partial<Announcement>) => void;
  deleteAnnouncement: (id: string) => void;
  addAgendaItem: (item: Omit<AgendaItem, 'id'>) => void;
  updateAgendaItem: (id: string, item: Partial<AgendaItem>) => void;
  deleteAgendaItem: (id: string) => void;
  addDevelopmentProject: (item: Omit<DevelopmentProject, 'id'>) => void;
  updateDevelopmentProject: (id: string, item: Partial<DevelopmentProject>) => void;
  deleteDevelopmentProject: (id: string) => void;
  likeDevelopmentProject: (projectId: string) => boolean;
  addProjectComment: (projectId: string, comment: Omit<import('../types').ProjectComment, 'id' | 'createdAt'>) => void;
  likeProjectComment: (projectId: string, commentId: string) => boolean;
  addUmkmItem: (item: Omit<UmkmItem, 'id'>) => void;
  deleteUmkmItem: (id: string) => void;
  toggleUmkmVerification: (id: string) => void;
  addPotential: (item: Omit<VillagePotential, 'id'>) => void;
  updatePotential: (id: string, item: Partial<VillagePotential>) => void;
  deletePotential: (id: string) => void;
  updateOfficial: (id: string, item: Partial<VillageOfficial>) => void;
  addOfficial: (item: Omit<VillageOfficial, 'id'>) => void;
  deleteOfficial: (id: string) => void;
  addFacility: (item: Omit<MapFacility, 'id'>) => void;
  updateFacility: (id: string, item: Partial<MapFacility>) => void;
  deleteFacility: (id: string) => void;
  updateUserRole: (userId: string, role: RoleType) => void;
  resetAllDataToDefault: () => void;
  logActivity: (action: string, module: string, details: string) => void;
  addLandParcel: (data: any) => Promise<void>;
  updateLandParcel: (id: string, data: any) => Promise<void>;
  deleteLandParcel: (id: string) => Promise<void>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);

  const { serviceRequests, setServiceRequests, deletedRequests, setDeletedRequests, addServiceRequest, updateServiceRequest, deleteServiceRequest: fbDeleteServiceRequest, findRequestByCode } = useServiceRequests();
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadStored('current_user', null));
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<VillageService[]>(INITIAL_SERVICES);
  
  // Data utama sekarang sepenuhnya dikelola oleh Server (Phase 3: Supabase)
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [budget, setBudget] = useState<BudgetYearData>(INITIAL_BUDGET);
  const [budgetHistory, setBudgetHistory] = useState<BudgetYearData[]>([]);
  const [developmentProjects, setDevelopmentProjects] = useState<DevelopmentProject[]>([]);
  const [potentials, setPotentials] = useState<VillagePotential[]>([]);
  const [umkm, setUmkm] = useState<UmkmItem[]>([]);
  const [officials, setOfficials] = useState<VillageOfficial[]>([]);
  const [facilities, setFacilities] = useState<MapFacility[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [webGisData, setWebGisData] = useState<LandParcel[]>([]);
  const [villageProfile, setVillageProfile] = useState<VillageProfile>({
    villageName: VILLAGE_INFO.NAME,
    district: VILLAGE_INFO.KECAMATAN,
    regency: VILLAGE_INFO.KABUPATEN,
    province: VILLAGE_INFO.PROVINCE,
    postalCode: VILLAGE_INFO.POSTAL_CODE,
    addressStreet: VILLAGE_INFO.ADDRESS_STREET,
    email: VILLAGE_INFO.EMAIL,
    phone: VILLAGE_INFO.PHONE,
    website: VILLAGE_INFO.DOMAIN,
    villageLogoUrl: '',
    regencyLogoUrl: '',
    letterCodePrefix: VILLAGE_INFO.LETTER_CODE_PREFIX,
    motto: VILLAGE_INFO.MOTTO,
    vision: 'Terwujudnya Desa Pulau Betung yang Maju, Mandiri, Agamis, Sejahtera, dan Berkeadilan Berbasis Pertanian dan Kearifan Lokal.',
    mission: [
      'Meningkatkan tata kelola pemerintahan desa yang bersih, transparan, dan akuntabel berbasis digital.',
      'Mendorong optimalisasi produktivitas perkebunan karet, kelapa sawit, dan perikanan air tawar warga.',
      'Meningkatkan mutu pembangunan infrastruktur dasar jalan usaha tani dan fasilitas publik desa.',
      'Memperkuat pelayanan sosial, kesehatan dasar balita dan lansia, serta mutu pendidikan.',
      'Melestarikan nilai adat budaya Melayu Jambi dan kerukunan kehidupan bermasyarakat.'
    ],
    history: 'Desa Pulau Betung merupakan salah satu desa bersejarah di sepanjang aliran Sungai Batang Hari, Kecamatan Pemayung.',
    sadewaLogoUrl: '',
    lastUpdated: new Date().toISOString()
  });
  const [territories, setTerritories] = useState<DusunRecord[]>([]);
  const [bansosRecipients, setBansosRecipients] = useState<BansosRecipient[]>([]);
  const [bansosComplaints, setBansosComplaints] = useState<BansosComplaint[]>([]);
  
  // Preferensi user tetap di LocalStorage (Client-only)
  const [userLikedItems, setUserLikedItems] = useState<string[]>(() =>
    loadStored<string[]>('user_liked_items', [])
  );

  const isItemLiked = useCallback((id: string) => {
    return userLikedItems.includes(id);
  }, [userLikedItems]);

  // Fetch Village Profile from API on Mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.getVillageProfile();
        if (res.success && res.data) {
          setVillageProfile(res.data);
        }
      } catch (err) {
        console.error('Error fetching village profile from API:', err);
      }
    };
    fetchProfile();

    const fetchBansos = async () => {
      try {
        const token = localStorage.getItem('pulau_betung_auth_token');
        const res = token ? await api.getKpmData() : await api.getPublicKpmData();
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setBansosRecipients(res.data);
        }
      } catch (err) {
        console.error('Error fetching bansos recipients from API:', err);
      }
    };
    fetchBansos();
  }, []);

  // Fetch Audit Logs from API when Admin
  useEffect(() => {
    const token = localStorage.getItem('pulau_betung_auth_token');
    const isAuthorized = !isLoading && token && currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'admin_desa');
    
    if (isAuthorized) {
      const fetchLogs = async () => {
        try {
          const logs = await api.getAuditLogs();
          if (logs && logs.length > 0) {
            setAuditLogs(logs);
          }
        } catch (err: any) {
          console.error('Error fetching audit logs from API:', err);
          setAuditLogs([]);
        }
      };
      fetchLogs();
    } else {
      if (auditLogs.length > INITIAL_AUDIT_LOGS.length || (auditLogs.length > 0 && auditLogs[0]?.id?.startsWith('log-'))) {
        setAuditLogs(INITIAL_AUDIT_LOGS);
      }
    }
  }, [currentUser, isLoading]);

  // Sinkronisasi ke local storage (Hanya Session & User Preferences)
  useEffect(() => {
    saveStored('current_user', currentUser);
    saveStored('user_liked_items', userLikedItems);
    
    // NOTE: Data operasional desa (News, Requests, dll) tidak lagi disimpan di LocalStorage
    // demi menjaga integritas Single Source of Truth (Supabase).
  }, [currentUser, userLikedItems]);

  // ============================================================================
  // 🗺️ SINKRONISASI SPASIAL OTOMATIS: DARI SURAT SPORADIK KE PETA WEBGIS
  // ============================================================================
  // Logika canggih ini bekerja secara reaktif:
  // Ketika seorang warga mengajukan surat SPORADIK (Penguasaan Fisik Bidang Tanah)
  // yang memuat data koordinat patok batas (boundaries) dan suratnya telah DISETUJUI
  // atau SELESAI diverifikasi oleh Kepala Desa/Sekdes:
  // 1. Sistem otomatis membaca titik-titik koordinat latitude & longitude.
  // 2. Menghitung luas bidang tanah menggunakan formula Shoelace Geometri.
  // 3. Mengkategorikan peruntukan lahan (sawit, karet, pemukiman, atau pertanian).
  // 4. Secara otomatis memasukkan persil tanah tersebut ke peta interaktif WebGIS desa!
  // 5. Dan jika surat tersebut dibatalkan atau ditolak, persil tanah otomatis dihapus dari peta.
  // ============================================================================
  useEffect(() => {
    setWebGisData((prevParcels) => {
      let updatedParcels = [...prevParcels];
      let hasChanges = false;

      // Filter pengajuan surat yang terkait tanah sporadik atau memiliki data koordinat batas
      const sporadikRequests = serviceRequests.filter(r => 
        r.serviceName.toLowerCase().includes('sporadik') || 
        r.serviceName.toLowerCase().includes('penguasaan') ||
        (r.formData && r.formData.boundaries)
      );

      sporadikRequests.forEach((req) => {
        // Cek status surat: apakah disetujui atau dibatalkan
        const isApproved = ['selesai', 'disetujui', 'dicetak'].includes(req.status.toLowerCase());
        const isCancelled = ['dibatalkan', 'dicabut', 'dihapus', 'ditolak'].includes(req.status.toLowerCase());
        
        // Cari apakah persil dari surat ini sudah pernah ada di daftar WebGIS
        const existingParcelIdx = updatedParcels.findIndex(p => p.sporadikRequestCode === req.trackingCode);

        // Jika surat dibatalkan/ditolak, hapus bidang tanah dari peta WebGIS
        if (isCancelled && existingParcelIdx !== -1) {
          updatedParcels.splice(existingParcelIdx, 1);
          hasChanges = true;
        } else if (isApproved) {
          // Jika surat telah disetujui resmi, olah data batas tanahnya
          const formData = (req.formData || {}) as Record<string, any>;
          if (formData && formData.boundaries && Array.isArray(formData.boundaries) && formData.boundaries.length >= 3) {
            const coords: [number, number][] = [];
            let valid = true;
            for (const b of formData.boundaries) {
               if (b.latitude && b.longitude) {
                  coords.push([parseFloat(b.latitude), parseFloat(b.longitude)]);
               } else {
                  valid = false;
               }
            }
            
            // Minimal 3 titik koordinat untuk membentuk poligon bidang tanah
            if (valid && coords.length >= 3) {
               // Hitung luas tanah otomatis menggunakan rumus Shoelace
               const areaCalc = calculatePolygonAreaShoelace(coords);
               
               // Tentukan kategori pemanfaatan tanah berdasarkan catatan pemohon
               let landUseCategory: LandUseCategory = 'SAWAH_PERTANIAN';
               if (formData.landSource?.toLowerCase().includes('sawit')) landUseCategory = 'PERKEBUNAN_SAWIT';
               else if (formData.landSource?.toLowerCase().includes('karet')) landUseCategory = 'PERKEBUNAN_KARET';
               else if (formData.landSource?.toLowerCase().includes('rumah')) landUseCategory = 'PEMUKIMAN';

               // Buat objek persil tanah resmi
               const newParcel: LandParcel = {
                 id: `PARCEL-SPORADIK-${req.id}`,
                 nop: '-', 
                 ownerName: req.citizenName,
                 ownerNik: req.citizenNikMasked,
                 addressDusun: req.addressDusun || formData.landLocation || 'Dusun Betung',
                 landUseCategory,
                 landAreaSqM: Math.round(areaCalc.areaSqM),
                 landAreaHectares: areaCalc.areaHectares,
                 buildingAreaSqM: 0,
                 coordinates: coords,
                 boundaries: (formData.boundaries as Array<{lat: number, lng: number}>).map((b: any) => ({
                    direction: (b.direction || 'UTARA').toUpperCase(),
                    neighborName: b.neighbor || 'Batas Warga',
                    distanceMeters: parseFloat(b.length || '0')
                 })),
                 njopLandPerSqM: 0,
                 njopBuildingPerSqM: 0,
                 pbbTaxAmount: 0,
                 pbbStatus: 'BEBAS_PAJAK',
                 sporadikStatus: 'SPORADIK_TERBIT',
                 sporadikRequestCode: req.trackingCode,
                 sporadikCertificateNumber: req.officialLetterNumber || req.trackingCode,
                 sporadikIssuedDate: req.completedAt,
                 createdAt: new Date().toISOString(),
                 updatedAt: new Date().toISOString()
               };
               
               // Jika persil sudah ada sebelumnya, perbarui datanya; jika baru, tambahkan ke peta
               if (existingParcelIdx !== -1) {
                  updatedParcels[existingParcelIdx] = newParcel;
                  hasChanges = true;
               } else {
                  updatedParcels.push(newParcel);
                  hasChanges = true;
               }
            }
          }
        }
      });
      
      return hasChanges ? updatedParcels : prevParcels;
    });
  }, [serviceRequests]);

  const logActivity = useCallback((action: string, module: string, details: string, level?: 'info' | 'warning' | 'error' | 'critical') => {
    let derivedLevel = level;
    if (!derivedLevel) {
      const act = action.toUpperCase();
      if (act.includes('RESET') || act.includes('PURGE') || act.includes('CRITICAL') || act.includes('AUTH_FAILED')) {
        derivedLevel = 'critical';
      } else if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('FAIL') || act.includes('CLEAR')) {
        derivedLevel = 'error';
      } else if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('STATUS') || act.includes('CHANGE') || act.includes('RESTORE')) {
        derivedLevel = 'warning';
      } else {
        derivedLevel = 'info';
      }
    }

    const newLog: AuditLog = {
      id: generateId('log'),
      userId: currentUser ? currentUser.id : 'guest',
      userName: currentUser ? currentUser.name : 'Masyarakat (Publik)',
      userRole: currentUser ? currentUser.role : 'warga',
      action,
      module,
      details,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      level: derivedLevel
    };
    
    // Save to local state
    setAuditLogs((prev) => [newLog, ...prev]);
  }, [currentUser]);

  const reloadServerData = useCallback(async () => {
    setIsLoading(true);
    try {
      const bootstrap = await api.getBootstrapData();
      if (bootstrap) {
        if (bootstrap.services?.length > 0) {
          const serverServiceIds = new Set(bootstrap.services.map((s: VillageService) => s.id));
          const missingDefaults = INITIAL_SERVICES.filter((s) => !serverServiceIds.has(s.id));
          setServices(missingDefaults.length > 0 ? [...bootstrap.services, ...missingDefaults] : bootstrap.services);
        }
        if (bootstrap.news?.length > 0) setNews(bootstrap.news);
        if (bootstrap.announcements?.length > 0) setAnnouncements(bootstrap.announcements);
        if (bootstrap.agendas?.length > 0) setAgendas(bootstrap.agendas);
        if (bootstrap.projects?.length > 0) setDevelopmentProjects(bootstrap.projects);
        if (bootstrap.budget) setBudget(bootstrap.budget);
        if (bootstrap.officials?.length > 0) setOfficials(bootstrap.officials);
        if (bootstrap.potentials?.length > 0) setPotentials(bootstrap.potentials);
        if (bootstrap.umkm?.length > 0) setUmkm(bootstrap.umkm);
        if (bootstrap.facilities?.length > 0) setFacilities(bootstrap.facilities);
        if (bootstrap.gallery?.length > 0) setGallery(bootstrap.gallery);
        if (bootstrap.territories && bootstrap.territories.length > 0) setTerritories(bootstrap.territories);
        if (bootstrap.profile) setVillageProfile((prev) => ({ ...prev, ...bootstrap.profile }));
        
        // Load WebGIS Data
        try {
          const gisRes = await api.getLandParcels();
          if (gisRes.success && gisRes.data) {
            setWebGisData(gisRes.data);
          }
        } catch (gisErr) {
          console.warn('Gagal memuat data WebGIS dari server:', gisErr);
        }
      }

      const token = localStorage.getItem('pulau_betung_auth_token');
      if (token) {
        try {
          const me = await api.getCurrentUser(token);
          if (me) {
            setCurrentUser((prev) => {
              if (!prev) return me;
              // Only update if major fields changed or if it's a different user
              if (prev.id !== me.id) return me;
              return { ...prev, ...me };
            });
            const logs = await api.getAuditLogs();
            if (logs?.length > 0) setAuditLogs(logs);

            // Sync service requests from server database
            try {
              const serverReqs = await api.getAdminRequests();
              if (serverReqs.success && Array.isArray(serverReqs.data) && serverReqs.data.length > 0) {
                setServiceRequests((prev: ServiceRequest[]) => {
                  const serverMap = new Map((serverReqs.data || []).map((r: ServiceRequest) => [r.id, r]));
                  (serverReqs.data || []).forEach((r: ServiceRequest) => {
                    if (r.trackingCode) serverMap.set(r.trackingCode, r);
                  });
                  const merged = prev.map((local: ServiceRequest) => {
                    const s = serverMap.get(local.id) || (local.trackingCode ? serverMap.get(local.trackingCode) : undefined);
                    return s ? { ...local, ...s } : local;
                  });
                  const localIds = new Set(prev.map((r: ServiceRequest) => r.id));
                  const localCodes = new Set(prev.map((r: ServiceRequest) => r.trackingCode));
                  (serverReqs.data || []).forEach((sr: ServiceRequest) => {
                    if (!localIds.has(sr.id) && !localCodes.has(sr.trackingCode)) {
                      merged.unshift(sr);
                    }
                  });
                  return merged;
                });
              }
            } catch (reqSyncErr) {
              console.warn('Admin requests sync notice:', reqSyncErr);
            }

            // Sync deleted service requests log from server
            try {
              const delRes = await api.getDeletedServiceRequests();
              if (delRes.success && Array.isArray(delRes.data)) {
                setDeletedRequests(delRes.data);
              }
            } catch (delErr) {
              console.warn('Deleted requests sync notice:', delErr);
            }
          } else {
            // Only logout if we are absolutely sure the session is invalid
            // (e.g. server explicitly returned 401/404, not just a network error)
            const checkRes = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null);
            if (checkRes && (checkRes.status === 401 || checkRes.status === 403)) {
              console.warn('Sesi tidak valid, mengeluarkan pengguna.');
              setCurrentUser(null);
              localStorage.removeItem('pulau_betung_auth_token');
            }
          }
        } catch (meErr) {
          console.error('Gagal verifikasi sesi pengguna:', meErr);
          // Keep current user state on network errors
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadServerData();
  }, [reloadServerData]);

  const updateBudget = useCallback((data: BudgetYearData) => {
    const updatedData: BudgetYearData = { ...data, id: data.id || `apbdes-${data.year}-${data.documentType || 'murni'}` };
    setBudget(updatedData);
    setBudgetHistory((prev) => {
      const idx = prev.findIndex(b => b.year === updatedData.year && (b.documentType || 'murni') === (updatedData.documentType || 'murni'));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedData;
        return next;
      }
      return [updatedData, ...prev];
    });
    logActivity('BUDGET_UPDATED', 'Transparansi APBDes', `Update APBDes TA ${updatedData.year}`);
  }, [logActivity]);

  // ============================================================================
  // 📝 1. PENGAJUAN SURAT BARU OLEH WARGA (SUBMIT SERVICE REQUEST)
  // ============================================================================
  // Fungsi ini dipanggil saat warga selesai mengisi form permohonan surat:
  // 1. Membuat nomor resi pelacakan unik (misal: REQ-PB-2026-8492) yang dijamin tidak kembar.
  // 2. Menyimpan data langsung ke state lokal agar UI langsung update tanpa jeda (optimistic UI).
  // 3. Mengirimkan data ke backend server via api.applyService.
  // 4. Mengembalikan nomor resi ke warga untuk disalin dan dilacak via AI Panjul.
  // ============================================================================
  const submitServiceRequest = useCallback((data: Omit<ServiceRequest, 'id' | 'trackingCode' | 'requestDate' | 'status'>) => {
    let trackingCode = '';
    let isUnique = false;
    let attempts = 0;
    
    // Perulangan untuk memastikan kode resi tracking 100% unik di seluruh sistem
    while (!isUnique && attempts < 100) {
      const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 Digit unik (1000 - 9999)
      const candidateCode = `REQ-PB-2026-${randomNum}`;
      const exists = serviceRequests.some((r) => r.trackingCode === candidateCode);
      if (!exists) {
        trackingCode = candidateCode;
        isUnique = true;
      }
      attempts++;
    }

    // Jika setelah 100 kali coba masih tabrakan (sangat langka), pakai timestamp mikrodetik
    if (!isUnique) {
      trackingCode = `REQ-PB-2026-${Date.now().toString().slice(-5)}`;
    }

    // Susun objek permohonan surat baru berstatus awal 'diajukan'
    const newReq: ServiceRequest = {
      ...data,
      id: 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      trackingCode,
      requestDate: new Date().toISOString().substring(0, 10),
      status: 'diajukan',
      formData: data.formData || {}
    };
    
    // Masukkan ke posisi paling atas antrean
    setServiceRequests((prev: ServiceRequest[]) => [newReq, ...prev]);
    logActivity('NEW_SERVICE_REQUEST', 'Pelayanan Masyarakat', `Pengajuan ${data.serviceName} (${trackingCode})`);
    
    // Simpan ke database server
    api.applyService({
      id: newReq.id,
      trackingCode,
      ...data,
      formData: data.formData || {}
    }).then((res) => {
      if (res.success && (res.data as any)?.trackingCode) {
        const serverData = res.data as any;
        setServiceRequests((prev: ServiceRequest[]) =>
          prev.map((item: ServiceRequest) =>
            item.id === newReq.id
              ? { ...item, id: serverData.id || item.id, trackingCode: serverData.trackingCode || item.trackingCode }
              : item
          )
        );
      }
    });
    
    // Kembalikan nomor resi ke komponen pemanggil
    return trackingCode;
  }, [logActivity]);

  // ============================================================================
  // ✍️ 2. PEMBARUAN STATUS & PENERBITAN NOMOR SURAT RESMI
  // ============================================================================
  // Dipanggil oleh Kades/Sekdes/Operator saat memproses surat:
  // - Jika status diubah jadi 'disetujui' atau 'selesai':
  //   1. Otomatis menghasilkan Nomor Surat Dinas Resmi sesuai tata naskah dinas Permendagri.
  //   2. Mengabadikan potret kop surat (letterheadSnapshot) berisi nama kades & logo
  //      agar dokumen hukum ini tidak berubah meskipun di masa depan ada pergantian kades!
  // ============================================================================
  const updateServiceRequestStatus = useCallback((id: string, status: ServiceStatus, staffNotes: string) => {
    let assignedLetterNumber: string | undefined;
    let targetReq: ServiceRequest | undefined;

    setServiceRequests((prev: ServiceRequest[]) =>
      prev.map((r: ServiceRequest) => {
        if (r.id === id || r.trackingCode === id) {
          const isFinished = ['selesai', 'disetujui'].includes(status);
          const completedAt = isFinished ? (r.completedAt || new Date().toISOString().substring(0, 10)) : r.completedAt;
          
          // Generate Nomor Surat Otomatis jika belum pernah terbit sebelumnya
          let officialLetterNumber = r.officialLetterNumber;
          if (isFinished && !officialLetterNumber) {
            officialLetterNumber = generateOfficialLetterNumber(r.serviceId || r.serviceName, completedAt, prev, r.id);
          }
          assignedLetterNumber = officialLetterNumber;
          
          // Potret kop surat abadi (Kop Snapshot)
          let letterheadSnapshot = r.letterheadSnapshot;
          if (isFinished && !letterheadSnapshot) {
            const activeKades = officials.find((o) => o.section === 'kepala_desa' && o.isActive !== false) || officials.find((o) => o.section === 'kepala_desa');
            letterheadSnapshot = {
              villageName: villageProfile.villageName,
              district: villageProfile.district,
              regency: villageProfile.regency,
              province: villageProfile.province,
              postalCode: villageProfile.postalCode,
              addressStreet: villageProfile.addressStreet || '',
              email: villageProfile.email || '',
              phone: villageProfile.phone || '',
              domain: villageProfile.website || '',
              villageLogoUrl: villageProfile.villageLogoUrl,
              regencyLogoUrl: villageProfile.regencyLogoUrl,
              kadesName: activeKades?.name || 'H. Sudirman',
              kadesNip: activeKades?.nip || 'NIAP. 19780412 201201 1 004',
              capturedAt: new Date().toISOString()
            };
          }
          
          const updated: ServiceRequest = {
            ...r,
            status,
            staffNotes,
            processedBy: currentUser?.name || 'Petugas',
            completedAt,
            officialLetterNumber,
            letterheadSnapshot
          };
          targetReq = updated;
          return updated;
        }
        return r;
      })
    );
    logActivity('SERVICE_STATUS_CHANGED', 'Pelayanan Masyarakat', `ID ${id} -> ${status}`);
    
    // Asynchronously send to server with full payload & tracking code for guaranteed persistence
    api.updateRequestStatus(id, status, staffNotes, assignedLetterNumber, {
      trackingCode: targetReq?.trackingCode,
      completedAt: targetReq?.completedAt,
      letterheadSnapshot: targetReq?.letterheadSnapshot,
      fullRequest: targetReq
    }).then((res) => {
      if (res.success && res.data) {
        setServiceRequests((prev: ServiceRequest[]) =>
          prev.map((item: ServiceRequest) => ((item.id === id || item.trackingCode === id) ? { ...item, ...res.data } : item))
        );
      }
    }).catch((err) => {
      console.warn('Gagal sinkron status surat ke server:', err);
    });
  }, [currentUser, officials, villageProfile, logActivity]);

  const deleteServiceRequest = useCallback((id: string, reason?: string) => {
    const target = serviceRequests.find((r) => r.id === id || r.trackingCode === id);
    if (!target) return;

    setServiceRequests((prev: ServiceRequest[]) => prev.filter((r: ServiceRequest) => r.id !== id && r.trackingCode !== id));

    const now = new Date().toISOString();
    const newLog: DeletedServiceRequestRecord = {
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      requestId: target.id,
      trackingCode: target.trackingCode,
      serviceId: target.serviceId,
      serviceName: target.serviceName,
      officialLetterNumber: target.officialLetterNumber || undefined,
      citizenName: target.citizenName,
      citizenNikMasked: target.citizenNikMasked,
      phone: target.phone,
      addressDusun: target.addressDusun,
      requestDate: target.requestDate,
      lastStatus: target.status,
      deletedAt: now,
      deletedByUserId: currentUser?.id,
      deletedByUserName: currentUser?.name || 'Administrator',
      deletedByUserRole: currentUser?.role || 'operator',
      deletionReason: reason || 'Penghapusan oleh Admin',
      fullRequestSnapshot: target
    };
    setDeletedRequests((prev: DeletedServiceRequestRecord[]) => [newLog, ...prev]);

    logActivity('SERVICE_REQUEST_DELETED', 'Pelayanan Surat', `Hapus permohonan ${target.trackingCode}. Alasan: ${reason || '-'}`);
    api.deleteServiceRequest(id, reason).catch((err) => {
      console.warn('Gagal menghapus permohonan dari server:', err);
    });
  }, [serviceRequests, currentUser, logActivity]);

  const bulkDeleteServiceRequests = useCallback((ids: string[], reason?: string) => {
    if (!ids || ids.length === 0) return;
    const cleanSet = new Set(ids.map((i) => (i || '').trim()));
    const targets = serviceRequests.filter((r) => cleanSet.has((r.id || '').trim()) || cleanSet.has((r.trackingCode || '').trim()));

    setServiceRequests((prev: ServiceRequest[]) =>
      prev.filter((r: ServiceRequest) => !cleanSet.has((r.id || '').trim()) && !cleanSet.has((r.trackingCode || '').trim()))
    );

    const now = new Date().toISOString();
    const newLogs: DeletedServiceRequestRecord[] = targets.map((target) => ({
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      requestId: target.id,
      trackingCode: target.trackingCode,
      serviceId: target.serviceId,
      serviceName: target.serviceName,
      officialLetterNumber: target.officialLetterNumber || undefined,
      citizenName: target.citizenName,
      citizenNikMasked: target.citizenNikMasked,
      phone: target.phone,
      addressDusun: target.addressDusun,
      requestDate: target.requestDate,
      lastStatus: target.status,
      deletedAt: now,
      deletedByUserId: currentUser?.id,
      deletedByUserName: currentUser?.name || 'Administrator',
      deletedByUserRole: currentUser?.role || 'operator',
      deletionReason: reason || 'Pembersihan Massal Data Uji Coba',
      fullRequestSnapshot: target
    }));
    setDeletedRequests((prev: DeletedServiceRequestRecord[]) => [...newLogs, ...prev]);

    logActivity('SERVICE_REQUEST_BULK_DELETED', 'Pelayanan Surat', `Hapus massal ${ids.length} permohonan surat. Alasan: ${reason || 'Uji Coba'}`);
    api.bulkDeleteServiceRequests(ids, reason).catch((err) => {
      console.warn('Gagal menghapus massal permohonan dari server:', err);
    });
  }, [serviceRequests, currentUser, logActivity]);

  const restoreDeletedServiceRequest = useCallback(async (id: string): Promise<boolean> => {
    const cleanId = (id || '').trim();
    const logItem = deletedRequests.find((d) => d.id === cleanId || d.requestId === cleanId || d.trackingCode === cleanId);
    if (!logItem) return false;

    setDeletedRequests((prev: DeletedServiceRequestRecord[]) => prev.filter((d: DeletedServiceRequestRecord) => d.id !== logItem.id));
    setServiceRequests((prev: ServiceRequest[]) => {
      const exists = prev.some((r: ServiceRequest) => r.id === logItem.fullRequestSnapshot.id || r.trackingCode === logItem.fullRequestSnapshot.trackingCode);
      return exists ? prev : [logItem.fullRequestSnapshot, ...prev];
    });

    logActivity('SERVICE_REQUEST_RESTORED', 'Pelayanan Surat', `Pulihkan permohonan ${logItem.trackingCode}`);
    try {
      await api.restoreDeletedServiceRequest(logItem.id);
      return true;
    } catch (err) {
      console.warn('Gagal memulihkan surat di server:', err);
      return true;
    }
  }, [deletedRequests, logActivity]);

  const permanentlyDeleteServiceRequestLog = useCallback(async (id: string): Promise<boolean> => {
    setDeletedRequests((prev: DeletedServiceRequestRecord[]) => prev.filter((d: DeletedServiceRequestRecord) => d.id !== id));
    logActivity('SERVICE_REQUEST_LOG_WIPED', 'Keamanan & Audit', `Hapus permanen log surat ID: ${id}`);
    try {
      await api.permanentlyDeleteServiceRequestLog(id);
      return true;
    } catch (err) {
      console.warn('Gagal menghapus permanen log di server:', err);
      return true;
    }
  }, [logActivity]);

  const clearAllDeletedServiceRequests = useCallback(async (): Promise<boolean> => {
    const count = deletedRequests.length;
    setDeletedRequests([]);
    logActivity('SERVICE_REQUEST_LOG_CLEARED', 'Keamanan & Audit', `Kosongkan ${count} seluruh catatan log surat terhapus`);
    try {
      await api.clearAllDeletedServiceRequests();
      return true;
    } catch (err) {
      console.warn('Gagal mengosongkan log di server:', err);
      return true;
    }
  }, [deletedRequests.length, logActivity]);

  const submitComplaint = useCallback((data: Omit<Complaint, 'id' | 'ticketNumber' | 'createdAt' | 'status'>) => {
    const ticketNumber = `ADU-PB-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newComplaint: Complaint = { ...data, id: generateId('cmp'), ticketNumber, createdAt: new Date().toISOString().substring(0, 10), status: 'diterima' };
    setComplaints((prev) => [newComplaint, ...prev]);
    logActivity('NEW_COMPLAINT', 'Pengaduan', `Tiket ${ticketNumber}`);
    api.submitComplaint(data).then((res) => {
      if (res.success && (res.data as any)?.ticketNumber) {
        setComplaints((prev) => prev.map((item) => (item.id === newComplaint.id ? { ...item, ticketNumber: (res.data as any).ticketNumber } : item)));
      }
    });
    return ticketNumber;
  }, [logActivity]);

  const respondToComplaint = useCallback((id: string, status: ComplaintStatus, adminResponse: string, fotoBuktiPenyelesaian?: string, catatanTindakLanjut?: string) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status, adminResponse, respondedBy: currentUser?.name || 'Admin', updatedAt: new Date().toISOString().substring(0, 10), fotoBuktiPenyelesaian, catatanTindakLanjut } : c)));
    logActivity('COMPLAINT_RESPONDED', 'Pengaduan', `ID ${id} -> ${status}`);
    api.respondComplaint(id, adminResponse, status, fotoBuktiPenyelesaian, catatanTindakLanjut);
  }, [currentUser, logActivity]);

  const updateVillageProfile = useCallback(async (profileData: Partial<VillageProfile>) => {
    const lastUpdated = new Date().toISOString();
    setVillageProfile((prev) => ({ ...prev, ...profileData, lastUpdated }));
    logActivity('PROFILE_UPDATED', 'Identitas Desa', 'Pembaruan data profil desa & kades');
    const res = await api.updateVillageProfile(profileData);
    if (res.success && res.data) {
      setVillageProfile(res.data);
    }
  }, [logActivity]);

  const updateTerritories = useCallback(async (data: DusunRecord[]) => {
    const normalized = normalizeTerritories(data);
    setTerritories(normalized);
    api.updateTerritories(normalized);
  }, []);

  const addNewsItem = useCallback((item: Omit<NewsItem, 'id' | 'views'>) => {
    const newItem: NewsItem = { ...item, id: generateId('nws'), views: 1 };
    setNews((prev) => [newItem, ...prev]);
    api.addNews(item);
  }, []);

  const updateNewsItem = useCallback((id: string, item: Partial<NewsItem>) => {
    setNews((prev) => prev.map((n) => (n.id === id ? { ...n, ...item } : n)));
    api.updateNews(id, item);
  }, []);

  const deleteNewsItem = useCallback((id: string) => {
    setNews((prev) => prev.filter((n) => n.id !== id));
    api.deleteNews(id);
  }, []);

  const likeNewsArticle = useCallback((newsId: string): boolean => {
    let nowLiked = false;
    setUserLikedItems((prevLiked) => {
      const exists = prevLiked.includes(newsId);
      nowLiked = !exists;
      const nextLiked = exists
        ? prevLiked.filter((id) => id !== newsId)
        : [...prevLiked, newsId];
      saveStored('user_liked_items', nextLiked);
      return nextLiked;
    });

    setNews((prev) => {
      const updated = prev.map((n) => {
        if (n.id !== newsId) return n;
        const currentLikes = n.likesCount || 0;
        const newCount = nowLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);
        return { ...n, likesCount: newCount };
      });
      saveStored('news', updated);
      return updated;
    });

    return nowLiked;
  }, []);

  const addNewsComment = useCallback((newsId: string, comment: Omit<import('../types').NewsComment, 'id' | 'createdAt'>) => {
    const newComment: import('../types').NewsComment = {
      ...comment,
      id: generateId('ncm'),
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      likesCount: 0
    };

    setNews((prev) => {
      const updated = prev.map((n) => {
        if (n.id !== newsId) return n;
        return {
          ...n,
          comments: [newComment, ...(n.comments || [])]
        };
      });
      saveStored('news', updated);
      return updated;
    });
  }, []);

  const likeNewsComment = useCallback((newsId: string, commentId: string): boolean => {
    const key = `${newsId}_cm_${commentId}`;
    let nowLiked = false;
    setUserLikedItems((prevLiked) => {
      const exists = prevLiked.includes(key);
      nowLiked = !exists;
      const nextLiked = exists
        ? prevLiked.filter((id) => id !== key)
        : [...prevLiked, key];
      saveStored('user_liked_items', nextLiked);
      return nextLiked;
    });

    setNews((prev) => {
      const updated = prev.map((n) => {
        if (n.id !== newsId || !n.comments) return n;
        return {
          ...n,
          comments: n.comments.map((c) => {
            if (c.id !== commentId) return c;
            const currentLikes = c.likesCount || 0;
            const newCount = nowLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);
            return { ...c, likesCount: newCount };
          })
        };
      });
      saveStored('news', updated);
      return updated;
    });

    return nowLiked;
  }, []);

  const addAnnouncement = useCallback((item: Omit<Announcement, 'id'>) => {
    const newItem: Announcement = { ...item, id: generateId('anc') };
    setAnnouncements((prev) => [newItem, ...prev]);
    api.addAnnouncement(item);
  }, []);

  const updateAnnouncement = useCallback((id: string, item: Partial<Announcement>) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...item } : a)));
    api.updateAnnouncement(id, item);
  }, []);

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    api.deleteAnnouncement(id);
  }, []);

  const addAgendaItem = useCallback((item: Omit<AgendaItem, 'id'>) => {
    const newItem: AgendaItem = { ...item, id: generateId('agd') };
    setAgendas((prev) => [newItem, ...prev]);
    api.addAgenda(item);
  }, []);

  const updateAgendaItem = useCallback((id: string, item: Partial<AgendaItem>) => {
    setAgendas((prev) => prev.map((a) => (a.id === id ? { ...a, ...item } : a)));
  }, []);

  const deleteAgendaItem = useCallback((id: string) => {
    setAgendas((prev) => prev.filter((a) => a.id !== id));
    api.deleteAgenda(id);
  }, []);

  const addDevelopmentProject = useCallback((item: Omit<DevelopmentProject, 'id'>) => {
    const newItem: DevelopmentProject = { ...item, id: generateId('prj') };
    setDevelopmentProjects((prev) => [newItem, ...prev]);
    api.addProject(item);
    logActivity('PROJECT_ADDED', 'Pembangunan & TPK', `Tambah proyek: ${item.title}`);
  }, [logActivity]);

  const updateDevelopmentProject = useCallback((id: string, item: Partial<DevelopmentProject>) => {
    setDevelopmentProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...item } : p)));
    api.updateProject(id, item);
    logActivity('PROJECT_UPDATED', 'Pembangunan & TPK', `Update proyek: ${item.title || id}`);
  }, [logActivity]);

  const deleteDevelopmentProject = useCallback((id: string) => {
    setDevelopmentProjects((prev) => prev.filter((p) => p.id !== id));
    api.deleteProject(id);
    logActivity('PROJECT_DELETED', 'Pembangunan & TPK', `Hapus proyek ID: ${id}`);
  }, [logActivity]);

  const likeDevelopmentProject = useCallback((projectId: string): boolean => {
    let nowLiked = false;
    setUserLikedItems((prevLiked) => {
      const exists = prevLiked.includes(projectId);
      nowLiked = !exists;
      const nextLiked = exists
        ? prevLiked.filter((id) => id !== projectId)
        : [...prevLiked, projectId];
      saveStored('user_liked_items', nextLiked);
      return nextLiked;
    });

    setDevelopmentProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId) return p;
        const currentLikes = p.likesCount || 0;
        const newCount = nowLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);
        return { ...p, likesCount: newCount };
      });
      saveStored('projects', updated);
      return updated;
    });

    return nowLiked;
  }, []);

  const addProjectComment = useCallback((projectId: string, comment: Omit<ProjectComment, 'id' | 'createdAt'>) => {
    const newComment: ProjectComment = {
      ...comment,
      id: generateId('cm'),
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      likesCount: 0
    };

    setDevelopmentProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId) return p;
        const isDispute = comment.type === 'sanggahan';
        const existingComments = p.comments || [];
        const updatedDisputeCount = isDispute ? (p.citizenDisputeCount || 0) + 1 : (p.citizenDisputeCount || 0);
        const updatedDisputeNotes = isDispute
          ? [...(p.disputeNotes || []), `[${comment.rtRwLocation || 'Warga'}] ${comment.authorName}: ${comment.content}`]
          : (p.disputeNotes || []);

        return {
          ...p,
          citizenDisputeCount: updatedDisputeCount,
          disputeNotes: updatedDisputeNotes,
          comments: [newComment, ...existingComments]
        };
      });
      saveStored('projects', updated);
      return updated;
    });
  }, []);

  const likeProjectComment = useCallback((projectId: string, commentId: string): boolean => {
    const key = `${projectId}_cm_${commentId}`;
    let nowLiked = false;
    setUserLikedItems((prevLiked) => {
      const exists = prevLiked.includes(key);
      nowLiked = !exists;
      const nextLiked = exists
        ? prevLiked.filter((id) => id !== key)
        : [...prevLiked, key];
      saveStored('user_liked_items', nextLiked);
      return nextLiked;
    });

    setDevelopmentProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId || !p.comments) return p;
        return {
          ...p,
          comments: p.comments.map((c) => {
            if (c.id !== commentId) return c;
            const currentLikes = c.likesCount || 0;
            const newCount = nowLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);
            return { ...c, likesCount: newCount };
          })
        };
      });
      saveStored('projects', updated);
      return updated;
    });

    return nowLiked;
  }, []);

  const addUmkmItem = useCallback((item: Omit<UmkmItem, 'id'>) => {
    const newItem: UmkmItem = { ...item, id: generateId('umkm') };
    setUmkm((prev) => [newItem, ...prev]);
    api.addUmkm(newItem);
  }, []);

  const deleteUmkmItem = useCallback((id: string) => {
    setUmkm((prev) => prev.filter((u) => u.id !== id));
    api.deleteUmkm(id);
  }, []);

  const toggleUmkmVerification = useCallback((id: string) => {
    setUmkm((prev) => prev.map((u) => u.id === id ? { ...u, isVerified: !u.isVerified } : u));
    api.toggleUmkm(id);
  }, []);

  const addPotential = useCallback((item: Omit<VillagePotential, 'id'>) => {
    const newItem: VillagePotential = { ...item, id: generateId('pot') };
    setPotentials((prev) => [newItem, ...prev]);
    api.addPotential(newItem);
    logActivity('POTENTIAL_ADDED', 'Potensi Desa', `Tambah potensi: ${item.name}`);
  }, [logActivity]);

  const updatePotential = useCallback((id: string, item: Partial<VillagePotential>) => {
    setPotentials((prev) => prev.map((p) => p.id === id ? { ...p, ...item } : p));
    api.updatePotential(id, item);
    logActivity('POTENTIAL_UPDATED', 'Potensi Desa', `Update potensi ID: ${id}`);
  }, [logActivity]);

  const deletePotential = useCallback((id: string) => {
    setPotentials((prev) => prev.filter((p) => p.id !== id));
    api.deletePotential(id);
    logActivity('POTENTIAL_DELETED', 'Potensi Desa', `Hapus potensi ID: ${id}`);
  }, [logActivity]);

  const updateOfficial = useCallback((id: string, item: Partial<VillageOfficial>) => {
    setOfficials((prev) => {
      const updatedList = prev.map((o) => o.id === id ? { ...o, ...item, updatedAt: new Date().toISOString() } : o);
      const updatedOfficial = updatedList.find((o) => o.id === id);
      
      if (updatedOfficial) {
        setUsers(prevUsers => {
          if (updatedOfficial.hasAdminAccess) {
             const existingUserIndex = prevUsers.findIndex(u => u.id === `usr-${id}`);
             const roleTitleMap: Record<string, string> = { super_admin: 'Super Administrator', admin_desa: 'Admin Desa', operator: 'Operator Modul', editor: 'Editor Publikasi' };
             const defaultUsername = updatedOfficial.name.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
             const username = updatedOfficial.adminUsername || defaultUsername;
             
             const newUser: User = {
               id: `usr-${id}`,
               name: updatedOfficial.name,
               username: username,
               email: `${username}@pulaubetung.sadewa.id`,
               role: updatedOfficial.adminRole || 'operator',
               roleTitle: roleTitleMap[updatedOfficial.adminRole || 'operator'] || 'Operator',
               avatar: updatedOfficial.imageUrl,
               phone: updatedOfficial.phone,
               gender: updatedOfficial.gender,
               birthDate: updatedOfficial.birthDate
             };
             
             if (existingUserIndex >= 0) {
                const newList = [...prevUsers];
                newList[existingUserIndex] = { ...newList[existingUserIndex], ...newUser };
                return newList;
             } else {
                return [...prevUsers, newUser];
             }
          } else {
             return prevUsers.filter(u => u.id !== `usr-${id}`);
          }
        });
      }
      return updatedList;
    });
    api.updateOfficial(id, item);
    logActivity('OFFICIAL_UPDATED', 'Aparatur Desa', `Update perangkat ID: ${id}`);
  }, [logActivity]);

  const addOfficial = useCallback((item: Omit<VillageOfficial, 'id'>) => {
    const now = new Date().toISOString();
    const id = generateId('off');
    const newOff: VillageOfficial = { ...item, id, isActive: true, displayOrder: officials.length + 1, createdAt: now, updatedAt: now };
    
    setOfficials((prev) => [...prev, newOff]);
    
    if (newOff.hasAdminAccess) {
      setUsers(prevUsers => {
        const roleTitleMap: Record<string, string> = { super_admin: 'Super Administrator', admin_desa: 'Admin Desa', operator: 'Operator Modul', editor: 'Editor Publikasi' };
        const defaultUsername = newOff.name.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
        const username = newOff.adminUsername || defaultUsername;
        
        return [...prevUsers, {
          id: `usr-${id}`,
          name: newOff.name,
          username: username,
          email: `${username}@pulaubetung.sadewa.id`,
          role: newOff.adminRole || 'operator',
          roleTitle: roleTitleMap[newOff.adminRole || 'operator'] || 'Operator',
          avatar: newOff.imageUrl,
          phone: newOff.phone,
          gender: newOff.gender,
          birthDate: newOff.birthDate
        }];
      });
    }
    
    api.addOfficial(newOff);
    logActivity('OFFICIAL_ADDED', 'Aparatur Desa', `Tambah perangkat: ${item.name}`);
  }, [officials.length, logActivity]);

  const deleteOfficial = useCallback((id: string) => {
    setOfficials((prev) => prev.filter((o) => o.id !== id));
    setUsers((prevUsers) => prevUsers.filter(u => u.id !== `usr-${id}`));
    api.deleteOfficial(id);
    logActivity('OFFICIAL_DELETED', 'Aparatur Desa', `Hapus perangkat ID: ${id}`);
  }, [logActivity]);

  const addFacility = useCallback((item: Omit<MapFacility, 'id'>) => {
    const newFac: MapFacility = { ...item, id: generateId('fac') };
    setFacilities((prev) => [...prev, newFac]);
    api.addFacility(newFac);
  }, []);

  const updateFacility = useCallback((id: string, item: Partial<MapFacility>) => {
    setFacilities((prev) => prev.map((f) => f.id === id ? { ...f, ...item } : f));
    api.updateFacility(id, item);
  }, []);

  const deleteFacility = useCallback((id: string) => {
    setFacilities((prev) => prev.filter((f) => f.id !== id));
    api.deleteFacility(id);
  }, []);

  const updateUserRole = useCallback((userId: string, role: RoleType) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
  }, []);

  const addBansosRecipient = useCallback(async (item: Omit<BansosRecipient, 'id' | 'createdAt'>) => {
    // Check local duplicate first for fast feedback
    const exists = bansosRecipients.some(r => r.nik.trim() === item.nik.trim() && r.programType === item.programType);
    if (exists) {
      throw new Error(`KPM dengan NIK ${item.nik} sudah terdaftar pada jenis bantuan yang sama!`);
    }

    try {
      const now = new Date().toISOString();
      // Placeholder for actual API call if needed, currently using state + log
      const newRecipient: BansosRecipient = {
        ...item,
        id: 'kpm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        createdAt: now,
        updatedAt: now
      };

      setBansosRecipients(prev => [newRecipient, ...prev]);
      logActivity('BANSOS_RECIPIENT_ADDED', 'Bantuan Sosial', `Tambah penerima bansos: ${item.name} (${item.programName})`);
      
      // Invalidate Query Cache
      queryClient.invalidateQueries({ queryKey: ['kpm_bansos'] });
    } catch (error: any) {
      console.error('Error adding bansos recipient:', error);
      throw new Error(`Gagal menyimpan data: ${error.message}`);
    }
  }, [bansosRecipients, logActivity, queryClient]);

  const bulkAddBansosRecipients = useCallback(async (items: Omit<BansosRecipient, 'id' | 'createdAt'>[]) => {
    const now = new Date().toISOString();
    const results: BansosRecipient[] = items.map(item => ({
      ...item,
      id: 'kpm-bulk-' + Math.random().toString(36).substring(2, 10),
      createdAt: now,
      updatedAt: now
    }));
    
    setBansosRecipients(prev => [...results, ...prev]);
    logActivity('BANSOS_BULK_IMPORT', 'Bantuan Sosial', `Import masal ${items.length} KPM`);
    queryClient.invalidateQueries({ queryKey: ['kpm_bansos'] });
    return items.length;
  }, [logActivity, queryClient]);

  const replaceBansosRecipients = useCallback(async (items: Omit<BansosRecipient, 'id' | 'createdAt'>[]) => {
    return await bulkAddBansosRecipients(items);
  }, [bulkAddBansosRecipients]);

  const updateBansosRecipient = useCallback(async (id: string, item: Partial<BansosRecipient>) => {
    try {
      const now = new Date().toISOString();
      setBansosRecipients(prev => prev.map(r => r.id === id ? { ...r, ...item, updatedAt: now } : r));
      logActivity('BANSOS_RECIPIENT_UPDATED', 'Bantuan Sosial', `Update penerima bansos ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['kpm_bansos'] });
    } catch (error: any) {
      console.error('Error updating bansos recipient:', error);
      throw new Error(`Gagal update data: ${error.message}`);
    }
  }, [logActivity, queryClient]);

  const deleteBansosRecipient = useCallback(async (id: string) => {
    try {
      setBansosRecipients(prev => prev.filter(r => r.id !== id));
      logActivity('BANSOS_RECIPIENT_DELETED', 'Bantuan Sosial', `Hapus penerima bansos ID: ${id}`);
      queryClient.invalidateQueries({ queryKey: ['kpm_bansos'] });
    } catch (error: any) {
      console.error('Error deleting bansos recipient:', error);
      throw new Error(`Gagal menghapus data: ${error.message}`);
    }
  }, [logActivity, queryClient]);

  const submitBansosComplaint = useCallback(async (data: Omit<BansosComplaint, 'id' | 'createdAt' | 'status'>) => {
    try {
      const now = new Date().toISOString();
      const newComplaint: BansosComplaint = {
        ...data,
        id: generateId('bs-cmp'),
        status: 'menunggu_musdes',
        createdAt: now,
        updatedAt: now
      };

      setBansosComplaints(prev => [newComplaint, ...prev]);
      logActivity('BANSOS_COMPLAINT_SUBMITTED', 'Bantuan Sosial', `Usulan/Sanggahan Bansos baru: ${data.namaPelapor} (${data.type})`);
      return newComplaint.id;
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      throw new Error(`Gagal mengirim laporan: ${error.message}`);
    }
  }, [logActivity]);

  const updateBansosComplaintStatus = useCallback(async (id: string, status: BansosComplaint['status'], adminNotes?: string) => {
    try {
      const now = new Date().toISOString();
      setBansosComplaints(prev => prev.map(c => c.id === id ? { ...c, status, adminNotes: adminNotes ?? c.adminNotes, updatedAt: now } : c));
      logActivity('BANSOS_COMPLAINT_UPDATED', 'Bantuan Sosial', `Tindak lanjut usulan/sanggahan bansos ID: ${id} -> ${status}`);
    } catch (error: any) {
      console.error('Error updating complaint status:', error);
      throw new Error(`Gagal update status laporan: ${error.message}`);
    }
  }, [logActivity]);

  const resetAllDataToDefault = useCallback(() => {
    Object.keys(localStorage).filter(k => k.startsWith(LOCAL_STORAGE_PREFIX)).forEach(k => localStorage.removeItem(k));
    
    // Keep only the first Super Admin
    setUsers([INITIAL_USERS[0]]);
    
    // Services are templates, keep them
    setServices(INITIAL_SERVICES);
    
    // Wipe all other data
    setServiceRequests([]);
    setComplaints([]);
    setNews([]);
    setAnnouncements([]);
    setAgendas([]);
    setGallery([]);
    setDevelopmentProjects([]);
    setPotentials([]);
    setUmkm([]);
    setOfficials([]);
    setFacilities([]);
    setAuditLogs([]);
    setTerritories([]);
    setBansosRecipients(INITIAL_BANSOS_RECIPIENTS);
    setBansosComplaints(INITIAL_BANSOS_COMPLAINTS);
    
    // Reset budget to 0
    setBudget({
      year: new Date().getFullYear(),
      totalIncome: 0,
      totalExpenditure: 0,
      totalFinancing: 0,
      realizationPercentage: 0,
      incomeBreakdown: [],
      expenditureBreakdown: [],
      incomeItems: [],
      expenditureItems: [],
      financingItems: [],
      publicDocuments: []
    });
    
    // Reset profile to generic template
    setVillageProfile({
      villageName: 'Desa Pulau Betung',
      district: 'Pemayung',
      regency: 'Batang Hari',
      province: 'Jambi',
      postalCode: '36657',
      addressStreet: 'Jl. Kantor Desa No. 1, Desa Pulau Betung',
      email: 'pemdes@pulaubetung.sadewa.id',
      phone: '0821-7654-3210',
      website: 'pulaubetung.sadewa.id',
      kadesName: 'H. Sudirman',
      kadesNip: '',
      vision: 'Terwujudnya Desa yang Mandiri, Sejahtera, dan Berbudaya.',
      mission: ['Meningkatkan kualitas pelayanan publik', 'Membangun infrastruktur desa yang memadai'],
      history: '',
      totalPopulation: 0,
      totalFamilies: 0,
      areaSqKm: 0,
      borders: { north: '', south: '', east: '', west: '' },
      heroBackgroundUrl: 'https://images.unsplash.com/photo-1596423735880-5f2a689b903e?w=1600&auto=format&fit=crop&q=80',
      villageLogoUrl: '/favicon.svg',
      regencyLogoUrl: '/favicon.svg',
      kadesPhotoUrl: '',
      officialSignatureUrl: '',
      lastUpdated: new Date().toISOString()
    } as VillageProfile);

    api.resetDatabase();
  }, []);

  const deleteLandParcel = useCallback(async (id: string) => {
    setWebGisData((prev) => prev.filter((p) => p.id !== id));
    await api.deleteLandParcel(id);
    logActivity('LAND_PARCEL_DELETED', 'WebGIS Spasial', `Hapus persil tanah ID: ${id}`);
  }, [logActivity]);

  const addLandParcel = useCallback(async (data: any) => {
    const res = await api.addLandParcel(data);
    if (res.success && res.data) {
      setWebGisData((prev) => [res.data, ...prev]);
      logActivity('LAND_PARCEL_ADDED', 'WebGIS Spasial', `Tambah persil tanah: NOP ${res.data.nop}`);
    }
  }, [logActivity]);

  const updateLandParcel = useCallback(async (id: string, data: any) => {
    const res = await api.updateLandParcel(id, data);
    if (res.success && res.data) {
      setWebGisData((prev) => prev.map((p) => (p.id === id ? res.data : p)));
      logActivity('LAND_PARCEL_UPDATED', 'WebGIS Spasial', `Update persil tanah: NOP ${res.data.nop}`);
    }
  }, [logActivity]);

  return (
    <DataContext.Provider value={{
      currentUser, setCurrentUser, users, services, serviceRequests, setServiceRequests,
      deletedRequests,
      complaints, news, announcements, agendas, gallery, budget, budgetHistory,
      developmentProjects, potentials, umkm, officials, facilities, auditLogs,
      villageProfile, territories, webGisData, setWebGisData, reloadServerData,
      bansosRecipients, bansosComplaints, userLikedItems, isItemLiked, addBansosRecipient, bulkAddBansosRecipients, replaceBansosRecipients, updateBansosRecipient,
      deleteBansosRecipient, submitBansosComplaint, updateBansosComplaintStatus,
      updateBudget, submitServiceRequest, updateServiceRequestStatus, deleteServiceRequest, bulkDeleteServiceRequests,
      restoreDeletedServiceRequest, findRequestByCode, permanentlyDeleteServiceRequestLog, clearAllDeletedServiceRequests,
      submitComplaint, respondToComplaint, updateVillageProfile, updateTerritories,
      addNewsItem, updateNewsItem, deleteNewsItem, likeNewsArticle, addNewsComment, likeNewsComment,
      addAnnouncement, updateAnnouncement,
      deleteAnnouncement, addAgendaItem, updateAgendaItem, deleteAgendaItem,
      addDevelopmentProject, updateDevelopmentProject, deleteDevelopmentProject,
      likeDevelopmentProject, addProjectComment, likeProjectComment,
      addUmkmItem, deleteUmkmItem, toggleUmkmVerification, 
      addPotential, updatePotential, deletePotential,
      updateOfficial, addOfficial,
      deleteOfficial, addFacility, updateFacility, deleteFacility, updateUserRole,
      resetAllDataToDefault, logActivity,
      addLandParcel, updateLandParcel, deleteLandParcel,
      isLoading, setIsLoading
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
