import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Zap, 
  Users, 
  User, 
  Home, 
  Calendar, 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Database, 
  Loader2, 
  Briefcase, 
  GraduationCap, 
  Upload, 
  FileText, 
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useResidents } from '../../hooks/useResidents';
import { useApp } from '../../context/AppContext';
import { Resident } from '../../types/resident';
import { cleanCitizenName, cleanCitizenNik } from '../../utils/formatting';
import { 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Cell
} from 'recharts';

interface SmartStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ParsedPerson {
  nik: string;
  kk: string;
  name: string;
  gender: 'Laki-laki' | 'Perempuan';
  birthDate: string;
  birthPlace?: string;
  address?: string;
  age: number;
  ageGroup: string;
  occupation: string;
  education: string;
  religion: string;
  maritalStatus: string;
  rt: string;
  rw: string;
  hasBansos: boolean;
  hasSku: boolean;
  status: 'Hidup' | 'Meninggal' | 'Pindah';
  dusun: string;
  economicStatus: 'Penerima Bantuan' | 'UMKM Transisi' | 'Mandiri / Pengusaha' | 'Umum';
  isStuntingRisk: boolean;
}

// Helper normalisasi Pekerjaan / Mata Pencaharian Standar Desa
export const normalizeOccupation = (raw: string, hasSku?: boolean): string => {
  if (!raw || !raw.trim()) {
    return hasSku ? 'Wiraswasta / UMKM / Pedagang' : 'Belum/Tidak Bekerja';
  }
  const s = raw.trim().toLowerCase();
  if (s.includes('tani') || s.includes('kebun') || s.includes('sawit') || s.includes('karet') || s.includes('ternak') || s.includes('nelayan') || s.includes('petani')) {
    return 'Petani / Pekebun';
  }
  if (s.includes('wira') || s.includes('dagang') || s.includes('jual') || s.includes('toko') || s.includes('umkm') || s.includes('usaha') || s.includes('bisnis') || s.includes('pedagang')) {
    return 'Wiraswasta / UMKM / Pedagang';
  }
  if (s.includes('buruh') || s.includes('kuli') || s.includes('tukang') || s.includes('harian')) {
    return 'Buruh Harian Lepas';
  }
  if (s.includes('asn') || s.includes('pns') || s.includes('tni') || s.includes('polri') || s.includes('guru') || s.includes('pppk') || s.includes('perawat') || s.includes('bidan') || s.includes('dokter')) {
    return 'ASN / TNI / Polri / Guru';
  }
  if (s.includes('swasta') || s.includes('bumn') || s.includes('karyawan') || s.includes('pegawai') || s.includes('pt') || s.includes('cv')) {
    return 'Karyawan Swasta / BUMN';
  }
  if (s.includes('irt') || s.includes('rumah tangga') || s.includes('ibu rumah') || s.includes('mengurus')) {
    return 'Mengurus Rumah Tangga (IRT)';
  }
  if (s.includes('pelajar') || s.includes('mahasiswa') || s.includes('siswa') || s.includes('santri') || s.includes('kuliah')) {
    return 'Pelajar / Mahasiswa';
  }
  if (s.includes('belum') || s.includes('tidak') || s.includes('menganggur') || s.includes('non') || s.includes('-')) {
    return 'Belum/Tidak Bekerja';
  }
  if (s.includes('pensiun')) {
    return 'Pensiunan';
  }
  return raw.trim();
};

// Helper normalisasi Jenjang Pendidikan Standar Desa
export const normalizeEducation = (raw: string, age?: number): string => {
  if (!raw || !raw.trim()) {
    if (age !== undefined && age <= 6) return 'Tidak/Belum Sekolah';
    return 'SMA / SMK / MA';
  }
  const s = raw.trim().toLowerCase();
  if (s.includes('belum') || s.includes('tidak') || s.includes('balita') || s.includes('paud') || s.includes('tk')) {
    return 'Tidak/Belum Sekolah';
  }
  if (s.includes('sd') || s.includes('mi') || s.includes('dasar') || s.includes('paket a')) {
    return 'SD / Sederajat';
  }
  if (s.includes('smp') || s.includes('mts') || s.includes('pertama') || s.includes('paket b') || s.includes('sltp')) {
    return 'SMP / MTs';
  }
  if (s.includes('sma') || s.includes('smk') || s.includes('ma') || s.includes('slta') || s.includes('kejuruan') || s.includes('atas') || s.includes('aliyah') || s.includes('paket c') || s.includes('sederajat')) {
    return 'SMA / SMK / MA';
  }
  if (s.includes('d1') || s.includes('d2') || s.includes('d3') || s.includes('d4') || s.includes('diploma') || s.includes('akademi')) {
    return 'Diploma (D1-D3)';
  }
  if (s.includes('s1') || s.includes('sarjana') || s.includes('strata 1') || s.includes('sarjana muda') || s.includes('s2') || s.includes('s3') || s.includes('magister') || s.includes('doktor')) {
    return 'Diploma / Sarjana (S1-S2)';
  }
  return raw.trim();
};

export const SmartStatsModal: React.FC<SmartStatsModalProps> = ({ isOpen, onClose }) => {
  const { addToast, serviceRequests, villageProfile, territories } = useApp();
  const { addResident, residents } = useResidents();
  const [rawText, setRawText] = useState('');
  const [step, setStep] = useState<'input' | 'result'>('input');
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'DUPLICATE' | 'INVALID'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALIAS_MAP = {
    nik: ['nik', 'ktp', 'nomor induk', 'no_nik', 'no ktp'],
    kk: ['kk', 'kartu keluarga', 'nomor kk', 'no_kk', 'nokk'],
    name: ['nama', 'lengkap', 'nama warga', 'nama penduduk', 'nama lengkap'],
    gender: ['jk', 'gender', 'jenis kelamin', 'sex', 'l/p', 'kelamin'],
    birthDate: ['tgl', 'lahir', 'tanggal lahir', 'tgl_lahir', 'tgllahir', 'birth'],
    birthPlace: ['tempat lahir', 'tmp lahir', 'tmpt lahir', 'tempat_lahir'],
    occupation: ['pekerjaan', 'profesi', 'mata pencaharian', 'pencaharian', 'job', 'occupation', 'kerja', 'usaha'],
    education: ['pendidikan', 'tamatan', 'sekolah', 'tingkat pendidikan', 'ijazah', 'education', 'pendidikan terakhir', 'lulusan', 'pendidikan_terakhir'],
    religion: ['agama', 'religion', 'kepercayaan'],
    maritalStatus: ['status kawin', 'perkawinan', 'pernikahan', 'marital', 'status perkawinan', 'status_nikah'],
    address: ['alamat', 'jalan', 'domisili', 'tempat tinggal'],
    rt: ['rt', 'rukun tetangga'],
    rw: ['rw', 'rukun warga'],
    sanitasi: ['sanitasi', 'wc', 'jamban', 'toilet'],
    stunting: ['stunting', 'gizi', 'tumbuh kembang', 'risiko gizi', 'pendek'],
    status: ['status', 'kehidupan', 'kondisi', 'status_warga'],
    dusun: ['dusun', 'wilayah', 'lingkungan', 'nama dusun'],
    bansos: ['bansos', 'bantuan', 'penerima pkh', 'bpnt', 'blt', 'dtks'],
    sku: ['sku', 'usaha', 'umkm', 'dagang', 'bisnis', 'surat usaha']
  };

  const parseNik = (nik: string) => {
    if (!nik || nik.length < 12) return null;
    const clean = nik.replace(/\D/g, '');
    if (clean.length !== 16) return null;

    let day = parseInt(clean.substring(6, 8));
    const month = parseInt(clean.substring(8, 10));
    let year = parseInt(clean.substring(10, 12));

    const gender: 'Laki-laki' | 'Perempuan' = day > 40 ? 'Perempuan' : 'Laki-laki';
    if (day > 40) day -= 40;

    const currentYearShort = new Date().getFullYear() % 100;
    const fullYear = year > currentYearShort ? 1900 + year : 2000 + year;

    try {
      const date = new Date(fullYear, month - 1, day);
      if (isNaN(date.getTime())) return null;
      return { gender, birthDate: date.toISOString().split('T')[0] };
    } catch {
      return null;
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getAgeGroup = (age: number) => {
    if (age <= 5) return 'Balita (0-5)';
    if (age <= 12) return 'Anak (6-12)';
    if (age <= 17) return 'Remaja (13-17)';
    if (age <= 25) return 'Pemuda (18-25)';
    if (age <= 45) return 'Dewasa (26-45)';
    if (age <= 60) return 'Lansia Awal (46-60)';
    return 'Lansia (60+)';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        addToast('success', 'File Dimuat', `Berkas ${file.name} berhasil dibaca. Silakan tinjau data.`);
      }
    };
    reader.readAsText(file);
  };

  const processedData = useMemo(() => {
    if (!rawText.trim()) return [];

    const lines = rawText.trim().split(/\r\n|\n|\r/);
    const grid: string[][] = lines.map(line => {
      if (line.includes('\t')) return line.split('\t').map(c => c.trim());
      if (line.includes(';')) return line.split(';').map(c => c.trim());
      return line.split(',').map(c => c.trim());
    }).filter(row => row.length > 1);

    if (grid.length === 0) return [];

    // Detect headers
    const headers = grid[0].map(h => h.toLowerCase());
    const findIdx = (aliases: string[]) => headers.findIndex(h => aliases.some(a => h.includes(a)));

    const mapping = {
      nik: findIdx(ALIAS_MAP.nik),
      kk: findIdx(ALIAS_MAP.kk),
      name: findIdx(ALIAS_MAP.name),
      gender: findIdx(ALIAS_MAP.gender),
      birthDate: findIdx(ALIAS_MAP.birthDate),
      birthPlace: findIdx(ALIAS_MAP.birthPlace),
      occupation: findIdx(ALIAS_MAP.occupation),
      education: findIdx(ALIAS_MAP.education),
      religion: findIdx(ALIAS_MAP.religion),
      maritalStatus: findIdx(ALIAS_MAP.maritalStatus),
      address: findIdx(ALIAS_MAP.address),
      rt: findIdx(ALIAS_MAP.rt),
      rw: findIdx(ALIAS_MAP.rw),
      status: findIdx(ALIAS_MAP.status),
      stunting: findIdx(ALIAS_MAP.stunting),
      dusun: findIdx(ALIAS_MAP.dusun),
      bansos: findIdx(ALIAS_MAP.bansos),
      sku: findIdx(ALIAS_MAP.sku)
    };

    const dataRows = grid.slice(1);
    const results: ParsedPerson[] = [];

    dataRows.forEach(row => {
      const get = (idx: number) => idx >= 0 && idx < row.length ? row[idx] : '';
      const rawNik = get(mapping.nik).replace(/['"]/g, '');
      const nik = cleanCitizenNik(rawNik);
      if (!nik && !get(mapping.name)) return; // Skip empty rows

      const rawKk = get(mapping.kk).replace(/['"]/g, '') || nik;
      const kk = cleanCitizenNik(rawKk) || nik;
      const rawName = get(mapping.name);
      const name = cleanCitizenName(rawName) || 'Warga';

      const nikInfo = parseNik(nik);
      
      let gender: 'Laki-laki' | 'Perempuan' = nikInfo?.gender || 'Laki-laki';
      const rawG = get(mapping.gender).toLowerCase();
      if (rawG.startsWith('p') || rawG.includes('wanita') || rawG.includes('perempuan') || rawG === 'f') gender = 'Perempuan';
      if (rawG.startsWith('l') || rawG.includes('pria') || rawG.includes('laki') || rawG === 'm') gender = 'Laki-laki';

      let birthDate = nikInfo?.birthDate || '1990-01-01';
      const rawB = get(mapping.birthDate);
      if (rawB && rawB.length > 5) {
        try {
          const d = new Date(rawB);
          if (!isNaN(d.getTime())) birthDate = d.toISOString().split('T')[0];
        } catch {}
      }

      const birthPlace = get(mapping.birthPlace) || 'Pulau Betung';
      const address = get(mapping.address) || 'Desa Pulau Betung';
      const rt = get(mapping.rt) || '01';
      const rw = get(mapping.rw) || '01';
      const religion = get(mapping.religion) || 'Islam';

      const age = calculateAge(birthDate);

      // Status Extraction
      const rawStatus = get(mapping.status).toLowerCase();
      let status: ParsedPerson['status'] = 'Hidup';
      if (rawStatus.includes('mati') || rawStatus.includes('meninggal')) status = 'Meninggal';
      if (rawStatus.includes('pindah') || rawStatus.includes('keluar')) status = 'Pindah';

      // Health / Stunting Extraction
      const rawStunting = get(mapping.stunting).toLowerCase();
      const isStuntingRisk = age <= 5 && !!(rawStunting && rawStunting !== '-' && !rawStunting.includes('normal') && !rawStunting.includes('sehat'));

      // Dusun Extraction
      let dusun = get(mapping.dusun) || 'Dusun I Betung Jaya';
      if (dusun.includes('1') || dusun.includes('I') || dusun.toLowerCase().includes('jaya')) dusun = 'Dusun I Betung Jaya';
      else if (dusun.includes('2') || dusun.includes('II') || dusun.toLowerCase().includes('subur')) dusun = 'Dusun II Pulau Subur';
      else if (dusun.includes('3') || dusun.includes('III') || dusun.toLowerCase().includes('makmur')) dusun = 'Dusun III Betung Makmur';

      // Economic Graduation Logic
      const bansosVal = get(mapping.bansos).toLowerCase();
      const skuVal = get(mapping.sku).toLowerCase();
      
      const hasBansos = !!(bansosVal && bansosVal !== '-' && bansosVal !== '0' && !bansosVal.includes('tidak') && bansosVal.trim() !== '');
      const hasSku = !!(skuVal && skuVal !== '-' && skuVal !== '0' && !skuVal.includes('tidak') && skuVal.trim() !== '');

      let economicStatus: ParsedPerson['economicStatus'] = 'Umum';
      if (hasBansos && hasSku) economicStatus = 'UMKM Transisi';
      else if (hasBansos) economicStatus = 'Penerima Bantuan';
      else if (hasSku) economicStatus = 'Mandiri / Pengusaha';

      // Occupation & Education Normalization
      const rawOcc = get(mapping.occupation);
      const occupation = normalizeOccupation(rawOcc, hasSku);

      const rawEdu = get(mapping.education);
      const education = normalizeEducation(rawEdu, age);

      const rawMarital = get(mapping.maritalStatus);
      const maritalStatus = rawMarital ? rawMarital : (age > 21 ? 'Kawin' : 'Belum Kawin');

      results.push({
        nik,
        kk,
        name,
        gender,
        birthDate,
        birthPlace,
        address,
        rt,
        rw,
        religion,
        maritalStatus,
        occupation,
        education,
        age,
        ageGroup: getAgeGroup(age),
        hasBansos,
        hasSku,
        status,
        dusun,
        economicStatus,
        isStuntingRisk
      });
    });

    return results;
  }, [rawText]);

  // Enhanced Staging Data with Validation
  const stagingData = useMemo(() => {
    return processedData.map(p => {
      const isDuplicateInDb = residents.some(r => r.nik === p.nik);
      const isInvalidNik = !p.nik || p.nik.length !== 16;
      const isInvalidKk = !p.kk || p.kk.length !== 16;
      const isInvalidName = !p.name || p.name === 'Warga';
      
      let status: 'VALID' | 'DUPLICATE' | 'INVALID' = 'VALID';
      let error: string | null = null;

      if (isInvalidNik) {
        status = 'INVALID';
        error = 'NIK tidak valid (harus 16 digit)';
      } else if (isInvalidKk) {
        status = 'INVALID';
        error = 'No. KK tidak valid (harus 16 digit)';
      } else if (isInvalidName) {
        status = 'INVALID';
        error = 'Nama tidak valid';
      } else if (isDuplicateInDb) {
        status = 'DUPLICATE';
        error = 'NIK sudah terdaftar di database (akan diupdate)';
      }

      return { ...p, stagingStatus: status, stagingError: error };
    });
  }, [processedData, residents]);

  const filteredStagingData = useMemo(() => {
    if (filterMode === 'ALL') return stagingData;
    return stagingData.filter(d => d.stagingStatus === filterMode);
  }, [stagingData, filterMode]);

  // Statistics Calculation
  const stats = useMemo(() => {
    if (processedData.length === 0) return null;

    const total = processedData.length;
    const males = processedData.filter(p => p.gender === 'Laki-laki').length;
    const females = processedData.filter(p => p.gender === 'Perempuan').length;

    const ageGroups: Record<string, number> = {};
    const ecoStats: Record<string, number> = {};
    const occStats: Record<string, number> = {};
    const eduStats: Record<string, number> = {};
    
    processedData.forEach(p => {
      ageGroups[p.ageGroup] = (ageGroups[p.ageGroup] || 0) + 1;
      ecoStats[p.economicStatus] = (ecoStats[p.economicStatus] || 0) + 1;
      occStats[p.occupation] = (occStats[p.occupation] || 0) + 1;
      eduStats[p.education] = (eduStats[p.education] || 0) + 1;
    });

    const families = new Set(processedData.map(p => p.kk)).size;
    const potentialGraduates = processedData.filter(p => p.hasBansos && p.hasSku).length;

    // Top Occupations
    const sortedOcc = Object.entries(occStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Top Education
    const sortedEdu = Object.entries(eduStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      total,
      males,
      females,
      families,
      potentialGraduates,
      ageGroupData: Object.entries(ageGroups).map(([name, value]) => ({ name, value })),
      occData: sortedOcc,
      eduData: sortedEdu,
      genderData: [
        { name: 'Laki-laki', value: males, color: '#0ea5e9' },
        { name: 'Perempuan', value: females, color: '#ec4899' }
      ],
      ecoData: Object.entries(ecoStats).map(([name, value]) => ({ 
        name, 
        value,
        color: name === 'UMKM Transisi' ? '#f59e0b' : 
               name === 'Penerima Bantuan' ? '#ef4444' :
               name === 'Mandiri / Pengusaha' ? '#10b981' : '#94a3b8'
      }))
    };
  }, [processedData]);

  const handleSyncToDatabase = async () => {
    const validData = stagingData.filter(d => d.stagingStatus !== 'INVALID');
    if (validData.length === 0) {
      addToast('error', 'Gagal', 'Tidak ada data valid yang dapat disinkronkan.');
      return;
    }
    
    setIsSyncing(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      let updateCount = 0;
      let newCount = 0;

      for (const p of validData) {
        const cleanNik = p.nik.toString().replace(/\s/g, '');
        const cleanKk = p.kk ? p.kk.toString().replace(/\s/g, '') : '';

        const isUpdate = p.stagingStatus === 'DUPLICATE';
        const hasHistory = serviceRequests.some(req => req.citizenNik === cleanNik);

        const matchedDusun = territories?.find(t => 
          t.name.toLowerCase().includes((p.dusun || '').toLowerCase()) ||
          (p.dusun || '').toLowerCase().includes(t.name.toLowerCase())
        ) || territories?.[0];

        const residentData: Resident = {
          nik: cleanNik,
          kk: cleanKk,
          kkNumber: cleanKk,
          name: p.name.toUpperCase(),
          gender: p.gender || 'Laki-laki',
          birthDate: p.birthDate || '1990-01-01',
          birthPlace: p.birthPlace || 'Pulau Betung',
          address: p.address || p.dusun || 'Desa Pulau Betung',
          dusun: matchedDusun?.name || p.dusun || 'Dusun Betung Indah',
          dusunId: matchedDusun?.id || undefined,
          rt: p.rt || '01', 
          rw: p.rw || '01', 
          religion: p.religion || 'Islam', 
          maritalStatus: p.maritalStatus || (p.age > 20 ? 'Kawin' : 'Belum Kawin'),
          occupation: p.occupation || 'Petani / Pekebun',
          education: p.education || 'SMA / SMK / MA',
          status: p.status || 'Hidup',
          hasBansos: p.hasBansos,
          hasSku: p.hasSku,
          isStuntingRisk: p.isStuntingRisk,
          hasLetterHistory: hasHistory,
          economicStatus: p.economicStatus,
          updatedAt: new Date().toISOString()
        };
        
        try {
          await addResident(residentData);
          successCount++;
          if (isUpdate) updateCount++;
          else newCount++;
        } catch (err) {
          console.error(`[SYSTEM SYNC] Gagal ${cleanNik}:`, err);
          errorCount++;
        }
      }
      
      if (errorCount > 0 && successCount > 0) {
        addToast('warning', 'Sinkronisasi Parsial', `${successCount} data berhasil disinkronkan, ${errorCount} data gagal.`);
      } else if (successCount > 0) {
        addToast('success', 'Sinkronisasi Berhasil', `Total ${successCount} data kependudukan berhasil disinkronkan (${newCount} data baru, ${updateCount} data diperbarui).`);
      } else {
        addToast('error', 'Sinkronisasi Gagal', `Seluruh data (${errorCount} baris) gagal disimpan.`);
      }
      
      setStep('input');
      setRawText('');
      onClose();
    } catch (err) {
      console.error('[SYSTEM SYNC] Fatal Error:', err);
      addToast('error', 'Sinkronisasi Gagal', 'Terjadi kesalahan sistem saat menghubungi database.');
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadSampleCSV = () => {
    const headers = [
      'NIK', 'No_KK', 'Nama_Lengkap', 'Jenis_Kelamin', 'Tanggal_Lahir', 'Tempat_Lahir', 
      'Dusun', 'RT', 'RW', 'Agama', 'Status_Perkawinan', 'Pekerjaan', 'Pendidikan_Terakhir', 
      'Status_Warga', 'Bansos', 'SKU'
    ];
    const sampleRows = [
      ['1504011205900001', '1504011205900001', 'AHMAD SOBRI', 'Laki-laki', '1990-05-12', 'Pulau Betung', 'Dusun I Betung Jaya', '01', '01', 'Islam', 'Kawin', 'Petani / Pekebun', 'SMA / SMK / MA', 'Hidup', 'Ya', 'Tidak'],
      ['1504015508920002', '1504011205900001', 'SITI NURHALIZA', 'Perempuan', '1992-08-15', 'Pulau Betung', 'Dusun I Betung Jaya', '01', '01', 'Islam', 'Kawin', 'Wiraswasta / UMKM / Pedagang', 'Diploma / Sarjana (S1-S2)', 'Hidup', 'Tidak', 'Ya'],
      ['1504011003180003', '1504011205900001', 'M. FAIZ AL-FARIZI', 'Laki-laki', '2018-03-10', 'Pulau Betung', 'Dusun I Betung Jaya', '01', '01', 'Islam', 'Belum Kawin', 'Pelajar / Mahasiswa', 'SD / Sederajat', 'Hidup', 'Tidak', 'Tidak']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...sampleRows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Template_Import_Kependudukan_SADEWA.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCSV = () => {
    if (!stats) return;
    const headers = ['Kategori', 'Sub-Kategori', 'Jumlah', 'Satuan'];
    const rows = [
      ['Kependudukan', 'Total Penduduk', stats.total, 'Jiwa'],
      ['Kependudukan', 'Laki-laki', stats.males, 'Jiwa'],
      ['Kependudukan', 'Perempuan', stats.females, 'Jiwa'],
      ['Keluarga', 'Total KK', stats.families, 'KK'],
      ...stats.occData.map(o => ['Mata Pencaharian', o.name, o.value, 'Jiwa']),
      ...stats.eduData.map(e => ['Jenjang Pendidikan', e.name, e.value, 'Jiwa']),
      ...stats.ageGroupData.map(a => ['Distribusi Usia', a.name, a.value, 'Jiwa'])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Sensus_360_${villageProfile.villageName || 'Desa'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" 
      />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 px-6 py-4 flex items-center justify-between border-b border-emerald-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-base tracking-tight font-serif flex items-center gap-2">
                <span>SADEWA 360 Smart Sensus & Import Engine</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase">v2.4 Auto-Demografi</span>
              </h3>
              <p className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider">
                Ekstraksi Cerdas NIK, KK, Mata Pencaharian, Pendidikan, & Kesejahteraan Desa
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="wait">
            {step === 'input' ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Information Banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white text-emerald-700 shadow-xs border border-emerald-100 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                      Mesin Deteksi Otomatis Seluruh Variabel Kependudukan
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Sistem otomatis memetakan header tabel dari Excel/Sheets/CSV. Mencakup <strong>NIK, KK, Nama, Usia, Mata Pencaharian/Profesi, Tingkat Pendidikan, Dusun, RT/RW, Status Bansos, & Usaha/SKU</strong> secara instan.
                    </p>
                  </div>
                </div>

                {/* Import Action Cards: File Upload & Copy Paste */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-5 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 transition-all cursor-pointer text-center space-y-2 group"
                  >
                    <input 
                      ref={fileInputRef} 
                      type="file" 
                      accept=".csv, .txt, .tsv" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-sm">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">Unggah Berkas Spreadsheet (.CSV / .TXT)</div>
                    <div className="text-[10px] text-slate-500">Klik untuk memilih file hasil ekspor Excel atau SIAK desa</div>
                  </div>

                  <div 
                    onClick={downloadSampleCSV}
                    className="p-5 rounded-2xl border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50/40 transition-all cursor-pointer text-center space-y-2 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-sm">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">Unduh Format Template CSV Standar</div>
                    <div className="text-[10px] text-slate-500">Dapatkan contoh susunan kolom lengkap dengan Pekerjaan & Pendidikan</div>
                  </div>
                </div>

                {/* Paste Text Area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>Atau Salin & Tempelkan (Paste) Teks Tabel di Bawah:</span>
                    </span>
                    <span className="text-[10px] text-slate-400 lowercase italic font-normal">Mendukung delimiter Tab, Koma, atau Titik-Koma</span>
                  </div>
                  <textarea
                    className="w-full h-56 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none shadow-inner"
                    placeholder="NIK	No_KK	Nama_Lengkap	Jenis_Kelamin	Tgl_Lahir	Pekerjaan	Pendidikan	Dusun...&#10;1504011205900001	1504011205900001	AHMAD SOBRI	Laki-laki	1990-05-12	Petani / Pekebun	SMA / SMK / MA	Dusun I Betung Jaya"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] text-slate-500 font-medium">
                    {rawText.trim() ? `${rawText.trim().split(/\r\n|\n|\r/).length - 1} baris data terdeteksi` : 'Siap memproses data'}
                  </div>
                  <button
                    disabled={!rawText.trim()}
                    onClick={() => setStep('result')}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Analisis & Pratinjau Ekstraksi</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 pb-2"
              >
                {/* Back Button */}
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setStep('input')}
                    className="text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Ubah / Tempel Ulang Data</span>
                  </button>

                  <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                    {processedData.length} Warga Terdeteksi Siap Disinkronkan
                  </div>
                </div>

                {stats && (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <SummaryCard label="Total Penduduk" value={stats.total} icon={<Users className="w-4 h-4" />} color="emerald" />
                      <SummaryCard label="Laki-laki" value={stats.males} icon={<User className="w-4 h-4" />} color="sky" />
                      <SummaryCard label="Perempuan" value={stats.females} icon={<User className="w-4 h-4" />} color="pink" />
                      <SummaryCard label="Total Kepala Keluarga" value={stats.families} icon={<Home className="w-4 h-4" />} color="amber" />
                    </div>

                    {/* Chart Grid: Mata Pencaharian & Pendidikan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Occupation Chart */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-emerald-600" />
                          <span>Distribusi Mata Pencaharian / Profesi</span>
                        </h4>
                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.occData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                              <XAxis type="number" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                              <YAxis dataKey="name" type="category" tick={{fontSize: 9, fontWeight: 'bold'}} axisLine={false} tickLine={false} width={120} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Education Chart */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-blue-600" />
                          <span>Tingkat Pendidikan Terakhir</span>
                        </h4>
                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.eduData} margin={{ left: -10, right: 10, top: 5, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{fontSize: 8}} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                              <YAxis tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#0284c7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Table Preview (Staging Area) */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                            STAGING AREA: HASIL ANALISIS ({stagingData.length} WARGA)
                          </h4>
                          
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => setFilterMode('ALL')}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${filterMode === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                            >
                              SEMUA ({stagingData.length})
                            </button>
                            <button 
                              onClick={() => setFilterMode('VALID')}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${filterMode === 'VALID' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                            >
                              VALID ({stagingData.filter(d => d.stagingStatus === 'VALID').length})
                            </button>
                            <button 
                              onClick={() => setFilterMode('DUPLICATE')}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${filterMode === 'DUPLICATE' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                            >
                              DUPLIKAT ({stagingData.filter(d => d.stagingStatus === 'DUPLICATE').length})
                            </button>
                            <button 
                              onClick={() => setFilterMode('INVALID')}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${filterMode === 'INVALID' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                            >
                              INVALID ({stagingData.filter(d => d.stagingStatus === 'INVALID').length})
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={exportCSV}
                          className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-600 transition-all cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ekspor CSV</span>
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-72">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5">Status Audit</th>
                              <th className="px-4 py-2.5">Warga (NIK / KK)</th>
                              <th className="px-4 py-2.5">Wilayah</th>
                              <th className="px-4 py-2.5">Mata Pencaharian</th>
                              <th className="px-4 py-2.5">Profil Sosial</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredStagingData.map((p, i) => (
                              <tr key={i} className={`hover:bg-slate-50 transition-colors ${p.stagingStatus === 'INVALID' ? 'bg-rose-50/30' : p.stagingStatus === 'DUPLICATE' ? 'bg-amber-50/20' : ''}`}>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block text-center ${
                                      p.stagingStatus === 'VALID' ? 'bg-emerald-100 text-emerald-700' :
                                      p.stagingStatus === 'DUPLICATE' ? 'bg-amber-100 text-amber-700' :
                                      'bg-rose-100 text-rose-700'
                                    }`}>
                                      {p.stagingStatus}
                                    </span>
                                    {p.stagingError && (
                                      <span className="text-[9px] text-rose-500 font-bold italic leading-tight">{p.stagingError}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="font-bold text-slate-900">{p.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    NIK: {p.nik} • {p.gender === 'Laki-laki' ? 'L' : 'P'}, {p.age} Thn
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="text-xs text-slate-700">{p.dusun}</div>
                                  <div className="text-[10px] text-slate-400">RT {p.rt} / RW {p.rw}</div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {p.occupation}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-wrap gap-1">
                                    {p.economicStatus !== 'Umum' && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        {p.economicStatus}
                                      </span>
                                    )}
                                    {p.hasBansos && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                        Bansos
                                      </span>
                                    )}
                                    {p.hasSku && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        SKU
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Parsing NIK & KK 16 Digit</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Normalisasi Profesi & Ijazah</span>
          </div>
          {step === 'result' && (
            <div className="flex items-center gap-3">
              <button
                disabled={isSyncing}
                onClick={handleSyncToDatabase}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:bg-slate-300"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sinkronisasi ke Database...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>SINKRONKAN KE DATABASE MASTER ({processedData.length} WARGA)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const SummaryCard = ({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200'
  }[color as 'emerald' | 'sky' | 'pink' | 'amber'] || 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1">
      <div className={`w-7 h-7 rounded-lg ${colors} border flex items-center justify-center`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <h5 className="text-lg font-black text-slate-900">{value.toLocaleString('id-ID')}</h5>
    </div>
  );
};
