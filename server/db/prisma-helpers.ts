import { PrismaClient } from '@prisma/client';

/**
 * 🏛️ KONTROLER UTAMA PRISMA (SINGLETON)
 * Kita pakai globalThis supaya Prisma Client cuma ada satu (biar gak menumpuk koneksi ke Supabase).
 * Ini penting banget buat performa server dan jatah koneksi gratisan Supabase!
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * 🔌 Ambil Koneksi Prisma
 * Fungsi ini bakal balikin client Prisma yang siap pakai.
 * Kalau koneksi belum ada, kita bikin baru.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    // 🛡️ Optimasi koneksi buat Supabase (PgBouncer)
    // Kalau pakai port 6543 (pooler), kita wajib tambahin pgbouncer=true di URL
    // biar Prisma gak error pas lagi "reuse" koneksi lama.
    let dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl && !dbUrl.includes('pgbouncer=true') && dbUrl.includes(':6543')) {
      process.env.DATABASE_URL = dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
    // Nyalain mesin Prisma!
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

// ============================================================================
// 📁 1. PENGAWAL DATA PUBLIK & PROFIL DESA
// ============================================================================

/**
 * 🏠 Ambil Profil Desa
 * Ngambil data identitas desa (Logo, Nama, Visi Misi) dari Supabase.
 * Kita pakai ID 'default' karena profil desa cuma ada satu buat satu portal.
 */
export async function getVillageProfile() {
  return getPrisma().villageProfile.findUnique({
    where: { id: 'default' }
  });
}

/**
 * 📜 Daftar Layanan Surat
 * Ngambil semua jenis surat yang dilayani desa (misal: KTP, Domisili, Sporadik).
 * 'onlyActive' buat mastiin kita cuma nampilin surat yang emang lagi dilayani.
 */
export async function getServices(onlyActive = true) {
  return getPrisma().villageService.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    orderBy: { category: 'asc' },
  });
}

/**
 * 📰 Berita Terkini
 * Ambil berita-berita terbaru biar warga gak ketinggalan info.
 * Kita urutin dari yang paling baru ('desc') dan batasi jumlahnya biar gak berat.
 */
export async function getLatestNews(limit = 5) {
  return getPrisma().newsItem.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

/**
 * 💰 Info Anggaran (APBDes)
 * Ngambil data anggaran terbaru buat transparansi ke warga.
 */
export async function getLatestBudget() {
  return getPrisma().budgetYearData.findFirst({
    orderBy: { year: 'desc' },
  });
}

// ============================================================================
// 🤖 2. KONTEKS PINTAR BUAT AI PANJUL
// ============================================================================

/**
 * 🧠 Otak AI Panjul (Konteks Desa)
 * Fungsi ini ngumpulin SEMUA info penting desa biar Panjul bisa jawab pertanyaan warga
 * dengan akurat (gak ngaco/halusinasi).
 * Ada 'try-catch' biar kalau DB lagi down, Panjul tetep bisa nyapa warga pakai data aman (fallback).
 */
export async function getAiContext() {
  try {
    const p = getPrisma();
    // Tarik data secara barengan (paralel) biar kilat!
    const [profile, services, latestNews, budget, officials, umkm] = await Promise.all([
      p.villageProfile.findFirst().catch(() => null),
      p.villageService.findMany({ 
        where: { isActive: true },
        select: { name: true, category: true, requirements: true, estimatedDays: true },
        take: 10
      }).catch(() => []),
      p.newsItem.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { title: true, category: true },
      }).catch(() => []),
      p.budgetYearData.findFirst({
        orderBy: { year: 'desc' },
      }).catch(() => null),
      p.villageOfficial.findMany({
        select: { name: true, position: true },
        take: 8
      }).catch(() => []),
      p.umkmItem.findMany({
        select: { name: true, category: true, priceRange: true, phone: true },
        take: 5
      }).catch(() => [])
    ]);

    // Balikin bungkusan data buat dikirim ke AI
    return {
      profile: profile || null,
      services: Array.isArray(services) ? services : [],
      servicesCount: Array.isArray(services) ? services.length : 0,
      latestNews: Array.isArray(latestNews) ? latestNews : [],
      budget: budget || null,
      officials: Array.isArray(officials) ? officials : [],
      umkm: Array.isArray(umkm) ? umkm : []
    };
  } catch (error) {
    // Kalau Supabase lagi ngadat, kasih info kosong aja biar gak crash satu portal
    console.error('⚠️ [AI-CONTEXT] Gagal ambil konteks AI dari Supabase, pakai data aman:', error);
    return {
      profile: null,
      services: [],
      servicesCount: 0,
      latestNews: [],
      budget: null,
      officials: [],
      umkm: []
    };
  }
}

// ============================================================================
// 👤 3. PENJAGA PINTU (USER & AUTH)
// ============================================================================

/**
 * 🔍 Cari User via Username
 * Dipakai pas login buat ngecek apakah akunnya beneran ada.
 */
export async function getUserByUsername(username: string) {
  return getPrisma().user.findUnique({
    where: { username },
  });
}

/**
 * 🆔 Cari User via ID
 * Dipakai buat validasi session token yang dibawa browser.
 */
export async function getUserById(id: string) {
  return getPrisma().user.findUnique({
    where: { id },
  });
}

/**
 * ⏰ Update Waktu Login Terakhir
 * Biar kita tahu kapan terakhir kali admin/operator masuk ke sistem.
 */
export async function updateUserLastLogin(id: string) {
  try {
    await getPrisma().user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  } catch (err) {
    console.error('⚠️ [LAST-LOGIN] Gagal update waktu login terakhir:', err);
  }
}

// ============================================================================
// 📝 4. PENCATAT JEJAK (AUDIT LOG)
// ============================================================================

/**
 * 🕵️ Rekam Jejak Admin (Audit Log)
 * Setiap admin ngapus atau nambah data, kita catat di sini.
 * Penting banget buat keamanan dan transparansi kerja perangkat desa.
 * Kita pakai 'try-catch' biar kalau gagal nyatet, proses utamanya (misal hapus data) gak keganggu.
 */
export async function recordAuditLogDb(
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  module: string,
  details: string,
  ipAddress = '127.0.0.1'
) {
  try {
    await getPrisma().auditLog.create({
      data: {
        userId,
        userName,
        userRole,
        action,
        module,
        details,
        ipAddress,
      },
    });
  } catch (err) {
    console.error('⚠️ [AUDIT-LOG] Gagal masukin log audit ke Supabase:', err);
  }
}

