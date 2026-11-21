import fs from 'fs';
import path from 'path';
import { SERVER_CONFIG } from '../config/constants';
import { getPrisma, isDatabaseAvailableCached } from '../db/prisma-helpers';
import { getDb } from '../db/database';

export interface DatabaseBackupResult {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  mode: 'prisma' | 'json-fallback';
}

const BACKUP_MODELS = [
  'user', 'villageProfile', 'dusun', 'rW', 'rT', 'villageService',
  'serviceRequest', 'deletedServiceRequest', 'complaint', 'resident',
  'bansosRecipient', 'newsItem', 'announcement', 'agendaItem',
  'galleryItem', 'budgetYearData', 'developmentProject',
  'villagePotential', 'umkmItem', 'villageOfficial', 'mapFacility',
  'landParcel', 'toddlerRecord', 'toddlerMeasurement',
  'posyanduSchedule', 'auditLog', 'attendanceLog'
] as const;

function sanitizeBackupUsers(users: any[]): any[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) => {
    if (!u || typeof u !== 'object') return u;
    const { passwordHash: _ph, salt: _s, ...safeUser } = u;
    return safeUser;
  });
}

function cleanupOldBackups(backupDir: string): void {
  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > SEVEN_DAYS_MS) {
      fs.unlinkSync(filePath);
      console.log(`🧹 [BACKUP] Deleted old backup: ${file}`);
    }
  }
}

export async function runDatabaseBackup(): Promise<DatabaseBackupResult> {
  console.log('🚀 [BACKUP] Starting database backup...');
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, '-');
  const backupDir = SERVER_CONFIG.BACKUP_DIR;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const fileName = `sadewa_backup_${timestamp}.json`;
  const backupFile = path.join(backupDir, fileName);
  let mode: 'prisma' | 'json-fallback' = 'prisma';
  let backupPayload: Record<string, any> = {};

  if (await isDatabaseAvailableCached()) {
    const prisma = getPrisma();
    for (const model of BACKUP_MODELS) {
      const rows = await (prisma as any)[model].findMany();
      backupPayload[model] = model === 'user' ? sanitizeBackupUsers(rows) : rows;
    }
  } else {
    mode = 'json-fallback';
    const jsonDb = getDb();
    backupPayload = {
      ...jsonDb,
      users: sanitizeBackupUsers(jsonDb.users || [])
    };
  }

  const finalSnapshot = {
    meta: {
      app: 'SADEWA - Sistem Administrasi & Pelayanan Desa Pulau Betung',
      mode,
      exportedAt: createdAt
    },
    data: backupPayload
  };

  fs.writeFileSync(backupFile, JSON.stringify(finalSnapshot, null, 2), 'utf-8');
  const stats = fs.statSync(backupFile);
  cleanupOldBackups(backupDir);

  console.log(`✅ [BACKUP] Success (${mode})! Saved to: ${backupFile}`);

  return {
    fileName,
    filePath: backupFile,
    sizeBytes: stats.size,
    createdAt,
    mode
  };
}

const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('db-backup');

if (isDirectCli) {
  runDatabaseBackup().catch((error) => {
    console.error('❌ [BACKUP] Failed:', error?.message || error);
    process.exit(1);
  });
}
