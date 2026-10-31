import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany();
  console.log('--- Current Users in DB ---');
  users.forEach((u: any) => {
    console.log(`ID: ${u.id}, Username: ${u.username}, Email: ${u.email}, Role: ${u.role}`);
  });
  console.log('---------------------------');
  await prisma.$disconnect();
}
main();
