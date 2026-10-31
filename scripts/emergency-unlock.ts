import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

function hashPassword(password: string, salt: string) {
  // MUST match server/auth.ts implementation
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');
  
  const urlWithPgbouncer = dbUrl.includes('?') ? `${dbUrl}&pgbouncer=true` : `${dbUrl}?pgbouncer=true`;
  process.env.DATABASE_URL = urlWithPgbouncer;
  
  const prisma = new PrismaClient();

  try {
    const password = 'Admin123!';
    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    console.log('🔓 Emergency Unlocking and Resetting Super Admin...');

    // Find the superadmin user
    const user = await prisma.user.findFirst({
      where: { 
        OR: [
          { username: 'superadmin' },
          { email: 'admin@sadewa.desa.id' }
        ]
      }
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hash,
          salt: salt,
          failedLoginCount: 0,
          lockoutUntil: null,
          isActive: true,
          mustChangePassword: false, // Set to false so they don't get stuck in a loop during debug
          tokenVersion: { increment: 1 }
        }
      });
      console.log('✅ User UNLOCKED and password set to: ' + password);
    } else {
      console.log('❌ User not found, creating new one...');
      await prisma.user.create({
        data: {
          id: 'user-superadmin-emergency',
          name: 'Super Admin Emergency',
          username: 'superadmin',
          email: 'admin@sadewa.desa.id',
          passwordHash: hash,
          salt: salt,
          role: 'super_admin',
          roleTitle: 'Administrator Utama',
          isActive: true,
          mustChangePassword: false
        }
      });
      console.log('✅ New Super Admin created with password: ' + password);
    }

  } catch (error) {
    console.error('❌ Error during emergency unlock:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
