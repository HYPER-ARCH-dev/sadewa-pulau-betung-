import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Memulai Proses Konsolidasi Data ke Supabase...');

  const jsonPath = path.join(process.cwd(), 'data', 'pulau_betung_db.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ File JSON tidak ditemukan!');
    return;
  }

  const db = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // 1. VillageProfile
  if (db.villageProfile) {
    console.log('📦 Migrasi VillageProfile...');
    await prisma.villageProfile.upsert({
      where: { id: 'default' },
      update: {
        ...db.villageProfile,
        id: 'default',
        lastUpdated: new Date(db.villageProfile.lastUpdated || new Date()),
      },
      create: {
        ...db.villageProfile,
        id: 'default',
        lastUpdated: new Date(db.villageProfile.lastUpdated || new Date()),
      },
    });
  }

  // 2. Territories (Nested: Dusun -> RW -> RT)
  if (db.territories && Array.isArray(db.territories)) {
    console.log('📦 Migrasi Wilayah (Dusun/RW/RT)...');
    for (const d of db.territories) {
      const dusun = await prisma.dusun.upsert({
        where: { id: d.id },
        update: { name: d.name, leaderName: d.leaderName, isActive: d.isActive },
        create: { id: d.id, name: d.name, leaderName: d.leaderName, isActive: d.isActive },
      });

      if (d.rws && Array.isArray(d.rws)) {
        for (const r of d.rws) {
          const rw = await prisma.rW.upsert({
            where: { id: r.id },
            update: { name: r.name, leaderName: r.leaderName, isActive: r.isActive, dusunId: dusun.id },
            create: { id: r.id, name: r.name, leaderName: r.leaderName, isActive: r.isActive, dusunId: dusun.id },
          });

          if (r.rts && Array.isArray(r.rts)) {
            for (const rt of r.rts) {
              await prisma.rT.upsert({
                where: { id: rt.id },
                update: { name: rt.name, leaderName: rt.leaderName, isActive: rt.isActive, rwId: rw.id, dusunId: dusun.id },
                create: { id: rt.id, name: rt.name, leaderName: rt.leaderName, isActive: rt.isActive, rwId: rw.id, dusunId: dusun.id },
              });
            }
          }
        }
      }
    }
  }

  // 3. VillageServices
  if (db.services && Array.isArray(db.services)) {
    console.log('📦 Migrasi Layanan Surat...');
    for (const s of db.services) {
      await prisma.villageService.upsert({
        where: { id: s.id },
        update: { ...s, cost: String(s.cost || 'Gratis') },
        create: { ...s, cost: String(s.cost || 'Gratis') },
      });
    }
  }

  // 4. ServiceRequests (Prioritas)
  if (db.serviceRequests && Array.isArray(db.serviceRequests)) {
    console.log(`📦 Migrasi ${db.serviceRequests.length} Permohonan Surat...`);
    for (const r of db.serviceRequests) {
      await prisma.serviceRequest.upsert({
        where: { trackingCode: r.trackingCode },
        update: {
          ...r,
          requestDate: new Date(r.requestDate),
          completedAt: r.completedAt ? new Date(r.completedAt) : null,
        },
        create: {
          ...r,
          requestDate: new Date(r.requestDate),
          completedAt: r.completedAt ? new Date(r.completedAt) : null,
        },
      });
    }
  }

  // 5. NewsItems
  if (db.news && Array.isArray(db.news)) {
    console.log('📦 Migrasi Berita...');
    for (const n of db.news) {
      await prisma.newsItem.upsert({
        where: { slug: n.slug },
        update: {
          title: n.title,
          content: n.content,
          summary: n.summary,
          category: n.category,
          coverImage: n.coverImage || n.imageUrl,
          gallery: n.gallery,
          author: n.author,
          isPublished: n.isPublished,
          views: n.views,
        },
        create: {
          id: n.id,
          title: n.title,
          slug: n.slug,
          content: n.content,
          summary: n.summary,
          category: n.category,
          coverImage: n.coverImage || n.imageUrl,
          gallery: n.gallery,
          author: n.author,
          isPublished: n.isPublished,
          views: n.views,
        },
      });
    }
  }

  // 6. Announcements
  if (db.announcements && Array.isArray(db.announcements)) {
    console.log('📦 Migrasi Pengumuman...');
    for (const a of db.announcements) {
      await prisma.announcement.upsert({
        where: { id: a.id },
        update: {
          ...a,
          publishedAt: new Date(a.date || a.publishedAt || new Date()),
          validUntil: new Date(a.validUntil || new Date()),
        },
        create: {
          ...a,
          publishedAt: new Date(a.date || a.publishedAt || new Date()),
          validUntil: new Date(a.validUntil || new Date()),
        },
      });
    }
  }

  // 7. Agendas
  if (db.agendas && Array.isArray(db.agendas)) {
    console.log('📦 Migrasi Agenda...');
    for (const ag of db.agendas) {
      await prisma.agendaItem.upsert({
        where: { id: ag.id },
        update: {
          ...ag,
          date: new Date(ag.date),
        },
        create: {
          ...ag,
          date: new Date(ag.date),
        },
      });
    }
  }

  // 8. UMKM
  if (db.umkm && Array.isArray(db.umkm)) {
    console.log('📦 Migrasi Data UMKM...');
    for (const u of db.umkm) {
      await prisma.umkmItem.upsert({
        where: { id: u.id },
        update: u,
        create: u,
      });
    }
  }

  // 9. Officials
  if (db.officials && Array.isArray(db.officials)) {
    console.log('📦 Migrasi Aparatur Desa...');
    for (const off of db.officials) {
      await prisma.villageOfficial.upsert({
        where: { id: off.id },
        update: off,
        create: off,
      });
    }
  }

  // 10. Facilities
  if (db.facilities && Array.isArray(db.facilities)) {
    console.log('📦 Migrasi Fasilitas Umum...');
    for (const f of db.facilities) {
      await prisma.mapFacility.upsert({
        where: { id: f.id },
        update: f,
        create: f,
      });
    }
  }

  // 11. Projects
  if (db.developmentProjects && Array.isArray(db.developmentProjects)) {
    console.log('📦 Migrasi Proyek Pembangunan...');
    for (const p of db.developmentProjects) {
      await prisma.developmentProject.upsert({
        where: { id: p.id },
        update: {
          ...p,
          startDate: new Date(p.startDate),
          targetEndDate: new Date(p.targetEndDate),
        },
        create: {
          ...p,
          startDate: new Date(p.startDate),
          targetEndDate: new Date(p.targetEndDate),
        },
      });
    }
  }

  console.log('✅ MIGRASI SELESAI!');
  await prisma.$disconnect();
}

migrate().catch(async (e) => {
  console.error('❌ Terjadi kesalahan fatal saat migrasi:', e);
  await prisma.$disconnect();
  process.exit(1);
});
