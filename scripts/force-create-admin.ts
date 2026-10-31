import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function main() {
  // Fix for PgBouncer / Prepared Statement issue
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');
  
  const urlWithPgbouncer = dbUrl.includes('?') 
    ? `${dbUrl}&pgbouncer=true` 
    : `${dbUrl}?pgbouncer=true`;

  process.env.DATABASE_URL = urlWithPgbouncer;

  const prisma = new PrismaClient();

  try {
    const password = process.env.SEED_DEFAULT_PASSWORD || 'Admin123!';
    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    console.log('🚀 Attempting to create Super Admin...');

    await prisma.user.upsert({
      where: { email: 'admin@sadewa.desa.id' },
      update: {
        passwordHash: hash,
        salt: salt,
        isActive: true
      },
      create: {
        id: 'user-superadmin-001',
        name: 'Super Admin SADEWA',
        username: 'superadmin',
        email: 'admin@sadewa.desa.id',
        passwordHash: hash,
        salt: salt,
        role: 'super_admin',
        roleTitle: 'Administrator Utama',
        isActive: true,
        mustChangePassword: true,
        tokenVersion: 1
      }
    });

    console.log('✅ Super Admin created/updated successfully!');
    
    // Also create the village profile record so the app doesn't crash
    await prisma.villageProfile.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        villageName: 'Desa Pulau Betung',
        district: 'Pemayung',
        regency: 'Batang Hari',
        province: 'Jambi',
        postalCode: '36657',
        email: 'kontak@pulaubetung.desa.id',
        vision: 'Mewujudkan Desa Pulau Betung yang Maju, Mandiri, dan Sejahtera melalui transformasi digital.',
        mission: ['Meningkatkan pelayanan publik berbasis digital.', 'Mendorong ekonomi kreatif warga.', 'Mewujudkan tata kelola desa yang transparan.'],
        history: 'Desa Pulau Betung merupakan desa yang kaya akan potensi alam dan budaya di Kabupaten Batang Hari.',
        totalPopulation: 2500,
        totalFamilies: 750,
        areaSqKm: 12.5,
        borders: { north: 'Desa A', south: 'Desa B', east: 'Sungai Batanghari', west: 'Hutan Lindung' }
      }
    });
    console.log('✅ Village Profile initialized!');

  } catch (error) {
    console.error('❌ Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
