import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function inventory() {
  console.log('--- DATA INVENTORY REPORT ---');
  
  // JSON Data
  const jsonDb = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'pulau_betung_db.json'), 'utf-8'));
  
  const entities = [
    { name: 'User', jsonKey: 'users', prismaModel: prisma.user },
    { name: 'VillageService', jsonKey: 'services', prismaModel: prisma.villageService },
    { name: 'ServiceRequest', jsonKey: 'serviceRequests', prismaModel: prisma.serviceRequest },
    { name: 'Complaint', jsonKey: 'complaints', prismaModel: prisma.complaint },
    { name: 'NewsItem', jsonKey: 'news', prismaModel: prisma.newsItem },
    { name: 'Announcement', jsonKey: 'announcements', prismaModel: prisma.announcement },
    { name: 'AgendaItem', jsonKey: 'agendas', prismaModel: prisma.agendaItem },
    { name: 'DevelopmentProject', jsonKey: 'developmentProjects', prismaModel: prisma.developmentProject },
    { name: 'UmkmItem', jsonKey: 'umkm', prismaModel: prisma.umkmItem },
    { name: 'VillageOfficial', jsonKey: 'officials', prismaModel: prisma.villageOfficial },
    { name: 'MapFacility', jsonKey: 'facilities', prismaModel: prisma.mapFacility },
    { name: 'Dusun', jsonKey: 'territories', prismaModel: prisma.dusun },
    { name: 'Resident', jsonKey: 'residents', prismaModel: prisma.resident },
    { name: 'BansosRecipient', jsonKey: 'bansosRecipients', prismaModel: prisma.bansosRecipient },
    { name: 'AuditLog', jsonKey: 'auditLogs', prismaModel: prisma.auditLog },
    { name: 'VillageProfile', jsonKey: 'villageProfile', prismaModel: prisma.villageProfile },
  ];

  const report = [];

  for (const entity of entities) {
    let jsonCount = 0;
    if (jsonDb[entity.jsonKey]) {
      jsonCount = Array.isArray(jsonDb[entity.jsonKey]) ? jsonDb[entity.jsonKey].length : 1;
    }
    
    let prismaCount = 0;
    try {
      prismaCount = await (entity.prismaModel as any).count();
    } catch (e) {
      prismaCount = -1; // Model might not exist or other error
    }
    
    report.push({
      Entity: entity.name,
      JSON: jsonCount,
      PostgreSQL: prismaCount,
      Difference: jsonCount - prismaCount
    });
  }

  console.table(report);
  
  // Check unique IDs and duplicates for ServiceRequest
  const jsonReqs = jsonDb.serviceRequests || [];
  const dbReqs = await prisma.serviceRequest.findMany({ select: { id: true, trackingCode: true } });
  const dbIds = new Set(dbReqs.map((r: any) => r.id));
  const dbCodes = new Set(dbReqs.map((r: any) => r.trackingCode));
  
  const onlyInJson = jsonReqs.filter((r: any) => !dbIds.has(r.id) && !dbCodes.has(r.trackingCode));
  console.log(`\nServiceRequest Unique in JSON: ${onlyInJson.length}`);
  
  await prisma.$disconnect();
}

inventory().catch(e => {
  console.error(e);
  process.exit(1);
});
