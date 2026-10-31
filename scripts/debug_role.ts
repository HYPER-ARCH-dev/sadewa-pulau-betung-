import { PrismaClient } from '@prisma/client';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    process.env.DATABASE_URL = dbUrl.includes('?') ? `${dbUrl}&pgbouncer=true` : `${dbUrl}?pgbouncer=true`;
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { username: 'superadmin' }
    });
    if (user) {
      console.log(`Role for superadmin: [${user.role}]`);
      console.log(`Length: ${user.role.length}`);
      console.log(`Hex: ${Buffer.from(user.role).toString('hex')}`);
    } else {
      console.log('User superadmin not found');
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
