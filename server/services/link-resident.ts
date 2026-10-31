/**
 * SADEWA DIGITAL SERVICE - Service Penghubung Relasi Warga (server/services/link-resident.ts)
 * 
 * Fungsi ini bertugas memindai record anak/balita (ToddlerRecord) yang belum terhubung
 * ke akun orang tua (parentResidentId IS NULL), kemudian mencocokkan field parentNik dengan
 * NIK resmi di tabel Resident.
 */

import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

function getPrisma() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

export interface LinkResult {
  scanned: number;
  linked: number;
  alreadyLinked: number;
  unresolvedNiks: string[];
}

/**
 * Memindai dan menghubungkan parentResidentId pada ToddlerRecord berdasarkan parentNik
 */
export async function linkResidentRelations(): Promise<LinkResult> {
  const prisma = getPrisma();
  const result: LinkResult = {
    scanned: 0,
    linked: 0,
    alreadyLinked: 0,
    unresolvedNiks: []
  };

  try {
    // 1. Ambil semua data balita
    const toddlers = await prisma.toddlerRecord.findMany({
      select: {
        id: true,
        name: true,
        parentNik: true,
        parentResidentId: true
      }
    });

    result.scanned = toddlers.length;

    // 2. Ambil semua NIK orang tua yang valid di database
    const residents = await prisma.resident.findMany({
      select: {
        id: true,
        nik: true
      }
    });

    const residentMap = new Map<string, string>();
    residents.forEach((r: { id: string; nik: string }) => residentMap.set(r.nik, r.id));

    // 3. Iterasi dan update relasi orphan
    for (const t of toddlers) {
      if (t.parentResidentId) {
        result.alreadyLinked++;
        continue;
      }

      if (t.parentNik && residentMap.has(t.parentNik)) {
        const targetResidentId = residentMap.get(t.parentNik)!;
        await prisma.toddlerRecord.update({
          where: { id: t.id },
          data: { parentResidentId: targetResidentId }
        });
        result.linked++;
      } else if (t.parentNik) {
        result.unresolvedNiks.push(`Balita ${t.name} (Parent NIK: ${t.parentNik}) tidak ditemukan di master Resident`);
      }
    }

    console.log(`🔗 [LINK-RESIDENT] Selesai: ${result.linked} balita baru terhubung ke orang tua, ${result.alreadyLinked} sudah terhubung.`);
    return result;
  } catch (error) {
    console.error('❌ [LINK-RESIDENT] Gagal menghubungkan relasi kependudukan:', error);
    throw error;
  }
}
