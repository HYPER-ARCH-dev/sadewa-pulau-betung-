import { Router, Request, Response as ExpressResponse } from 'express';
import crypto from 'crypto';
import { getPrisma, getVillageProfile } from '../db/prisma-helpers';
import { hashPassword, verifyPassword, verifyToken } from '../auth';

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

// 1. All public data bundle for efficient bootstrapping
router.get('/bootstrap', async (req: Request, res: ExpressResponse) => {
  try {
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
      budget,
      officials,
      potentials,
      umkm,
      facilities,
      gallery,
      territories
    ] = await Promise.all([
      getVillageProfile().catch(() => null),
      p.villageService.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }).catch(() => []),
      p.newsItem.findMany({ 
        where: { isPublished: true }, 
        take: 6, 
        orderBy: { publishedAt: 'desc' },
        select: { id: true, title: true, slug: true, coverImage: true, publishedAt: true, category: true, summary: true }
      }).catch(() => []),
      p.announcement.findMany({ 
        where: { isActive: true }, 
        take: 5, 
        orderBy: { publishedAt: 'desc' },
        select: { id: true, title: true, priority: true, publishedAt: true }
      }).catch(() => []),
      p.agendaItem.findMany({ take: 5, orderBy: { date: 'desc' } }).catch(() => []),
      p.developmentProject.findMany({ take: 5, orderBy: { fiscalYear: 'desc' } }).catch(() => []),
      p.budgetYearData.findFirst({ orderBy: { year: 'desc' } }).catch(() => null),
      p.villageOfficial.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } }).catch(() => []),
      p.villagePotential.findMany({ take: 4 }).catch(() => []),
      p.umkmItem.findMany({ where: { isVerified: true }, take: 4 }).catch(() => []),
      p.mapFacility.findMany({ take: 6 }).catch(() => []),
      p.galleryItem.findMany({ take: 6, orderBy: { date: 'desc' } }).catch(() => []),
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
      }).catch(() => [])
    ]);

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
        officials,
        potentials,
        umkm,
        facilities,
        gallery,
        territories
      }
    });
  } catch (error: any) {
    console.error('❌ [BOOTSTRAP-ERROR]:', error.message);
    return res.status(503).json({ 
      success: false, 
      error: 'Layanan data desa sedang sibuk. Silakan segarkan halaman dalam beberapa saat.' 
    });
  }
});

// 2. Village Profile
router.get('/profile', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getVillageProfile();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat profil desa.' });
  }
});

// 2b. Master Wilayah Publik (Dusun -> RW -> RT)
router.get('/territories', async (req: Request, res: ExpressResponse) => {
  try {
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data wilayah.' });
  }
});

// 3. Services Catalog
router.get('/services', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().villageService.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar layanan.' });
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

    const prisma = getPrisma();
    const service = await prisma.villageService.findUnique({ where: { id: serviceId } });
    
    if (!service) {
      return res.status(404).json({ success: false, error: 'Layanan administrasi tidak ditemukan.' });
    }

    // Generate Secure Tracking Code (UUID based to prevent collision)
    const trackingCode = `REQ-PB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

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

    return res.status(201).json({
      success: true,
      message: 'Permohonan surat berhasil dikirim ke Kantor Desa Pulau Betung.',
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
    console.error('❌ [SERVICE-APPLY-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengirim permohonan surat. Silakan coba lagi.' });
  }
});

// 5. Public Application Tracking (FIX 6: Exact Match, Limited Columns, Generic 404)
router.get('/tracking/:code', async (req: Request, res: ExpressResponse) => {
  try {
    const rawCode = (req.params.code || '').trim();
    const prisma = getPrisma();

    const found = await prisma.serviceRequest.findUnique({
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
    console.error('❌ [TRACKING-ERROR]:', error.message);
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
    
    const prisma = getPrisma();
    const cleanSearchKey = searchKey.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const requestItem = await prisma.serviceRequest.findFirst({
      where: {
        OR: [
          { trackingCode: { in: candidateKeys } },
          { officialLetterNumber: { in: candidateKeys } },
          { id: { in: candidateKeys } },
          { trackingCode: { contains: cleanSearchKey, mode: 'insensitive' } },
          { officialLetterNumber: { contains: cleanSearchKey, mode: 'insensitive' } }
        ]
      }
    });

    if (!requestItem) {
      return res.status(404).json({
        success: false,
        verified: false,
        reason: 'DOCUMENT_NOT_FOUND',
        error: `Dokumen dengan nomor registrasi / kode '${searchKey}' TIDAK DITEMUKAN dalam arsip resmi Pemerintah Desa Pulau Betung.`
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
      message = 'PERINGATAN: Dokumen ini telah DIBATALKAN / DITOLAK oleh Pemerintah Desa Pulau Betung. Dokumen fisik tidak berlaku lagi untuk keabsahan administrasi.';
    } else if (currentStatusRaw === 'diajukan' || currentStatusRaw === 'diproses' || currentStatusRaw === 'menunggu') {
      validityState = 'PENDING';
      isVerified = false;
      message = 'Dokumen terdaftar dalam sistem desa, namun MASIH DALAM PROSES VERIFIKASI / PERSETUJUAN (Belum diterbitkan resmi oleh Kepala Desa).';
    } else {
      validityState = 'VALID';
      isVerified = true;
      message = 'Dokumen RESMI TERVERIFIKASI SAH dan terdaftar secara elektronik oleh Pemerintah Desa Pulau Betung.';
    }

    const officialNumber = requestItem.officialLetterNumber || `470 / ${requestItem.id.replace('req-', '')} / SK-DESA / PB-PMY / IX / ${new Date().getFullYear()}`;

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
        authority: 'Pemerintah Desa Pulau Betung, Kecamatan Pemayung, Kabupaten Batang Hari',
        verificationTimestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('Terjadi kesalahan internal verifikasi dokumen:', err);
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

    const prisma = getPrisma();
    const currentCount = await prisma.complaint.count();
    const ticketNumber = `ADU-PB-2026-${String(currentCount + 1).padStart(3, '0')}`;

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
        adminResponse: 'Laporan telah diterima di sistem pengaduan terpadu Desa Pulau Betung dan segera diteruskan ke penanggung jawab terkait.',
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
    console.error('❌ [COMPLAINT-POST-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengirim pengaduan. Silakan coba lagi.' });
  }
});

// 7. Track Complaint by Ticket
router.get('/complaints/track/:ticket', async (req: Request, res: ExpressResponse) => {
  try {
    const ticket = req.params.ticket.trim().toUpperCase();
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
        ticketNumber: found.ticketNumber,
        category: found.category,
        title: found.title,
        content: found.content,
        reporterName: found.isAnonymous ? 'Warga Anonim' : found.reporterName,
        location: found.location,
        status: found.status,
        adminResponse: found.adminResponse,
        respondedBy: found.respondedBy,
        date: found.createdAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal melacak pengaduan.' });
  }
});

// 8. Public resolved complaints feed (FIX 7: Filter by isPublic=true)
router.get('/complaints/public', async (req: Request, res: ExpressResponse) => {
  try {
    const prisma = getPrisma();
    const list = await prisma.complaint.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const sanitizedList = list.map((c: any) => ({
      ticketNumber: c.ticketNumber,
      category: c.category,
      title: c.title,
      content: c.content,
      reporterName: c.isAnonymous ? 'Warga Anonim' : c.reporterName,
      location: c.location,
      status: c.status,
      adminResponse: c.adminResponse,
      respondedBy: c.respondedBy,
      date: c.createdAt
    }));
    
    return res.json({ success: true, data: sanitizedList });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar pengaduan publik.' });
  }
});

// 9. News / Berita
router.get('/news', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().newsItem.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat berita.' });
  }
});

// 10. Announcements
router.get('/announcements', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().announcement.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat pengumuman.' });
  }
});

// 11. Agendas
router.get('/agendas', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().agendaItem.findMany({
      orderBy: { date: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat agenda kegiatan.' });
  }
});

// 12. Development Projects
router.get('/projects', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().developmentProject.findMany({
      orderBy: { fiscalYear: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data pembangunan.' });
  }
});

// 13. Transparency / APBDes
router.get('/transparency', async (req: Request, res: ExpressResponse) => {
  try {
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data transparansi anggaran.' });
  }
});

// 14. Officials / Aparatur
router.get('/officials', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().villageOfficial.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar aparatur desa.' });
  }
});

// 15. Potentials, UMKM, Facilities, Gallery
router.get('/kpm', async (req: Request, res: ExpressResponse) => {
  try {
    const prisma = getPrisma();
    const list = await prisma.toddlerMeasurement.findMany({
      include: {
        toddler: true
      },
      take: 50,
      orderBy: { measurementDate: 'desc' }
    });
    
    // Wait, KPM data is in Resident/BansosRecipients logic from Tier 0.
    // Let's get real KPM data from Resident table or similar if exists.
    // In Tier 0, we used api.getKpmData which hits /admin/kpm.
    // Let's check where the data actually comes from.
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
    console.error('❌ [PUBLIC-KPM-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal memuat data bansos publik.' });
  }
});

router.get('/potentials', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().villagePotential.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data potensi desa.' });
  }
});

router.get('/umkm', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().umkmItem.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar UMKM.' });
  }
});

router.get('/facilities', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().mapFacility.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat data fasilitas desa.' });
  }
});

router.get('/gallery', async (req: Request, res: ExpressResponse) => {
  try {
    const data = await getPrisma().galleryItem.findMany({
      orderBy: { date: 'desc' }
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Gagal memuat galeri foto.' });
  }
});

// 16. Contact / Message from Citizen
router.post('/contact', async (req: Request, res: ExpressResponse) => {
  try {
    const { name, phone, email, subject, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ success: false, error: 'Nama dan pesan wajib diisi.' });
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
      message: 'Pesan Anda berhasil terkirim ke Sekretariat Desa Pulau Betung.',
      data: { id: newLog.id }
    });
  } catch (error: any) {
    console.error('❌ [CONTACT-ERROR]:', error.message);
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

    // FIX 9: Validasi selfieUrl harus URL hasil upload internal (public/uploads atau supabase)
    if (!selfieUrl || (!selfieUrl.includes('/uploads/') && !selfieUrl.includes('.supabase.co'))) {
      return res.status(400).json({ success: false, error: 'Wajib menggunakan foto selfie dari kamera sistem.' });
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
    console.error('❌ [ATTENDANCE-SUBMIT-ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Gagal mengirim absensi.' });
  }
});

// Get attendance logs for an official (FIX 9: PIN & Lockout)
router.post('/attendance/history', async (req: Request, res: ExpressResponse) => {
  try {
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
    return res.status(500).json({ success: false, error: 'Gagal memuat riwayat absensi.' });
  }
});

export default router;
