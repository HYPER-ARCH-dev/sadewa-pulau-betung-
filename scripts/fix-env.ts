import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');

// Ambil dari environment yang ada (dari UI Secrets)
const dbUrl = process.env.DATABASE_URL || '';
const directUrl = process.env.DIRECT_URL || '';

// Pastikan DATABASE_URL punya pgbouncer=true kalau pakai pooling
let fixedDbUrl = dbUrl;
if (fixedDbUrl && !fixedDbUrl.includes('pgbouncer=true')) {
    fixedDbUrl += fixedDbUrl.includes('?') ? '&pgbouncer=true' : '?pgbouncer=true';
}

const envContent = `
DATABASE_URL="${fixedDbUrl}"
DIRECT_URL="${directUrl}"
SESSION_SECRET="${process.env.SESSION_SECRET || 'PULAU_BETUNG_SADEWA_SUPER_SECRET_2026_KEY'}"
MIGRATION_PHASE="PHASE_3_SUPABASE_ONLY"
VITE_API_URL="/api"
SEED_DEFAULT_PASSWORD="Admin123!"
NODE_ENV="development"
`.trim();

fs.writeFileSync(envPath, envContent);
console.log('✅ File .env berhasil dibuat ulang dengan perbaikan PgBouncer!');
console.log('DATABASE_URL yang digunakan:', fixedDbUrl.substring(0, 20) + '...');
