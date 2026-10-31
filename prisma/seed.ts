import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { seedInitialData, DatabaseSchema } from '../server/db/database';

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:\[([^\]]+)\]@/, ':$1@');
  if (!process.env.DATABASE_URL.includes('pgbouncer=true') && process.env.DATABASE_URL.includes(':6543')) {
    process.env.DATABASE_URL = process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SADEWA Database Seeding to PostgreSQL via Prisma...');

  let dbData: DatabaseSchema;
  const dbPath = path.join(process.cwd(), 'data', 'pulau_betung_db.json');

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      dbData = JSON.parse(raw);
      console.log('📦 Loaded existing dataset from pulau_betung_db.json');
    } catch (err) {
      console.warn('⚠️ Failed to parse pulau_betung_db.json, falling back to initial seed generator:', err);
      dbData = seedInitialData();
    }
  } else {
    console.log('⚙️ No pulau_betung_db.json found. Using default initial seed generator.');
    dbData = seedInitialData();
  }

  // 1. Seed Users
  if (dbData.users && dbData.users.length > 0) {
    console.log(`👤 Seeding ${dbData.users.length} Users...`);
    for (const u of dbData.users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          username: u.username || u.email.split('@')[0],
          passwordHash: u.passwordHash,
          salt: u.salt,
          role: u.role,
          roleTitle: u.roleTitle,
          phone: u.phone,
          gender: u.gender,
          birthDate: u.birthDate,
          isActive: u.isActive ?? true
        },
        create: {
          id: u.id,
          name: u.name,
          username: u.username || u.email.split('@')[0],
          email: u.email,
          passwordHash: u.passwordHash,
          salt: u.salt,
          role: u.role,
          roleTitle: u.roleTitle,
          phone: u.phone,
          gender: u.gender,
          birthDate: u.birthDate,
          isActive: u.isActive ?? true,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
        }
      });
    }
  }

  // 2. Seed Village Profile
  if (dbData.villageProfile) {
    console.log('🏛️ Seeding Village Profile...');
    const vp = dbData.villageProfile;
    await prisma.villageProfile.upsert({
      where: { id: 'default' },
      update: {
        villageName: vp.villageName,
        district: vp.district,
        regency: vp.regency,
        province: vp.province,
        postalCode: vp.postalCode,
        addressStreet: vp.addressStreet,
        email: vp.email,
        phone: vp.phone,
        website: vp.website,
        villageLogoUrl: vp.villageLogoUrl,
        regencyLogoUrl: vp.regencyLogoUrl,
        letterCodePrefix: vp.letterCodePrefix,
        motto: vp.motto,
        vision: vp.vision,
        mission: vp.mission || [],
        history: vp.history,
        totalPopulation: vp.totalPopulation,
        totalFamilies: vp.totalFamilies,
        areaSqKm: vp.areaSqKm,
        borders: vp.borders || {},
        officeLocation: vp.officeLocation ? (vp.officeLocation as any) : undefined,
        kadesName: vp.kadesName,
        kadesNip: vp.kadesNip,
        kadesPhotoUrl: vp.kadesPhotoUrl,
        kadesGreetingTitle: vp.kadesGreetingTitle,
        kadesGreeting: vp.kadesGreeting,
        officialSignatureUrl: vp.officialSignatureUrl,
        heroTitle: vp.heroTitle,
        heroSubtitle: vp.heroSubtitle,
        heroBackgroundUrl: vp.heroBackgroundUrl,
        heroBadgeText: vp.heroBadgeText,
        heroIsActive: vp.heroIsActive ?? true,
        sadewaLogoUrl: vp.sadewaLogoUrl,
        whatsappCenter: vp.whatsappCenter,
        operatingHours: vp.operatingHours ? (vp.operatingHours as any) : undefined,
        emergencyContacts: vp.emergencyContacts ? (vp.emergencyContacts as any) : undefined,
        lastUpdated: vp.lastUpdated ? new Date(vp.lastUpdated) : new Date(),
        updatedBy: vp.updatedBy
      },
      create: {
        id: 'default',
        villageName: vp.villageName,
        district: vp.district,
        regency: vp.regency,
        province: vp.province,
        postalCode: vp.postalCode,
        addressStreet: vp.addressStreet,
        email: vp.email,
        phone: vp.phone,
        website: vp.website,
        villageLogoUrl: vp.villageLogoUrl,
        regencyLogoUrl: vp.regencyLogoUrl,
        letterCodePrefix: vp.letterCodePrefix,
        motto: vp.motto,
        vision: vp.vision,
        mission: vp.mission || [],
        history: vp.history,
        totalPopulation: vp.totalPopulation,
        totalFamilies: vp.totalFamilies,
        areaSqKm: vp.areaSqKm,
        borders: vp.borders || {},
        officeLocation: vp.officeLocation ? (vp.officeLocation as any) : undefined,
        kadesName: vp.kadesName,
        kadesNip: vp.kadesNip,
        kadesPhotoUrl: vp.kadesPhotoUrl,
        kadesGreetingTitle: vp.kadesGreetingTitle,
        kadesGreeting: vp.kadesGreeting,
        officialSignatureUrl: vp.officialSignatureUrl,
        heroTitle: vp.heroTitle,
        heroSubtitle: vp.heroSubtitle,
        heroBackgroundUrl: vp.heroBackgroundUrl,
        heroBadgeText: vp.heroBadgeText,
        heroIsActive: vp.heroIsActive ?? true,
        sadewaLogoUrl: vp.sadewaLogoUrl,
        whatsappCenter: vp.whatsappCenter,
        operatingHours: vp.operatingHours ? (vp.operatingHours as any) : undefined,
        emergencyContacts: vp.emergencyContacts ? (vp.emergencyContacts as any) : undefined,
        lastUpdated: vp.lastUpdated ? new Date(vp.lastUpdated) : new Date(),
        updatedBy: vp.updatedBy
      }
    });
  }

  // 3. Seed Territories (Dusun -> RW -> RT)
  if (dbData.territories && dbData.territories.length > 0) {
    console.log(`🗺️ Seeding ${dbData.territories.length} Dusun Territories...`);
    for (const dusun of dbData.territories) {
      const createdDusun = await prisma.dusun.upsert({
        where: { id: dusun.id },
        update: {
          name: dusun.name,
          number: dusun.number,
          customName: dusun.customName,
          leaderName: dusun.leaderName,
          isActive: dusun.isActive ?? true
        },
        create: {
          id: dusun.id,
          name: dusun.name,
          number: dusun.number,
          customName: dusun.customName,
          leaderName: dusun.leaderName,
          isActive: dusun.isActive ?? true
        }
      });

      if (dusun.rws && dusun.rws.length > 0) {
        for (const rw of dusun.rws) {
          await prisma.rW.upsert({
            where: { id: rw.id },
            update: {
              name: rw.name,
              dusunId: createdDusun.id,
              leaderName: rw.leaderName,
              isActive: rw.isActive ?? true
            },
            create: {
              id: rw.id,
              name: rw.name,
              dusunId: createdDusun.id,
              leaderName: rw.leaderName,
              isActive: rw.isActive ?? true
            }
          });

          if (rw.rts && rw.rts.length > 0) {
            for (const rt of rw.rts) {
              await prisma.rT.upsert({
                where: { id: rt.id },
                update: {
                  name: rt.name,
                  rwId: rw.id,
                  dusunId: createdDusun.id,
                  leaderName: rt.leaderName,
                  isActive: rt.isActive ?? true
                },
                create: {
                  id: rt.id,
                  name: rt.name,
                  rwId: rw.id,
                  dusunId: createdDusun.id,
                  leaderName: rt.leaderName,
                  isActive: rt.isActive ?? true
                }
              });
            }
          }
        }
      }
    }
  }

  // 4. Seed Village Services
  if (dbData.services && dbData.services.length > 0) {
    console.log(`📋 Seeding ${dbData.services.length} Village Services...`);
    for (const s of dbData.services) {
      await prisma.villageService.upsert({
        where: { id: s.id },
        update: {
          name: s.name,
          category: s.category,
          letterClass: s.letterClass,
          allowDownload: s.allowDownload ?? true,
          isMultiPage: s.isMultiPage ?? false,
          pageCount: s.pageCount ?? 1,
          shortName: s.shortName,
          description: s.description,
          requirements: s.requirements || [],
          procedures: s.procedures || [],
          estimatedDays: s.estimatedDays || '1 hari',
          cost: s.cost || 'Gratis',
          isActive: s.isActive ?? true,
          requiredFields: s.requiredFields || []
        },
        create: {
          id: s.id,
          name: s.name,
          category: s.category,
          letterClass: s.letterClass,
          allowDownload: s.allowDownload ?? true,
          isMultiPage: s.isMultiPage ?? false,
          pageCount: s.pageCount ?? 1,
          shortName: s.shortName,
          description: s.description,
          requirements: s.requirements || [],
          procedures: s.procedures || [],
          estimatedDays: s.estimatedDays || '1 hari',
          cost: s.cost || 'Gratis',
          isActive: s.isActive ?? true,
          requiredFields: s.requiredFields || []
        }
      });
    }
  }

  // 5. Seed Service Requests
  if (dbData.serviceRequests && dbData.serviceRequests.length > 0) {
    console.log(`📨 Seeding ${dbData.serviceRequests.length} Service Requests...`);
    for (const req of dbData.serviceRequests) {
      await prisma.serviceRequest.upsert({
        where: { trackingCode: req.trackingCode },
        update: {
          serviceId: req.serviceId,
          serviceName: req.serviceName,
          citizenName: req.citizenName,
          citizenNik: req.citizenNik,
          citizenNikMasked: req.citizenNikMasked,
          phone: req.phone,
          addressDusun: req.addressDusun,
          citizenGender: req.citizenGender,
          citizenBirthPlace: req.citizenBirthPlace,
          citizenBirthDate: req.citizenBirthDate,
          dusunId: req.dusunId,
          rwId: req.rwId,
          rtId: req.rtId,
          status: req.status,
          notes: req.notes,
          staffNotes: req.staffNotes,
          processedBy: req.processedBy,
          completedAt: req.completedAt ? new Date(req.completedAt) : undefined,
          fileAttachmentName: req.fileAttachmentName,
          fileAttachmentUrl: req.fileAttachmentUrl,
          ktpAttachmentUrl: req.ktpAttachmentUrl,
          officialLetterNumber: req.officialLetterNumber,
          formData: req.formData || {},
          letterheadSnapshot: req.letterheadSnapshot || undefined
        },
        create: {
          id: req.id,
          trackingCode: req.trackingCode,
          serviceId: req.serviceId,
          serviceName: req.serviceName,
          citizenName: req.citizenName,
          citizenNik: req.citizenNik,
          citizenNikMasked: req.citizenNikMasked,
          phone: req.phone,
          addressDusun: req.addressDusun,
          citizenGender: req.citizenGender,
          citizenBirthPlace: req.citizenBirthPlace,
          citizenBirthDate: req.citizenBirthDate,
          dusunId: req.dusunId,
          rwId: req.rwId,
          rtId: req.rtId,
          requestDate: req.requestDate ? new Date(req.requestDate) : new Date(),
          status: req.status,
          notes: req.notes,
          staffNotes: req.staffNotes,
          processedBy: req.processedBy,
          completedAt: req.completedAt ? new Date(req.completedAt) : undefined,
          fileAttachmentName: req.fileAttachmentName,
          fileAttachmentUrl: req.fileAttachmentUrl,
          ktpAttachmentUrl: req.ktpAttachmentUrl,
          officialLetterNumber: req.officialLetterNumber,
          formData: req.formData || {},
          letterheadSnapshot: req.letterheadSnapshot || undefined
        }
      });
    }
  }

  // 6. Seed Complaints
  if (dbData.complaints && dbData.complaints.length > 0) {
    console.log(`📢 Seeding ${dbData.complaints.length} Complaints...`);
    for (const c of dbData.complaints) {
      await prisma.complaint.upsert({
        where: { ticketNumber: c.ticketNumber },
        update: {
          category: c.category,
          title: c.title,
          content: c.content,
          reporterName: c.reporterName,
          isAnonymous: c.isAnonymous ?? false,
          reporterContact: c.reporterContact,
          location: c.location,
          status: c.status,
          adminResponse: c.adminResponse,
          respondedBy: c.respondedBy,
          fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian,
          catatanTindakLanjut: c.catatanTindakLanjut
        },
        create: {
          id: c.id,
          ticketNumber: c.ticketNumber,
          category: c.category,
          title: c.title,
          content: c.content,
          reporterName: c.reporterName,
          isAnonymous: c.isAnonymous ?? false,
          reporterContact: c.reporterContact,
          location: c.location,
          status: c.status,
          adminResponse: c.adminResponse,
          respondedBy: c.respondedBy,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          fotoBuktiPenyelesaian: c.fotoBuktiPenyelesaian,
          catatanTindakLanjut: c.catatanTindakLanjut
        }
      });
    }
  }

  // 7. Seed News
  if (dbData.news && dbData.news.length > 0) {
    console.log(`📰 Seeding ${dbData.news.length} News Items...`);
    for (const n of dbData.news) {
      await prisma.newsItem.upsert({
        where: { slug: n.slug },
        update: {
          title: n.title,
          content: n.content,
          summary: n.summary,
          category: n.category,
          coverImage: n.coverImage,
          gallery: n.gallery || [],
          author: n.author,
          isPublished: n.isPublished ?? true,
          views: n.views || 0
        },
        create: {
          id: n.id,
          title: n.title,
          slug: n.slug,
          content: n.content,
          summary: n.summary,
          category: n.category,
          coverImage: n.coverImage,
          gallery: n.gallery || [],
          author: n.author,
          publishedAt: n.publishedAt ? new Date(n.publishedAt) : new Date(),
          isPublished: n.isPublished ?? true,
          views: n.views || 0
        }
      });
    }
  }

  // 8. Seed Announcements
  if (dbData.announcements && dbData.announcements.length > 0) {
    console.log(`📣 Seeding ${dbData.announcements.length} Announcements...`);
    for (const a of dbData.announcements) {
      await prisma.announcement.upsert({
        where: { id: a.id },
        update: {
          title: a.title,
          content: a.content,
          validUntil: a.validUntil ? new Date(a.validUntil) : new Date(),
          priority: a.priority || 'normal',
          isActive: a.isActive ?? true,
          attachmentUrl: a.attachmentUrl,
          attachmentName: a.attachmentName
        },
        create: {
          id: a.id,
          title: a.title,
          content: a.content,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
          validUntil: a.validUntil ? new Date(a.validUntil) : new Date(),
          priority: a.priority || 'normal',
          isActive: a.isActive ?? true,
          attachmentUrl: a.attachmentUrl,
          attachmentName: a.attachmentName
        }
      });
    }
  }

  // 9. Seed Agendas
  if (dbData.agendas && dbData.agendas.length > 0) {
    console.log(`🗓️ Seeding ${dbData.agendas.length} Agendas...`);
    for (const ag of dbData.agendas) {
      await prisma.agendaItem.upsert({
        where: { id: ag.id },
        update: {
          title: ag.title,
          description: ag.description,
          date: ag.date ? new Date(ag.date) : new Date(),
          time: ag.time,
          location: ag.location,
          organizer: ag.organizer,
          category: ag.category,
          status: ag.status || 'akan_datang'
        },
        create: {
          id: ag.id,
          title: ag.title,
          description: ag.description,
          date: ag.date ? new Date(ag.date) : new Date(),
          time: ag.time,
          location: ag.location,
          organizer: ag.organizer,
          category: ag.category,
          status: ag.status || 'akan_datang'
        }
      });
    }
  }

  // 10. Seed APBDes Budget Year Data
  if (dbData.budget) {
    console.log('💰 Seeding APBDes Budget...');
    const b = dbData.budget;
    await prisma.budgetYearData.upsert({
      where: { year: b.year || 2026 },
      update: {
        documentType: b.documentType || 'murni',
        status: b.status || 'BERLAKU',
        legalRefNumber: b.legalRefNumber,
        enactmentDate: b.enactmentDate ? new Date(b.enactmentDate) : undefined,
        totalIncome: b.totalIncome || 0,
        totalIncomeRealized: b.totalIncomeRealized || 0,
        totalExpenditure: b.totalExpenditure || 0,
        totalExpenditureRealized: b.totalExpenditureRealized || 0,
        totalFinancing: b.totalFinancing || 0,
        totalFinancingRealized: b.totalFinancingRealized || 0,
        realizationPercentage: b.realizationPercentage || 0,
        incomeBreakdown: b.incomeBreakdown || [],
        expenditureBreakdown: b.expenditureBreakdown || [],
        incomeItems: b.incomeItems || [],
        expenditureItems: b.expenditureItems || [],
        financingItems: b.financingItems || [],
        publicDocuments: b.publicDocuments || []
      },
      create: {
        id: b.id || `budget-${b.year || 2026}`,
        year: b.year || 2026,
        documentType: b.documentType || 'murni',
        status: b.status || 'BERLAKU',
        legalRefNumber: b.legalRefNumber,
        enactmentDate: b.enactmentDate ? new Date(b.enactmentDate) : undefined,
        totalIncome: b.totalIncome || 0,
        totalIncomeRealized: b.totalIncomeRealized || 0,
        totalExpenditure: b.totalExpenditure || 0,
        totalExpenditureRealized: b.totalExpenditureRealized || 0,
        totalFinancing: b.totalFinancing || 0,
        totalFinancingRealized: b.totalFinancingRealized || 0,
        realizationPercentage: b.realizationPercentage || 0,
        incomeBreakdown: b.incomeBreakdown || [],
        expenditureBreakdown: b.expenditureBreakdown || [],
        incomeItems: b.incomeItems || [],
        expenditureItems: b.expenditureItems || [],
        financingItems: b.financingItems || [],
        publicDocuments: b.publicDocuments || []
      }
    });
  }

  // 11. Seed Development Projects
  if (dbData.developmentProjects && dbData.developmentProjects.length > 0) {
    console.log(`🏗️ Seeding ${dbData.developmentProjects.length} Development Projects...`);
    for (const p of dbData.developmentProjects) {
      await prisma.developmentProject.upsert({
        where: { id: p.id },
        update: {
          title: p.title,
          location: p.location,
          fiscalYear: p.fiscalYear,
          budget: p.budget,
          fundingSource: p.fundingSource,
          contractor: p.contractor,
          status: p.status,
          progressPercent: p.progressPercent,
          startDate: p.startDate ? new Date(p.startDate) : new Date(),
          targetEndDate: p.targetEndDate ? new Date(p.targetEndDate) : new Date(),
          description: p.description,
          beforeImage: p.beforeImage,
          inProgressImage: p.inProgressImage,
          completedImage: p.completedImage
        },
        create: {
          id: p.id,
          title: p.title,
          location: p.location,
          fiscalYear: p.fiscalYear,
          budget: p.budget,
          fundingSource: p.fundingSource,
          contractor: p.contractor,
          status: p.status,
          progressPercent: p.progressPercent,
          startDate: p.startDate ? new Date(p.startDate) : new Date(),
          targetEndDate: p.targetEndDate ? new Date(p.targetEndDate) : new Date(),
          description: p.description,
          beforeImage: p.beforeImage,
          inProgressImage: p.inProgressImage,
          completedImage: p.completedImage
        }
      });
    }
  }

  // 12. Seed Village Potentials & UMKM & Officials & Facilities & Gallery
  if (dbData.potentials && dbData.potentials.length > 0) {
    console.log(`🌾 Seeding ${dbData.potentials.length} Potentials...`);
    for (const pot of dbData.potentials) {
      await prisma.villagePotential.upsert({
        where: { id: pot.id },
        update: {
          name: pot.name,
          category: pot.category,
          description: pot.description,
          highlightStat: pot.highlightStat,
          imageUrl: pot.imageUrl,
          keyCommodities: pot.keyCommodities || [],
          keyOpportunities: pot.keyOpportunities || []
        },
        create: {
          id: pot.id,
          name: pot.name,
          category: pot.category,
          description: pot.description,
          highlightStat: pot.highlightStat,
          imageUrl: pot.imageUrl,
          keyCommodities: pot.keyCommodities || [],
          keyOpportunities: pot.keyOpportunities || []
        }
      });
    }
  }

  if (dbData.umkm && dbData.umkm.length > 0) {
    console.log(`🏪 Seeding ${dbData.umkm.length} UMKM items...`);
    for (const u of dbData.umkm) {
      await prisma.umkmItem.upsert({
        where: { id: u.id },
        update: {
          name: u.name,
          ownerName: u.ownerName,
          category: u.category,
          description: u.description,
          products: u.products || [],
          imageUrl: u.imageUrl,
          location: u.location,
          whatsappContact: u.whatsappContact,
          phone: u.phone,
          priceRange: u.priceRange,
          isVerified: u.isVerified ?? true
        },
        create: {
          id: u.id,
          name: u.name,
          ownerName: u.ownerName,
          category: u.category,
          description: u.description,
          products: u.products || [],
          imageUrl: u.imageUrl,
          location: u.location,
          whatsappContact: u.whatsappContact,
          phone: u.phone,
          priceRange: u.priceRange,
          isVerified: u.isVerified ?? true
        }
      });
    }
  }

  if (dbData.officials && dbData.officials.length > 0) {
    console.log(`👔 Seeding ${dbData.officials.length} Village Officials...`);
    for (const off of dbData.officials) {
      await prisma.villageOfficial.upsert({
        where: { id: off.id },
        update: {
          name: off.name,
          position: off.position,
          section: off.section,
          nip: off.nip,
          bio: off.bio,
          imageUrl: off.imageUrl,
          tenure: off.tenure,
          phone: off.phone,
          gender: off.gender,
          birthDate: off.birthDate,
          isActive: off.isActive ?? true,
          displayOrder: off.displayOrder || 0,
          hasAdminAccess: off.hasAdminAccess ?? false,
          adminRole: off.adminRole,
          adminUsername: off.adminUsername,
          allowedModules: off.allowedModules || []
        },
        create: {
          id: off.id,
          name: off.name,
          position: off.position,
          section: off.section,
          nip: off.nip,
          bio: off.bio,
          imageUrl: off.imageUrl,
          tenure: off.tenure,
          phone: off.phone,
          gender: off.gender,
          birthDate: off.birthDate,
          isActive: off.isActive ?? true,
          displayOrder: off.displayOrder || 0,
          hasAdminAccess: off.hasAdminAccess ?? false,
          adminRole: off.adminRole,
          adminUsername: off.adminUsername,
          allowedModules: off.allowedModules || []
        }
      });
    }
  }

  if (dbData.facilities && dbData.facilities.length > 0) {
    console.log(`📍 Seeding ${dbData.facilities.length} Map Facilities...`);
    for (const fac of dbData.facilities) {
      await prisma.mapFacility.upsert({
        where: { id: fac.id },
        update: {
          name: fac.name,
          category: fac.category,
          address: fac.address,
          dusun: fac.dusun,
          coordinatesLabel: fac.coordinatesLabel,
          description: fac.description,
          coordinates: fac.coordinates || [0, 0],
          imageUrl: fac.imageUrl,
          contact: fac.contact
        },
        create: {
          id: fac.id,
          name: fac.name,
          category: fac.category,
          address: fac.address,
          dusun: fac.dusun,
          coordinatesLabel: fac.coordinatesLabel,
          description: fac.description,
          coordinates: fac.coordinates || [0, 0],
          imageUrl: fac.imageUrl,
          contact: fac.contact
        }
      });
    }
  }

  if (dbData.gallery && dbData.gallery.length > 0) {
    console.log(`🖼️ Seeding ${dbData.gallery.length} Gallery items...`);
    for (const gal of dbData.gallery) {
      await prisma.galleryItem.upsert({
        where: { id: gal.id },
        update: {
          title: gal.title,
          description: gal.description,
          category: gal.category,
          mediaUrl: gal.mediaUrl || gal.url || '',
          mediaType: gal.mediaType || gal.type || 'image',
          date: gal.date ? new Date(gal.date) : new Date()
        },
        create: {
          id: gal.id,
          title: gal.title,
          description: gal.description,
          category: gal.category,
          mediaUrl: gal.mediaUrl || gal.url || '',
          mediaType: gal.mediaType || gal.type || 'image',
          date: gal.date ? new Date(gal.date) : new Date()
        }
      });
    }
  }

  // 13. Seed WebGIS Land Parcels
  const landParcels = (dbData as any).landParcels;
  if (landParcels && landParcels.length > 0) {
    console.log(`🗺️ Seeding ${landParcels.length} WebGIS Land Parcels...`);
    for (const parcel of landParcels) {
      await prisma.landParcel.upsert({
        where: { nop: parcel.nop },
        update: {
          ownerName: parcel.ownerName,
          ownerNik: parcel.ownerNik,
          phone: parcel.phone,
          addressDusun: parcel.addressDusun,
          landUseCategory: parcel.landUseCategory,
          landAreaSqM: parcel.landAreaSqM,
          landAreaHectares: parcel.landAreaHectares,
          buildingAreaSqM: parcel.buildingAreaSqM,
          coordinates: parcel.coordinates as any,
          boundaries: parcel.boundaries as any,
          njopLandPerSqM: parcel.njopLandPerSqM,
          njopBuildingPerSqM: parcel.njopBuildingPerSqM,
          pbbTaxAmount: parcel.pbbTaxAmount,
          pbbStatus: parcel.pbbStatus,
          pbbPaymentDate: parcel.pbbPaymentDate ? new Date(parcel.pbbPaymentDate) : undefined,
          pbbReceiptNumber: parcel.pbbReceiptNumber,
          sporadikStatus: parcel.sporadikStatus,
          sporadikRequestCode: parcel.sporadikRequestCode,
          sporadikCertificateNumber: parcel.sporadikCertificateNumber,
          sporadikIssuedDate: parcel.sporadikIssuedDate ? new Date(parcel.sporadikIssuedDate) : undefined,
          surveyorName: parcel.surveyorName,
          witnesses: parcel.witnesses || [],
          notes: parcel.notes
        },
        create: {
          id: parcel.id,
          nop: parcel.nop,
          ownerName: parcel.ownerName,
          ownerNik: parcel.ownerNik,
          phone: parcel.phone,
          addressDusun: parcel.addressDusun,
          landUseCategory: parcel.landUseCategory,
          landAreaSqM: parcel.landAreaSqM,
          landAreaHectares: parcel.landAreaHectares,
          buildingAreaSqM: parcel.buildingAreaSqM,
          coordinates: parcel.coordinates as any,
          boundaries: parcel.boundaries as any,
          njopLandPerSqM: parcel.njopLandPerSqM,
          njopBuildingPerSqM: parcel.njopBuildingPerSqM,
          pbbTaxAmount: parcel.pbbTaxAmount,
          pbbStatus: parcel.pbbStatus,
          pbbPaymentDate: parcel.pbbPaymentDate ? new Date(parcel.pbbPaymentDate) : undefined,
          pbbReceiptNumber: parcel.pbbReceiptNumber,
          sporadikStatus: parcel.sporadikStatus,
          sporadikRequestCode: parcel.sporadikRequestCode,
          sporadikCertificateNumber: parcel.sporadikCertificateNumber,
          sporadikIssuedDate: parcel.sporadikIssuedDate ? new Date(parcel.sporadikIssuedDate) : undefined,
          surveyorName: parcel.surveyorName,
          witnesses: parcel.witnesses || [],
          notes: parcel.notes
        }
      });
    }
  }

  // 14. Seed Master Residents (Buku Induk Penduduk) & Bansos Recipients
  const masterResidents = [
    {
      id: 'res-001',
      nik: '1504011205900001',
      kkNumber: '1504011205900001',
      fullName: 'AHMAD SOBRI',
      gender: 'Laki-laki',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1990-05-12'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Petani / Pekebun',
      education: 'SMA / SMK / MA',
      address: 'Dusun 1, RT 01 / RW 01',
      dusunId: 'dus-1',
      rwId: 'rw-1',
      rtId: 'rt-1',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const,
      phone: '081274890011'
    },
    {
      id: 'res-002',
      nik: '1504015508920002',
      kkNumber: '1504011205900001',
      fullName: 'SITI NURHALIZA',
      gender: 'Perempuan',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1992-08-15'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Wiraswasta / UMKM / Pedagang',
      education: 'Diploma / Sarjana (S1-S2)',
      address: 'Dusun 1, RT 01 / RW 01',
      dusunId: 'dus-1',
      rwId: 'rw-1',
      rtId: 'rt-1',
      economicStatus: 'UMKM Transisi',
      hasKus: true,
      isStuntingRisk: false,
      status: 'HIDUP' as const,
      phone: '081274890012'
    },
    {
      id: 'res-003',
      nik: '1504011003180003',
      kkNumber: '1504011205900001',
      fullName: 'M. FAIZ AL-FARIZI',
      gender: 'Laki-laki',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('2018-03-10'),
      religion: 'Islam',
      maritalStatus: 'Belum Kawin',
      occupation: 'Pelajar / Mahasiswa',
      education: 'SD / Sederajat',
      address: 'Dusun 1, RT 01 / RW 01',
      dusunId: 'dus-1',
      rwId: 'rw-1',
      rtId: 'rt-1',
      economicStatus: 'Umum',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const
    },
    {
      id: 'res-004',
      nik: '1504015408930012',
      kkNumber: '1504012005080002',
      fullName: 'SITI RAHMA',
      gender: 'Perempuan',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1993-08-14'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Mengurus Rumah Tangga (IRT)',
      education: 'SMP / MTs',
      address: 'Dusun 1, RT 02 / RW 01',
      dusunId: 'dus-1',
      rwId: 'rw-1',
      rtId: 'rt-2',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const,
      phone: '081377889900'
    },
    {
      id: 'res-005',
      nik: '1504011208900001',
      kkNumber: '1504012005080002',
      fullName: 'HENDRA GUNAWAN',
      gender: 'Laki-laki',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1990-08-12'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Petani / Pekebun',
      education: 'SMA / SMK / MA',
      address: 'Dusun 1, RT 02 / RW 01',
      dusunId: 'dus-1',
      rwId: 'rw-1',
      rtId: 'rt-2',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const,
      phone: '081377889901'
    },
    {
      id: 'res-006',
      nik: '1504014101680003',
      kkNumber: '1504012005080003',
      fullName: 'HASAN BASRI',
      gender: 'Laki-laki',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1968-01-01'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Petani / Pekebun',
      education: 'SD / Sederajat',
      address: 'Dusun 2, RT 04 / RW 02',
      dusunId: 'dus-2',
      rwId: 'rw-2',
      rtId: 'rt-4',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const
    },
    {
      id: 'res-007',
      nik: '1504015507790018',
      kkNumber: '1504012005080004',
      fullName: 'ROHANI BINTI SAMAN',
      gender: 'Perempuan',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1979-07-15'),
      religion: 'Islam',
      maritalStatus: 'Cerai Mati',
      occupation: 'Mengurus Rumah Tangga (IRT)',
      education: 'Tidak/Belum Sekolah',
      address: 'Dusun 2, RT 04 / RW 02',
      dusunId: 'dus-2',
      rwId: 'rw-2',
      rtId: 'rt-4',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const
    },
    {
      id: 'res-008',
      nik: '1504011909820085',
      kkNumber: '1504012005080005',
      fullName: 'BAHARUDDIN HASAN',
      gender: 'Laki-laki',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1982-09-19'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Buruh Harian Lepas',
      education: 'SMP / MTs',
      address: 'Dusun 2, RT 04 / RW 02',
      dusunId: 'dus-2',
      rwId: 'rw-2',
      rtId: 'rt-4',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const
    },
    {
      id: 'res-009',
      nik: '1504012403680011',
      kkNumber: '1504012005080006',
      fullName: 'KADIRUN BIN KASIM',
      gender: 'Laki-laki',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1968-03-24'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Petani / Pekebun',
      education: 'SD / Sederajat',
      address: 'Dusun 1, RT 03 / RW 01',
      dusunId: 'dus-1',
      rwId: 'rw-1',
      rtId: 'rt-3',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const
    },
    {
      id: 'res-010',
      nik: '1504011003840027',
      kkNumber: '1504012005080007',
      fullName: 'RUSTAM EFENDI',
      gender: 'Laki-laki',
      birthPlace: 'Pulau Betung',
      birthDate: new Date('1984-03-10'),
      religion: 'Islam',
      maritalStatus: 'Kawin',
      occupation: 'Buruh Harian Lepas',
      education: 'SMA / SMK / MA',
      address: 'Dusun 1, RT 01 / RW 01',
      dusunId: 'dus-1',
      rwId: 'rw-1',
      rtId: 'rt-1',
      economicStatus: 'Penerima Bantuan',
      hasKus: false,
      isStuntingRisk: false,
      status: 'HIDUP' as const,
      phone: '085277889911'
    }
  ];

  console.log(`👥 Seeding ${masterResidents.length} Master Residents (Buku Induk Penduduk)...`);
  for (const r of masterResidents) {
    await prisma.resident.upsert({
      where: { nik: r.nik },
      update: {
        kkNumber: r.kkNumber,
        fullName: r.fullName,
        gender: r.gender,
        birthPlace: r.birthPlace,
        birthDate: r.birthDate,
        religion: r.religion,
        maritalStatus: r.maritalStatus,
        occupation: r.occupation,
        education: r.education,
        address: r.address,
        dusunId: r.dusunId,
        rwId: r.rwId,
        rtId: r.rtId,
        economicStatus: r.economicStatus,
        hasKus: r.hasKus,
        isStuntingRisk: r.isStuntingRisk,
        status: r.status,
        phone: r.phone
      },
      create: {
        id: r.id,
        nik: r.nik,
        kkNumber: r.kkNumber,
        fullName: r.fullName,
        gender: r.gender,
        birthPlace: r.birthPlace,
        birthDate: r.birthDate,
        religion: r.religion,
        maritalStatus: r.maritalStatus,
        occupation: r.occupation,
        education: r.education,
        address: r.address,
        dusunId: r.dusunId,
        rwId: r.rwId,
        rtId: r.rtId,
        economicStatus: r.economicStatus,
        hasKus: r.hasKus,
        isStuntingRisk: r.isStuntingRisk,
        status: r.status,
        phone: r.phone
      }
    });
  }

  // 15. Seed Bansos Recipients linked to Master Residents
  const bansosSeeds = [
    {
      id: 'BNS-001',
      residentNik: '1504011205900001',
      programName: 'BLT Dana Desa (BLT-DD) TA 2026',
      fiscalYear: 2026,
      stageOrMonth: 'Tahap 1 (Januari - Maret 2026)',
      nominalAmount: 900000,
      status: 'SALUR_SELESAI' as const,
      notes: 'Keluarga Desil 1 Kemiskinan Ekstrem. Pengambilan langsung di Aula Kantor Desa.'
    },
    {
      id: 'BNS-002',
      residentNik: '1504015408930012',
      programName: 'Program Keluarga Harapan (PKH)',
      fiscalYear: 2026,
      stageOrMonth: 'Tahap 1 (Januari - Maret 2026)',
      nominalAmount: 750000,
      status: 'SALUR_SELESAI' as const,
      notes: 'Komponen Balita & Anak SD. Bantuan telah disalurkan melalui rekening KKS.'
    },
    {
      id: 'BNS-003',
      residentNik: '1504014101680003',
      programName: 'Cadangan Pangan Pemerintah (Beras CPP)',
      fiscalYear: 2026,
      stageOrMonth: 'Alokasi Maret 2026',
      nominalAmount: 10,
      status: 'TERDAFTAR' as const,
      notes: 'Penyaluran dari Bapanas & Perum Bulog Kanwil Jambi.'
    },
    {
      id: 'BNS-004',
      residentNik: '1504015507790018',
      programName: 'BLT Dana Desa (BLT-DD) TA 2026',
      fiscalYear: 2026,
      stageOrMonth: 'Tahap 1 (Januari - Maret 2026)',
      nominalAmount: 900000,
      status: 'TERDAFTAR' as const,
      notes: 'Keluarga Miskin Ekstrem / Janda Lansia Tanpa Penghasilan Tetap.'
    },
    {
      id: 'BNS-005',
      residentNik: '1504011909820085',
      programName: 'Bantuan Pangan Non Tunai (BPNT / Sembako)',
      fiscalYear: 2026,
      stageOrMonth: 'Tahap 1 (Januari - Februari 2026)',
      nominalAmount: 400000,
      status: 'SALUR_SELESAI' as const,
      notes: 'Dana sembako telah ditransfer ke rekening KKS Penerima.'
    },
    {
      id: 'BNS-006',
      residentNik: '1504012403680011',
      programName: 'Kartu Indonesia Sehat (KIS PBI JK)',
      fiscalYear: 2026,
      stageOrMonth: 'Tahun Anggaran 2026',
      nominalAmount: 0,
      status: 'SALUR_SELESAI' as const,
      notes: 'Status kepesertaan aktif di BPJS Kesehatan (Iuran ditanggung Pemerintah).'
    },
    {
      id: 'BNS-007',
      residentNik: '1504011003840027',
      programName: 'BLT Dana Desa (BLT-DD) TA 2026',
      fiscalYear: 2026,
      stageOrMonth: 'Tahap 1 (Januari - Maret 2026)',
      nominalAmount: 900000,
      status: 'TERDAFTAR' as const,
      notes: 'Sedang dalam proses pencocokan data desil kemiskinan ekstrem oleh BPD & Tim Verifikasi.'
    }
  ];

  console.log(`🎁 Seeding ${bansosSeeds.length} Bansos Recipients...`);
  for (const b of bansosSeeds) {
    const resident = await prisma.resident.findUnique({ where: { nik: b.residentNik } });
    if (resident) {
      await prisma.bansosRecipient.upsert({
        where: { id: b.id },
        update: {
          residentId: resident.id,
          programName: b.programName,
          fiscalYear: b.fiscalYear,
          stageOrMonth: b.stageOrMonth,
          nominalAmount: b.nominalAmount,
          status: b.status,
          notes: b.notes
        },
        create: {
          id: b.id,
          residentId: resident.id,
          programName: b.programName,
          fiscalYear: b.fiscalYear,
          stageOrMonth: b.stageOrMonth,
          nominalAmount: b.nominalAmount,
          status: b.status,
          notes: b.notes
        }
      });
    }
  }

  console.log('✅ SADEWA Database Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
