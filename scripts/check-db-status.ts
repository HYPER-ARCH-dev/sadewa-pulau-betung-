import { getPrisma } from '../server/db/prisma-helpers';

async function checkStatus() {
  const prisma = getPrisma();
  try {
    console.log('⏳ Menghubungi Supabase...');
    
    // Query untuk cek koneksi aktif di PostgreSQL
    const stats: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `);

    // Cek versi database
    const version: any[] = await prisma.$queryRawUnsafe(`SELECT version()`);

    console.log('\n=== KESEHATAN DATABASE SADEWA ===');
    console.log(`Status         : TERHUBUNG`);
    console.log(`Koneksi Aktif  : ${stats[0].active_connections}`);
    console.log(`Engine         : ${version[0].version.split(',')[0]}`);
    console.log('---------------------------------\n');

  } catch (error: any) {
    console.error('❌ GAGAL MENGHUBUNGI DATABASE:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
