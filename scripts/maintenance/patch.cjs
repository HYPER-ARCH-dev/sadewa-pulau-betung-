const fs = require('fs');
const file = 'server/routes/admin.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  'const freshDb = seedInitialData();',
  `const freshDb = seedInitialData();
  // Keep only the first Super Admin
  freshDb.users = [freshDb.users[0]];
  // Wipe all other data
  freshDb.serviceRequests = [];
  freshDb.complaints = [];
  freshDb.news = [];
  freshDb.announcements = [];
  freshDb.agendas = [];
  freshDb.gallery = [];
  freshDb.developmentProjects = [];
  freshDb.potentials = [];
  freshDb.umkm = [];
  freshDb.officials = [];
  freshDb.facilities = [];
  freshDb.auditLogs = [];
  freshDb.territories = [];
  // Reset budget to 0
  freshDb.budget = {
    year: new Date().getFullYear(),
    income: { target: 0, realized: 0, items: [] },
    expense: { target: 0, realized: 0, items: [] }
  };
  // Reset profile to generic template
  freshDb.villageProfile = {
    name: 'Desa Pulau Betung',
    district: 'Pemayung',
    regency: 'Batang Hari',
    province: 'Jambi',
    postalCode: '36657',
    address: 'Jl. Kantor Desa No. 1, Desa Pulau Betung',
    email: 'pemdes@pulaubetung.sadewa.id',
    phone: '0821-7654-3210',
    website: 'pulaubetung.sadewa.id',
    kadesName: 'H. Sudirman',
    kadesNip: '',
    vision: 'Terwujudnya Desa yang Mandiri, Sejahtera, dan Berbudaya.',
    mission: ['Meningkatkan kualitas pelayanan publik', 'Membangun infrastruktur desa yang memadai'],
    heroBackgroundUrl: 'https://images.unsplash.com/photo-1596423735880-5f2a689b903e?w=1600&auto=format&fit=crop&q=80',
    logoUrl: '/favicon.svg',
    regencyLogoUrl: '/favicon.svg',
    kadesPhotoUrl: '',
    officialSignatureUrl: '',
    stampUrl: ''
  };`
);
fs.writeFileSync(file, code);
