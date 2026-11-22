import { Router, Request, Response as ExpressResponse } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  getPrisma,
  getPrismaForActiveContext,
  recordAuditLogDb,
  isDatabaseAvailableCached,
  isJsonFallbackAllowed,
  getTenantVillageProfileId,
  getUserById
} from '../db/prisma-helpers';
import { getDb, saveDb, seedInitialData } from '../db/database';
import { authenticateToken, requireRoles, AuthenticatedRequest, verifyPassword, hashPassword, generateSalt, createToken } from '../auth';
import { assignServerLetterNumberAtomic } from '../services/letterNumbering';
import { clearSupabaseStorageBucket } from './upload';
import {
  assertSafeUnscopedMutation,
  getCurrentTenantContext,
  getScopedDeleteWhere,
  TenantScopeViolationError
} from '../db/tenantContext';
import { SERVER_CONFIG } from '../config/constants';
import { getStorageArchitectureSummary } from '../config/storageRegistry';
import { getAdminArchitectureMap } from '../config/adminModuleRegistry';
import { runDatabaseBackup } from '../scripts/db-backup';

const router = Router();

/**
 * Helper generator ID robust untuk server-side JSON fallback (FIX 8)
 */
function generateServerId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// All routes here require authentication (Keyword: AUTH, RBAC)
router.use(authenticateToken);

// Blokir fallback JSON lokal jika multi-tenant aktif atau tenant != pulau_betung
router.use(async (req: AuthenticatedRequest, res: ExpressResponse, next) => {
  if (req.path === '/storage-map' || req.path === '/panel-map') {
    return next();
  }
  if (!isJsonFallbackAllowed() && !(await isDatabaseAvailableCached())) {
    return res.status(503).json({
      success: false,
      error: 'Database portal desa belum tersedia. Akses penyimpanan lokal dinonaktifkan demi isolasi multi-tenant.'
    });
  }
  return next();
});

// 1. Dashboard Statistics
router.get('/stats', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({
        success: true,
        degraded: true,
        data: {
          totalRequests: (db.serviceRequests || []).length,
          pendingRequests: (db.serviceRequests || []).filter((r: any) => ['diajukan', 'diverifikasi', 'diproses'].includes(r.status)).length,
          completedRequests: (db.serviceRequests || []).filter((r: any) => r.status === 'selesai').length,
          totalComplaints: (db.complaints || []).length,
          activeComplaints: (db.complaints || []).filter((c: any) => !['selesai', 'ditolak'].includes(c.status)).length,
          totalNews: (db.news || []).length,
          totalProjects: (db.developmentProjects || []).length,
          totalAuditLogs: (db.auditLogs || []).length,
          totalResidents: (db.residents || []).length || db.villageProfile?.totalPopulation || 0
        }
      });
    }

    const prisma = getPrisma();
    
    // Tarik statistik secara paralel untuk performa maksimal
    const [
      totalRequests,
      pendingRequests,
      completedRequests,
      totalComplaints,
      activeComplaints,
      totalNews,
      totalProjects,
      totalAuditLogs,
      totalResidents
    ] = await Promise.all([
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({ where: { status: { in: ['diajukan', 'diverifikasi', 'diproses'] } } }),
      prisma.serviceRequest.count({ where: { status: 'selesai' } }),
      prisma.complaint.count(),
      prisma.complaint.count({ where: { NOT: { status: { in: ['selesai', 'ditolak'] } } } }),
      prisma.newsItem.count(),
      prisma.developmentProject.count(),
      prisma.auditLog.count(),
      prisma.resident.count()
    ]);

    return res.json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        completedRequests,
        totalComplaints,
        activeComplaints,
        totalNews,
        totalProjects,
        totalAuditLogs,
        totalResidents
      }
    });
  } catch (error: any) {
    console.error('❌ [ADMIN-STATS-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal memuat statistik dashboard.' });
  }
});

// 2. Service Requests Management (Operator, Admin Desa, Super Admin)
// Helper: Auto-sync statistik demografi ke VillageProfile
export async function recalculateVillageProfileStats(prisma: any) {
  try {
    const [totalPop, malePop, femalePop, familiesGroup] = await Promise.all([
      prisma.resident.count({
        where: { status: 'HIDUP' }
      }),
      prisma.resident.count({
        where: { status: 'HIDUP', gender: 'Laki-laki' }
      }),
      prisma.resident.count({
        where: { status: 'HIDUP', gender: 'Perempuan' }
      }),
      prisma.resident.groupBy({
        by: ['kkNumber'],
        where: {
          status: 'HIDUP',
          kkNumber: { not: '' }
        }
      })
    ]);

    const totalFamilies = familiesGroup.length;
    const ctx = getCurrentTenantContext();
    const existingProfile = await prisma.villageProfile.findFirst({
      orderBy: { lastUpdated: 'desc' }
    });

    if (existingProfile) {
      await prisma.villageProfile.update({
        where: { id: existingProfile.id },
        data: {
          totalPopulation: totalPop,
          totalFamilies: totalFamilies,
          lastUpdated: new Date()
        }
      });
    } else {
      await prisma.villageProfile.create({
        data: {
          id: getTenantVillageProfileId(),
          villageName: ctx?.tenantName || 'Desa Pulau Betung',
          district: 'Pembarap',
          regency: 'Kabupaten Merangin',
          province: 'Jambi',
          postalCode: '37361',
          history: `Sejarah ${ctx?.tenantName || 'Desa Pulau Betung'}`,
          vision: 'Mewujudkan Desa Mandiri, Maju, dan Sejahtera',
          mission: [],
          areaSqKm: 12.5,
          borders: {},
          totalPopulation: totalPop,
          totalFamilies: totalFamilies,
          lastUpdated: new Date()
        }
      });
    }

    return { totalPop, malePop, femalePop, totalFamilies };
  } catch (err) {
    console.error('[STATS] Gagal recalculateVillageProfileStats:', err);
    return null;
  }
}

router.get('/residents', requireRoles('super_admin', 'admin_desa', 'operator', 'admin_posyandu'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.residents || [] });
    }
    const prisma = getPrisma();
    const residents = await prisma.resident.findMany({
      include: {
        dusun: true,
        rw: true,
        rt: true
      },
      orderBy: { fullName: 'asc' }
    });

    // Helper normalisasi NIK (menghilangkan spasi dan tanda hubung)
    const normalizeNik = (nik: any): string => {
      if (!nik) return '';
      return String(nik).replace(/[\s-]/g, '').trim();
    };

    const residentNiks = residents.map((r: any) => normalizeNik(r.nik)).filter(Boolean);
    const residentIds = residents.map((r: any) => r.id);

    // BATCH QUERY (Hanya 4 query paralel, tanpa loop N+1)
    const [bansosRecipients, serviceRequests, toddlerRecords, complaints] = await Promise.all([
      prisma.bansosRecipient.findMany({
        where: {
          OR: [
            { resident: { nik: { in: residentNiks } } },
            { residentId: { in: residentIds } }
          ]
        },
        include: {
          resident: { select: { id: true, nik: true } }
        }
      }).catch(() => []),
      prisma.serviceRequest.findMany({
        where: {
          citizenNik: { not: null }
        },
        select: {
          id: true,
          trackingCode: true,
          serviceName: true,
          citizenNik: true,
          status: true,
          requestDate: true
        }
      }).catch(() => []),
      prisma.toddlerRecord.findMany({
        where: {
          OR: [
            { parentNik: { in: residentNiks } },
            { nik: { in: residentNiks } }
          ]
        },
        select: {
          id: true,
          nik: true,
          name: true,
          parentNik: true,
          isInterventionTarget: true,
          kmsCardNumber: true,
          birthDate: true
        }
      }).catch(() => []),
      prisma.complaint.findMany({
        where: {
          reporterContact: { in: residentNiks }
        },
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          category: true,
          status: true,
          createdAt: true,
          reporterContact: true
        }
      }).catch(() => [])
    ]);

    // O(1) Hash Map Indexing
    const bansosMap = new Map<string, any[]>();
    for (const b of bansosRecipients) {
      const item = {
        id: b.id,
        programName: b.programName,
        criteria: b.notes || 'Penerima Bantuan Sosial Terverifikasi',
        year: b.fiscalYear || 2026,
        stage: b.stageOrMonth || 'Tahap 1',
        nominal: b.nominalAmount || 0,
        disbursementStatus: b.status === 'SALUR_SELESAI' ? 'Tersalurkan' : (b.status === 'DITUNDA_DIBATALKAN' ? 'Ditunda' : 'Siap Disalurkan')
      };

      const nik = normalizeNik(b.resident?.nik);
      if (nik) {
        const arr = bansosMap.get(nik) || [];
        arr.push(item);
        bansosMap.set(nik, arr);
      }
      if (b.residentId) {
        const arr = bansosMap.get(b.residentId) || [];
        arr.push(item);
        bansosMap.set(b.residentId, arr);
      }
    }

    const lettersMap = new Map<string, any[]>();
    for (const s of serviceRequests) {
      const nik = normalizeNik(s.citizenNik);
      if (nik) {
        const arr = lettersMap.get(nik) || [];
        arr.push({
          id: s.id,
          trackingCode: s.trackingCode,
          serviceName: s.serviceName,
          status: s.status,
          requestDate: s.requestDate ? new Date(s.requestDate).toISOString() : ''
        });
        lettersMap.set(nik, arr);
      }
    }

    const toddlersMap = new Map<string, any[]>();
    for (const t of toddlerRecords) {
      const pNik = normalizeNik(t.parentNik);
      const ownNik = normalizeNik(t.nik);
      const toddlerObj = {
        id: t.id,
        nik: t.nik,
        name: t.name,
        isInterventionTarget: Boolean(t.isInterventionTarget),
        kmsCardNumber: t.kmsCardNumber,
        birthDate: t.birthDate ? new Date(t.birthDate).toISOString() : ''
      };
      if (pNik) {
        const arr = toddlersMap.get(pNik) || [];
        arr.push(toddlerObj);
        toddlersMap.set(pNik, arr);
      }
      if (ownNik && ownNik !== pNik) {
        const arr = toddlersMap.get(ownNik) || [];
        arr.push(toddlerObj);
        toddlersMap.set(ownNik, arr);
      }
    }

    const complaintsMap = new Map<string, any[]>();
    for (const c of complaints) {
      const nik = normalizeNik(c.reporterContact);
      if (nik) {
        const arr = complaintsMap.get(nik) || [];
        arr.push({
          id: c.id,
          ticketNumber: c.ticketNumber,
          title: c.title,
          category: c.category,
          status: c.status,
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : ''
        });
        complaintsMap.set(nik, arr);
      }
    }

    // Gabungkan Profil 360° ke masing-masing Warga
    const data = residents.map((r: any) => {
      const normNik = normalizeNik(r.nik);
      const bansos = bansosMap.get(normNik) || [];
      const letters = lettersMap.get(normNik) || [];
      const toddlers = toddlersMap.get(normNik) || [];
      const complaintsList = complaintsMap.get(normNik) || [];

      const hasBansos = bansos.length > 0;
      const hasSku = letters.some((l: any) => String(l.serviceName || '').toUpperCase().includes('SKU'));
      const hasSktm = letters.some((l: any) => String(l.serviceName || '').toUpperCase().includes('SKTM'));
      const hasLetterHistory = letters.length > 0;
      const hasToddler = toddlers.length > 0;
      const isStuntingRisk = Boolean(r.isStuntingRisk || toddlers.some((t: any) => t.isInterventionTarget));
      const hasComplaint = complaintsList.length > 0;

      const dusunStr = typeof r.dusun === 'object' && r.dusun?.name ? r.dusun.name : (typeof r.dusun === 'string' ? r.dusun : (r.address || ''));
      const rwStr = typeof r.rw === 'object' && r.rw?.name ? r.rw.name : (typeof r.rw === 'string' ? r.rw : (r.rwId || '01'));
      const rtStr = typeof r.rt === 'object' && r.rt?.name ? r.rt.name : (typeof r.rt === 'string' ? r.rt : (r.rtId || '01'));

      return {
        ...r,
        dusun: dusunStr,
        rw: rwStr,
        rt: rtStr,
        hasBansos,
        hasSku,
        hasSktm,
        hasLetterHistory,
        hasToddler,
        isStuntingRisk,
        hasComplaint,
        bansosList: bansos,
        serviceList: letters,
        toddlerList: toddlers,
        complaintList: complaintsList
      };
    });

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data penduduk: ' + (error?.message || '') });
  }
});

router.post('/residents', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { 
      nik, kkNumber, kk, fullName, name, gender, 
      birthPlace, birthDate, religion, maritalStatus, 
      education, occupation, address, dusunId, rwId, rtId, 
      phone, economicStatus, status 
    } = req.body;
    
    const cleanNik = String(nik || '').trim();
    const cleanKk = String(kkNumber || kk || '').trim();
    const cleanName = String(fullName || name || '').trim();
    const cleanBirthPlace = String(birthPlace || '').trim();
    const cleanAddress = String(address || '').trim();

    if (!cleanNik || !cleanName) {
      return res.status(400).json({ success: false, error: 'NIK dan Nama Lengkap wajib diisi.' });
    }

    if (!cleanKk) {
      return res.status(400).json({ success: false, error: 'No. KK wajib diisi.' });
    }

    if (!cleanBirthPlace) {
      return res.status(400).json({ success: false, error: 'Tempat Lahir wajib diisi.' });
    }

    if (!cleanAddress) {
      return res.status(400).json({ success: false, error: 'Alamat domisili wajib diisi.' });
    }

    if (!birthDate || isNaN(new Date(birthDate).getTime())) {
      return res.status(400).json({ success: false, error: 'Tanggal Lahir tidak valid.' });
    }

    // Map status enum safely
    let mappedStatus: 'HIDUP' | 'MENINGGAL' | 'PINDAH' = 'HIDUP';
    if (status) {
      const s = String(status).toUpperCase();
      if (s === 'MENINGGAL') mappedStatus = 'MENINGGAL';
      else if (s === 'PINDAH') mappedStatus = 'PINDAH';
    }

    const resident = await getPrisma().resident.create({
      data: {
        nik: cleanNik,
        kkNumber: cleanKk,
        fullName: cleanName,
        gender: gender || 'Laki-laki',
        birthPlace: cleanBirthPlace,
        birthDate: new Date(birthDate),
        religion: religion || 'Islam',
        maritalStatus: maritalStatus || 'Belum Kawin',
        education: education || 'SMA / SMK / MA',
        occupation: occupation || 'Petani / Pekebun',
        address: cleanAddress,
        dusunId: dusunId || null,
        rwId: rwId || null,
        rtId: rtId || null,
        phone: phone || null,
        status: mappedStatus,
        economicStatus: economicStatus || 'Umum'
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Penduduk',
      'Master Penduduk',
      `Menambahkan warga baru: ${cleanName} (NIK: ${cleanNik})`,
      req.ip || '127.0.0.1'
    );

    // Auto-sync statistik demografi ke profil desa secara real-time
    await recalculateVillageProfileStats(getPrisma());

    return res.status(201).json({ success: true, data: resident });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ success: false, error: 'NIK sudah terdaftar.' });
    return res.status(500).json({ success: false, error: 'Gagal menambah data penduduk: ' + (error?.message || '') });
  }
});

router.delete('/residents/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const resident = await getPrisma().resident.delete({
      where: { id }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Penduduk',
      'Master Penduduk',
      `Menghapus warga: ${resident.fullName} (NIK: ${resident.nik})`,
      req.ip || '127.0.0.1'
    );

    // Auto-sync statistik demografi ke profil desa secara real-time
    await recalculateVillageProfileStats(getPrisma());

    return res.json({ success: true, message: 'Data penduduk berhasil dihapus.' });
  } catch (error: any) {
    if (error.code === 'P2003') return res.status(400).json({ success: false, error: 'Gagal menghapus: Warga ini masih terhubung dengan data lain (Bansos/Surat).' });
    return res.status(500).json({ success: false, error: 'Gagal menghapus data penduduk.' });
  }
});

router.put('/residents/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { fullName, nik, gender, birthPlace, birthDate, address, dusunId, rwId, rtId, status } = req.body;
    const prisma = getPrisma();

    if (nik) {
      const cleanNik = String(nik).trim();
      if (!/^\d{16}$/.test(cleanNik)) {
        return res.status(400).json({ success: false, error: 'NIK harus terdiri dari 16 digit angka.' });
      }
      const existing = await prisma.resident.findFirst({
        where: { nik: cleanNik, NOT: { id } }
      });
      if (existing) return res.status(400).json({ success: false, error: 'NIK sudah terdaftar pada warga lain.' });
    }

    let mappedStatus: 'HIDUP' | 'MENINGGAL' | 'PINDAH' | undefined = undefined;
    if (status) {
      const s = String(status).toUpperCase();
      if (s === 'MENINGGAL') mappedStatus = 'MENINGGAL';
      else if (s === 'PINDAH') mappedStatus = 'PINDAH';
      else if (s === 'HIDUP') mappedStatus = 'HIDUP';
    }

    const updated = await prisma.resident.update({
      where: { id },
      data: {
        fullName: fullName?.trim(),
        nik: nik?.trim(),
        gender,
        birthPlace: birthPlace?.trim(),
        birthDate: birthDate ? new Date(birthDate) : undefined,
        address: address?.trim(),
        dusunId,
        rwId,
        rtId,
        status: mappedStatus
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Update Penduduk',
      'Master Penduduk',
      `Update warga: ${updated.fullName} (NIK: ${updated.nik})`,
      req.ip || '127.0.0.1'
    );

    // Auto-sync statistik demografi ke profil desa secara real-time
    await recalculateVillageProfileStats(prisma);

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal memperbarui data penduduk.' });
  }
});

// 2a. User Management (CRUD for Super Admin and Admin Desa)
router.get('/users', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const safeUsers = (db.users || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        roleTitle: u.roleTitle,
        isActive: u.isActive,
        officialId: u.officialId || null,
        permissions: u.permissions || [],
        lastLogin: u.lastLogin || null,
        createdAt: u.createdAt
      }));
      return res.json({ success: true, degraded: true, data: safeUsers });
    }
    const prisma = getPrisma();
    
    // Admin Desa can see users, but maybe we should limit or just let them see all
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        roleTitle: true,
        isActive: true,
        officialId: true,
        permissions: true,
        lastLogin: true,
        createdAt: true
      }
    });
    return res.json({ success: true, data: users });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data pengguna.' });
  }
});

router.post('/users', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { name, username, email, password, role, roleTitle, officialId, permissions } = req.body;
    const prisma = getPrisma();

    if (!name || !username || !password) {
      return res.status(400).json({ success: false, error: 'Nama, username, dan password wajib diisi.' });
    }

    // Role protection: Only super_admin can create super_admin
    if (role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Hanya Super Admin yang dapat membuat akun Super Admin lain.' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: username.trim() }, { email: email?.trim() }] }
    });
    if (existing) return res.status(400).json({ success: false, error: 'Username atau email sudah terdaftar.' });

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);

    const cleanOfficialId = officialId && String(officialId).trim().length > 0 ? String(officialId).trim() : null;

    const activeCtx = getCurrentTenantContext();
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        username: username.trim(),
        email: email?.trim() || `${username.trim()}@${activeCtx?.slug || 'pulaubetung'}.sadewa.id`,
        passwordHash,
        salt,
        role: role || 'operator',
        roleTitle: roleTitle || 'Operator',
        officialId: cleanOfficialId,
        permissions: permissions || [],
        isActive: true,
        mustChangePassword: false
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        roleTitle: true,
        isActive: true,
        officialId: true,
        permissions: true,
        lastLogin: true,
        createdAt: true
      }
    });

    // Sinkronisasi status admin ke data aparatur
    if (cleanOfficialId) {
      try {
        await prisma.villageOfficial.update({
          where: { id: cleanOfficialId },
          data: { hasAdminAccess: true }
        });
      } catch (err) {
        console.warn('⚠️ Gagal update status official:', err);
      }
    }

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Pengguna',
      'Sistem & Keamanan',
      `Membuat user baru: ${newUser.username} (${newUser.role})`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, data: newUser });
  } catch (error: any) {
    console.error('Error in POST /users:', error);
    return res.status(500).json({ success: false, error: 'Gagal membuat pengguna baru: ' + (error?.message || '') });
  }
});

router.put('/users/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { name, role, roleTitle, isActive, officialId, permissions } = req.body;
    const prisma = getPrisma();

    // Protection: admin_desa cannot modify super_admin or grant super_admin
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (targetUser?.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Hanya Super Admin yang dapat mengubah akun Super Admin.' });
    }
    if (role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Hanya Super Admin yang dapat memberikan hak akses Super Admin.' });
    }

    const cleanOfficialId = officialId && String(officialId).trim().length > 0 ? String(officialId).trim() : null;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name?.trim(),
        role,
        roleTitle,
        officialId: cleanOfficialId,
        permissions: permissions || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        ...(isActive === false ? { tokenVersion: { increment: 1 } } : {})
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        roleTitle: true,
        isActive: true,
        officialId: true,
        permissions: true,
        lastLogin: true,
        createdAt: true
      }
    });

    // Sinkronisasi status admin ke data aparatur
    if (cleanOfficialId) {
      try {
        await prisma.villageOfficial.update({
          where: { id: cleanOfficialId },
          data: { hasAdminAccess: isActive !== false }
        });
      } catch (err) {
        console.warn('⚠️ Gagal update status official:', err);
      }
    }

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Update Pengguna',
      'Sistem & Keamanan',
      `Update user: ${updated.username}`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error in PUT /users/:id:', error);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui data pengguna: ' + (error?.message || '') });
  }
});

router.delete('/users/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const prisma = getPrisma();

    if (id === req.user?.userId) {
      return res.status(400).json({ success: false, error: 'Tidak dapat menghapus akun sendiri.' });
    }

    // Protection: admin_desa cannot delete super_admin
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (targetUser?.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Hanya Super Admin yang dapat menghapus akun Super Admin.' });
    }

    const user = await prisma.user.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Pengguna',
      'Sistem & Keamanan',
      `Menghapus user: ${user.username}`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus pengguna.' });
  }
});

// 2b. User Password Management (FIXED: uses scryptSync matching login + RBAC + tokenVersion revocation)
router.put('/users/:id/password', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const prisma = getPrisma();

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password minimal 6 karakter.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
    }

    if (targetUser.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Hanya Super Admin yang dapat mengubah password akun Super Admin.' });
    }

    // Hash password baru menggunakan scryptSync agar 100% cocok dengan verifyPassword saat login
    const salt = generateSalt();
    const passwordHash = hashPassword(newPassword, salt);

    const isSelfReset = id === req.user?.userId;

    // Update user record, reset lockout, dan cabut token lama
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        salt,
        failedLoginCount: 0,
        lockoutUntil: null,
        mustChangePassword: isSelfReset ? false : targetUser.mustChangePassword,
        tokenVersion: { increment: 1 }
      }
    });

    const refreshedToken = isSelfReset ? createToken(updatedUser as any) : undefined;

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Ubah Password User',
      'Sistem & Keamanan',
      `Berhasil mengubah password untuk user: ${targetUser.username}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: 'Password berhasil diperbarui.',
      ...(refreshedToken ? { token: refreshedToken } : {})
    });
  } catch (error: any) {
    console.error('❌ [PASSWORD-UPDATE-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui password.' });
  }
});

// Endpoint sinkronisasi manual statistik kependudukan ke profil desa
router.post('/residents/sync-profile', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const stats = await recalculateVillageProfileStats(getPrisma());
    return res.json({ success: true, data: stats, message: 'Statistik profil desa berhasil diperbarui.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui profil desa: ' + (error?.message || '') });
  }
});

// 2b. Bansos Management
router.get('/bansos', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.kpm || [] });
    }
    const data = await getPrisma().bansosRecipient.findMany({
      include: { resident: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data bansos.' });
  }
});

router.post('/bansos', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { residentId, programName, fiscalYear, stageOrMonth, nominalAmount, status, notes } = req.body;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.kpm = db.kpm || [];
      const created = {
        id: generateServerId('bansos'),
        residentId,
        programName: programName || 'BLT-DD',
        fiscalYear: Number(fiscalYear) || 2026,
        stageOrMonth: stageOrMonth || 'Tahap 1',
        nominalAmount: Number(nominalAmount) || 0,
        status: status || 'TERDAFTAR',
        notes: notes || '',
        createdAt: new Date().toISOString()
      };
      db.kpm.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, data: created });
    }

    const bansos = await getPrisma().bansosRecipient.create({
      data: { residentId, programName, fiscalYear, stageOrMonth, nominalAmount, status, notes },
      include: { resident: true }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Penerima Bansos',
      'Bantuan Sosial',
      `Menambahkan warga ${bansos.resident.fullName} ke program ${programName}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, data: bansos });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menambah data bansos.' });
  }
});

// 2c. Posyandu / Toddler Management
router.get('/toddlers', requireRoles('super_admin', 'admin_desa', 'operator', 'admin_posyandu'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.toddlers || [] });
    }
    const data = await getPrisma().toddlerRecord.findMany({
      include: {
        measurements: {
          orderBy: { measurementDate: 'desc' },
          take: 5
        }
      },
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal memuat data balita.' });
  }
});

router.post('/toddlers', requireRoles('super_admin', 'admin_desa', 'operator', 'admin_posyandu'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { name, nik, gender, birthDate, parentName, parentNik, parentPhone, dusunName, rtRw, address, coordinates, kmsCardNumber, birthWeightKg, birthHeightCm, isInterventionTarget } = req.body;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.toddlers = db.toddlers || [];
      const newRec = {
        id: generateServerId('toddler'),
        name,
        nik: nik || `TEMP-${Date.now()}`,
        gender: gender || 'L',
        birthDate,
        birthWeightKg: birthWeightKg ? Number(birthWeightKg) : 3.0,
        birthHeightCm: birthHeightCm ? Number(birthHeightCm) : 48.0,
        parentName: parentName || 'Orang Tua Balita',
        parentNik: parentNik || null,
        parentPhone: parentPhone || '-',
        dusunName: dusunName || 'Dusun I',
        rtRw: rtRw || 'RT 01/RW 01',
        address: address || 'Desa Pulau Betung',
        coordinates: Array.isArray(coordinates) ? coordinates : [-1.5562, 103.4475],
        kmsCardNumber: kmsCardNumber || `KMS-${Date.now()}`,
        isInterventionTarget: Boolean(isInterventionTarget),
        measurements: Array.isArray(req.body.measurements) ? req.body.measurements : []
      };
      db.toddlers.unshift(newRec);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, data: newRec });
    }

    const toddler = await getPrisma().toddlerRecord.create({
      data: { 
        name, 
        nik: nik || `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 
        gender: gender || 'L', 
        birthDate: new Date(birthDate), 
        birthWeightKg: birthWeightKg ? Number(birthWeightKg) : 3.0,
        birthHeightCm: birthHeightCm ? Number(birthHeightCm) : 48.0,
        parentName: parentName || 'Orang Tua Balita',
        parentNik: parentNik || null,
        parentPhone: parentPhone || '-', 
        dusunName: dusunName || 'Dusun I', 
        rtRw: rtRw || 'RT 01/RW 01', 
        address: address || 'Desa Pulau Betung', 
        coordinates: Array.isArray(coordinates) ? coordinates : [-1.5562, 103.4475], 
        kmsCardNumber: kmsCardNumber || `KMS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        isInterventionTarget: Boolean(isInterventionTarget)
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Data Balita',
      'e-Posyandu',
      `Mendaftarkan balita baru: ${name}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, data: toddler });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal menambah data balita.' });
  }
});

router.put('/toddlers/:id', requireRoles('super_admin', 'admin_desa', 'operator', 'admin_posyandu'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { name, nik, gender, birthDate, parentName, parentNik, parentPhone, dusunName, rtRw, address, coordinates, kmsCardNumber, birthWeightKg, birthHeightCm, isInterventionTarget } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.toddlers = db.toddlers || [];
      const idx = db.toddlers.findIndex((t: any) => t.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Data balita tidak ditemukan.' });
      db.toddlers[idx] = { ...db.toddlers[idx], ...req.body, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.toddlers[idx] });
    }

    const updated = await getPrisma().toddlerRecord.update({
      where: { id },
      data: {
        name: name?.trim(),
        nik: nik?.trim(),
        gender,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        birthWeightKg: birthWeightKg !== undefined ? Number(birthWeightKg) : undefined,
        birthHeightCm: birthHeightCm !== undefined ? Number(birthHeightCm) : undefined,
        parentName,
        parentNik,
        parentPhone,
        dusunName,
        rtRw,
        address,
        coordinates,
        kmsCardNumber,
        isInterventionTarget: isInterventionTarget !== undefined ? Boolean(isInterventionTarget) : undefined
      },
      include: { measurements: { orderBy: { measurementDate: 'desc' } } }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Perbarui Data Balita',
      'e-Posyandu',
      `Memperbarui data balita: ${updated.name}`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal memperbarui data balita.' });
  }
});

router.delete('/toddlers/:id', requireRoles('super_admin', 'admin_desa', 'operator', 'admin_posyandu'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.toddlers = (db.toddlers || []).filter((t: any) => t.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Data balita berhasil dihapus.' });
    }

    const removed = await getPrisma().toddlerRecord.delete({ where: { id } });
    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Data Balita',
      'e-Posyandu',
      `Menghapus data balita: ${removed.name}`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Data balita berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus data balita.' });
  }
});

router.post('/toddlers/measurements', requireRoles('super_admin', 'admin_desa', 'operator', 'admin_posyandu'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { toddlerId, measurementDate, weight, weightKg, height, heightCm, headCircumference, headCircumferenceCm, notes, ageInMonths, vitA, deworming, immunizationStatus, zScoreHeightForAge, zScoreWeightForAge, zScoreWeightForHeight, stuntingCategory, weightCategory, overallStatus } = req.body;
    const finalWeight = Number(weightKg ?? weight);
    const finalHeight = Number(heightCm ?? height);
    const finalHead = Number(headCircumferenceCm ?? headCircumference ?? 0);

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.toddlers = db.toddlers || [];
      const idx = db.toddlers.findIndex((t: any) => t.id === toddlerId);
      const newM = {
        id: generateServerId('meas'),
        toddlerId,
        measurementDate: measurementDate || new Date().toISOString().split('T')[0],
        ageInMonths: Number(ageInMonths) || 0,
        weightKg: finalWeight,
        heightCm: finalHeight,
        headCircumferenceCm: finalHead,
        vitA: Boolean(vitA),
        deworming: Boolean(deworming),
        immunizationStatus: immunizationStatus || 'Lengkap',
        zScoreHeightForAge: Number(zScoreHeightForAge) || 0,
        zScoreWeightForAge: Number(zScoreWeightForAge) || 0,
        zScoreWeightForHeight: Number(zScoreWeightForHeight) || 0,
        stuntingCategory: stuntingCategory || 'Normal',
        weightCategory: weightCategory || 'Normal',
        overallStatus: overallStatus || 'Normal (Gizi Baik)',
        cadreNotes: notes || ''
      };
      if (idx !== -1) {
        db.toddlers[idx].measurements = [...(db.toddlers[idx].measurements || []), newM];
        saveDb(db);
      }
      return res.status(201).json({ success: true, degraded: true, data: newM });
    }

    const measurement = await getPrisma().toddlerMeasurement.create({
      data: { 
        toddlerId, 
        measurementDate: new Date(measurementDate),
        ageInMonths: Number(ageInMonths) || 0,
        weightKg: finalWeight, 
        heightCm: finalHeight, 
        headCircumferenceCm: finalHead,
        vitA: Boolean(vitA),
        deworming: Boolean(deworming),
        immunizationStatus: immunizationStatus || 'Lengkap',
        zScoreHeightForAge: Number(zScoreHeightForAge) || 0,
        zScoreWeightForAge: Number(zScoreWeightForAge) || 0,
        zScoreWeightForHeight: Number(zScoreWeightForHeight) || 0,
        stuntingCategory: stuntingCategory || 'Normal',
        weightCategory: weightCategory || 'Normal',
        overallStatus: overallStatus || 'Normal (Gizi Baik)',
        cadreNotes: notes || null,
        measuredBy: req.user?.name || 'Kader Posyandu'
      }
    });

    return res.status(201).json({ success: true, data: measurement });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal mencatat pengukuran.' });
  }
});

router.get('/requests', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.serviceRequests || [] });
    }
    const data = await getPrisma().serviceRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar permohonan.' });
  }
});

router.put('/requests/:id/status', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { id } = req.params;
  const {
    status,
    staffNotes,
    officialLetterNumber,
    trackingCode,
    completedAt,
    letterheadSnapshot,
    fullRequest
  } = req.body;

  const validStatuses = [
    'diajukan', 'diverifikasi', 'perlu_perbaikan', 'diproses',
    'disetujui', 'selesai', 'ditolak', 'dibatalkan', 'dicabut', 'batal'
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Status permohonan tidak valid.' });
  }

  const prisma = getPrisma();
  
  try {
    // FIX 10: Pemindahan pembuatan nomor ke dalam prisma.$transaction dengan retry otomatis
    const activeCtx = getCurrentTenantContext();
    const updated = await prisma.$transaction(async (tx: any) => {
      if (activeCtx?.tenantId && activeCtx.tenancyMode === 'SHARED' && typeof tx.$executeRawUnsafe === 'function') {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_tenant_id', $1, true)`,
          activeCtx.tenantId
        );
      }

      // Robust search: match by id or tracking code
      const searchId = (id || '').trim();
      const searchTracking = (trackingCode || fullRequest?.trackingCode || '').trim();
      
      let existing = await tx.serviceRequest.findFirst({
        where: {
          OR: [
            { id: searchId },
            { trackingCode: searchId },
            { trackingCode: searchTracking }
          ]
        }
      });

      if (!existing && !fullRequest) {
        throw new Error('NOT_FOUND');
      }

      const updateData: any = {
        status,
        staffNotes: staffNotes !== undefined ? staffNotes : (existing ? existing.staffNotes : (fullRequest ? fullRequest.staffNotes : '')),
        processedBy: req.user?.name || 'Petugas Pelayanan',
        officialLetterNumber: officialLetterNumber || (existing ? existing.officialLetterNumber : (fullRequest ? fullRequest.officialLetterNumber : null)),
        completedAt: (status === 'selesai' || status === 'disetujui') 
          ? (completedAt ? new Date(completedAt) : (existing?.completedAt || new Date())) 
          : (existing ? existing.completedAt : (fullRequest ? new Date(fullRequest.completedAt) : null)),
      };

      if (letterheadSnapshot) {
        updateData.letterheadSnapshot = letterheadSnapshot;
      }

      const isFinalizing = status === 'selesai' || status === 'disetujui';
      const profile = isFinalizing
        ? await tx.villageProfile.findFirst({ orderBy: { lastUpdated: 'desc' } })
        : null;

      // Logic generate nomor otomatis & atomik per-desa jika selesai/disetujui dan belum ada nomor
      if (isFinalizing && !updateData.officialLetterNumber) {
        const serviceName = existing ? existing.serviceName : fullRequest.serviceName;
        const dateStr = updateData.completedAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const resolvedVillageCode =
          profile?.letterCodePrefix?.trim() ||
          activeCtx?.letterCodePrefix?.trim() ||
          undefined;

        updateData.officialLetterNumber = await assignServerLetterNumberAtomic(
          serviceName,
          dateStr,
          [],
          existing ? existing.id : fullRequest.id,
          {
            prisma: tx,
            villageId: activeCtx?.tenantId || existing?.villageId || undefined,
            villageCode: resolvedVillageCode
          }
        );
      }

      // Capture snapshots if missing
      if (isFinalizing) {
        if (!updateData.letterheadSnapshot && !existing?.letterheadSnapshot) {
          const activeKades = await tx.villageOfficial.findFirst({
            where: { section: 'kepala_desa', isActive: true }
          }) || await tx.villageOfficial.findFirst({ where: { section: 'kepala_desa' } });

          const fallbackTenantName = activeCtx?.tenantName || 'Desa Pulau Betung';
          const fallbackDomain = activeCtx?.slug ? `${activeCtx.slug}.sadewa.id` : 'pulau-betung.desa.id';

          updateData.letterheadSnapshot = {
            villageName: profile?.villageName || fallbackTenantName,
            district: profile?.district || '-',
            regency: profile?.regency || '-',
            province: profile?.province || '-',
            postalCode: profile?.postalCode || '-',
            addressStreet: profile?.addressStreet || `Kantor ${fallbackTenantName}`,
            email: profile?.email || `pemdes@${activeCtx?.slug || 'desa'}.sadewa.id`,
            phone: profile?.phone || '-',
            domain: profile?.website || fallbackDomain,
            villageLogoUrl: profile?.villageLogoUrl || '',
            regencyLogoUrl: profile?.regencyLogoUrl || '',
            officialSignatureUrl: profile?.officialSignatureUrl || '',
            kadesName: profile?.kadesName || (activeKades ? activeKades.name : 'Kepala Desa'),
            kadesNip: profile?.kadesNip || activeKades?.nip || '-',
            capturedAt: new Date().toISOString()
          };
        }

        const citizenNik = existing ? existing.citizenNik : fullRequest.citizenNik;
        if (citizenNik && !existing?.citizenSnapshot) {
          const resident = await tx.resident.findFirst({ where: { nik: citizenNik } });
          if (resident) {
            updateData.citizenSnapshot = {
              nik: resident.nik,
              fullName: resident.fullName,
              gender: resident.gender,
              birthPlace: resident.birthPlace,
              birthDate: resident.birthDate,
              religion: resident.religion,
              occupation: resident.occupation,
              address: resident.address,
              economicStatus: resident.economicStatus,
              capturedAt: new Date().toISOString()
            };
          }
        }
      }

      if (existing) {
        return await tx.serviceRequest.update({
          where: { id: existing.id },
          data: updateData
        });
      } else {
        return await tx.serviceRequest.create({
          data: {
            ...fullRequest,
            ...updateData,
            id: fullRequest.id || id,
            trackingCode: fullRequest.trackingCode || trackingCode || id
          }
        });
      }
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    });

    // FIX 10: Sinkronisasi ke cache JSON telah dinonaktifkan (Phase 3: Supabase Only)

    recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Update Status Permohonan',
      'Administrasi Surat',
      `Memperbarui status permohonan [${id}] menjadi [${status}]`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: `Permohonan surat '${id}' tidak ditemukan.` });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Nomor surat sudah digunakan. Silakan gunakan nomor lain.' });
    }
    console.error('❌ [UPDATE-STATUS-ERROR]:', err);
    return res.status(500).json({ success: false, error: `Gagal memperbarui status: ${err.message}` });
  }
});

// Delete Single Service Request (records audit log & stores into deletedServiceRequests archive)
router.delete('/requests/:id', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { id } = req.params;
  const reason = (req.body?.reason || req.query?.reason || 'Data Uji Coba / Testing').toString();
  const prisma = getPrisma();

  try {
    const searchId = (id || '').trim();

    const logRecord = await prisma.$transaction(async (tx: any) => {
      const target = await tx.serviceRequest.findFirst({
        where: {
          OR: [
            { id: searchId },
            { trackingCode: searchId }
          ]
        }
      });

      if (!target) throw new Error('NOT_FOUND');

      const deletedLog = await tx.deletedServiceRequest.create({
        data: {
          originalRequestId: target.id,
          trackingCode: target.trackingCode,
          serviceId: target.serviceId,
          serviceName: target.serviceName,
          citizenName: target.citizenName,
          citizenNikMasked: target.citizenNikMasked,
          phone: target.phone,
          addressDusun: target.addressDusun,
          requestDate: target.requestDate,
          lastStatus: target.status,
          deletedByUserName: req.user!.name,
          deletedByUserRole: req.user!.role,
          deletionReason: reason,
          fullRequestSnapshot: target as any
        }
      });

      await tx.serviceRequest.delete({ where: { id: target.id } });
      return deletedLog;
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Permohonan Surat',
      'Layanan Surat',
      `Permohonan surat ${logRecord.trackingCode} (${logRecord.citizenName} - ${logRecord.serviceName}) dihapus oleh ${req.user!.name} (${req.user!.role}). Alasan: ${reason}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Permohonan surat ${logRecord.trackingCode} berhasil dihapus dan dicatat di Buku Log Penghapusan.`,
      data: logRecord
    });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, error: 'Permohonan surat tidak ditemukan.' });
    return res.status(500).json({ success: false, error: 'Gagal menghapus permohonan surat.' });
  }
});

// Bulk Delete Service Requests (for bulk testing data cleanup)
router.post('/requests/bulk-delete', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'Daftar ID permohonan tidak valid.' });
  }

  const deletionReason = (reason || 'Pembersihan Massal Data Uji Coba / Testing').toString();
  const prisma = getPrisma();

  try {
    const idSet = ids.map((i: string) => String(i).trim());
    
    const results = await prisma.$transaction(async (tx: any) => {
      const targets = await tx.serviceRequest.findMany({
        where: {
          OR: [
            { id: { in: idSet } },
            { trackingCode: { in: idSet } }
          ]
        }
      });

      if (targets.length === 0) return 0;

      const deleteLogs = targets.map((target: any) => ({
        originalRequestId: target.id,
        trackingCode: target.trackingCode,
        serviceId: target.serviceId,
        serviceName: target.serviceName,
        citizenName: target.citizenName,
        citizenNikMasked: target.citizenNikMasked,
        phone: target.phone,
        addressDusun: target.addressDusun,
        requestDate: target.requestDate,
        lastStatus: target.status,
        deletedByUserName: req.user!.name,
        deletedByUserRole: req.user!.role,
        deletionReason: deletionReason,
        fullRequestSnapshot: target as any
      }));

      await tx.deletedServiceRequest.createMany({ data: deleteLogs });
      await tx.serviceRequest.deleteMany({
        where: {
          id: { in: targets.map((t: any) => t.id) }
        }
      });

      return targets.length;
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Massal Permohonan Surat',
      'Layanan Surat',
      `${results} berkas permohonan surat dihapus massal oleh ${req.user!.name}. Alasan: ${deletionReason}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `${results} berkas permohonan surat berhasil dihapus dan dicatat di Buku Log Penghapusan.`,
      deletedCount: results
    });
  } catch (err: any) {
    console.error('❌ [BULK-DELETE-ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Gagal menghapus permohonan secara massal.' });
  }
});

// Get Deleted Service Requests Log
router.get('/requests/deleted', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.deletedServiceRequests || [] });
    }
    const list = await getPrisma().deletedServiceRequest.findMany({
      orderBy: { deletedAt: 'desc' }
    });
    return res.json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat log penghapusan.' });
  }
});

// Restore Deleted Service Request
router.post('/requests/deleted/:id/restore', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { id } = req.params;
  const searchId = (id || '').trim();

  if (!(await isDatabaseAvailableCached())) {
    const db = getDb();
    db.deletedServiceRequests = db.deletedServiceRequests || [];
    const idx = db.deletedServiceRequests.findIndex((d: any) => d.id === searchId || d.trackingCode === searchId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Data log surat terhapus tidak ditemukan.' });
    const delLog = db.deletedServiceRequests[idx];
    const snapshot = delLog.fullRequestSnapshot || delLog;
    db.serviceRequests = db.serviceRequests || [];
    if (!db.serviceRequests.some((r: any) => r.id === snapshot.id || r.trackingCode === snapshot.trackingCode)) {
      db.serviceRequests.unshift(snapshot);
    }
    db.deletedServiceRequests.splice(idx, 1);
    saveDb(db);
    return res.json({
      success: true,
      degraded: true,
      message: `Permohonan surat ${snapshot.trackingCode || searchId} berhasil dipulihkan.`,
      data: snapshot
    });
  }

  const prisma = getPrisma();
  
  try {
    const restored = await prisma.$transaction(async (tx: any) => {
      const delLog = await tx.deletedServiceRequest.findFirst({
        where: {
          OR: [
            { id: searchId },
            { trackingCode: searchId }
          ]
        }
      });

      if (!delLog) throw new Error('NOT_FOUND');

      const snapshot = delLog.fullRequestSnapshot as any;
      
      // Cek apakah sudah ada di permohonan aktif
      const existing = await tx.serviceRequest.findFirst({
        where: {
          OR: [
            { id: snapshot.id },
            { trackingCode: snapshot.trackingCode }
          ]
        }
      });

      if (!existing) {
        await tx.serviceRequest.create({
          data: {
            ...snapshot,
            requestDate: new Date(snapshot.requestDate),
            completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
            updatedAt: new Date()
          }
        });
      }

      await tx.deletedServiceRequest.delete({ where: { id: delLog.id } });
      return snapshot;
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Pulihkan Permohonan Surat',
      'Layanan Surat',
      `Permohonan surat ${restored.trackingCode} dipulihkan oleh ${req.user!.name}.`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Permohonan surat ${restored.trackingCode} berhasil dipulihkan.`,
      data: restored
    });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, error: 'Data log surat terhapus tidak ditemukan.' });
    return res.status(500).json({ success: false, error: 'Gagal memulihkan permohonan.' });
  }
});

// Permanently Wipe Deleted Log (Super Admin & Admin Desa Only)
router.delete('/requests/deleted/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const before = (db.deletedServiceRequests || []).length;
      db.deletedServiceRequests = (db.deletedServiceRequests || []).filter((d: any) => d.id !== id);
      if (db.deletedServiceRequests.length === before) {
        return res.status(404).json({ success: false, error: 'Catatan log tidak ditemukan.' });
      }
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Catatan log surat terhapus berhasil dibersihkan.' });
    }

    const wiped = await getPrisma().deletedServiceRequest.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Permanen Catatan Log Surat',
      'Keamanan & Audit',
      `Catatan log surat terhapus ${wiped.trackingCode} dihapus permanen oleh ${req.user!.name}.`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Catatan log surat terhapus berhasil dibersihkan.' });
  } catch (error) {
    return res.status(404).json({ success: false, error: 'Catatan log tidak ditemukan.' });
  }
});

// Clear All Deleted Logs (Super Admin only for reset testing)
router.post('/requests/deleted/clear-all', requireRoles('super_admin'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const count = (db.deletedServiceRequests || []).length;
      db.deletedServiceRequests = [];
      saveDb(db);
      return res.json({
        success: true,
        degraded: true,
        message: `Seluruh catatan log sampah (${count} berkas) berhasil dikosongkan.`
      });
    }

    const scopedWhere = getScopedDeleteWhere({}, 'POST /api/admin/requests/deleted/clear-all');
    const prisma = await getPrismaForActiveContext();
    const { count } = await prisma.deletedServiceRequest.deleteMany({ where: scopedWhere });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Kosongkan Seluruh Log Surat Terhapus',
      'Keamanan & Audit',
      `${count} catatan log surat terhapus telah dikosongkan secara permanen.`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Seluruh catatan log sampah (${count} berkas) berhasil dikosongkan.`
    });
  } catch (error: any) {
    if (error instanceof TenantScopeViolationError) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Gagal mengosongkan log.' });
  }
});

// 3. Complaints Management (Operator, Admin Desa, Super Admin)
router.get('/complaints', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.complaints || [] });
    }
    const data = await getPrisma().complaint.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar pengaduan.' });
  }
});

router.put('/complaints/:id/respond', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { response, status, fotoBuktiPenyelesaian, catatanTindakLanjut } = req.body;

    const validStatuses = ['diterima', 'diverifikasi', 'diproses', 'selesai', 'ditolak'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status aduan tidak valid.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.complaints || []).findIndex((c: any) => c.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Pengaduan tidak ditemukan.' });
      db.complaints[idx] = {
        ...db.complaints[idx],
        adminResponse: response,
        status: status || db.complaints[idx].status,
        respondedBy: req.user?.name || 'Pemerintah Desa',
        fotoBuktiPenyelesaian,
        catatanTindakLanjut,
        updatedAt: new Date().toISOString()
      };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.complaints[idx] });
    }

    const prisma = getPrisma();
    const complaint = await prisma.complaint.update({
      where: { id },
      data: {
        adminResponse: response,
        status: status || undefined,
        respondedBy: req.user?.name || 'Pemerintah Desa',
        fotoBuktiPenyelesaian,
        catatanTindakLanjut
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tanggapi Pengaduan',
      'Aspirasi Warga',
      `Aduan ${complaint.ticketNumber} (${complaint.title}) ditanggapi: "${response || '-'}" (Status: ${status || complaint.status})`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Tanggapan untuk aduan ${complaint.ticketNumber} berhasil disimpan.`,
      data: complaint
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menanggapi pengaduan.' });
  }
});

// 4. News CRUD (Editor, Operator, Admin Desa, Super Admin)
router.get('/news', requireRoles('super_admin', 'admin_desa', 'operator', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.news || [] });
    }
    const data = await getPrisma().newsItem.findMany({
      orderBy: { publishedAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat berita.' });
  }
});

router.post('/news', requireRoles('super_admin', 'admin_desa', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { title, summary, content, category, imageUrl, coverImage, author, isPublished } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Judul dan isi berita wajib diisi.' });
    }

    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4);

    const finalImg = (coverImage || imageUrl || 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80').trim();

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.news = db.news || [];
      const created = {
        id: generateServerId('news'),
        title: title.trim(),
        slug,
        summary: summary ? summary.trim() : title.slice(0, 120),
        content: content.trim(),
        category: category || 'pemerintahan',
        author: (author || req.user?.name || 'Admin Desa').trim(),
        coverImage: finalImg,
        imageUrl: finalImg,
        isPublished: typeof isPublished === 'boolean' ? isPublished : true,
        publishedAt: new Date().toISOString(),
        views: 0
      };
      db.news.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, message: 'Berita berhasil dipublikasikan.', data: created });
    }

    const newArticle = await getPrisma().newsItem.create({
      data: {
        title: title.trim(),
        slug,
        summary: summary ? summary.trim() : title.slice(0, 120),
        content: content.trim(),
        category: category || 'pemerintahan',
        author: (author || req.user?.name || 'Admin Desa').trim(),
        coverImage: finalImg,
        isPublished: typeof isPublished === 'boolean' ? isPublished : true,
        views: 0
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Publikasi Berita',
      'Warta Berita',
      `Menerbitkan artikel baru: "${newArticle.title}" (${newArticle.category})`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'Berita berhasil dipublikasikan.', data: newArticle });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memublikasikan berita.' });
  }
});

router.put('/news/:id', requireRoles('super_admin', 'admin_desa', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { title, summary, content, category, imageUrl, coverImage, author, isPublished } = req.body;
    const finalImg = (coverImage || imageUrl)?.trim();

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.news || []).findIndex((n: any) => n.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Berita tidak ditemukan.' });
      db.news[idx] = {
        ...db.news[idx],
        ...req.body,
        id,
        ...(finalImg ? { coverImage: finalImg, imageUrl: finalImg } : {})
      };
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Berita berhasil diperbarui.', data: db.news[idx] });
    }

    const prisma = getPrisma();

    const article = await prisma.newsItem.update({
      where: { id },
      data: {
        title: title?.trim(),
        summary: summary?.trim(),
        content: content?.trim(),
        category,
        author: author?.trim(),
        coverImage: finalImg,
        isPublished: typeof isPublished === 'boolean' ? isPublished : undefined
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Ubah Berita',
      'Warta Berita',
      `Memperbarui artikel: "${article.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Berita berhasil diperbarui.', data: article });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui berita.' });
  }
});

router.delete('/news/:id', requireRoles('super_admin', 'admin_desa', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.news = (db.news || []).filter((n: any) => n.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Berita berhasil dihapus.' });
    }

    const removed = await getPrisma().newsItem.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Berita',
      'Warta Berita',
      `Menghapus artikel: "${removed.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Berita berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus berita.' });
  }
});

// 5. Announcements CRUD (Editor, Admin Desa, Super Admin)
router.post('/announcements', requireRoles('super_admin', 'admin_desa', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { title, content, priority, validUntil } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Judul dan isi pengumuman wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.announcements = db.announcements || [];
      const created = {
        id: generateServerId('ann'),
        title: title.trim(),
        content: content.trim(),
        priority: priority || 'normal',
        validUntil: validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        publishedAt: new Date().toISOString(),
        isActive: true
      };
      db.announcements.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, message: 'Pengumuman berhasil diterbitkan.', data: created });
    }

    const newAnn = await getPrisma().announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        priority: priority || 'normal',
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        isActive: true
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Pengumuman',
      'Pengumuman',
      `Menambahkan pengumuman prioritas ${newAnn.priority}: "${newAnn.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'Pengumuman berhasil diterbitkan.', data: newAnn });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menerbitkan pengumuman.' });
  }
});

router.put('/announcements/:id', requireRoles('super_admin', 'admin_desa', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { title, content, priority, validUntil, isActive } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.announcements || []).findIndex((a: any) => a.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Pengumuman tidak ditemukan.' });
      db.announcements[idx] = { ...db.announcements[idx], ...req.body, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Pengumuman berhasil diperbarui.', data: db.announcements[idx] });
    }

    const ann = await getPrisma().announcement.update({
      where: { id },
      data: {
        title: title?.trim(),
        content: content?.trim(),
        priority,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Ubah Pengumuman',
      'Pengumuman',
      `Memperbarui pengumuman: "${ann.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Pengumuman berhasil diperbarui.', data: ann });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui pengumuman.' });
  }
});

router.delete('/announcements/:id', requireRoles('super_admin', 'admin_desa', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.announcements = (db.announcements || []).filter((a: any) => a.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Pengumuman berhasil dihapus.' });
    }

    const removed = await getPrisma().announcement.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Pengumuman',
      'Pengumuman',
      `Menghapus pengumuman: "${removed.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Pengumuman berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus pengumuman.' });
  }
});

// 6. Agendas CRUD (Editor, Admin Desa, Super Admin)
router.post('/agendas', requireRoles('super_admin', 'admin_desa', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { title, date, time, location, organizer, description, category } = req.body;
    if (!title || !date || !location) {
      return res.status(400).json({ success: false, error: 'Judul, tanggal, dan lokasi agenda wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.agendas = db.agendas || [];
      const created = {
        id: generateServerId('agenda'),
        title: title.trim(),
        date,
        time: time || '09:00 WIB',
        location: location.trim(),
        organizer: organizer || 'Pemerintah Desa',
        description: description || '',
        category: category || undefined,
        status: 'akan_datang'
      };
      db.agendas.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, message: 'Agenda berhasil ditambahkan.', data: created });
    }

    const newAgenda = await getPrisma().agendaItem.create({
      data: {
        title: title.trim(),
        date: new Date(date),
        time: time || '09:00 WIB',
        location: location.trim(),
        organizer: organizer || 'Pemerintah Desa',
        description: description || '',
        status: 'akan_datang'
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Agenda',
      'Kalender Kegiatan',
      `Menjadwalkan agenda: "${newAgenda.title}" pada ${date}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'Agenda berhasil ditambahkan.', data: newAgenda });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menambahkan agenda.' });
  }
});

router.put('/agendas/:id', requireRoles('super_admin', 'admin_desa', 'operator', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { title, date, time, location, organizer, description, category, status } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.agendas || []).findIndex((a: any) => a.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Agenda tidak ditemukan.' });
      db.agendas[idx] = { ...db.agendas[idx], ...req.body, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Agenda berhasil diperbarui.', data: db.agendas[idx] });
    }

    const updatedAgenda = await getPrisma().agendaItem.update({
      where: { id },
      data: {
        title: title?.trim(),
        date: date ? new Date(date) : undefined,
        time: time || undefined,
        location: location?.trim(),
        organizer: organizer || undefined,
        description: description !== undefined ? description : undefined,
        category: category !== undefined ? category : undefined,
        status: status || undefined
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Perbarui Agenda',
      'Kalender Kegiatan',
      `Memperbarui agenda: "${updatedAgenda.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Agenda berhasil diperbarui.', data: updatedAgenda });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui agenda.' });
  }
});

router.delete('/agendas/:id', requireRoles('super_admin', 'admin_desa', 'operator', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.agendas = (db.agendas || []).filter((a: any) => a.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Agenda berhasil dihapus.' });
    }
    const removed = await getPrisma().agendaItem.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Agenda',
      'Kalender Kegiatan',
      `Menghapus agenda: "${removed.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Agenda berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus agenda.' });
  }
});

// 7. Development Projects CRUD (Admin Desa, Super Admin)
router.post('/projects', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { title, location, year, fiscalYear, budget, source, fundingSource, contractor, progress, progressPercent, status, description, imageUrl } = req.body;
    if (!title || !location || budget === undefined) {
      return res.status(400).json({ success: false, error: 'Nama proyek, lokasi, dan anggaran wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.developmentProjects = db.developmentProjects || [];
      const created = {
        id: generateServerId('proj'),
        title: title.trim(),
        location: location.trim(),
        fiscalYear: Number(year || fiscalYear) || 2026,
        budget: Number(budget) || 0,
        fundingSource: fundingSource || source || 'Dana Desa (DDS)',
        contractor: contractor || 'TPK Desa Pulau Betung',
        progressPercent: Math.min(100, Math.max(0, Number(progress ?? progressPercent) || 0)),
        status: status || 'sedang_berjalan',
        description: description || '',
        beforeImage: imageUrl || 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80',
        inProgressImage: imageUrl || 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80',
        startDate: new Date().toISOString(),
        targetEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      };
      db.developmentProjects.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, message: 'Proyek pembangunan berhasil ditambahkan.', data: created });
    }

    const newProj = await getPrisma().developmentProject.create({
      data: {
        title: title.trim(),
        location: location.trim(),
        fiscalYear: Number(year || fiscalYear) || 2026,
        budget: Number(budget) || 0,
        fundingSource: fundingSource || source || 'Dana Desa (DDS)',
        contractor: contractor || 'TPK Desa Pulau Betung',
        progressPercent: Math.min(100, Math.max(0, Number(progress ?? progressPercent) || 0)),
        status: status || 'sedang_berjalan',
        description: description || '',
        beforeImage: imageUrl || 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80',
        inProgressImage: imageUrl || 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80',
        startDate: new Date(),
        targetEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // Default 6 months
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Proyek Pembangunan',
      'Monitoring Pembangunan',
      `Mendaftarkan proyek fisik: "${newProj.title}" (Pagu: Rp ${newProj.budget.toLocaleString('id-ID')})`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'Proyek pembangunan berhasil ditambahkan.', data: newProj });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menambahkan proyek pembangunan.' });
  }
});

router.put('/projects/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { progress, progressPercent } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.developmentProjects || []).findIndex((p: any) => p.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Proyek pembangunan tidak ditemukan.' });
      const nextProgress = progress !== undefined || progressPercent !== undefined
        ? Math.min(100, Math.max(0, Number(progress ?? progressPercent)))
        : db.developmentProjects[idx].progressPercent;
      db.developmentProjects[idx] = { ...db.developmentProjects[idx], ...req.body, progressPercent: nextProgress, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Data proyek berhasil diperbarui.', data: db.developmentProjects[idx] });
    }
    
    const updateData = { ...req.body };
    if (progress !== undefined || progressPercent !== undefined) {
      updateData.progressPercent = Math.min(100, Math.max(0, Number(progress ?? progressPercent)));
    }
    
    // Clean up non-schema fields
    delete updateData.progress;
    delete updateData.year;
    if (req.body.year) updateData.fiscalYear = Number(req.body.year);

    const proj = await getPrisma().developmentProject.update({
      where: { id },
      data: updateData
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Update Proyek Pembangunan',
      'Monitoring Pembangunan',
      `Memperbarui data proyek: "${proj.title}" (Progres saat ini: ${proj.progressPercent}%)`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Data proyek berhasil diperbarui.', data: proj });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui data proyek.' });
  }
});

// 8. UMKM Verification (Admin Desa, Super Admin)
router.put('/umkm/:id/verify', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.umkm || []).findIndex((u: any) => u.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'UMKM tidak ditemukan.' });
      db.umkm[idx] = { ...db.umkm[idx], isVerified: !db.umkm[idx].isVerified };
      saveDb(db);
      return res.json({
        success: true,
        degraded: true,
        message: `Status verifikasi ${db.umkm[idx].name} berhasil diperbarui.`,
        data: db.umkm[idx]
      });
    }

    const prisma = getPrisma();
    
    const existing = await prisma.umkmItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'UMKM tidak ditemukan.' });

    const item = await prisma.umkmItem.update({
      where: { id },
      data: { isVerified: !existing.isVerified }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Verifikasi UMKM',
      'Katalog UMKM',
      `Status verifikasi UMKM "${item.name}" diubah menjadi ${item.isVerified ? 'TERVERIFIKASI' : 'BELUM TERVERIFIKASI'}`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: `Status verifikasi ${item.name} berhasil diperbarui.`,
      data: item
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui status verifikasi UMKM.' });
  }
});

router.post('/umkm', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { name, ownerName, category, description, products, imageUrl, location, whatsappContact } = req.body;
    if (!name || !ownerName) {
      return res.status(400).json({ success: false, error: 'Nama usaha dan nama pemilik wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.umkm = db.umkm || [];
      const created = {
        id: generateServerId('umkm'),
        name: name.trim(),
        ownerName: ownerName.trim(),
        category: category || 'kuliner',
        description: description || '',
        products: Array.isArray(products) ? products : (products ? [products] : []),
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80',
        location: location || 'Desa Pulau Betung',
        whatsappContact: whatsappContact || '',
        isVerified: true
      };
      db.umkm.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, message: 'UMKM berhasil didaftarkan.', data: created });
    }

    const prisma = getPrisma();
    let ownerSnapshot = null;

    try {
      const resident = await prisma.resident.findFirst({
        where: { fullName: { equals: ownerName.trim(), mode: 'insensitive' } }
      });
      if (resident) {
        ownerSnapshot = {
          nik: resident.nik,
          fullName: resident.fullName,
          address: resident.address,
          phone: resident.phone,
          capturedAt: new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('⚠️ Gagal mengambil snapshot pemilik UMKM:', err);
    }

    const newUmkm = await prisma.umkmItem.create({
      data: {
        name: name.trim(),
        ownerName: ownerName.trim(),
        category: category || 'kuliner',
        description: description || '',
        products: Array.isArray(products) ? products : (products ? [products] : []),
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80',
        location: location || 'Desa Pulau Betung',
        whatsappContact: whatsappContact || '',
        isVerified: true,
        ownerSnapshot: ownerSnapshot as any
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah UMKM',
      'Katalog UMKM',
      `Mendaftarkan UMKM baru: "${newUmkm.name}" milik ${newUmkm.ownerName}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'UMKM berhasil didaftarkan.', data: newUmkm });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal mendaftarkan UMKM.' });
  }
});

router.put('/umkm/:id', requireRoles('super_admin', 'admin_desa', 'operator', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { name, ownerName, category, description, products, imageUrl, location, whatsappContact, phone, priceRange, isVerified } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.umkm || []).findIndex((u: any) => u.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'UMKM tidak ditemukan.' });
      db.umkm[idx] = { ...db.umkm[idx], ...req.body, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.umkm[idx] });
    }

    const updated = await getPrisma().umkmItem.update({
      where: { id },
      data: {
        name: name?.trim(),
        ownerName: ownerName?.trim(),
        category,
        description,
        products: Array.isArray(products) ? products : undefined,
        imageUrl,
        location,
        whatsappContact,
        phone,
        priceRange,
        isVerified: typeof isVerified === 'boolean' ? isVerified : undefined
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Update UMKM',
      'Katalog UMKM',
      `Memperbarui data UMKM: "${updated.name}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui UMKM.' });
  }
});

router.delete('/umkm/:id', requireRoles('super_admin', 'admin_desa', 'operator', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.umkm = (db.umkm || []).filter((u: any) => u.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'UMKM berhasil dihapus.' });
    }
    const removed = await getPrisma().umkmItem.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus UMKM',
      'Katalog UMKM',
      `Menghapus UMKM: "${removed.name}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'UMKM berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus UMKM.' });
  }
});

// 7b. Delete Development Project (Operator, Admin Desa, Super Admin)
router.delete('/projects/:id', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.developmentProjects = (db.developmentProjects || []).filter((p: any) => p.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Proyek pembangunan berhasil dihapus.' });
    }
    const removed = await getPrisma().developmentProject.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Proyek Pembangunan',
      'Monitoring Pembangunan',
      `Menghapus proyek: "${removed.title}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Proyek pembangunan berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus proyek pembangunan.' });
  }
});

// 7c. Village Potentials CRUD (Admin Desa, Super Admin)
router.post('/potentials', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { name, category, description, highlightStat, imageUrl, keyCommodities, keyOpportunities } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nama potensi desa wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const created = {
        id: generateServerId('pot'),
        name: name.trim(),
        category: category || 'pertanian',
        description: description || '',
        highlightStat: highlightStat || '-',
        imageUrl: imageUrl || '',
        keyCommodities: Array.isArray(keyCommodities) ? keyCommodities : [],
        keyOpportunities: Array.isArray(keyOpportunities) ? keyOpportunities : []
      };
      db.potentials = [created, ...(db.potentials || [])];
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, data: created });
    }

    const created = await getPrisma().villagePotential.create({
      data: {
        name: name.trim(),
        category: category || 'pertanian',
        description: description || '',
        highlightStat: highlightStat || '-',
        imageUrl: imageUrl || '',
        keyCommodities: Array.isArray(keyCommodities) ? keyCommodities : [],
        keyOpportunities: Array.isArray(keyOpportunities) ? keyOpportunities : []
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Potensi Desa',
      'Potensi Desa',
      `Menambahkan potensi desa: "${created.name}" (${created.category})`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menambahkan potensi desa.' });
  }
});

router.put('/potentials/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { name, category, description, highlightStat, imageUrl, keyCommodities, keyOpportunities } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.potentials || []).findIndex((p: any) => p.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Potensi desa tidak ditemukan.' });
      db.potentials[idx] = { ...db.potentials[idx], ...req.body, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.potentials[idx] });
    }

    const updated = await getPrisma().villagePotential.update({
      where: { id },
      data: {
        name: name?.trim(),
        category,
        description,
        highlightStat,
        imageUrl,
        keyCommodities: Array.isArray(keyCommodities) ? keyCommodities : undefined,
        keyOpportunities: Array.isArray(keyOpportunities) ? keyOpportunities : undefined
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Perbarui Potensi Desa',
      'Potensi Desa',
      `Memperbarui potensi desa: "${updated.name}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui potensi desa.' });
  }
});

router.delete('/potentials/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.potentials = (db.potentials || []).filter((p: any) => p.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Potensi desa berhasil dihapus.' });
    }

    const removed = await getPrisma().villagePotential.delete({ where: { id } });
    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Potensi Desa',
      'Potensi Desa',
      `Menghapus potensi desa: "${removed.name}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Potensi desa berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus potensi desa.' });
  }
});

// 7d. APBDes / Budget Management (Admin Desa, Super Admin)
router.get('/budget', requireRoles('super_admin', 'admin_desa', 'operator'), async (_req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const history = Array.isArray(db.budgetHistory) && db.budgetHistory.length > 0
        ? db.budgetHistory
        : (db.budget ? [db.budget] : []);
      return res.json({ success: true, degraded: true, data: history });
    }

    const budgets = await getPrisma().budgetYearData.findMany({
      orderBy: { year: 'desc' }
    });
    return res.json({ success: true, data: budgets });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data APBDes.' });
  }
});

router.put('/budget', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const payload = req.body || {};
    const year = Number(payload.year) || 2026;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const savedBudget = { ...payload, year, id: payload.id || `apbdes-${year}-${payload.documentType || 'murni'}` };
      db.budget = savedBudget;
      db.budgetHistory = Array.isArray(db.budgetHistory) ? db.budgetHistory : [];
      const idx = db.budgetHistory.findIndex((b: any) => Number(b.year) === year && (b.documentType || 'murni') === (savedBudget.documentType || 'murni'));
      if (idx >= 0) db.budgetHistory[idx] = savedBudget;
      else db.budgetHistory.unshift(savedBudget);
      saveDb(db);
      return res.json({ success: true, degraded: true, data: savedBudget });
    }

    const docType = payload.documentType || 'murni';
    const budgetPrisma = getPrisma();
    const existingBudget = await budgetPrisma.budgetYearData.findFirst({
      where: { year, documentType: docType }
    });
    const budgetPayload = {
      documentType: docType,
      status: payload.status || 'BERLAKU',
      legalRefNumber: payload.legalRefNumber || null,
      enactmentDate: payload.enactmentDate ? new Date(payload.enactmentDate) : null,
      totalIncome: Number(payload.totalIncome) || 0,
      totalIncomeRealized: Number(payload.totalIncomeRealized) || 0,
      totalExpenditure: Number(payload.totalExpenditure) || 0,
      totalExpenditureRealized: Number(payload.totalExpenditureRealized) || 0,
      totalFinancing: Number(payload.totalFinancing) || 0,
      totalFinancingRealized: Number(payload.totalFinancingRealized) || 0,
      realizationPercentage: Number(payload.realizationPercentage) || 0,
      incomeBreakdown: payload.incomeBreakdown || [],
      expenditureBreakdown: payload.expenditureBreakdown || [],
      incomeItems: payload.incomeItems || null,
      expenditureItems: payload.expenditureItems || null,
      financingItems: payload.financingItems || null,
      publicDocuments: payload.publicDocuments || []
    };

    const saved = existingBudget
      ? await budgetPrisma.budgetYearData.update({
          where: { id: existingBudget.id },
          data: budgetPayload
        })
      : await budgetPrisma.budgetYearData.create({
          data: {
            year,
            ...budgetPayload
          }
        });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Perbarui APBDes',
      'Transparansi APBDes',
      `Memperbarui data APBDes Tahun Anggaran ${year} (${saved.documentType})`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, data: saved });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menyimpan data APBDes: ' + (error?.message || '') });
  }
});

// 9. Village Officials Management (Aparatur, RT, RW, Karang Taruna, BPD, PKK)
router.post('/officials', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { name, position, section, nip, bio, imageUrl, tenure, phone, gender, birthDate, isActive, displayOrder } = req.body;
    if (!name || !position) {
      return res.status(400).json({ success: false, error: 'Nama lengkap dan jabatan perangkat wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.officials = db.officials || [];
      const created = {
        id: generateServerId('off'),
        name: name.trim(),
        position: position.trim(),
        section: section || 'sekretariat',
        nip: nip ? String(nip).trim() : null,
        bio: bio || `Aparatur Pemerintahan Desa Pulau Betung - ${position.trim()}`,
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
        tenure: tenure || 'Aktif',
        phone: phone ? String(phone).trim() : null,
        gender: gender || 'Laki-laki',
        birthDate: birthDate ? String(birthDate) : null,
        isActive: isActive !== false,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
        hasAdminAccess: Boolean(req.body.hasAdminAccess),
        adminRole: req.body.adminRole || 'operator',
        adminUsername: req.body.adminUsername || null,
        allowedModules: req.body.allowedModules || []
      };
      db.officials.push(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, message: 'Perangkat desa berhasil ditambahkan.', data: created });
    }

    const prisma = getPrisma();
    const newOfficial = await prisma.villageOfficial.create({
      data: {
        name: name.trim(),
        position: position.trim(),
        section: section || 'sekretariat',
        nip: nip ? String(nip).trim() : null,
        bio: bio || `Aparatur Pemerintahan Desa Pulau Betung - ${position.trim()}`,
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
        tenure: tenure || 'Aktif',
        phone: phone ? String(phone).trim() : null,
        gender: gender || 'Laki-laki',
        birthDate: birthDate ? String(birthDate) : null,
        isActive: isActive !== false,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
        hasAdminAccess: Boolean(req.body.hasAdminAccess),
        adminRole: req.body.adminRole || 'operator',
        adminUsername: req.body.adminUsername || null,
        allowedModules: req.body.allowedModules || []
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Perangkat Desa',
      'Pemerintahan Desa',
      `Menambahkan perangkat baru: "${newOfficial.name}" (${newOfficial.position})`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'Perangkat desa berhasil ditambahkan.', data: newOfficial });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menambahkan perangkat desa.' });
  }
});

router.put('/officials/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { name, position, section, nip, bio, imageUrl, tenure, phone, gender, birthDate, isActive, displayOrder } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.officials || []).findIndex((o: any) => o.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Perangkat desa tidak ditemukan.' });
      db.officials[idx] = { ...db.officials[idx], ...req.body, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Data perangkat desa berhasil diperbarui.', data: db.officials[idx] });
    }

    const prisma = getPrisma();

    const official = await prisma.villageOfficial.update({
      where: { id },
      data: {
        name: name?.trim(),
        position: position?.trim(),
        section,
        nip: nip ? String(nip).trim() : undefined,
        bio: bio ? String(bio).trim() : undefined,
        imageUrl: imageUrl ? String(imageUrl).trim() : undefined,
        tenure: tenure ? String(tenure).trim() : undefined,
        phone: phone ? String(phone).trim() : undefined,
        gender,
        birthDate: birthDate ? String(birthDate) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : undefined,
        hasAdminAccess: req.body.hasAdminAccess !== undefined ? Boolean(req.body.hasAdminAccess) : undefined,
        adminRole: req.body.adminRole,
        adminUsername: req.body.adminUsername,
        allowedModules: req.body.allowedModules
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Perbarui Perangkat Desa',
      'Pemerintahan Desa',
      `Memperbarui data perangkat: "${official.name}" (${official.position})`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Data perangkat desa berhasil diperbarui.', data: official });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui data perangkat desa.' });
  }
});

router.delete('/officials/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.officials = (db.officials || []).filter((o: any) => o.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Data perangkat desa berhasil dihapus.' });
    }

    const removed = await getPrisma().villageOfficial.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Perangkat Desa',
      'Pemerintahan Desa',
      `Menghapus perangkat desa: "${removed.name}" (${removed.position})`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Data perangkat desa berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus perangkat desa.' });
  }
});

// 9b. Village Profile & Identity Management (Consolidated with DB)
router.get('/profile', requireRoles('super_admin', 'admin_desa', 'operator', 'editor', 'admin_posyandu'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.villageProfile });
    }
    const profile = await getPrisma().villageProfile.findFirst({
      orderBy: { lastUpdated: 'desc' }
    });
    return res.json({ success: true, data: profile });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat profil desa.' });
  }
});

router.put('/profile', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { 
      villageName, kadesName, kadesNip, district, email, phone, 
      addressStreet, vision, mission, villageLogoUrl,
      villageLogoSecondaryUrl, regencyLogoUrl, sadewaLogoUrl,
      sadewaIconUrl, officialSignatureUrl, kadesPhotoUrl,
      regency, province, website, postalCode, history,
      officeLocation,
      motto, kadesGreetingTitle, kadesGreeting,
      heroTitle, heroSubtitle, heroBackgroundUrl, heroBadgeText, heroIsActive,
      whatsappCenter, operatingHours, emergencyContacts, letterCodePrefix,
      totalPopulation, totalFamilies
    } = req.body;

    // Validasi Format Email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Format email tidak valid.' });
    }

    const userRole = req.user!.role;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const existingFallback = db.villageProfile || ({} as any);
      if (sadewaLogoUrl !== undefined && existingFallback.sadewaLogoUrl !== sadewaLogoUrl && userRole !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Akses Ditolak: Hanya Super Admin yang boleh mengubah Logo Induk SADEWA.' });
      }
      if ((req.body.sadewaIconUrl !== undefined) && existingFallback.sadewaIconUrl !== req.body.sadewaIconUrl && userRole !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Akses Ditolak: Hanya Super Admin yang boleh mengubah Ikon Simbol SADEWA.' });
      }
      db.villageProfile = { ...existingFallback, ...req.body, lastUpdated: new Date().toISOString() };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.villageProfile });
    }

    const profilePrisma = getPrisma();
    const activeCtx = getCurrentTenantContext();
    const existing = await profilePrisma.villageProfile.findFirst({
      orderBy: { lastUpdated: 'desc' }
    });

    // Guards: Ganti Logo Induk & Favicon (Hanya Super Admin)
    if (sadewaLogoUrl !== undefined && (!existing || existing.sadewaLogoUrl !== sadewaLogoUrl)) {
      if (userRole !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Akses Ditolak: Hanya Super Admin yang boleh mengubah Logo Induk SADEWA.' });
      }
    }
    if (sadewaIconUrl !== undefined && (!existing || existing.sadewaIconUrl !== sadewaIconUrl)) {
      if (userRole !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'Akses Ditolak: Hanya Super Admin yang boleh mengubah Ikon Simbol SADEWA.' });
      }
    }

    // Guards: Banner Utama Beranda (Hanya Super Admin atau Admin Desa)
    if (heroBackgroundUrl !== undefined && (!existing || existing.heroBackgroundUrl !== heroBackgroundUrl)) {
      if (userRole !== 'super_admin' && userRole !== 'admin_desa') {
        return res.status(403).json({ success: false, error: 'Akses Ditolak: Hanya Super Admin atau Admin Desa yang boleh mengubah Banner Hero Utama.' });
      }
    }

    const updateFields = {
      totalPopulation: totalPopulation !== undefined ? Number(totalPopulation) : undefined,
      totalFamilies: totalFamilies !== undefined ? Number(totalFamilies) : undefined,
      villageName: villageName?.trim(),
      kadesName: kadesName?.trim(),
      kadesNip: kadesNip?.trim(),
      district: district?.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      addressStreet: addressStreet?.trim(),
      vision: vision?.trim(),
      mission: Array.isArray(mission) ? mission : undefined,
      villageLogoUrl: villageLogoUrl !== undefined ? (villageLogoUrl && villageLogoUrl.trim().length > 0 ? villageLogoUrl.trim() : null) : undefined,
      villageLogoSecondaryUrl: villageLogoSecondaryUrl !== undefined ? (villageLogoSecondaryUrl && villageLogoSecondaryUrl.trim().length > 0 ? villageLogoSecondaryUrl.trim() : null) : undefined,
      regencyLogoUrl: regencyLogoUrl !== undefined ? (regencyLogoUrl && regencyLogoUrl.trim().length > 0 ? regencyLogoUrl.trim() : null) : undefined,
      sadewaLogoUrl: sadewaLogoUrl !== undefined ? (sadewaLogoUrl && sadewaLogoUrl.trim().length > 0 ? sadewaLogoUrl.trim() : null) : undefined,
      sadewaIconUrl: sadewaIconUrl !== undefined ? (sadewaIconUrl && sadewaIconUrl.trim().length > 0 ? sadewaIconUrl.trim() : null) : undefined,
      officialSignatureUrl: officialSignatureUrl !== undefined ? (officialSignatureUrl && officialSignatureUrl.trim().length > 0 ? officialSignatureUrl.trim() : null) : undefined,
      kadesPhotoUrl: kadesPhotoUrl !== undefined ? (kadesPhotoUrl && kadesPhotoUrl.trim().length > 0 ? kadesPhotoUrl.trim() : null) : undefined,
      regency: regency?.trim(),
      province: province?.trim(),
      website: website?.trim(),
      postalCode: postalCode?.trim(),
      history: history?.trim(),
      officeLocation: officeLocation !== undefined ? officeLocation : undefined,
      motto: motto?.trim(),
      kadesGreetingTitle: kadesGreetingTitle?.trim(),
      kadesGreeting: kadesGreeting?.trim(),
      heroTitle: heroTitle?.trim(),
      heroSubtitle: heroSubtitle?.trim(),
      heroBackgroundUrl: heroBackgroundUrl !== undefined ? (heroBackgroundUrl && heroBackgroundUrl.trim().length > 0 ? heroBackgroundUrl.trim() : null) : undefined,
      heroBadgeText: heroBadgeText?.trim(),
      heroIsActive: heroIsActive !== undefined ? Boolean(heroIsActive) : undefined,
      whatsappCenter: whatsappCenter?.trim(),
      operatingHours: operatingHours !== undefined ? operatingHours : undefined,
      emergencyContacts: emergencyContacts !== undefined ? emergencyContacts : undefined,
      letterCodePrefix: letterCodePrefix?.trim(),
      lastUpdated: new Date()
    };

    const profile = existing
      ? await profilePrisma.villageProfile.update({
          where: { id: existing.id },
          data: updateFields
        })
      : await profilePrisma.villageProfile.create({
          data: {
            id: getTenantVillageProfileId(),
            villageName: villageName?.trim() || activeCtx?.tenantName || 'Desa Pulau Betung',
            kadesName: kadesName?.trim() || 'Kepala Desa',
            kadesNip: kadesNip?.trim() || '-',
            district: district?.trim() || '-',
            regency: regency?.trim() || 'Kabupaten Batang Hari',
            province: province?.trim() || 'Provinsi Jambi',
            postalCode: postalCode?.trim() || '36657',
            email: email?.trim(),
            phone: phone?.trim(),
            addressStreet: addressStreet?.trim(),
            vision: vision?.trim() || '-',
            mission: Array.isArray(mission) ? mission : [],
            villageLogoUrl: villageLogoUrl && villageLogoUrl.length > 10 ? villageLogoUrl : undefined,
            villageLogoSecondaryUrl: villageLogoSecondaryUrl && villageLogoSecondaryUrl.length > 10 ? villageLogoSecondaryUrl : undefined,
            regencyLogoUrl: regencyLogoUrl && regencyLogoUrl.length > 10 ? regencyLogoUrl : undefined,
            sadewaLogoUrl: sadewaLogoUrl && sadewaLogoUrl.length > 10 ? sadewaLogoUrl : undefined,
            sadewaIconUrl: sadewaIconUrl && sadewaIconUrl.length > 10 ? sadewaIconUrl : undefined,
            officialSignatureUrl: officialSignatureUrl && officialSignatureUrl.length > 10 ? officialSignatureUrl : undefined,
            kadesPhotoUrl: kadesPhotoUrl && kadesPhotoUrl.length > 10 ? kadesPhotoUrl : undefined,
            motto: motto?.trim(),
            kadesGreetingTitle: kadesGreetingTitle?.trim(),
            kadesGreeting: kadesGreeting?.trim(),
            heroTitle: heroTitle?.trim(),
            heroSubtitle: heroSubtitle?.trim(),
            heroBackgroundUrl: heroBackgroundUrl && heroBackgroundUrl.length > 10 ? heroBackgroundUrl : undefined,
            heroBadgeText: heroBadgeText?.trim(),
            heroIsActive: heroIsActive !== undefined ? Boolean(heroIsActive) : true,
            whatsappCenter: whatsappCenter?.trim(),
            history: history?.trim() || `Sejarah ${activeCtx?.tenantName || 'Desa'}`,
            operatingHours: operatingHours || {},
            emergencyContacts: emergencyContacts || [],
            letterCodePrefix: letterCodePrefix?.trim() || activeCtx?.letterCodePrefix || 'PB',
            totalPopulation: 0,
            totalFamilies: 0,
            areaSqKm: 0,
            borders: {},
            lastUpdated: new Date()
          }
        });

    // Catat Audit Trail spesifik untuk perubahan branding/banner
    if (sadewaLogoUrl !== undefined && (!existing || existing.sadewaLogoUrl !== sadewaLogoUrl)) {
      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Update Logo Induk',
        'Branding',
        'Memperbarui Logo Induk SADEWA',
        req.ip || '127.0.0.1'
      );
    }
    if (sadewaIconUrl !== undefined && (!existing || existing.sadewaIconUrl !== sadewaIconUrl)) {
      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Update Ikon',
        'Branding',
        'Memperbarui Ikon Simbol SADEWA (Favicon)',
        req.ip || '127.0.0.1'
      );
    }
    if (heroBackgroundUrl !== undefined && (!existing || existing.heroBackgroundUrl !== heroBackgroundUrl)) {
      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Update Banner',
        'Branding',
        'Memperbarui Banner Utama Beranda (Hero Section)',
        req.ip || '127.0.0.1'
      );
    }

    // Default general update log if other fields were modified
    const isBrandingOnly = (sadewaLogoUrl !== undefined || sadewaIconUrl !== undefined || heroBackgroundUrl !== undefined) &&
      (villageName === undefined && kadesName === undefined && kadesNip === undefined && district === undefined && email === undefined && phone === undefined);
    
    if (!isBrandingOnly) {
      await recordAuditLogDb(
        req.user!.userId,
        req.user!.name,
        req.user!.role,
        'Update Profil',
        'Pengaturan Desa',
        'Memperbarui profil desa & identitas kades',
        req.ip || '127.0.0.1'
      );
    }
    
    return res.json({ success: true, data: profile });
  } catch (error: any) {
    console.error('❌ [UPDATE-PROFILE-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Gagal memperbarui profil desa.' });
  }
});

// 9c. Master Wilayah Hirarkis (Dusun -> RW -> RT) Management
router.get('/territories', requireRoles('super_admin', 'admin_desa', 'operator', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.territories || [] });
    }
    const prisma = getPrisma();
    const dusunList = await prisma.dusun.findMany({
      include: {
        rws: {
          include: {
            rts: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data: dusunList });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data wilayah.' });
  }
});

router.put('/territories', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { territories } = req.body;
  if (!Array.isArray(territories)) {
    return res.status(400).json({ success: false, error: 'Format data wilayah harus berupa array susunan Dusun/RW/RT.' });
  }

  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.territories = territories;
      saveDb(db);
      return res.json({
        success: true,
        degraded: true,
        message: 'Master data wilayah (Dusun, RW, RT) berhasil diperbarui.',
        data: db.territories
      });
    }
    const prisma = getPrisma();
    
    // Sync data wilayah secara aman (ID-preserving upsert) agar tidak memicu FK Restrict crash pada tabel Resident
    await prisma.$transaction(async (tx: any) => {
      const existingDusuns = await tx.dusun.findMany({ select: { id: true } });
      const existingRws = await tx.rW.findMany({ select: { id: true } });
      const existingRts = await tx.rT.findMany({ select: { id: true } });

      const existingDusunIds = new Set(existingDusuns.map((x: any) => x.id));
      const existingRwIds = new Set(existingRws.map((x: any) => x.id));
      const existingRtIds = new Set(existingRts.map((x: any) => x.id));

      const seenDusunIds = new Set<string>();
      const seenRwIds = new Set<string>();
      const seenRtIds = new Set<string>();

      for (const d of territories) {
        let savedDusun: any;
        if (d.id && existingDusunIds.has(d.id)) {
          savedDusun = await tx.dusun.update({
            where: { id: d.id },
            data: {
              name: d.name,
              leaderName: d.leaderName,
              isActive: d.isActive !== false
            }
          });
        } else {
          savedDusun = await tx.dusun.create({
            data: {
              name: d.name,
              leaderName: d.leaderName,
              isActive: d.isActive !== false
            }
          });
        }
        seenDusunIds.add(savedDusun.id);

        if (Array.isArray(d.rws)) {
          for (const r of d.rws) {
            let savedRw: any;
            if (r.id && existingRwIds.has(r.id)) {
              savedRw = await tx.rW.update({
                where: { id: r.id },
                data: {
                  name: r.name,
                  leaderName: r.leaderName,
                  isActive: r.isActive !== false,
                  dusunId: savedDusun.id
                }
              });
            } else {
              savedRw = await tx.rW.create({
                data: {
                  name: r.name,
                  leaderName: r.leaderName,
                  isActive: r.isActive !== false,
                  dusunId: savedDusun.id
                }
              });
            }
            seenRwIds.add(savedRw.id);

            if (Array.isArray(r.rts)) {
              for (const rt of r.rts) {
                let savedRt: any;
                if (rt.id && existingRtIds.has(rt.id)) {
                  savedRt = await tx.rT.update({
                    where: { id: rt.id },
                    data: {
                      name: rt.name,
                      leaderName: rt.leaderName,
                      isActive: rt.isActive !== false,
                      rwId: savedRw.id,
                      dusunId: savedDusun.id
                    }
                  });
                } else {
                  savedRt = await tx.rT.create({
                    data: {
                      name: rt.name,
                      leaderName: rt.leaderName,
                      isActive: rt.isActive !== false,
                      rwId: savedRw.id,
                      dusunId: savedDusun.id
                    }
                  });
                }
                seenRtIds.add(savedRt.id);
              }
            }
          }
        }
      }

      // Pembersihan aman bottom-up: hapus jika tidak direferensikan Resident, atau nonaktifkan jika masih dipakai
      for (const oldRt of existingRts) {
        if (seenRtIds.has(oldRt.id)) continue;
        const refResidents = await tx.resident.count({ where: { rtId: oldRt.id } });
        if (refResidents === 0) {
          await tx.rT.delete({ where: { id: oldRt.id } });
        } else {
          await tx.rT.update({ where: { id: oldRt.id }, data: { isActive: false } });
        }
      }

      for (const oldRw of existingRws) {
        if (seenRwIds.has(oldRw.id)) continue;
        const [refResidents, refRts] = await Promise.all([
          tx.resident.count({ where: { rwId: oldRw.id } }),
          tx.rT.count({ where: { rwId: oldRw.id } })
        ]);
        if (refResidents === 0 && refRts === 0) {
          await tx.rW.delete({ where: { id: oldRw.id } });
        } else {
          await tx.rW.update({ where: { id: oldRw.id }, data: { isActive: false } });
        }
      }

      for (const oldDusun of existingDusuns) {
        if (seenDusunIds.has(oldDusun.id)) continue;
        const [refResidents, refRws, refRts] = await Promise.all([
          tx.resident.count({ where: { dusunId: oldDusun.id } }),
          tx.rW.count({ where: { dusunId: oldDusun.id } }),
          tx.rT.count({ where: { dusunId: oldDusun.id } })
        ]);
        if (refResidents === 0 && refRws === 0 && refRts === 0) {
          await tx.dusun.delete({ where: { id: oldDusun.id } });
        } else {
          await tx.dusun.update({ where: { id: oldDusun.id }, data: { isActive: false } });
        }
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Perbarui Master Wilayah',
      'Master Wilayah',
      `Sinkronisasi ulang data Dusun, RW, dan RT berhasil dilakukan.`,
      req.ip || '127.0.0.1'
    );

    const updated = await prisma.dusun.findMany({
      include: { rws: { include: { rts: true } } },
      orderBy: { name: 'asc' }
    });

    return res.json({
      success: true,
      message: 'Master data wilayah (Dusun, RW, RT) berhasil diperbarui.',
      data: updated
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui data wilayah: ' + error.message });
  }
});

// 10. Facilities & Village Places (Fasilitas, Titik Peta, & Lokasi Desa)
router.post('/facilities', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { name, category, address, dusun, coordinatesLabel, description, coordinates, imageUrl, contact } = req.body;
    if (!name || !address) {
      return res.status(400).json({ success: false, error: 'Nama fasilitas dan alamat wajib diisi.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.facilities = db.facilities || [];
      const created = {
        id: generateServerId('fac'),
        name: name.trim(),
        category: category || 'infrastruktur',
        address: address.trim(),
        dusun: dusun || 'Dusun Betung Indah',
        coordinatesLabel: coordinatesLabel || (coordinates ? `${coordinates[0]}, ${coordinates[1]}` : '-1.5280, 103.3140'),
        coordinates: coordinates || [-1.5280, 103.3140],
        description: description || '',
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80',
        contact: contact || ''
      };
      db.facilities.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, message: 'Fasilitas desa berhasil ditambahkan.', data: created });
    }

    const newFacility = await getPrisma().mapFacility.create({
      data: {
        name: name.trim(),
        category: category || 'infrastruktur',
        address: address.trim(),
        dusun: dusun || 'Dusun Betung Indah',
        coordinatesLabel: coordinatesLabel || (coordinates ? `${coordinates[0]}, ${coordinates[1]}` : '-1.5280, 103.3140'),
        coordinates: coordinates || [-1.5280, 103.3140],
        description: description || '',
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80',
        contact: contact || ''
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Fasilitas Desa',
      'Peta & Fasilitas',
      `Menambahkan fasilitas baru: "${newFacility.name}"`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, message: 'Fasilitas desa berhasil ditambahkan.', data: newFacility });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menambahkan fasilitas desa.' });
  }
});

router.put('/facilities/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.facilities || []).findIndex((f: any) => f.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Fasilitas desa tidak ditemukan.' });
      db.facilities[idx] = { ...db.facilities[idx], ...req.body, id };
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Fasilitas desa berhasil diperbarui.', data: db.facilities[idx] });
    }

    const facility = await getPrisma().mapFacility.update({
      where: { id },
      data: req.body
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Perbarui Fasilitas Desa',
      'Peta & Fasilitas',
      `Memperbarui fasilitas: "${facility.name}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Fasilitas desa berhasil diperbarui.', data: facility });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui fasilitas desa.' });
  }
});

router.delete('/facilities/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.facilities = (db.facilities || []).filter((f: any) => f.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Fasilitas desa berhasil dihapus.' });
    }

    const removed = await getPrisma().mapFacility.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Fasilitas Desa',
      'Peta & Fasilitas',
      `Menghapus fasilitas: "${removed.name}"`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Fasilitas desa berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus fasilitas desa.' });
  }
});

// 9. Audit Logs Management (Super Admin, Admin Desa)
// 9a. GET ALL AUDIT LOGS WITH PAGINATION
router.get('/audit-logs', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const allLogs = db.auditLogs || [];
      const total = allLogs.length;
      const logs = allLogs.slice(skip, skip + limit);
      return res.json({
        success: true,
        degraded: true,
        data: logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
      });
    }

    const prisma = getPrisma();
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count()
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: `Gagal memuat log audit: ${err.message}` });
  }
});

// 9b. DELETE SINGLE AUDIT LOG - REMOVED FOR SECURITY (FIX 11)
// 9c. PURGE AUDIT LOGS MASSAL - REMOVED FOR SECURITY (FIX 11)

// 12. Attendance Logs Management (Super Admin, Admin Desa, Operator)
router.get('/attendance/all', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.attendance || [] });
    }
    const logs = await getPrisma().attendanceLog.findMany({
      orderBy: { timestamp: 'desc' }
    });
    return res.json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat log presensi.' });
  }
});

// 10. Reset Data to Default (FIX 12: Super Admin password required, clean error)
router.post('/reset-data', requireRoles('super_admin'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { confirmationText, adminPassword } = req.body || {};

  if (confirmationText !== 'RESET_DATABASE_DESA_SADEWA_PERMANEN') {
    return res.status(400).json({
      success: false,
      error: 'Gagal melakukan reset. Konfirmasi teks tidak sesuai.'
    });
  }

  // FIX 12: Wajibkan input ulang password super_admin
  if (!adminPassword) {
    return res.status(400).json({ success: false, error: 'Gagal melakukan reset. Password admin diperlukan.' });
  }

  try {
    const user = await getUserById(req.user!.userId);
    if (!user || !verifyPassword(adminPassword, user.passwordHash, user.salt)) {
      return res.status(401).json({ success: false, error: 'Gagal melakukan reset. Password admin salah.' });
    }

    const currentUserId = req.user!.userId;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const fresh = seedInitialData();
      db.serviceRequests = [];
      db.deletedServiceRequests = [];
      db.complaints = [];
      db.news = [];
      db.announcements = [];
      db.agendas = [];
      db.gallery = [];
      db.developmentProjects = [];
      db.potentials = [];
      db.umkm = [];
      db.facilities = [];
      db.landParcels = [];
      db.toddlers = [];
      db.kpm = [];
      db.attendance = [];
      db.residents = [];
      db.officials = [];
      db.services = fresh.services;
      db.territories = fresh.territories;
      db.villageProfile = fresh.villageProfile;
      db.users = (db.users || []).filter((u: any) => u.id === currentUserId);
      db.auditLogs = [
        {
          id: generateServerId('log'),
          userId: currentUserId,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'SAAS FACTORY RESET',
          module: 'Keamanan Sistem',
          details: `Super Admin (${req.user!.name}) mengeksekusi SaaS Factory Reset (Mode Offline JSON). Log audit dipertahankan.`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          level: 'critical'
        },
        ...(db.auditLogs || [])
      ];
      saveDb(db);
      return res.json({
        success: true,
        degraded: true,
        message: 'SaaS Factory Reset BERHASIL pada penyimpanan lokal. Akun Super Admin Anda tetap aktif.'
      });
    }

    const mutationScope = assertSafeUnscopedMutation('POST /api/admin/reset-data');
    const scopedDeleteWhere = mutationScope.tenantId ? { villageId: mutationScope.tenantId } : {};
    const prisma = await getPrismaForActiveContext();

    // 1. FACTORY RESET: Hapus data transaksi, master, wilayah, kependudukan (AUDIT LOG DILEPAS & TIDAK DIHAPUS!)
    await prisma.serviceRequest.deleteMany({ where: scopedDeleteWhere });
    await prisma.deletedServiceRequest.deleteMany({ where: scopedDeleteWhere });
    await prisma.complaint.deleteMany({ where: scopedDeleteWhere });
    await prisma.newsItem.deleteMany({ where: scopedDeleteWhere });
    await prisma.announcement.deleteMany({ where: scopedDeleteWhere });
    await prisma.agendaItem.deleteMany({ where: scopedDeleteWhere });
    await prisma.galleryItem.deleteMany({ where: scopedDeleteWhere });
    await prisma.developmentProject.deleteMany({ where: scopedDeleteWhere });
    await prisma.villagePotential.deleteMany({ where: scopedDeleteWhere });
    await prisma.umkmItem.deleteMany({ where: scopedDeleteWhere });
    await prisma.mapFacility.deleteMany({ where: scopedDeleteWhere });
    await prisma.landParcel.deleteMany({ where: scopedDeleteWhere });
    await prisma.toddlerMeasurement.deleteMany({ where: scopedDeleteWhere });
    await prisma.toddlerRecord.deleteMany({ where: scopedDeleteWhere });
    await prisma.posyanduSchedule.deleteMany({ where: scopedDeleteWhere });
    await prisma.bansosRecipient.deleteMany({ where: scopedDeleteWhere });
    await prisma.attendanceLog.deleteMany({ where: scopedDeleteWhere });
    await prisma.resident.deleteMany({ where: scopedDeleteWhere });
    await prisma.rT.deleteMany({ where: scopedDeleteWhere });
    await prisma.rW.deleteMany({ where: scopedDeleteWhere });
    await prisma.dusun.deleteMany({ where: scopedDeleteWhere });
    await prisma.villageService.deleteMany({ where: scopedDeleteWhere });
    await prisma.villageOfficial.deleteMany({ where: scopedDeleteWhere });
    await prisma.budgetYearData.deleteMany({ where: scopedDeleteWhere });
    // ⚠️ BARIS await prisma.auditLog.deleteMany({}); TELAH DIHAPUS - AUDIT LOG SURVIVES RESET

    // 2. Hapus seluruh berkas media/gambar di bucket Supabase Storage saat Factory Reset (terbatas prefix tenant jika multi-tenant)
    await clearSupabaseStorageBucket(
      mutationScope.tenantId ? `tenants/${mutationScope.tenantId}` : undefined
    );

    // 2. Pertahankan HANYA 1 Super Admin yang sedang melakukan reset (mencegah lockout)
    await prisma.user.deleteMany({
      where: {
        id: { not: currentUserId },
        ...scopedDeleteWhere
      }
    });

    // 3. Reset Profil Desa kembali ke kondisi awal "Baru Install" (FIX 4: Clear Logo & Foto)
    const profileRecordId = mutationScope.tenantId ? `profile-${mutationScope.tenantId}` : 'default';
    await prisma.villageProfile.upsert({
      where: { id: profileRecordId },
      update: {
        villageName: 'Desa Pulau Betung',
        district: 'Pemayung',
        regency: 'Kabupaten Batang Hari',
        province: 'Provinsi Jambi',
        postalCode: '36657',
        addressStreet: 'Jl. Kantor Desa No. 1, Desa Pulau Betung',
        email: 'pemdes@pulaubetung.sadewa.id',
        phone: '0821-7654-3210',
        kadesName: 'H. Sudirman',
        kadesNip: '-',
        vision: 'Terwujudnya Desa yang Mandiri, Sejahtera, dan Berbudaya.',
        mission: ['Meningkatkan kualitas pelayanan publik', 'Membangun infrastruktur desa yang memadai'],
        history: 'Sejarah Desa Pulau Betung belum diisi.',
        totalPopulation: 0,
        totalFamilies: 0,
        areaSqKm: 0,
        borders: {},
        villageLogoUrl: null,
        villageLogoSecondaryUrl: null,
        regencyLogoUrl: null,
        sadewaLogoUrl: null,
        sadewaIconUrl: null,
        kadesPhotoUrl: null,
        officialSignatureUrl: null,
        heroBackgroundUrl: null,
        lastUpdated: new Date()
      },
      create: {
        id: profileRecordId,
        villageName: 'Desa Pulau Betung',
        kadesName: 'H. Sudirman',
        kadesNip: '-',
        district: 'Pemayung',
        regency: 'Kabupaten Batang Hari',
        province: 'Provinsi Jambi',
        postalCode: '36657',
        addressStreet: 'Jl. Kantor Desa No. 1, Desa Pulau Betung',
        email: 'pemdes@pulaubetung.sadewa.id',
        phone: '0821-7654-3210',
        vision: 'Terwujudnya Desa yang Mandiri, Sejahtera, dan Berbudaya.',
        mission: ['Meningkatkan kualitas pelayanan publik', 'Membangun infrastruktur desa yang memadai'],
        history: 'Sejarah Desa Pulau Betung belum diisi.',
        totalPopulation: 0,
        totalFamilies: 0,
        areaSqKm: 0,
        borders: {},
        villageLogoUrl: null,
        villageLogoSecondaryUrl: null,
        regencyLogoUrl: null,
        sadewaLogoUrl: null,
        sadewaIconUrl: null,
        kadesPhotoUrl: null,
        officialSignatureUrl: null,
        heroBackgroundUrl: null
      }
    });

    // 4. OPTION A: Auto-Seed 15 Master Layanan Surat Standar & Struktur Wilayah Awal
    const defaultServices = [
      { code: 'SKU', name: 'Surat Keterangan Usaha', description: 'Surat keterangan untuk keperluan legalitas usaha warga', processDays: 1, requirements: ['KTP', 'KK', 'Foto Tempat Usaha'] },
      { code: 'SKTM', name: 'Surat Keterangan Tidak Mampu', description: 'Surat keterangan tidak mampu untuk bantuan/pendidikan', processDays: 1, requirements: ['KTP', 'KK'] },
      { code: 'SKD', name: 'Surat Keterangan Domisili', description: 'Surat keterangan domisili tempat tinggal', processDays: 1, requirements: ['KTP', 'KK'] },
      { code: 'SKCK', name: 'Surat Pengantar SKCK', description: 'Surat pengantar permohonan SKCK ke Kepolisian', processDays: 1, requirements: ['KTP', 'KK', 'Pas Foto'] },
      { code: 'SKBM', name: 'Surat Keterangan Belum Menikah', description: 'Surat keterangan status belum pernah menikah', processDays: 1, requirements: ['KTP', 'KK', 'Pernyataan'] },
      { code: 'SKL', name: 'Surat Keterangan Kelahiran', description: 'Surat keterangan kelahiran bayi dari desa', processDays: 1, requirements: ['KK', 'KTP Orang Tua', 'Surat Bidan/RS'] },
      { code: 'SKK', name: 'Surat Keterangan Kematian', description: 'Surat keterangan kematian warga', processDays: 1, requirements: ['KK', 'KTP Almarhum', 'KTP Pelapor'] },
      { code: 'SKP', name: 'Surat Keterangan Pindah', description: 'Surat pengantar pindah domisili', processDays: 2, requirements: ['KTP', 'KK Asli'] },
      { code: 'SP-KTP', name: 'Surat Pengantar KTP-el', description: 'Surat pengantar perekaman/pencetakan KTP-el', processDays: 1, requirements: ['KK'] },
      { code: 'SP-KK', name: 'Surat Pengantar Kartu Keluarga', description: 'Surat pengantar penerbitan/perubahan KK', processDays: 1, requirements: ['KTP', 'KK Lama/Dokumen Pendukung'] },
      { code: 'SKBN', name: 'Surat Keterangan Beda Nama', description: 'Surat keterangan klarifikasi beda nama pada dokumen', processDays: 1, requirements: ['KTP', 'KK', 'Dokumen Terkait'] },
      { code: 'SKAW', name: 'Surat Keterangan Ahli Waris', description: 'Surat keterangan silsilah/ahli waris', processDays: 2, requirements: ['KTP Para Ahli Waris', 'KK', 'Surat Kematian'] },
      { code: 'SKP-INCOME', name: 'Surat Keterangan Penghasilan', description: 'Surat keterangan rincian penghasilan orang tua/warga', processDays: 1, requirements: ['KTP', 'KK'] },
      { code: 'SKIK', name: 'Surat Keterangan Izin Keramaian', description: 'Surat pengantar izin mengadakan acara/keramaian', processDays: 1, requirements: ['KTP', 'Surat Permohonan Acara'] },
      { code: 'SKT', name: 'Surat Keterangan Tanah', description: 'Surat keterangan riwayat/kepemilikan tanah', processDays: 3, requirements: ['KTP', 'Sertifikat/Bukti Fisik', 'Pernyataan Sempadan'] }
    ];

    for (const srv of defaultServices) {
      await prisma.villageService.create({ data: srv });
    }

    // Auto-seed Wilayah Dasar (Dusun I -> RW 001 -> RT 001)
    const dusun1 = await prisma.dusun.create({ data: { name: 'Dusun I', leaderName: 'Kepala Dusun I' } });
    const rw1 = await prisma.rW.create({ data: { number: '001', dusunId: dusun1.id, leaderName: 'Ketua RW 001' } });
    await prisma.rT.create({ data: { number: '001', rwId: rw1.id, leaderName: 'Ketua RT 001' } });

    // 4. Buat entri Audit Log tunggal pasca reset
    await prisma.auditLog.create({
      data: {
        userId: currentUserId,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: 'SAAS FACTORY RESET',
        module: 'Keamanan Sistem',
        details: `Super Admin (${req.user!.name}) mengeksekusi SaaS Factory Reset. Pangkalan data Supabase bersih kembali ke kondisi baru install. Akun admin dipertahankan.`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    // Sinkronkan cache lokal jika ada (Legacy support)
    try {
      const freshDb = seedInitialData();
      freshDb.users = freshDb.users.filter((u: any) => u.id === currentUserId || u.username === req.user!.username);
      // Data operasional di-reset total di file juga jika masih ada
      // saveDb(freshDb); // Commented out to prevent accidental file overwrite if not needed
    } catch {}

    return res.json({
      success: true,
      message: 'SaaS Factory Reset BERHASIL. Pangkalan data Supabase PostgreSQL telah dibersihkan kembali ke kondisi baru install. Akun Super Admin Anda tetap aktif.'
    });
  } catch (err: any) {
    if (err instanceof TenantScopeViolationError) {
      return res.status(403).json({
        success: false,
        error: err.message
      });
    }
    return res.status(500).json({
      success: false,
      error: `Gagal memproses SaaS Factory Reset: ${err.message}`
    });
  }
});

// 11. Automated & Manual Backup Management (Super Admin & Admin Desa — Tenant-Isolated)
// Keyword: BACKUP
function getActiveBackupDir(): string {
  const ctx = getCurrentTenantContext();
  if (ctx?.tenantId) {
    return path.join(SERVER_CONFIG.BACKUP_DIR, 'tenants', ctx.tenantId);
  }
  return SERVER_CONFIG.BACKUP_DIR;
}

function ensureBackupDir(): string {
  const dir = getActiveBackupDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn('⚠️ [Backup] Direktori backup lokal tidak dapat ditulis:', err);
  }
  return dir;
}

// List all database backups with metadata (scoped per tenant)
router.get('/backups', requireRoles('super_admin', 'admin_desa'), (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const dir = ensureBackupDir();
    if (!fs.existsSync(dir)) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const files = fs.readdirSync(dir).filter((f: any) => f.endsWith('.json'));
    const backups = files.map((fileName) => {
      const filePath = path.join(dir, fileName);
      const stats = fs.statSync(filePath);
      return {
        fileName,
        sizeBytes: stats.size,
        sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
        createdAt: stats.birthtime || stats.mtime,
        downloadUrl: `/api/admin/backups/download/${fileName}`
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ success: true, count: backups.length, data: backups });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Gagal membaca daftar cadangan.' });
  }
});

// Create manual instant backup snapshot (Export Prisma or JSON fallback to JSON)
router.post('/backups/create', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const result = await runDatabaseBackup();

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Pencadangan Database Manual',
      'Backup & Recovery',
      `Membuat ekspor cadangan JSON (${result.mode}): ${result.fileName} (${(result.sizeBytes / 1024).toFixed(1)} KB)`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({
      success: true,
      message: 'Salinan cadangan basis data berhasil dibuat.',
      data: {
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
        createdAt: result.createdAt,
        mode: result.mode
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Gagal membuat cadangan basis data.' });
  }
});

// FIX 2: Helper untuk validasi path backup (Anti-Traversal + Strict Tenant Boundary)
const getSafeBackupPath = (filename: string) => {
  const sanitized = path.basename(filename);
  if (!/^[\w.-]+\.json$/.test(sanitized)) return null;
  const resolvedDir = path.resolve(getActiveBackupDir());
  const fullPath = path.resolve(resolvedDir, sanitized);
  if (!fullPath.startsWith(resolvedDir + path.sep)) return null;
  return { fullPath, sanitized };
};

// Download backup file (FIX 2: Path Traversal Fix)
router.get('/backups/download/:filename', requireRoles('super_admin'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { filename } = req.params;
  const safe = getSafeBackupPath(filename);

  if (!safe || !fs.existsSync(safe.fullPath)) {
    return res.status(404).json({ success: false, error: 'Berkas cadangan tidak ditemukan atau akses ditolak.' });
  }

  await recordAuditLogDb(
    req.user!.userId,
    req.user!.name,
    req.user!.role,
    'Unduh Berkas Cadangan',
    'Backup & Recovery',
    `Mengunduh berkas cadangan offline: ${safe.sanitized}`,
    req.ip || '127.0.0.1'
  );

  return res.download(safe.fullPath, safe.sanitized);
});

// Restore database - REMOVED AS PER POINT 13
// router.post('/backups/restore', ...)

// 13. KPM (Keluarga Penerima Manfaat) / Bansos Management
router.get('/kpm', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.kpm || [] });
    }
    const kpm = await getPrisma().bansosRecipient.findMany({
      include: { 
        resident: {
          include: { dusun: true, rt: true, rw: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = kpm.map((b: any) => {
      const r = b.resident || {};
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
        name: r.fullName || 'Warga Desa',
        nameMasked: (r.fullName || 'Warga').split(' ').map((w: string, i: number) => i === 0 ? w : w[0] + '***').join(' '),
        nik: r.nik || '',
        nikMasked: r.nik ? r.nik.slice(0, 6) + '******' + r.nik.slice(-4) : '',
        noKk: kk,
        noKkMasked: kk.length >= 10 ? kk.slice(0, 6) + '******' + kk.slice(-4) : '******',
        gender: r.gender || 'Laki-laki',
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
    });

    return res.json({ success: true, data: mapped });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Gagal memuat data KPM.' });
  }
});

router.post('/kpm', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    let { residentId, nik, programName, fiscalYear, stageOrMonth, period, nominalAmount, nominalOrItem, status, notes, keterangan } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.kpm = db.kpm || [];
      const created = {
        ...req.body,
        id: req.body.id || generateServerId('kpm'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.kpm.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, data: created });
    }

    const prisma = getPrisma();

    if (!residentId && nik) {
      const cleanNik = String(nik).trim();
      const resident = await prisma.resident.findFirst({ where: { nik: cleanNik } });
      if (resident) {
        residentId = resident.id;
      } else {
        return res.status(400).json({ success: false, error: `NIK ${cleanNik} tidak terdaftar di Buku Induk Penduduk!` });
      }
    }

    if (!residentId) {
      return res.status(400).json({ success: false, error: 'ID Warga atau NIK Warga wajib diisi.' });
    }

    // Check duplicate in same program & year to prevent double entry
    const existingKpm = await prisma.bansosRecipient.findFirst({
      where: {
        residentId,
        programName: programName || 'BLT Dana Desa (BLT-DD) TA 2026',
        fiscalYear: Number(fiscalYear) || 2026
      }
    });

    if (existingKpm) {
      return res.status(400).json({
        success: false,
        error: `Warga ini sudah terdaftar sebagai penerima program ${programName || 'bansos'} pada Tahun Anggaran ${fiscalYear || 2026}.`
      });
    }

    const parsedNominal = nominalAmount !== undefined
      ? Number(nominalAmount)
      : Number(String(nominalOrItem || '0').replace(/[^\d]/g, '')) || 0;
    const mappedStatus =
      status === 'tersalurkan' || status === 'SALUR_SELESAI'
        ? 'SALUR_SELESAI'
        : status === 'proses_verifikasi' || status === 'TERTUNDA'
        ? 'TERTUNDA'
        : status === 'GAGAL_SALUR'
        ? 'GAGAL_SALUR'
        : 'TERDAFTAR';

    const bansos = await prisma.bansosRecipient.create({
      data: {
        residentId,
        programName: programName || 'BLT Dana Desa (BLT-DD) TA 2026',
        fiscalYear: Number(fiscalYear) || 2026,
        stageOrMonth: stageOrMonth || period || 'Tahap 1',
        nominalAmount: parsedNominal,
        status: mappedStatus,
        notes: notes || keterangan || null
      },
      include: { resident: true }
    });
    return res.status(201).json({ success: true, data: bansos });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menambah data KPM: ' + (error?.message || '') });
  }
});

router.put('/kpm/:id', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.kpm = db.kpm || [];
      const idx = db.kpm.findIndex((k: any) => k.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Data KPM tidak ditemukan.' });
      db.kpm[idx] = { ...db.kpm[idx], ...req.body, id, updatedAt: new Date().toISOString() };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.kpm[idx] });
    }

    const { programName, fiscalYear, stageOrMonth, period, nominalAmount, nominalOrItem, status, notes, keterangan } = req.body;
    const mappedStatus =
      status === 'tersalurkan' || status === 'SALUR_SELESAI'
        ? 'SALUR_SELESAI'
        : status === 'proses_verifikasi' || status === 'TERTUNDA'
        ? 'TERTUNDA'
        : status === 'GAGAL_SALUR'
        ? 'GAGAL_SALUR'
        : status === 'siap_diambil' || status === 'TERDAFTAR'
        ? 'TERDAFTAR'
        : undefined;

    const updated = await getPrisma().bansosRecipient.update({
      where: { id },
      data: {
        programName: programName || undefined,
        fiscalYear: fiscalYear !== undefined ? Number(fiscalYear) : undefined,
        stageOrMonth: stageOrMonth || period || undefined,
        nominalAmount: nominalAmount !== undefined
          ? Number(nominalAmount)
          : nominalOrItem !== undefined
          ? Number(String(nominalOrItem).replace(/[^\d]/g, '')) || 0
          : undefined,
        status: mappedStatus,
        notes: notes !== undefined ? notes : keterangan
      },
      include: { resident: true }
    });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui data KPM.' });
  }
});

router.delete('/kpm/:id', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.kpm = (db.kpm || []).filter((k: any) => k.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Data KPM berhasil dihapus.' });
    }
    await getPrisma().bansosRecipient.delete({ where: { id } });
    return res.json({ success: true, message: 'Data KPM berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus data KPM.' });
  }
});

// 14. WebGIS & Spasial Land Parcels CRUD
router.get('/land-parcels', requireRoles('super_admin', 'admin_desa', 'operator', 'editor'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      return res.json({ success: true, degraded: true, data: db.landParcels || [] });
    }
    const parcels = await getPrisma().landParcel.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    return res.json({ success: true, data: parcels });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data persil tanah.' });
  }
});

router.post('/land-parcels', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const data = req.body;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.landParcels = db.landParcels || [];
      const created = {
        ...data,
        id: data.id || generateServerId('parcel'),
        landAreaSqM: Number(data.landAreaSqM) || 0,
        landAreaHectares: Number(data.landAreaHectares) || 0,
        buildingAreaSqM: Number(data.buildingAreaSqM) || 0,
        njopLandPerSqM: Number(data.njopLandPerSqM) || 0,
        njopBuildingPerSqM: Number(data.njopBuildingPerSqM) || 0,
        pbbTaxAmount: Number(data.pbbTaxAmount) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.landParcels.unshift(created);
      saveDb(db);
      return res.status(201).json({ success: true, degraded: true, data: created });
    }

    const parcel = await getPrisma().landParcel.create({
      data: {
        ...data,
        landAreaSqM: Number(data.landAreaSqM) || 0,
        landAreaHectares: Number(data.landAreaHectares) || 0,
        buildingAreaSqM: Number(data.buildingAreaSqM) || 0,
        njopLandPerSqM: Number(data.njopLandPerSqM) || 0,
        njopBuildingPerSqM: Number(data.njopBuildingPerSqM) || 0,
        pbbTaxAmount: Number(data.pbbTaxAmount) || 0,
        pbbPaymentDate: data.pbbPaymentDate ? new Date(data.pbbPaymentDate) : null,
        sporadikIssuedDate: data.sporadikIssuedDate ? new Date(data.sporadikIssuedDate) : null
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Tambah Persil Tanah',
      'WebGIS Spasial',
      `Menambahkan persil tanah baru: NOP ${parcel.nop} atas nama ${parcel.ownerName}`,
      req.ip || '127.0.0.1'
    );

    return res.status(201).json({ success: true, data: parcel });
  } catch (error: any) {
    console.error('❌ [LAND-PARCEL-CREATE-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal menambahkan data persil tanah. Pastikan NOP unik.' });
  }
});

router.put('/land-parcels/:id', requireRoles('super_admin', 'admin_desa', 'operator'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.landParcels = db.landParcels || [];
      const idx = db.landParcels.findIndex((p: any) => p.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Data persil tanah tidak ditemukan.' });
      db.landParcels[idx] = { ...db.landParcels[idx], ...data, id, updatedAt: new Date().toISOString() };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.landParcels[idx] });
    }

    const updated = await getPrisma().landParcel.update({
      where: { id },
      data: {
        ...data,
        landAreaSqM: data.landAreaSqM !== undefined ? Number(data.landAreaSqM) : undefined,
        landAreaHectares: data.landAreaHectares !== undefined ? Number(data.landAreaHectares) : undefined,
        buildingAreaSqM: data.buildingAreaSqM !== undefined ? Number(data.buildingAreaSqM) : undefined,
        njopLandPerSqM: data.njopLandPerSqM !== undefined ? Number(data.njopLandPerSqM) : undefined,
        njopBuildingPerSqM: data.njopBuildingPerSqM !== undefined ? Number(data.njopBuildingPerSqM) : undefined,
        pbbTaxAmount: data.pbbTaxAmount !== undefined ? Number(data.pbbTaxAmount) : undefined,
        pbbPaymentDate: data.pbbPaymentDate ? new Date(data.pbbPaymentDate) : (data.pbbPaymentDate === null ? null : undefined),
        sporadikIssuedDate: data.sporadikIssuedDate ? new Date(data.sporadikIssuedDate) : (data.sporadikIssuedDate === null ? null : undefined)
      }
    });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Update Persil Tanah',
      'WebGIS Spasial',
      `Memperbarui data persil tanah: NOP ${updated.nop} (${updated.ownerName})`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui data persil tanah.' });
  }
});

router.delete('/land-parcels/:id', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.landParcels = (db.landParcels || []).filter((p: any) => p.id !== id);
      saveDb(db);
      return res.json({ success: true, degraded: true, message: 'Data persil tanah berhasil dihapus.' });
    }

    const deleted = await getPrisma().landParcel.delete({ where: { id } });

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Hapus Persil Tanah',
      'WebGIS Spasial',
      `Menghapus data persil tanah: NOP ${deleted.nop} atas nama ${deleted.ownerName}`,
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Data persil tanah berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal menghapus data persil tanah.' });
  }
});

// --- DATABASE BACKUP & MAINTENANCE (SUPER ADMIN ONLY) ---
router.get('/maintenance/backups', requireRoles('super_admin'), (req: AuthenticatedRequest, res: ExpressResponse) => {
  const dir = ensureBackupDir();
  if (!fs.existsSync(dir)) {
    return res.json({ success: true, data: [] });
  }

  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(dir, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return res.json({ success: true, data: files });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal membaca direktori backup.' });
  }
});

router.get('/maintenance/backups/download/:filename', requireRoles('super_admin'), (req: AuthenticatedRequest, res: ExpressResponse) => {
  const filename = req.params.filename;
  const safe = getSafeBackupPath(filename);

  if (!safe || !fs.existsSync(safe.fullPath)) {
    return res.status(404).json({ success: false, error: 'File backup tidak ditemukan atau akses ditolak.' });
  }

  return res.download(safe.fullPath);
});

router.post('/maintenance/backups/run', requireRoles('super_admin'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const result = await runDatabaseBackup();

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Jalankan Backup Manual',
      'Pemeliharaan',
      `Admin menjalankan backup database manual (${result.mode}) ke file ${result.fileName}.`,
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: 'Backup berhasil dibuat secara instan.',
      data: {
        filename: result.fileName,
        size: result.sizeBytes,
        createdAt: result.createdAt,
        mode: result.mode
      }
    });
  } catch (error: any) {
    console.error('❌ [BACKUP-RUN-ERROR]:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Gagal menjalankan proses backup.' });
  }
});

router.delete('/maintenance/backups/:filename', requireRoles('super_admin'), (req: AuthenticatedRequest, res: ExpressResponse) => {
  const filename = req.params.filename;
  const safe = getSafeBackupPath(filename);

  if (safe && fs.existsSync(safe.fullPath)) {
    fs.unlinkSync(safe.fullPath);
    return res.json({ success: true, message: 'File backup berhasil dihapus.' });
  }
  return res.status(404).json({ success: false, error: 'File tidak ditemukan atau akses ditolak.' });
});

// FIX 7: Complaint Moderation Endpoint
router.put('/complaints/:id/visibility', requireRoles('super_admin', 'admin_desa'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      const idx = (db.complaints || []).findIndex((c: any) => c.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Aduan tidak ditemukan.' });
      db.complaints[idx] = { ...db.complaints[idx], isPublic: !!isPublic, updatedAt: new Date().toISOString() };
      saveDb(db);
      return res.json({ success: true, degraded: true, data: db.complaints[idx] });
    }
    
    const updated = await getPrisma().complaint.update({
      where: { id },
      data: { isPublic: !!isPublic }
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memperbarui visibilitas aduan.' });
  }
});

// --- MASTER RESET DATABASE ENDPOINT (SUPER ADMIN ONLY, HARDENED) ---
router.post('/reset-database', requireRoles('super_admin'), async (req: AuthenticatedRequest, res: ExpressResponse) => {
  try {
    const { adminPassword, confirmationText } = req.body || {};

    if (!adminPassword || typeof adminPassword !== 'string') {
      return res.status(400).json({ success: false, error: 'Password Super Admin wajib diisi untuk otorisasi reset database.' });
    }

    const allowedConfirmTexts = ['HAPUS SEMUA DATA', 'RESET_DATABASE_DESA_SADEWA_PERMANEN', 'RESET'];
    if (!confirmationText || !allowedConfirmTexts.includes(confirmationText)) {
      return res.status(400).json({ success: false, error: 'Teks konfirmasi reset tidak sesuai.' });
    }

    const adminUser = await getUserById(req.user!.userId);
    if (!adminUser || !verifyPassword(adminPassword, adminUser.passwordHash, adminUser.salt)) {
      return res.status(401).json({ success: false, error: 'Password Super Admin salah. Reset dibatalkan.' });
    }

    if (!(await isDatabaseAvailableCached())) {
      const db = getDb();
      db.residents = [];
      db.kpm = [];
      db.toddlers = [];
      db.deletedServiceRequests = [];
      db.serviceRequests = [];
      db.complaints = [];
      db.developmentProjects = [];
      db.landParcels = [];
      db.news = [];
      db.announcements = [];
      db.agendas = [];
      db.gallery = [];
      db.umkm = [];
      db.facilities = [];
      db.attendance = [];
      // Audit logs tetap dipertahankan untuk jejak forensik keamanan
      db.auditLogs = [
        {
          id: generateServerId('log'),
          userId: req.user!.userId,
          userName: req.user!.name,
          userRole: req.user!.role,
          action: 'Reset Master Database',
          module: 'Pemeliharaan',
          details: 'Pembersihan seluruh data operasional desa (Mode JSON Fallback). Log audit dipertahankan.',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          level: 'critical'
        },
        ...(db.auditLogs || [])
      ];
      saveDb(db);
      return res.json({
        success: true,
        degraded: true,
        message: 'Seluruh data operasional berhasil dibersihkan pada penyimpanan lokal (Log audit tetap dipertahankan).'
      });
    }

    const scopedDeleteWhere = getScopedDeleteWhere({}, 'POST /api/admin/reset-database');
    const prisma = await getPrismaForActiveContext();

    // Clear all operational tables in Prisma / Supabase (AuditLog TIDAK dihapus agar jejak forensik tetap utuh)
    await prisma.$transaction([
      prisma.toddlerMeasurement.deleteMany({ where: scopedDeleteWhere }),
      prisma.toddlerRecord.deleteMany({ where: scopedDeleteWhere }),
      prisma.bansosRecipient.deleteMany({ where: scopedDeleteWhere }),
      prisma.deletedServiceRequest.deleteMany({ where: scopedDeleteWhere }),
      prisma.serviceRequest.deleteMany({ where: scopedDeleteWhere }),
      prisma.complaint.deleteMany({ where: scopedDeleteWhere }),
      prisma.resident.deleteMany({ where: scopedDeleteWhere }),
      prisma.developmentProject.deleteMany({ where: scopedDeleteWhere }),
      prisma.landParcel.deleteMany({ where: scopedDeleteWhere }),
      prisma.newsItem.deleteMany({ where: scopedDeleteWhere }),
      prisma.announcement.deleteMany({ where: scopedDeleteWhere }),
      prisma.agendaItem.deleteMany({ where: scopedDeleteWhere }),
      prisma.galleryItem.deleteMany({ where: scopedDeleteWhere }),
      prisma.umkmItem.deleteMany({ where: scopedDeleteWhere }),
      prisma.mapFacility.deleteMany({ where: scopedDeleteWhere }),
      prisma.attendanceLog.deleteMany({ where: scopedDeleteWhere })
    ]);

    await recordAuditLogDb(
      req.user!.userId,
      req.user!.name,
      req.user!.role,
      'Reset Master Database',
      'Pemeliharaan',
      'Pembersihan total seluruh data dummy operasional desa (Log audit tetap dipertahankan).',
      req.ip || '127.0.0.1'
    );

    return res.json({ success: true, message: 'Seluruh data dummy berhasil dibersihkan dari database Supabase (Log audit tetap dipertahankan).' });
  } catch (error: any) {
    if (error instanceof TenantScopeViolationError) {
      return res.status(403).json({ success: false, error: error.message });
    }
    console.error('❌ [RESET-DB-ERROR]:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Gagal mereset database: ' + (error?.message || '') });
  }
});

// --- STORAGE & ADMIN ARCHITECTURE REGISTRY MAP (ADMIN READ-ONLY) ---
router.get('/storage-map', requireRoles('super_admin', 'admin_desa'), (_req: AuthenticatedRequest, res: ExpressResponse) => {
  return res.json({
    success: true,
    data: getStorageArchitectureSummary()
  });
});

router.get('/panel-map', requireRoles('super_admin', 'admin_desa'), (_req: AuthenticatedRequest, res: ExpressResponse) => {
  return res.json({
    success: true,
    data: getAdminArchitectureMap()
  });
});

export default router;

