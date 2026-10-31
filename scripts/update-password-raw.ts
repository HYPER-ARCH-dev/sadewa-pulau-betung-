import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

async function main() {
  const password = process.env.SEED_DEFAULT_PASSWORD || 'Admin123!';
  const salt = generateSalt();
  const hash = hashPassword(password, salt);

  console.log(`Force setting admin password via RAW SQL...`);

  // Using Raw SQL to bypass prepared statement issues with PgBouncer
  await prisma.$executeRawUnsafe(`
    UPDATE "User" 
    SET "passwordHash" = '${hash}', 
        "salt" = '${salt}', 
        "mustChangePassword" = true 
    WHERE "username" = 'superadmin'
  `);

  console.log('✅ Admin password updated via RAW SQL!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
