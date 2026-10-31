// Ambient declarations for optional Prisma client
declare module '@prisma/client' {
  export class PrismaClient {
    [key: string]: any;
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    user: any;
    villageProfile: any;
    dusun: any;
    rW: any;
    rT: any;
    villageService: any;
    serviceRequest: any;
    complaint: any;
    newsItem: any;
    announcement: any;
    agendaItem: any;
    budgetYearData: any;
    developmentProject: any;
    villagePotential: any;
    umkmItem: any;
    villageOfficial: any;
    mapFacility: any;
    galleryItem: any;
    landParcel: any;
    auditLog: any;
  }
}
