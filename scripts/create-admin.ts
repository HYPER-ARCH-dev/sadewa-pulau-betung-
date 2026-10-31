import { getPrisma } from '../server/db/prisma-helpers';
import { hashPassword, generateSalt } from '../server/auth';
import minimist from 'minimist';

/**
 * Script untuk membuat atau reset password Super Admin di Supabase
 * Penggunaan: npx tsx scripts/create-admin.ts --username=admin --password=admin123 --name="Super Admin"
 */
async function main() {
  // Parsing argumen CLI
  const args = minimist(process.argv.slice(2));
  const username = args.username || args.u;
  const password = args.password || args.p;
  const name = args.name || args.n || 'Super Admin';

  if (!username || !password) {
    console.error('❌ Error: Username dan Password wajib diisi!');
    console.log('Contoh: npx tsx scripts/create-admin.ts --username=admin --password=admin123 --name="Super Admin"');
    process.exit(1);
  }

  try {
    const prisma = getPrisma();
    
    // 1. Generate Security Kredensial
    const salt = generateSalt();
    const hash = hashPassword(password, salt);
    const email = `${username.toLowerCase()}@sadewa.local`;

    console.log(`\n⏳ Sedang memproses user: ${username}...`);

    // 2. Upsert ke Supabase
    const user = await prisma.user.upsert({
      where: { username: username },
      update: {
        passwordHash: hash,
        salt: salt,
        name: name,
        isActive: true,
        role: 'super_admin',
        roleTitle: 'Super Administrator',
        updatedAt: new Date()
      },
      create: {
        username: username,
        email: email,
        name: name,
        passwordHash: hash,
        salt: salt,
        role: 'super_admin',
        roleTitle: 'Super Administrator',
        isActive: true
      }
    });

    console.log(`\n✅ BERHASIL!`);
    console.log(`-----------------------------------`);
    console.log(`User ID   : ${user.id}`);
    console.log(`Username  : ${user.username}`);
    console.log(`Email     : ${user.email}`);
    console.log(`Role      : ${user.role}`);
    console.log(`-----------------------------------`);
    console.log(`Password  : ${password} (Harap catat/simpan!)`);
    console.log(`-----------------------------------\n`);

  } catch (error: any) {
    console.error('❌ Terjadi kesalahan:', error.message);
    process.exit(1);
  }
}

main();
