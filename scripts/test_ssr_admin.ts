import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { PrismaClient } from '@prisma/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rawUrl = process.env.DATABASE_URL || '';
const dbUrl = rawUrl.includes('?') ? rawUrl + '&pgbouncer=true' : rawUrl + '?pgbouncer=true';
const prisma = new (PrismaClient as any)({ datasources: { db: { url: dbUrl } } });

async function runSSRTest() {
  console.log('--- FETCHING REAL SUPABASE DATA FOR FULL ADMIN TEST ---');
  const [
    profile,
    officials,
    residents,
    toddlers,
    bansos,
    news,
    announcements,
    dusuns,
    facilities,
    potentials,
    projects,
    budget
  ] = await Promise.all([
    prisma.villageProfile.findUnique({ where: { id: 'default' } }),
    prisma.villageOfficial.findMany({}),
    prisma.resident.findMany({ take: 10 }),
    prisma.toddlerRecord.findMany({ take: 10 }),
    prisma.bansosRecipient.findMany({ take: 10 }),
    prisma.newsItem.findMany({ take: 10 }),
    prisma.announcement.findMany({ take: 10 }),
    prisma.dusun.findMany({ take: 10 }),
    prisma.mapFacility.findMany({ take: 10 }),
    prisma.villagePotential.findMany({ take: 10 }),
    prisma.developmentProject.findMany({ take: 10 }),
    prisma.budgetYearData.findFirst({ orderBy: { year: 'desc' } })
  ]);

  console.log('Real data loaded. Initializing Providers...');

  const { AppContext } = await import('../src/context/AppContext');

  // Convert dates to ISO string for news items
  const cleanNews = (news || []).map((n: any) => ({
    ...n,
    publishedAt: n.publishedAt ? new Date(n.publishedAt).toISOString().substring(0, 10) : ''
  }));

  const mockValue: any = {
    currentUser: { id: 'usr-1', name: 'Admin', role: 'super_admin', roleTitle: 'Administrator' },
    villageProfile: profile,
    officials: officials || [],
    residents: residents || [],
    toddlers: toddlers || [],
    bansosRecipients: bansos || [],
    bansosComplaints: [],
    news: cleanNews,
    announcements: announcements || [],
    agendas: [],
    territories: dusuns || [],
    facilities: facilities || [],
    potentials: potentials || [],
    developmentProjects: projects || [],
    projects: projects || [],
    serviceRequests: [],
    deletedRequests: [],
    incomingLetters: [],
    outgoingLetters: [],
    archivedLetters: [],
    deletedLetters: [],
    attendanceLogs: [],
    umkm: [],
    umkmList: [],
    posyanduActivities: [],
    kpmRecipients: [],
    posyanduMonthlyReports: [],
    activityLogs: [],
    budget: budget || { year: 2026, totalIncome: 1000000, totalExpenditure: 1000000, incomeItems: [], expenditureItems: [], financingItems: [] },
    budgetHistory: budget ? [budget] : [],
    resetAllDataToDefault: () => {},
    updateVillageProfile: async () => {},
    addToast: () => {},
    toast: null,
    dismissToast: () => {},
    addNewsItem: () => {},
    deleteNewsItem: () => {},
    addAnnouncement: () => {},
    updateAnnouncement: () => {},
    deleteAnnouncement: () => {},
    addAgendaItem: () => {},
    updateAgendaItem: () => {},
    deleteAgendaItem: () => {},
    addDevelopmentProject: () => {},
    updateDevelopmentProject: () => {},
    deleteDevelopmentProject: () => {},
    addUmkmItem: () => {},
    deleteUmkmItem: () => {},
    toggleUmkmVerification: () => {},
    addBansosRecipient: () => {},
    bulkAddBansosRecipients: async () => 0,
    replaceBansosRecipients: async () => 0,
    updateBansosRecipient: () => {},
    deleteBansosRecipient: () => {},
    updateBansosComplaintStatus: () => {},
    updateBudget: () => {}
  };

  const queryClient = new QueryClient();

  const adminComponents = [
    { name: 'VillageProfileManager', path: '../src/components/admin/VillageProfileManager', prop: 'VillageProfileManager' },
    { name: 'PopulationManager', path: '../src/components/admin/PopulationManager', prop: 'PopulationManager' },
    { name: 'BansosManager', path: '../src/components/admin/BansosManager', prop: 'BansosManager' },
    { name: 'NewsManager', path: '../src/components/admin/NewsManager', prop: 'NewsManager' },
    { name: 'AnnouncementsManager', path: '../src/components/admin/AnnouncementsManager', prop: 'AnnouncementsManager' },
    { name: 'TerritoriesManager', path: '../src/components/admin/TerritoriesManager', prop: 'TerritoriesManager' },
    { name: 'FacilitiesManager', path: '../src/components/admin/FacilitiesManager', prop: 'FacilitiesManager' },
    { name: 'PotentialManager', path: '../src/components/admin/PotentialManager', prop: 'PotentialManager' },
    { name: 'ProjectsManager', path: '../src/components/admin/ProjectsManager', prop: 'ProjectsManager' },
    { name: 'OfficialsManager', path: '../src/components/admin/OfficialsManager', prop: 'OfficialsManager' },
    { name: 'UmkmManager', path: '../src/components/admin/UmkmManager', prop: 'UmkmManager' },
    { name: 'AttendanceSystem', path: '../src/components/admin/AttendanceSystem', prop: 'AttendanceSystem' },
    { name: 'AttendanceLogManager', path: '../src/components/admin/AttendanceLogManager', prop: 'AttendanceLogManager' },
    { name: 'ApbdesManager', path: '../src/components/admin/ApbdesManager', prop: 'ApbdesManager' },
    { name: 'LetterArchivesManager', path: '../src/components/admin/LetterArchivesManager', prop: 'LetterArchivesManager', customProps: { requests: [], onSelectRequest: () => {}, onPreviewLetter: () => {}, onSendWhatsApp: () => {} } }
  ];

  console.log('\n--- COMMENCING RUNTIME RENDER TESTS ON ALL ADMIN MODULES ---');
  let passCount = 0;
  let failCount = 0;

  for (const item of adminComponents) {
    try {
      const mod = await import(item.path);
      const Component = mod[item.prop] || mod.default;
      if (!Component) {
        throw new Error(`Component export "${item.prop}" or default not found in ${item.path}`);
      }
      const rendered = ReactDOMServer.renderToString(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(
            AppContext.Provider,
            { value: mockValue },
            React.createElement(Component, item.customProps || null)
          )
        )
      );
      console.log(`✅ [PASS] ${item.name} rendered successfully (${rendered.length} bytes)`);
      passCount++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${item.name} crashed with error:`);
      console.error(`       ${err.name}: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\nSSR TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${adminComponents.length} modules.`);
  await prisma.$disconnect();

  if (failCount > 0) {
    process.exit(1);
  }
}

runSSRTest().catch((e) => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
