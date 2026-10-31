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

  console.log(`Setting admin password to: ${password}`);

  await prisma.user.updateMany({
    where: { username: 'superadmin' },
    data: {
      passwordHash: hash,
      salt: salt,
      mustChangePassword: true
    }
  });

  console.log('✅ Admin password updated!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
