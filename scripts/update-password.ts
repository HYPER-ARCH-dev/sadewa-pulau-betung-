import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string) {
  // MUST match server/auth.ts scryptSync implementation
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function main() {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password || password.length < 6) {
    throw new Error('Set environment variable SEED_DEFAULT_PASSWORD (minimal 6 karakter) sebelum menjalankan script ini.');
  }
  const targetUsername = process.env.TARGET_ADMIN_USERNAME || 'superadmin';
  const salt = generateSalt();
  const hash = hashPassword(password, salt);

  console.log(`Updating password (scryptSync) for user: ${targetUsername}...`);

  const result = await prisma.user.updateMany({
    where: { username: targetUsername },
    data: {
      passwordHash: hash,
      salt: salt,
      failedLoginCount: 0,
      lockoutUntil: null,
      isActive: true,
      mustChangePassword: true,
      tokenVersion: { increment: 1 }
    }
  });

  if (result.count === 0) {
    console.warn(`⚠️ User '${targetUsername}' tidak ditemukan di database.`);
  } else {
    console.log('✅ Admin password updated cleanly with scryptSync!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
