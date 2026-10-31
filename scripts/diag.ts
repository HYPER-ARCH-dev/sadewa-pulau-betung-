import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log('--- DATABASE DIAGNOSTIC ---');
  console.log('DATABASE_URL defined:', !!dbUrl);
  if (dbUrl) {
    console.log('DATABASE_URL starts with:', dbUrl.substring(0, 15) + '...');
  }
  
  const prisma = new PrismaClient();
  try {
    const userCount = await prisma.user.count();
    console.log('Connection successful. User count:', userCount);
    
    const admin = await prisma.user.findFirst({ where: { username: 'superadmin' } });
    if (admin) {
      console.log('Admin user found.');
      console.log('Is Active:', admin.isActive);
      console.log('Failed Login Count:', admin.failedLoginCount);
      console.log('Lockout Until:', admin.lockoutUntil);
    } else {
      console.log('Admin user NOT FOUND!');
    }
  } catch (err: any) {
    console.error('Connection failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
