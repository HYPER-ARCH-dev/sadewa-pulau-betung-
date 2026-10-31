import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function main() {
  const newPassword = 'sadewa123';
  const newSalt = generateSalt();
  const newHash = hashPassword(newPassword, newSalt);

  console.log('--- Resetting Password for admin_sadewa ---');

  // 1. Update Supabase via Prisma
  try {
    const user = await prisma.user.update({
      where: { username: 'admin_sadewa' },
      data: {
        passwordHash: newHash,
        salt: newSalt
      }
    });
    console.log('✅ Successfully updated Supabase DB.');
  } catch (err) {
    console.error('❌ Failed to update Supabase DB:', err);
  }

  // 2. Update local JSON fallback
  try {
    const DB_FILE = path.join(process.cwd(), 'data', 'pulau_betung_db.json');
    if (fs.existsSync(DB_FILE)) {
      const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      const localUser = db.users.find((u: any) => u.username === 'admin_sadewa');
      if (localUser) {
        localUser.passwordHash = newHash;
        localUser.salt = newSalt;
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
        console.log('✅ Successfully updated local JSON file.');
      }
    }
  } catch (err) {
    console.error('❌ Failed to update local JSON file:', err);
  }

  console.log(`\nUser: admin_sadewa`);
  console.log(`New Password: ${newPassword}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
