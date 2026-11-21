import fs from 'fs';
import path from 'path';
import { SERVER_CONFIG } from '../config/constants';
import { getPrisma } from '../db/prisma-helpers';

async function runBackup() {
  console.log('🚀 [BACKUP] Starting automated database backup...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = SERVER_CONFIG.BACKUP_DIR;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `sadewa_backup_${timestamp}.json`);
  const prisma = getPrisma();

  const models = [
    'user', 'villageProfile', 'dusun', 'rW', 'rT', 'villageService',
    'serviceRequest', 'deletedServiceRequest', 'complaint', 'resident',
    'bansosRecipient', 'newsItem', 'announcement', 'agendaItem',
    'galleryItem', 'budgetYearData', 'developmentProject',
    'villagePotential', 'umkmItem', 'villageOfficial', 'mapFacility',
    'landParcel', 'toddlerRecord', 'toddlerMeasurement',
    'posyanduSchedule', 'auditLog', 'attendanceLog'
  ];

  const backupData: Record<string, any> = {};

  try {
    for (const model of models) {
      console.log(`📦 [BACKUP] Exporting table: ${model}...`);
      const data = await (prisma as any)[model].findMany();
      backupData[model] = data;
    }

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`✅ [BACKUP] Success! Backup saved to: ${backupFile}`);

    // Cleanup old backups (keep only last 7 days)
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
  } catch (error) {
    console.error('❌ [BACKUP] Failed:', error);
    process.exit(1);
  }
}

runBackup();
