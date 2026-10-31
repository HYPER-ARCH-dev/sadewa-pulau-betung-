import { PrismaClient } from '@prisma/client';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    process.env.DATABASE_URL = dbUrl.includes('?') ? `${dbUrl}&pgbouncer=true` : `${dbUrl}?pgbouncer=true`;
  }
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        tokenVersion: true,
        isActive: true,
        mustChangePassword: true
      }
    });
    console.log(JSON.stringify(users, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
