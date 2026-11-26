import { Router, Request, Response as ExpressResponse } from 'express';
import crypto from 'crypto';
import {
  getPrisma,
  getVillageProfile,
  isDatabaseAvailableCached,
  isJsonFallbackAllowed
} from '../db/prisma-helpers';
import { getCurrentTenantContext } from '../db/tenantContext';
import { getDb } from '../db/database';
import { sanitizeDiagnosticMessage } from '../db/connection-diagnostic';
import { hashPassword, verifyPassword, verifyToken } from '../auth';
import { normalizeMapFacilityRecord } from '../utils/facilityNormalizer';

const allowJsonFallback = () => isJsonFallbackAllowed();

// 🏛️ INISIALISASI ROUTER UNTUK LAYANAN PUBLIK
// Jalur ini bisa diakses siapa saja (Warga, Pengunjung, Bot) tanpa perlu login admin.
const router = Router();

// ============================================================================
// 🛠️ FUNGSI PEMBANTU (HELPER FUNCTIONS)
// ============================================================================

/**
 * 🕵️ Sensor NIK (Masking)
 * Biar data pribadi warga gak bocor, kita sensor bagian tengah NIK.
 * Misal: 360105******0001
 */
function maskNik(nik: string): string {
  if (!nik || nik.length < 10) return '******';
  const start = nik.slice(0, 6);
  const end = nik.slice(-4);
  return `${start}******${end}`;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

function parseTrackingCodeFromKey(input: string): string[] {
  const results: string[] = [];
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const matches = input.match(uuidRegex);
  if (matches) results.push(...matches);
  
  const rawParts = input.split(/[^a-zA-Z0-9-]/);
  for (const part of rawParts) {
    if (part.length >= 8 && /^[a-zA-Z0-9-]+$/.test(part)) {
      results.push(part);
    }
  }
  return [...new Set(results)];
}
// ------------------------

// ============================================================================
// 🛡️ SISTEM ANTI-SPAM (RATE LIMITING LOKAL)
// ============================================================================
// Mencegah satu orang ngirim aduan ribuan kali dalam sekejap (bomber).
const complaintRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // Jendela waktu: 1 jam
const MAX_COMPLAINTS_PER_WINDOW = 3;

/**
 * 🚦 Cek Batas Kiriman
 * Ngecek apakah IP ini udah pernah lapor di jam yang sama.
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfterMin?: number } {
  const now = Date.now();
  const lastTime = complaintRateLimit.get(ip);
  
  if (lastTime && now - lastTime < RATE_LIMIT_WINDOW_MS) {
    // Implementasi cooldown sederhana: 1 aduan per 1 jam per IP
    const remainingMs = RATE_LIMIT_WINDOW_MS - (now - lastTime);
    return { allowed: false, retryAfterMin: Math.ceil(remainingMs / 60000) };
  }
  
  complaintRateLimit.set(ip, now);
  return { allowed: true };
}
// ------------------------

router.get('/tenant-info', (_req: Request, res: ExpressResponse) => {
  const ctx = getCurrentTenantContext();
  return res.json({
    success: true,
    data: ctx?.tenantId
      ? {
          id: ctx.tenantId,
          slug: ctx.slug,
          name: ctx.tenantName || null,
          tenancyMode: ctx.tenancyMode
        }
      : null
  });
});

/**
 * Agregasi Demografi Publik (Patuh UU PDP No. 27/2022)
 * Menghitung statistik agregat dari tabel Resident di sisi server.
 * TIDAK PERNAH mengembalikan NIK, Nomor KK, Nama, Tanggal Lahir, maupun Alamat warga.
 */
interface DemographicResidentRow {
  gender?: string | null;
  birthDate?: Date | string | null;
  education?: string | null;
  occupation?: string | null;
  kkNumber?: string | null;
  dusun?: { name?: string | null } | string | null;
}

function buildEmptyDemographics() {
  return {
    hasMasterData: false,
    totalPopulation: 0,
    totalFamilies: 0,
    maleCount: 0,
    femaleCount: 0,
    dusunData: [],
    ageGroupData: [],
    homeAgeData: [],
    occupationData: [],
    educationData: []
  };
}

function computePublicDemographics(
  residents: DemographicResidentRow[],
  dusunNames: string[] = []
) {
  if (!Array.isArray(residents) || residents.length === 0) {
    return buildEmptyDemographics();
  }

  const totalPopulation = residents.length;
  const kkSet = new Set<string>();
  let maleCount = 0;
  let femaleCount = 0;

  const dusunMap = new Map<
    string,
    { total: number; kkSet: Set<string>; laki: number; perempuan: number }
  >();
  for (const dName of dusunNames) {
    const clean = dName?.trim();
    if (clean && !dusunMap.has(clean)) {
      dusunMap.set(clean, { total: 0, kkSet: new Set(), laki: 0, perempuan: 0 });
    }
  }

  const ageCounts = [
    { range: '0 - 4 Thn (Balita)', count: 0, color: '#10b981', desc: 'Prioritas e-Posyandu & Pencegahan Stunting' },
    { range: '5 - 14 Thn (Anak/Pelajar)', count: 0, color: '#06b6d4', desc: 'Wajib Belajar Pendidikan Dasar' },
    { range: '15 - 39 Thn (Pemuda/Produktif)', count: 0, color: '#3b82f6', desc: 'Tenaga Kerja & Wirausaha Muda' },
    { range: '40 - 59 Thn (Pra-Lansia)', count: 0, color: '#f59e0b', desc: 'Penggerak Ekonomi & Rumah Tangga' },
    { range: '≥ 60 Thn (Lansia)', count: 0, color: '#8b5cf6', desc: 'Layanan Posbindu & Jaminan Sosial' },
    { range: 'Tidak Diketahui', count: 0, color: '#64748b', desc: 'Format tanggal lahir kosong atau tidak valid' }
  ];

  const homeAgeGroups = [
    { name: '0-5', min: 0, max: 5, value: 0 },
    { name: '6-12', min: 6, max: 12, value: 0 },
    { name: '13-17', min: 13, max: 17, value: 0 },
    { name: '18-25', min: 18, max: 25, value: 0 },
    { name: '26-45', min: 26, max: 45, value: 0 },
    { name: '46-60', min: 46, max: 60, value: 0 },
    { name: '60+', min: 61, max: 200, value: 0 },
    { name: 'Tidak Diketahui', min: -999, max: -1, value: 0 }
  ];

  const occMap: Record<string, number> = {};
  const eduMap: Record<string, number> = {};

  const today = new Date();
  const calcAge = (rawDate: Date | string | null | undefined): number | null => {
    if (!rawDate) return null;
    const b = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (isNaN(b.getTime()) || b > today) return null;
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    if (age < 0 || age > 130) return null;
    return age;
  };

  for (const r of residents) {
    const kk = typeof r.kkNumber === 'string' ? r.kkNumber.trim() : '';
    if (kk) kkSet.add(kk);

    const genderNorm = (r.gender || '').trim().toLowerCase();
    const isMale = genderNorm === 'laki-laki' || genderNorm === 'l' || genderNorm === 'male';
    const isFemale = genderNorm === 'perempuan' || genderNorm === 'p' || genderNorm === 'female';
    if (isMale) maleCount++;
    else if (isFemale) femaleCount++;

    const rawDusun =
      typeof r.dusun === 'object' && r.dusun !== null
        ? r.dusun.name
        : typeof r.dusun === 'string'
        ? r.dusun
        : '';
    const dName = (rawDusun || '').trim() || 'Lainnya';
    if (!dusunMap.has(dName)) {
      dusunMap.set(dName, { total: 0, kkSet: new Set(), laki: 0, perempuan: 0 });
    }
    const dStat = dusunMap.get(dName)!;
    dStat.total += 1;
    if (kk) dStat.kkSet.add(kk);
    if (isMale) dStat.laki += 1;
    else if (isFemale) dStat.perempuan += 1;

    const age = calcAge(r.birthDate);
    if (age === null) {
      ageCounts[5].count++;
      homeAgeGroups[7].value++;
    } else {
      if (age <= 4) ageCounts[0].count++;
      else if (age <= 14) ageCounts[1].count++;
      else if (age <= 39) ageCounts[2].count++;
      else if (age <= 59) ageCounts[3].count++;
      else ageCounts[4].count++;

      const hg = homeAgeGroups.find((g) => age >= g.min && age <= g.max);
      if (hg) hg.value++;
    }

    const occ = (r.occupation || '').trim() || 'Lainnya';
    occMap[occ] = (occMap[occ] || 0) + 1;

    const edu = (r.education || '').trim() || 'Tidak/Belum Sekolah';
    eduMap[edu] = (eduMap[edu] || 0) + 1;
  }

  const dusunData = Array.from(dusunMap.entries())
    .filter(([name, stat]) => name !== 'Lainnya' || stat.total > 0)
    .map(([name, stat]) => ({
      name,
      total: stat.total,
      kk: stat.kkSet.size || (stat.total > 0 ? Math.max(1, Math.round(stat.total / 3.6)) : 0),
      laki: stat.laki,
      perempuan: stat.perempuan
    }));

  const ageGroupData = ageCounts
    .filter((c, idx) => idx < 5 || c.count > 0)
    .map((c) => ({
      range: c.range,
      jumlah: c.count,
      persentase: parseFloat(((c.count / totalPopulation) * 100).toFixed(1)),
      color: c.color,
      desc: c.desc
    }));

  const homeAgeData = homeAgeGroups
    .filter((g) => g.name !== 'Tidak Diketahui' || g.value > 0)
    .map(({ name, value }) => ({ name, value }));

  const occColors = ['#059669', '#0284c7', '#d97706', '#7c3aed', '#db2777', '#64748b', '#10b981'];
  const occupationData = Object.entries(occMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, val], idx) => ({
      name,
      value: val,
      pct: `${((val / totalPopulation) * 100).toFixed(1)}%`,
      color: occColors[idx % occColors.length]
    }));

  const eduColors = ['#94a3b8', '#38bdf8', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
  const educationData = Object.entries(eduMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([level, total], idx) => ({
      level,
      total,
      color: eduColors[idx % eduColors.length]
    }));

  return {
    hasMasterData: true,
    totalPopulation,
    totalFamilies: kkSet.size || Math.max(1, Math.round(totalPopulation / 3.6)),
    maleCount,
    femaleCount,
    dusunData,
    ageGroupData,
    homeAgeData,
    occupationData,
    educationData
  };
}

async function getPublicDemographicsPayload() {
  try {
    if (!(await isDatabaseAvailableCached())) {
      if (allowJsonFallback()) {
        const db = getDb();
        const rawResidents = Array.isArray(db.residents) ? db.residents : [];
        const active = rawResidents.filter(
          (r: any) => !r.status || String(r.status).toUpperCase() === 'HIDUP'
        );
        const dusunNames = Array.isArray(db.territories)
          ? db.territories.map((t: any) => t.name).filter(Boolean)
          : [];
        return computePublicDemographics(active, dusunNames);
      }
      return buildEmptyDemographics();
    }

    const p = getPrisma();
    const [dusuns, residents] = await Promise.all([
      p.dusun
        .findMany({
          where: { isActive: true },
          orderBy: { number: 'asc' },
          select: { name: true }
        })
        .catch(() => []),
      p.resident
        .findMany({
          where: { status: 'HIDUP', isActive: true },
          select: {
            gender: true,
            birthDate: true,
            education: true,
            occupation: true,
            kkNumber: true,
            dusun: { select: { name: true } }
          }
        })
        .catch(() => [])
    ]);

    return computePublicDemographics(
      residents,
      dusuns.map((d: any) => d.name).filter(Boolean)
    );
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-DEMOGRAPHICS-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return buildEmptyDemographics();
  }
}

// 1. All public data bundle for efficient bootstrapping
router.get('/bootstrap', async (req: Request, res: ExpressResponse) => {
  try {
    const dbAvailable = await isDatabaseAvailableCached();
    if (!dbAvailable) {
      if (allowJsonFallback()) {
        const db = getDb() as any;
        const fallbackBudgetHistory =
          Array.isArray(db.budgetHistory) && db.budgetHistory.length > 0
            ? db.budgetHistory
            : db.budget
            ? [db.budget]
            : [];
        const demographics = await getPublicDemographicsPayload();
        const fallbackPublicComplaints = (db.complaints || [])
          .filter((c: any) => c.isPublic === true)
          .slice(0, 30)
          .map((c: any) => ({
            id: c.id,
            ticketNumber: c.ticketNumber,
            category: c.category,
            title: c.title,
            content: c.content,
            reporterName: c.isAnonymous ? 'Warga Anonim' : c.reporterName,
            location: c.location,
            status: c.status,
            adminResponse: c.adminResponse,
            respondedBy: c.respondedBy,
            isPublic: true,
            fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian || null,
            catatanTindakLanjut: c.catatanTindakLanjut || null,
            date: c.createdAt || c.date,
            createdAt: c.createdAt || c.date,
            updatedAt: c.updatedAt || c.createdAt || c.date
          }));
        return res.json({
          success: true,
          degraded: true,
          data: {
            profile: db.villageProfile || null,
            services: (db.services || []).filter((s: any) => s.isActive !== false),
            news: (db.news || []).filter((n: any) => n.isPublished !== false),
            announcements: (db.announcements || []).filter((a: any) => a.isActive !== false),
            agendas: db.agendas || [],
            projects: db.developmentProjects || [],
            budget: db.budget || fallbackBudgetHistory[0] || null,
            budgetHistory: fallbackBudgetHistory,
            officials: (db.officials || []).filter((o: any) => o.isActive !== false),
            potentials: db.potentials || [],
            umkm: (db.umkm || []).filter((u: any) => u.isVerified !== false),
            facilities: (db.facilities || []).map(normalizeMapFacilityRecord),
            gallery: db.gallery || [],
            territories: db.territories || [],
            publicComplaints: fallbackPublicComplaints,
            posyanduSchedules: db.posyanduSchedules || [],
            demographics
          }
        });
      }
      return res.json({
        success: true,
        degraded: true,
        data: {
          profile: null,
          services: [],
          news: [],
          announcements: [],
          agendas: [],
          projects: [],
          budget: null,
          budgetHistory: [],
          officials: [],
          potentials: [],
          umkm: [],
          facilities: [],
          gallery: [],
          territories: [],
          publicComplaints: [],
          posyanduSchedules: [],
          demographics: buildEmptyDemographics()
        }
      });
    }

    const p = getPrisma();
    
    // Tarik seluruh data secara paralel dengan Promise.all
    // Tambahkan .catch(() => []) agar jika satu tabel error, yang lain tetap jalan
    const [
      profile,
      services,
      news,
      announcements,
      agendas,
      projects,
      budgetHistory,
      officials,
      potentials,
      umkm,
      facilities,
      gallery,
      territories,
      publicComplaintsRaw,
      posyanduSchedules,
      demographics
    ] = await Promise.all([
      getVillageProfile().catch(() => null),
      p.villageService.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }).catch(() => []),
      p.newsItem.findMany({ 
        where: { isPublished: true }, 
        take: 50, 
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          publishedAt: true,
          category: true,
          summary: true,
          content: true,
          author: true,
          views: true,
          isPublished: true,
          gallery: true
        }
      }).catch(() => []),
      p.announcement.findMany({ 
        where: { isActive: true }, 
        take: 30, 
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          content: true,
          priority: true,
          publishedAt: true,
          validUntil: true,
          isActive: true,
          attachmentName: true,
          attachmentUrl: true
        }
      }).catch(() => []),
      p.agendaItem.findMany({ take: 50, orderBy: { date: 'desc' } }).catch(() => []),
      p.developmentProject.findMany({ take: 50, orderBy: { fiscalYear: 'desc' } }).catch(() => []),
      p.budgetYearData.findMany({ orderBy: { year: 'desc' } }).catch(() => []),
      p.villageOfficial.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }).catch(() => []),
      p.villagePotential.findMany({ take: 50 }).catch(() => []),
      p.umkmItem.findMany({ where: { isVerified: true }, take: 50 }).catch(() => []),
      p.mapFacility.findMany({ take: 100 }).catch(() => []),
      p.galleryItem.findMany({ take: 50, orderBy: { date: 'desc' } }).catch(() => []),
      p.dusun.findMany({
        where: { isActive: true },
        include: { 
          rws: { 
            where: { isActive: true }, 
            include: { 
              rts: { where: { isActive: true } } 
            } 
          } 
        },
        orderBy: { number: 'asc' }
      }).catch(() => []),
      p.complaint.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 30
      }).catch(() => []),
      p.posyanduSchedule.findMany({
        orderBy: { scheduleDate: 'asc' },
        take: 30
      }).catch(() => []),
      getPublicDemographicsPayload()
    ]);

    const publicComplaints = (Array.isArray(publicComplaintsRaw) ? publicComplaintsRaw : []).map((c: any) => ({
      id: c.id,
      ticketNumber: c.ticketNumber,
      category: c.category,
      title: c.title,
      content: c.content,
      reporterName: c.isAnonymous ? 'Warga Anonim' : c.reporterName,
      location: c.location,
      status: c.status,
      adminResponse: c.adminResponse,
      respondedBy: c.respondedBy,
      isPublic: true,
      fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian || null,
      catatanTindakLanjut: c.catatanTindakLanjut || null,
      date: c.createdAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    const budget = Array.isArray(budgetHistory) && budgetHistory.length > 0 ? budgetHistory[0] : null;

    return res.json({
      success: true,
      data: {
        profile,
        services,
        news,
        announcements,
        agendas,
        projects,
        budget,
        budgetHistory,
        officials,
        potentials,
        umkm,
        facilities: (Array.isArray(facilities) ? facilities : []).map(normalizeMapFacilityRecord),
        gallery,
        territories,
        publicComplaints,
        posyanduSchedules,
        demographics
      }
    });
  } catch (error: any) {
    console.warn('⚠️ [BOOTSTRAP-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(503).json({ 
      success: false, 
      error: 'Layanan data desa sedang sibuk. Silakan segarkan halaman dalam beberapa saat.' 
    });
  }
});

// 1b. Public Aggregate Demographics (UU PDP Compliant - Zero PII)
router.get('/demographics', async (_req: Request, res: ExpressResponse) => {
  const data = await getPublicDemographicsPayload();
  return res.json({ success: true, data });
});

// 1c. Public APBDes Multi-Year History
router.get('/budgets', async (_req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb() : null;
      const history = fallback
        ? (Array.isArray(fallback.budgetHistory) && fallback.budgetHistory.length > 0
            ? fallback.budgetHistory
            : fallback.budget
            ? [fallback.budget]
            : [])
        : [];
      return res.json({ success: true, degraded: true, data: history });
    }

    const budgets = await getPrisma().budgetYearData.findMany({
      orderBy: { year: 'desc' }
    });
    return res.json({ success: true, data: budgets });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-BUDGETS-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar APBDes publik.' });
  }
});

// 2. Village Profile
router.get('/profile', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb().villageProfile || null : null;
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getVillageProfile();
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-PROFILE-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? getDb().villageProfile || null : null;
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 2b. Master Wilayah Publik (Dusun -> RW -> RT)
router.get('/territories', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb().territories || [] : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().dusun.findMany({
      where: { isActive: true },
      include: {
        rws: {
          where: { isActive: true },
          include: {
            rts: { where: { isActive: true } }
          }
        }
      },
      orderBy: { number: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-TERRITORIES-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? getDb().territories || [] : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 3. Services Catalog
router.get('/services', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? (getDb().services || []).filter((s: any) => s.isActive !== false) : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().villageService.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-SERVICES-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? (getDb().services || []).filter((s: any) => s.isActive !== false) : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 4. Online Service Application (Surat Online Warga)
router.post('/services/apply', async (req: Request, res: ExpressResponse) => {
  try {
    const {
      serviceId,
      citizenName,
      citizenNik,
      phone,
      addressDusun,
      citizenGender,
      citizenBirthPlace,
      citizenBirthDate,
      dusunId,
      rwId,
      rtId,
      formData,
      notes,
      fileAttachmentName,
      fileAttachmentUrl,
      ktpAttachmentUrl
    } = req.body;

    if (!serviceId || !citizenName || !citizenNik || !phone || !addressDusun) {
      return res.status(400).json({
        success: false,
        error: 'Harap lengkapi semua kolom wajib: Layanan, Nama Lengkap, NIK, No. Telepon, dan Dusun/RT.'
      });
    }

    // Validate NIK format (16 digits)
    const cleanNik = citizenNik.trim().replace(/\s/g, '');
    if (!/^\d{16}$/.test(cleanNik)) {
      return res.status(400).json({
        success: false,
        error: 'Format NIK tidak valid. NIK harus terdiri dari 16 digit angka resmi.'
      });
    }

    if (!(await isDatabaseAvailableCached())) {
      return res.status(503).json({
        success: false,
        error: 'Koneksi database sedang tidak tersedia. Pengajuan surat belum dapat diproses.'
      });
    }

    const prisma = getPrisma();
    const service = await prisma.villageService.findFirst({ where: { id: serviceId } });

    if (!service) {
      return res.status(404).json({ success: false, error: 'Layanan administrasi tidak ditemukan.' });
    }

    const activeCtx = getCurrentTenantContext();
    const profile = await getVillageProfile().catch(() => null);
    const shortCode = (
      profile?.letterCodePrefix?.split('-')[0] ||
      activeCtx?.letterCodePrefix?.split('-')[0] ||
      'PB'
    )
      .replace(/[^A-Z0-9]/gi, '')
      .slice(0, 6)
      .toUpperCase() || 'PB';

    // Generate Secure Tracking Code (UUID based to prevent collision)
    const trackingCode = `REQ-${shortCode}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const newRequest = await prisma.serviceRequest.create({
      data: {
        trackingCode,
        serviceId: service.id,
        serviceName: service.name,
        citizenName: citizenName.trim(),
        citizenNik: cleanNik,
        citizenNikMasked: maskNik(cleanNik),
        phone: phone.trim(),
        addressDusun: addressDusun.trim(),
        citizenGender: citizenGender || null,
        citizenBirthPlace: citizenBirthPlace ? String(citizenBirthPlace).trim() : null,
        citizenBirthDate: citizenBirthDate || null,
        dusunId: dusunId || null,
        rwId: rwId || null,
        rtId: rtId || null,
        formData: formData || {},
        status: 'diajukan',
        notes: notes || '',
        staffNotes: 'Permohonan berhasil diterima sistem. Menunggu verifikasi berkas oleh petugas pelayanan.',
        fileAttachmentName: fileAttachmentName || '',
        fileAttachmentUrl: fileAttachmentUrl || '',
        ktpAttachmentUrl: ktpAttachmentUrl || ''
      }
    });

    const villageDisplayName = profile?.villageName || activeCtx?.tenantName || 'Pemerintah Desa';
    return res.status(201).json({
      success: true,
      message: `Permohonan surat berhasil dikirim ke Kantor ${villageDisplayName}.`,
      data: {
        id: newRequest.id,
        trackingCode: newRequest.trackingCode,
        serviceName: service.name,
        citizenName: newRequest.citizenName,
        citizenNikMasked: newRequest.citizenNikMasked,
        status: newRequest.status,
        requestDate: newRequest.requestDate
      }
    });
  } catch (error: any) {
    console.warn('⚠️ [SERVICE-APPLY-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal mengirim permohonan surat. Silakan coba lagi.' });
  }
});

// 5. Public Application Tracking (FIX 6: Exact Match, Limited Columns, Generic 404)
router.get('/tracking/:code', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      return res.status(503).json({
        success: false,
        error: 'Koneksi database sedang tidak tersedia untuk pelacakan permohonan.'
      });
    }

    const rawCode = (req.params.code || '').trim();
    const prisma = getPrisma();

    const found = await prisma.serviceRequest.findFirst({
      where: { trackingCode: rawCode },
      select: {
        status: true,
        serviceName: true,
        officialLetterNumber: true,
        requestDate: true,
        completedAt: true
      }
    });

    if (!found) {
      return res.status(404).json({
        success: false,
        error: 'Kode pelacakan tidak ditemukan. Pastikan kode yang Anda masukkan sudah benar.'
      });
    }

    return res.json({
      success: true,
      data: found
    });
  } catch (error: any) {
    console.warn('⚠️ [TRACKING-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan saat melacak permohonan.' });
  }
});

// 5b. Authoritative Backend QR & Document Verification Endpoint

// Source of truth for validating official letter authenticity
// Keyword: QR_VERIFICATION, OFFICIAL_LETTER, LETTER_NUMBER
const handleDocumentVerification = async (req: Request, res: ExpressResponse) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    const queryCode = (req.query.trackingCode || req.query.code || req.query.resi || req.params.identifier || '') as string;
    const letterNumber = typeof req.query.letterNumber === 'string'
      ? req.query.letterNumber.trim()
      : typeof req.query.noSurat === 'string'
      ? req.query.noSurat.trim()
      : '';
    const searchKey = queryCode.trim();

    if (!searchKey) {
      return res.status(400).json({
        success: false,
        verified: false,
        reason: 'MISSING_PARAMETER',
        error: 'Nomor identifikasi surat (Nomor Surat / Resi / ID) wajib disertakan untuk verifikasi.'
      });
    }

    const candidateKeys = parseTrackingCodeFromKey(searchKey);
    if (letterNumber) {
      candidateKeys.push(...parseTrackingCodeFromKey(letterNumber));
    }
    
    if (!(await isDatabaseAvailableCached())) {
      return res.status(503).json({
        success: false,
        verified: false,
        reason: 'DATABASE_UNAVAILABLE',
        error: 'Layanan verifikasi dokumen belum dapat mengakses database saat ini.'
      });
    }

    const prisma = getPrisma();
    const cleanSearchKey = searchKey.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const [requestItem, activeProfile] = await Promise.all([
      prisma.serviceRequest.findFirst({
        where: {
          OR: [
            { trackingCode: { in: candidateKeys } },
            { officialLetterNumber: { in: candidateKeys } },
            { id: { in: candidateKeys } },
            { trackingCode: { contains: cleanSearchKey, mode: 'insensitive' } },
            { officialLetterNumber: { contains: cleanSearchKey, mode: 'insensitive' } }
          ]
        }
      }),
      getVillageProfile().catch(() => null)
    ]);

    const snapshot = (requestItem?.letterheadSnapshot || null) as Record<string, any> | null;
    const authorityVillageName =
      snapshot?.villageName ||
      activeProfile?.villageName ||
      getCurrentTenantContext()?.tenantName ||
      'Desa Pulau Betung';
    const authorityDistrict = snapshot?.district || activeProfile?.district || 'Kecamatan Pemayung';
    const authorityRegency = snapshot?.regency || activeProfile?.regency || 'Kabupaten Batang Hari';
    const authorityPrefix = activeProfile?.letterCodePrefix || getCurrentTenantContext()?.letterCodePrefix || 'PB-PMY';
    const fullAuthority = `Pemerintah ${authorityVillageName}, ${authorityDistrict}, ${authorityRegency}`;

    if (!requestItem) {
      return res.status(404).json({
        success: false,
        verified: false,
        reason: 'DOCUMENT_NOT_FOUND',
        error: `Dokumen dengan nomor registrasi / kode '${searchKey}' TIDAK DITEMUKAN dalam arsip resmi Pemerintah ${authorityVillageName}.`
      });
    }

    const currentStatusRaw = (requestItem.status || '').toLowerCase();
    const currentStatusDisplay = (requestItem.status || 'DIPROSES').toUpperCase();

    let validityState: 'VALID' | 'CANCELLED' | 'PENDING' = 'VALID';
    let isVerified = false;
    let message = '';

    if (currentStatusRaw.includes('ditolak') || currentStatusRaw.includes('batal') || currentStatusRaw.includes('rejected') || currentStatusRaw.includes('cancel')) {
      validityState = 'CANCELLED';
      isVerified = false;
      message = `PERINGATAN: Dokumen ini telah DIBATALKAN / DITOLAK oleh Pemerintah ${authorityVillageName}. Dokumen fisik tidak berlaku lagi untuk keabsahan administrasi.`;
    } else if (currentStatusRaw === 'diajukan' || currentStatusRaw === 'diproses' || currentStatusRaw === 'menunggu') {
      validityState = 'PENDING';
      isVerified = false;
      message = 'Dokumen terdaftar dalam sistem desa, namun MASIH DALAM PROSES VERIFIKASI / PERSETUJUAN (Belum diterbitkan resmi oleh Kepala Desa).';
    } else {
      validityState = 'VALID';
      isVerified = true;
      message = `Dokumen RESMI TERVERIFIKASI SAH dan terdaftar secara elektronik oleh Pemerintah ${authorityVillageName}.`;
    }

    const officialNumber = requestItem.officialLetterNumber || `470 / ${requestItem.id.replace('req-', '')} / SK-DESA / ${authorityPrefix} / IX / ${new Date().getFullYear()}`;

    return res.status(200).json({
      success: true,
      verified: isVerified,
      validityState,
      trackingCode: requestItem.trackingCode,
      letterNumber: officialNumber,
      status: currentStatusDisplay,
      message,
      notes: requestItem.notes || requestItem.staffNotes,
      certificate: {
        trackingCode: requestItem.trackingCode,
        officialLetterNumber: officialNumber,
        serviceName: requestItem.serviceName,
        citizenName: requestItem.citizenName,
        citizenNikMasked: requestItem.citizenNikMasked || maskNik(requestItem.citizenNik || ''),
        completedAt: (requestItem.updatedAt || requestItem.createdAt).toISOString(),
        authority: fullAuthority,
        verificationTimestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.warn('⚠️ [VERIFY-DOC-ERROR]:', sanitizeDiagnosticMessage(err?.message || String(err)));
    return res.status(500).json({
      success: false,
      verified: false,
      reason: 'SERVER_ERROR',
      error: 'Terjadi kesalahan internal pada server verifikasi dokumen desa.'
    });
  }
};

router.get('/verify-document', handleDocumentVerification);
router.get('/verify/:identifier', handleDocumentVerification);
router.get('/v/:slug/verify/:identifier', handleDocumentVerification);


// 6. Public Complaints Submission
router.post('/complaints', async (req: Request, res: ExpressResponse) => {
  try {
    const { category, title, content, reporterName, isAnonymous, reporterContact, location, attachmentUrl } = req.body;

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const limitStatus = checkRateLimit(ip);
    if (!limitStatus.allowed) {
      return res.status(429).json({
        success: false,
        error: `Anda telah mengirim pengaduan baru-baru ini. Harap tunggu ${limitStatus.retryAfterMin} menit lagi sebelum mengirim laporan baru.`
      });
    }

    if (!category || !title || !content || !location) {
      return res.status(400).json({
        success: false,
        error: 'Harap lengkapi kolom Kategori, Judul, Uraian Laporan, dan Lokasi Kejadian.'
      });
    }

    if (!(await isDatabaseAvailableCached())) {
      return res.status(503).json({
        success: false,
        error: 'Koneksi database belum tersedia. Pengaduan belum dapat disimpan ke server.'
      });
    }

    const prisma = getPrisma();
    const [currentCount, profile] = await Promise.all([
      prisma.complaint.count(),
      getVillageProfile().catch(() => null)
    ]);
    const activeCtx = getCurrentTenantContext();
    const shortCode = (
      profile?.letterCodePrefix?.split('-')[0] ||
      activeCtx?.letterCodePrefix?.split('-')[0] ||
      'PB'
    )
      .replace(/[^A-Z0-9]/gi, '')
      .slice(0, 6)
      .toUpperCase() || 'PB';
    const yearNow = new Date().getFullYear();
    const ticketNumber = `ADU-${shortCode}-${yearNow}-${String(currentCount + 1).padStart(3, '0')}`;
    const villageLabel = profile?.villageName || activeCtx?.tenantName || 'Pemerintah Desa';

    const newComplaint = await prisma.complaint.create({
      data: {
        ticketNumber,
        category,
        title: title.trim(),
        content: content.trim(),
        reporterName: isAnonymous ? 'Warga Anonim' : (reporterName || 'Masyarakat'),
        isAnonymous: !!isAnonymous,
        reporterContact: isAnonymous ? null : (reporterContact || ''),
        location: location.trim(),
        status: 'diterima',
        adminResponse: `Laporan telah diterima di sistem pengaduan terpadu ${villageLabel} dan segera diteruskan ke penanggung jawab terkait.`,
        fotoBuktiPenyelesaian: null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Pengaduan berhasil didaftarkan.',
      data: {
        ticketNumber: newComplaint.ticketNumber,
        title: newComplaint.title,
        status: newComplaint.status,
        createdAt: newComplaint.createdAt
      }
    });
  } catch (error: any) {
    console.warn('⚠️ [COMPLAINT-POST-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal mengirim pengaduan. Silakan coba lagi.' });
  }
});

// 7. Track Complaint by Ticket
router.get('/complaints/track/:ticket', async (req: Request, res: ExpressResponse) => {
  try {
    const ticket = req.params.ticket.trim().toUpperCase();

    if (!(await isDatabaseAvailableCached())) {
      if (allowJsonFallback()) {
        const found = (getDb().complaints || []).find(
          (c: any) => String(c.ticketNumber || '').toUpperCase() === ticket
        );
        if (!found) {
          return res.status(404).json({
            success: false,
            error: `Nomor tiket aduan '${ticket}' tidak ditemukan.`
          });
        }
        return res.json({
          success: true,
          degraded: true,
          data: {
            id: found.id,
            ticketNumber: found.ticketNumber,
            category: found.category,
            title: found.title,
            content: found.content,
            reporterName: found.isAnonymous ? 'Warga Anonim' : found.reporterName,
            location: found.location,
            status: found.status,
            adminResponse: found.adminResponse,
            respondedBy: found.respondedBy,
            isPublic: Boolean(found.isPublic),
            fotoBuktiPenyelesaian: found.fotoBuktiPenyelesaian || null,
            catatanTindakLanjut: found.catatanTindakLanjut || null,
            date: found.createdAt || found.date,
            createdAt: found.createdAt || found.date,
            updatedAt: found.updatedAt || found.createdAt || found.date
          }
        });
      }
      return res.status(503).json({
        success: false,
        error: 'Koneksi database belum tersedia untuk pelacakan pengaduan.'
      });
    }

    const prisma = getPrisma();

    const found = await prisma.complaint.findFirst({
      where: { ticketNumber: { equals: ticket, mode: 'insensitive' } }
    });

    if (!found) {
      return res.status(404).json({
        success: false,
        error: `Nomor tiket aduan '${ticket}' tidak ditemukan.`
      });
    }

    return res.json({
      success: true,
      data: {
        id: found.id,
        ticketNumber: found.ticketNumber,
        category: found.category,
        title: found.title,
        content: found.content,
        reporterName: found.isAnonymous ? 'Warga Anonim' : found.reporterName,
        location: found.location,
        status: found.status,
        adminResponse: found.adminResponse,
        respondedBy: found.respondedBy,
        isPublic: Boolean(found.isPublic),
        fotoBuktiPenyelesaian: found.fotoBuktiPenyelesaian || null,
        catatanTindakLanjut: found.catatanTindakLanjut || null,
        date: found.createdAt,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt
      }
    });
  } catch (error: any) {
    console.warn('⚠️ [COMPLAINT-TRACK-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal melacak pengaduan.' });
  }
});

// 8. Public resolved complaints feed (FIX 7: Filter by isPublic=true)
router.get('/complaints/public', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const list = allowJsonFallback()
        ? (getDb().complaints || []).filter((c: any) => c.isPublic).slice(0, 30).map((c: any) => ({
            id: c.id,
            ticketNumber: c.ticketNumber,
            category: c.category,
            title: c.title,
            content: c.content,
            reporterName: c.isAnonymous ? 'Warga Anonim' : c.reporterName,
            location: c.location,
            status: c.status,
            adminResponse: c.adminResponse,
            respondedBy: c.respondedBy,
            isPublic: true,
            fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian || null,
            catatanTindakLanjut: c.catatanTindakLanjut || null,
            date: c.createdAt || c.date,
            createdAt: c.createdAt || c.date,
            updatedAt: c.updatedAt || c.createdAt || c.date
          }))
        : [];
      return res.json({ success: true, data: list, degraded: true });
    }
    const prisma = getPrisma();
    const list = await prisma.complaint.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    const sanitizedList = list.map((c: any) => ({
      id: c.id,
      ticketNumber: c.ticketNumber,
      category: c.category,
      title: c.title,
      content: c.content,
      reporterName: c.isAnonymous ? 'Warga Anonim' : c.reporterName,
      location: c.location,
      status: c.status,
      adminResponse: c.adminResponse,
      respondedBy: c.respondedBy,
      isPublic: true,
      fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian || null,
      catatanTindakLanjut: c.catatanTindakLanjut || null,
      date: c.createdAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
    
    return res.json({ success: true, data: sanitizedList });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-COMPLAINTS-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.json({ success: true, data: [], degraded: true });
  }
});

// 9. News / Berita
router.get('/news', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? (getDb().news || []).filter((n: any) => n.isPublished !== false) : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().newsItem.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-NEWS-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? (getDb().news || []).filter((n: any) => n.isPublished !== false) : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 10. Announcements
router.get('/announcements', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? (getDb().announcements || []).filter((a: any) => a.isActive !== false) : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().announcement.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-ANNOUNCEMENTS-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? (getDb().announcements || []).filter((a: any) => a.isActive !== false) : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 11. Agendas
router.get('/agendas', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb().agendas || [] : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().agendaItem.findMany({
      orderBy: { date: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-AGENDAS-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? getDb().agendas || [] : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 12. Development Projects
router.get('/projects', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb().developmentProjects || [] : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().developmentProject.findMany({
      orderBy: { fiscalYear: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-PROJECTS-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? getDb().developmentProjects || [] : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 13. Transparency / APBDes
router.get('/transparency', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallbackBudget = allowJsonFallback() ? getDb().budget || null : null;
      return res.json({
        success: true,
        degraded: true,
        data: {
          budget: fallbackBudget,
          isDemoDataNotice: true,
          noticeText: 'Data APBDes dan rincian alokasi belanja yang ditampilkan berstatus simulasi percontohan sebelum pengesahan lembaran Perdes definitif 2026.'
        }
      });
    }
    const budget = await getPrisma().budgetYearData.findFirst({
      orderBy: { year: 'desc' }
    });
    return res.json({
      success: true,
      data: {
        budget,
        isDemoDataNotice: true,
        noticeText: 'Data APBDes dan rincian alokasi belanja yang ditampilkan berstatus simulasi percontohan sebelum pengesahan lembaran Perdes definitif 2026.'
      }
    });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-TRANSPARENCY-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallbackBudget = allowJsonFallback() ? getDb().budget || null : null;
    return res.json({
      success: true,
      degraded: true,
      data: {
        budget: fallbackBudget,
        isDemoDataNotice: true,
        noticeText: 'Data APBDes dan rincian alokasi belanja yang ditampilkan berstatus simulasi percontohan sebelum pengesahan lembaran Perdes definitif 2026.'
      }
    });
  }
});

// 14. Officials / Aparatur
router.get('/officials', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? (getDb().officials || []).filter((o: any) => o.isActive !== false) : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().villageOfficial.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-OFFICIALS-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? (getDb().officials || []).filter((o: any) => o.isActive !== false) : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 15. Potentials, UMKM, Facilities, Gallery
router.get('/kpm', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      return res.json({ success: true, data: [], degraded: true });
    }
    const prisma = getPrisma();
    const kpmList = await prisma.resident.findMany({
      where: {
        OR: [
          { bansosRecipients: { some: {} } }
        ]
      },
      include: {
        bansosRecipients: true,
        dusun: true,
        rt: true,
        rw: true
      },
      take: 100
    });

    const sanitized = kpmList.flatMap((r: any) => 
      (r.bansosRecipients || []).map((b: any) => {
        const kk = r.kkNumber || r.noKk || '';
        const rawStatus = String(b.status || '').toLowerCase();
        const displayStatus = rawStatus.includes('salur') ? 'tersalurkan' : (rawStatus.includes('tunda') ? 'proses_verifikasi' : 'siap_diambil');
        const progName = b.programName || 'Bantuan Sosial';
        const progType = progName.includes('PKH') ? 'PKH' :
                         progName.includes('BPNT') || progName.includes('Sembako') ? 'BPNT' :
                         progName.includes('Beras') || progName.includes('CPP') ? 'BERAS_CPP' :
                         progName.includes('KIS') || progName.includes('BPJS') ? 'KIS_PBI' : 'BLT_DD';

        return {
          id: b.id,
          name: r.fullName,
          nameMasked: r.fullName.split(' ').map((w: string, i: number) => i === 0 ? w : w[0] + '***').join(' '),
          nik: r.nik,
          nikMasked: r.nik.slice(0, 6) + '******' + r.nik.slice(-4),
          noKk: kk,
          noKkMasked: kk.length >= 10 ? kk.slice(0, 6) + '******' + kk.slice(-4) : '******',
          gender: r.gender,
          dusun: r.dusun?.name || r.address || 'Dusun 1',
          rt: r.rt?.name || r.rtId || '01',
          rw: r.rw?.name || r.rwId || '01',
          programName: progName,
          programType: progType,
          nominalOrItem: b.nominalAmount ? (b.nominalAmount === 10 ? '10 Kg Beras Medium' : `Rp ${b.nominalAmount.toLocaleString('id-ID')}`) : 'Jaminan Kesehatan Gratis',
          period: b.stageOrMonth || 'Tahap 1 (Januari - Maret 2026)',
          status: displayStatus,
          distributionDate: b.stageOrMonth?.includes('Maret') ? '2026-03-25' : (b.stageOrMonth?.includes('Februari') ? '2026-02-20' : '2026-01-05'),
          distributionLocation: progType === 'PKH' || progType === 'BPNT' ? 'Agen BRIlink / e-Warong' : 'Aula Kantor Desa Pulau Betung',
          keterangan: b.notes || 'Data terverifikasi DTKS & Buku Induk Penduduk Desa.'
        };
      })
    );

    return res.json({ success: true, data: sanitized });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-KPM-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.json({ success: true, data: [], degraded: true });
  }
});

// 15b. Public e-Posyandu Summary (UU PDP Compliant - Aggregate Stats + Schedules Only, Zero Child PII)
router.get('/posyandu/summary', async (_req: Request, res: ExpressResponse) => {
  const buildPosyanduSummary = (toddlers: any[], schedules: any[]) => {
    const now = new Date();
    const active = toddlers.filter((t: any) => {
      if (!t?.birthDate) return true;
      const b = new Date(t.birthDate);
      if (isNaN(b.getTime())) return true;
      const months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
      return months >= 0 && months <= 60;
    });

    let normalCount = 0;
    let riskCount = 0;
    let immCount = 0;
    let vitACount = 0;
    const dusunMap = new Map<string, { dusunName: string; count: number; normalCount: number; riskCount: number }>();

    for (const t of active) {
      const dusun = String(t.dusunName || 'Dusun Utama').trim() || 'Dusun Utama';
      const entry = dusunMap.get(dusun) || { dusunName: dusun, count: 0, normalCount: 0, riskCount: 0 };
      entry.count += 1;

      const measurements = Array.isArray(t.measurements) ? [...t.measurements] : [];
      measurements.sort((a: any, b: any) => new Date(a.measurementDate).getTime() - new Date(b.measurementDate).getTime());
      const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
      const overall = String(latest?.overallStatus || '');
      const isNormal = overall ? overall.includes('Normal') : !t.isInterventionTarget;
      const isRisk = t.isInterventionTarget || (overall ? overall.includes('Stunting') || overall.includes('Gizi Kurang') || overall.includes('Pendek') : false);

      if (isNormal) {
        normalCount += 1;
        entry.normalCount += 1;
      }
      if (isRisk) {
        riskCount += 1;
        entry.riskCount += 1;
      }
      if (latest?.immunizationStatus && String(latest.immunizationStatus).toLowerCase() !== 'belum') {
        immCount += 1;
      }
      if (latest?.vitA) {
        vitACount += 1;
      }
      dusunMap.set(dusun, entry);
    }

    const total = active.length;
    return {
      stats: {
        total,
        normalCount,
        normalPct: total > 0 ? Math.round((normalCount / total) * 100) : 0,
        riskCount,
        immunizationPct: total > 0 ? Math.round((immCount / total) * 100) : 0,
        vitAPct: total > 0 ? Math.round((vitACount / total) * 100) : 0
      },
      dusunBreakdown: Array.from(dusunMap.values()).sort((a, b) => a.dusunName.localeCompare(b.dusunName)),
      schedules
    };
  };

  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = allowJsonFallback() ? (getDb() as any) : null;
      const toddlers = db?.toddlers || [];
      const schedules = db?.posyanduSchedules || [];
      return res.json({ success: true, degraded: true, data: buildPosyanduSummary(toddlers, schedules) });
    }

    const prisma = getPrisma();
    const [toddlers, schedules] = await Promise.all([
      prisma.toddlerRecord.findMany({
        select: {
          id: true,
          birthDate: true,
          dusunName: true,
          isInterventionTarget: true,
          measurements: {
            orderBy: { measurementDate: 'desc' },
            take: 1,
            select: {
              measurementDate: true,
              overallStatus: true,
              immunizationStatus: true,
              vitA: true
            }
          }
        }
      }).catch(() => []),
      prisma.posyanduSchedule.findMany({
        orderBy: { scheduleDate: 'asc' }
      }).catch(() => [])
    ]);

    return res.json({ success: true, data: buildPosyanduSummary(toddlers, schedules) });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-POSYANDU-SUMMARY-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.json({
      success: true,
      degraded: true,
      data: {
        stats: { total: 0, normalCount: 0, normalPct: 0, riskCount: 0, immunizationPct: 0, vitAPct: 0 },
        dusunBreakdown: [],
        schedules: []
      }
    });
  }
});

// 15c. Public KMS Digital Exact Lookup (Strict NIK or KMS Card Number only)
router.get('/posyandu/kms', async (req: Request, res: ExpressResponse) => {
  try {
    const cleanQ = String(req.query.q || '').trim();
    if (cleanQ.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Masukkan NIK Anak (16 digit) atau Nomor Kartu KMS/KIA yang valid (minimal 6 karakter).'
      });
    }

    const sanitizeToddlerForParent = (t: any) => ({
      id: t.id,
      name: t.name,
      nik: t.nik,
      gender: t.gender,
      birthDate: t.birthDate,
      birthWeightKg: t.birthWeightKg,
      birthHeightCm: t.birthHeightCm,
      parentName: t.parentName,
      dusunName: t.dusunName,
      rtRw: t.rtRw,
      address: t.address,
      kmsCardNumber: t.kmsCardNumber,
      isInterventionTarget: Boolean(t.isInterventionTarget),
      measurements: Array.isArray(t.measurements) ? t.measurements : []
    });

    if (!(await isDatabaseAvailableCached())) {
      if (allowJsonFallback()) {
        const found = ((getDb() as any).toddlers || []).find(
          (t: any) =>
            String(t.nik || '').trim() === cleanQ ||
            String(t.kmsCardNumber || '').trim().toLowerCase() === cleanQ.toLowerCase()
        );
        if (!found) {
          return res.status(404).json({
            success: false,
            error: `Data anak dengan NIK atau Nomor KMS "${cleanQ}" tidak ditemukan.`
          });
        }
        return res.json({ success: true, degraded: true, data: sanitizeToddlerForParent(found) });
      }
      return res.status(503).json({
        success: false,
        error: 'Layanan KMS Digital sedang tidak tersedia saat koneksi database terputus.'
      });
    }

    const found = await getPrisma().toddlerRecord.findFirst({
      where: {
        OR: [
          { nik: cleanQ },
          { kmsCardNumber: { equals: cleanQ, mode: 'insensitive' } }
        ]
      },
      include: {
        measurements: {
          orderBy: { measurementDate: 'asc' }
        }
      }
    });

    if (!found) {
      return res.status(404).json({
        success: false,
        error: `Data anak dengan NIK atau Nomor KMS "${cleanQ}" tidak ditemukan.`
      });
    }

    return res.json({ success: true, data: sanitizeToddlerForParent(found) });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-POSYANDU-KMS-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal memeriksa data KMS Digital.' });
  }
});

router.get('/potentials', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb().potentials || [] : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().villagePotential.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-POTENTIALS-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? getDb().potentials || [] : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

router.get('/umkm', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb().umkm || [] : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().umkmItem.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-UMKM-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? getDb().umkm || [] : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

router.get('/facilities', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? (getDb().facilities || []).map(normalizeMapFacilityRecord) : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().mapFacility.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data: data.map(normalizeMapFacilityRecord) });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-FACILITIES-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? (getDb().facilities || []).map(normalizeMapFacilityRecord) : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

router.get('/gallery', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const fallback = allowJsonFallback() ? getDb().gallery || [] : [];
      return res.json({ success: true, data: fallback, degraded: true });
    }
    const data = await getPrisma().galleryItem.findMany({
      orderBy: { date: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.warn('⚠️ [PUBLIC-GALLERY-DEGRADED]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    const fallback = allowJsonFallback() ? getDb().gallery || [] : [];
    return res.json({ success: true, data: fallback, degraded: true });
  }
});

// 16. Contact / Message from Citizen
router.post('/contact', async (req: Request, res: ExpressResponse) => {
  try {
    const { name, phone, email, subject, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ success: false, error: 'Nama dan pesan wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      return res.status(503).json({
        success: false,
        error: 'Koneksi database belum tersedia. Pesan belum dapat dikirim saat ini.'
      });
    }

    const prisma = getPrisma();
    const newLog = await prisma.auditLog.create({
      data: {
        userId: 'citizen',
        userName: name,
        userRole: 'Masyarakat',
        action: 'Kirim Pesan Warga',
        module: 'Kontak',
        details: `Pesan baru diterima dari ${name} (${phone || email || '-'}): "${subject || 'Pesan'}" - Isi: ${message.slice(0, 500)}`,
        ipAddress: req.ip || '127.0.0.1',
        level: 'info'
      }
    });

    return res.status(201).json({
      success: true,
      message: `Pesan Anda berhasil terkirim ke Sekretariat ${getCurrentTenantContext()?.tenantName || 'Desa'}.`,
      data: { id: newLog.id }
    });
  } catch (error: any) {
    console.warn('⚠️ [CONTACT-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal mengirim pesan. Silakan coba lagi.' });
  }
});

// 17. Public Attendance System (Akses Cepat Perangkat) - FIX 9: PIN verification & Lockout
router.post('/attendance/submit', async (req: Request, res: ExpressResponse) => {
  try {
    const { officialId, pin, type, location, deviceInfo, deviceId, selfieUrl } = req.body;

    if (!officialId || !pin || !type) {
      return res.status(400).json({ success: false, error: 'Harap lengkapi ID Perangkat, PIN, dan Jenis Absensi.' });
    }

    // FIX 9: Validasi selfieUrl harus URL hasil upload internal (public/uploads, private upload, atau supabase)
    if (
      !selfieUrl ||
      (!selfieUrl.includes('/uploads/') &&
        !selfieUrl.includes('/api/upload/private/') &&
        !selfieUrl.includes('.supabase.co'))
    ) {
      return res.status(400).json({ success: false, error: 'Wajib menggunakan foto selfie dari kamera sistem.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      return res.status(503).json({ success: false, error: 'Database belum terhubung. Absensi perangkat tidak dapat dicatat saat ini.' });
    }

    const prisma = getPrisma();
    const official = await prisma.villageOfficial.findUnique({ where: { id: officialId } });
    const villageProfile = await getVillageProfile();

    if (!official) {
      // 404 Generik untuk mencegah enumerasi nama perangkat lain
      return res.status(404).json({ success: false, error: 'Petugas tidak terdaftar atau akun dinonaktifkan.' });
    }

    // FIX 9: Lockout per officialId
    if (official.lockoutUntil && official.lockoutUntil > new Date()) {
      return res.status(403).json({ success: false, error: 'Akses absensi dikunci sementara karena terlalu banyak kegagalan PIN. Silakan lapor admin.' });
    }

    // FIX 9: Verifikasi PIN (PIN 6 digit)
    const isPinValid = official.pinHash ? verifyPassword(pin, official.pinHash, official.id) : false;

    if (!isPinValid) {
      const updated = await prisma.villageOfficial.update({
        where: { id: officialId },
        data: { failedPinAttempts: { increment: 1 } }
      });

      if (updated.failedPinAttempts >= 5) {
        await prisma.villageOfficial.update({
          where: { id: officialId },
          data: { lockoutUntil: new Date(Date.now() + 30 * 60 * 1000) } // Lock 30 min
        });
      }

      return res.status(403).json({ success: false, error: 'PIN yang Anda masukkan salah.' });
    }

    // Reset failed attempts on success
    await prisma.villageOfficial.update({
      where: { id: officialId },
      data: { failedPinAttempts: 0, lockoutUntil: null }
    });

    // Anti-Titip Logic: One device per day
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Jakarta', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(now);
    
    if (deviceId) {
      const proxyCheck = await prisma.attendanceLog.findFirst({
        where: {
          date: todayStr,
          deviceId: deviceId,
          NOT: { officialId: officialId }
        }
      });

      if (proxyCheck) {
        return res.status(403).json({ 
          success: false, 
          error: 'Deteksi Pelanggaran: Perangkat ini sudah digunakan oleh petugas lain hari ini.' 
        });
      }
    }

    // GPS Verification
    if (villageProfile?.officeLocation) {
      const officeLoc = villageProfile.officeLocation as any;
      if (officeLoc.lat && officeLoc.lng) {
        if (!location || !location.lat || !location.lng) {
          return res.status(400).json({ 
            success: false, 
            error: 'Sistem mewajibkan verifikasi lokasi (GPS).' 
          });
        }

        const distance = calculateDistance(
          location.lat, 
          location.lng, 
          officeLoc.lat, 
          officeLoc.lng
        );

        const allowedRadius = officeLoc.radius || 100;

        if (distance > allowedRadius) {
          return res.status(403).json({ 
            success: false, 
            error: 'Dunsanak terdeteksi berada di luar area kantor desa.' 
          });
        }
      }
    }

    const hour = now.getHours();
    let status = 'hadir';

    if (type === 'masuk') {
      if (hour >= 9) status = 'terlambat';
    } else {
      if (hour < 15) status = 'pulang_awal';
      else if (hour >= 18) status = 'lembur';
    }

    const newLog = await prisma.attendanceLog.create({
      data: {
        officialId: official.id,
        officialName: official.name,
        type,
        timestamp: now,
        date: todayStr,
        location: location || {},
        status,
        notes: deviceInfo || '',
        deviceId: deviceId || '',
        selfieUrl,
        gpsCapturedBy: 'client', // FIX 9: Tandai asal data
        deviceIdCapturedBy: 'client'
      }
    });

    return res.status(201).json({
      success: true,
      message: `Absensi ${type.toUpperCase()} berhasil direkam. Selamat bertugas!`,
      data: newLog
    });
  } catch (error: any) {
    console.warn('⚠️ [ATTENDANCE-SUBMIT-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal mengirim absensi.' });
  }
});

// Get attendance logs for an official (FIX 9: PIN & Lockout)
router.post('/attendance/history', async (req: Request, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      return res.status(503).json({ success: false, error: 'Database belum terhubung.' });
    }
    const { officialId, pin } = req.body;
    const prisma = getPrisma();
    const official = await prisma.villageOfficial.findUnique({ where: { id: officialId } });

    if (!official) return res.status(404).json({ success: false, error: 'Data tidak ditemukan.' });
    
    const isPinValid = official.pinHash ? verifyPassword(pin, official.pinHash, official.id) : false;
    if (!isPinValid) return res.status(403).json({ success: false, error: 'Verifikasi gagal.' });

    const history = await prisma.attendanceLog.findMany({
      where: { officialId: officialId },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    return res.json({ success: true, data: history });
  } catch (error: any) {
    console.warn('⚠️ [ATTENDANCE-HISTORY-ERROR]:', sanitizeDiagnosticMessage(error?.message || String(error)));
    return res.status(500).json({ success: false, error: 'Gagal memuat riwayat absensi.' });
  }
});

export default router;
