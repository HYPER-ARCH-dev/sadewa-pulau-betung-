import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useResidents } from '../../hooks/useResidents';
import { BansosRecipient, BansosProgramType, BansosStatus } from '../../types/bansos';
import { BANSOS_PROGRAM_LIST } from '../../data/bansosData';
import {
  FileSpreadsheet,
  Upload,
  Clipboard,
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
  ArrowRight,
  RefreshCw,
  Eye,
  Check,
  HelpCircle,
  Layers,
  Zap,
  BadgeCheck
} from 'lucide-react';

interface BansosImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedCount: number, mode: 'append' | 'replace') => void;
  bulkAdd: (items: Omit<BansosRecipient, 'id' | 'createdAt'>[]) => Promise<number>;
  replaceAll: (items: Omit<BansosRecipient, 'id' | 'createdAt'>[]) => Promise<number>;
}

interface ColumnMapping {
  nik: number;
  noKk: number;
  name: number;
  gender: number;
  dusun: number;
  rt: number;
  rw: number;
  programType: number;
  nominalOrItem: number;
  status: number;
  distributionLocation: number;
}

const ALIAS_MAP: Record<keyof ColumnMapping, string[]> = {
  nik: ['nik', 'no ktp', 'nomor ktp', 'no. ktp', 'no_ktp', 'nomor induk', 'noktp', 'id kependudukan'],
  noKk: ['no kk', 'nomor kk', 'no. kk', 'no_kk', 'nokk', 'kartu keluarga', 'nomor kartu keluarga'],
  name: ['nama', 'nama lengkap', 'nama kpm', 'nama penerima', 'nama kepala keluarga', 'kepala keluarga', 'nama_kpm', 'namapenerima'],
  gender: ['gender', 'jk', 'jenis kelamin', 'l/p', 'sex', 'jns kelamin'],
  dusun: ['dusun', 'alamat', 'wilayah', 'kampung', 'lingkungan', 'alamat dusun', 'nama dusun'],
  rt: ['rt', 'no rt', 'nomor rt', 'no. rt', 'rukun tetangga'],
  rw: ['rw', 'no rw', 'nomor rw', 'no. rw', 'rukun warga'],
  programType: ['program', 'bansos', 'jenis bansos', 'bantuan', 'nama program', 'program bansos', 'jenis bantuan'],
  nominalOrItem: ['nominal', 'jumlah', 'besaran', 'dana', 'bantuan', 'barang', 'nilai'],
  status: ['status', 'keterangan', 'tahap penyaluran', 'kondisi'],
  distributionLocation: ['lokasi', 'tempat', 'lokasi penyaluran', 'tempat pengambilan']
};

export const BansosImportModal: React.FC<BansosImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  bulkAdd,
  replaceAll
}) => {
  const { bansosRecipients } = useApp();
  const { residents } = useResidents();
  const [previewTab, setPreviewTab] = useState<'all' | 'valid' | 'pending' | 'duplicate'>('all');

  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste');
  const [rawText, setRawText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  
  // Default values when column is not present
  const [defaultProgram, setDefaultProgram] = useState<BansosProgramType>('BLT_DD');
  const [defaultPeriod, setDefaultPeriod] = useState('Tahap 1 TA 2026');
  const [defaultLocation, setDefaultLocation] = useState('Aula Kantor Desa Pulau Betung');
  const [defaultStatus, setDefaultStatus] = useState<BansosStatus>('siap_diambil');

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse raw text into rows and columns
  const parsedGrid = useMemo(() => {
    if (!rawText.trim()) return [];

    const lines = rawText.trim().split(/\r\n|\n|\r/);
    const result: string[][] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      let cols: string[] = [];
      // If line contains TAB (Excel copy-paste)
      if (line.includes('\t')) {
        cols = line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
      } else if (line.includes(';')) {
        // Semicolon-separated CSV (Indonesian Excel standard)
        cols = line.split(';').map(c => c.trim().replace(/^["']|["']$/g, ''));
      } else {
        // Comma-separated CSV
        cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      }

      result.push(cols);
    }
    return result;
  }, [rawText]);

  // Headers
  const rawHeaders = useMemo(() => {
    if (parsedGrid.length === 0) return [];
    if (hasHeader) {
      return parsedGrid[0].map(h => h.trim());
    }
    return parsedGrid[0].map((_, i) => `Kolom ${i + 1}`);
  }, [parsedGrid, hasHeader]);

  // Auto column detection based on aliases
  const autoMapping = useMemo<ColumnMapping>(() => {
    const mapping: ColumnMapping = {
      nik: -1,
      noKk: -1,
      name: -1,
      gender: -1,
      dusun: -1,
      rt: -1,
      rw: -1,
      programType: -1,
      nominalOrItem: -1,
      status: -1,
      distributionLocation: -1
    };

    if (rawHeaders.length === 0) return mapping;

    rawHeaders.forEach((header, colIdx) => {
      const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

      (Object.keys(ALIAS_MAP) as (keyof ColumnMapping)[]).forEach((field) => {
        if (mapping[field] === -1) {
          // Priority 1: Exact match with alias
          const exactMatched = ALIAS_MAP[field].some(alias => cleanHeader === alias);
          if (exactMatched) {
            mapping[field] = colIdx;
            return;
          }
          
          // Priority 2: Header contains alias (but be more selective for common short words)
          const includesMatched = ALIAS_MAP[field].some(alias => {
            if (alias.length <= 2) return cleanHeader === alias; // Exact for RT, RW, JK
            return cleanHeader.includes(alias);
          });
          if (includesMatched) {
            mapping[field] = colIdx;
          }
        }
      });
    });

    return mapping;
  }, [rawHeaders]);

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(autoMapping);

  // Sync column mapping whenever autoMapping changes
  React.useEffect(() => {
    setColumnMapping(autoMapping);
  }, [autoMapping]);

  // Masking helpers
  const maskNik = (raw: string) => {
    if (!raw) return '';
    const clean = raw.replace(/\D/g, '');
    if (clean.length < 10) return clean;
    return `${clean.slice(0, 6)}******${clean.slice(-4)}`;
  };

  const maskName = (raw: string) => {
    if (!raw) return '';
    const parts = raw.split(' ');
    return parts.map(p => p.length > 2 ? `${p.slice(0, 2)}***` : p).join(' ');
  };

  // Convert parsed rows into clean BansosRecipient models
  const processedRecipients = useMemo(() => {
    if (parsedGrid.length === 0) return [];

    const dataRows = hasHeader ? parsedGrid.slice(1) : parsedGrid;

    return dataRows.map((cols) => {
      const getVal = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx].trim() : '');

      let rawNik = getVal(columnMapping.nik).replace(/['"\s.]/g, '');
      // Handle scientific notation e.g. 1.50403E+15
      if (rawNik.includes('E+') || rawNik.includes('e+')) {
        try {
          rawNik = Number(rawNik).toFixed(0);
        } catch (_) {}
      }

      let rawKk = getVal(columnMapping.noKk).replace(/['"\s.]/g, '');
      if (rawKk.includes('E+') || rawKk.includes('e+')) {
        try {
          rawKk = Number(rawKk).toFixed(0);
        } catch (_) {}
      }

      const name = getVal(columnMapping.name);
      const genderRaw = getVal(columnMapping.gender).toLowerCase();
      const gender: 'Laki-laki' | 'Perempuan' =
        genderRaw.startsWith('p') || genderRaw.includes('wanita') || genderRaw.includes('perempuan')
          ? 'Perempuan'
          : 'Laki-laki';

      const dusun = getVal(columnMapping.dusun) || 'Dusun 1';
      const rt = getVal(columnMapping.rt) || '01';
      const rw = getVal(columnMapping.rw) || '01';

      // Program detection
      const rawProg = getVal(columnMapping.programType).toUpperCase();
      let programType: BansosProgramType = defaultProgram;
      if (rawProg.includes('PKH')) programType = 'PKH';
      else if (rawProg.includes('BPNT') || rawProg.includes('SEMBAKO')) programType = 'BPNT';
      else if (rawProg.includes('BERAS') || rawProg.includes('CPP') || rawProg.includes('PANGAN')) programType = 'BERAS_CPP';
      else if (rawProg.includes('KIS') || rawProg.includes('PBI') || rawProg.includes('BPJS')) programType = 'KIS_PBI';
      else if (rawProg.includes('BLT') || rawProg.includes('DANA DESA')) programType = 'BLT_DD';

      const matchedProgram = BANSOS_PROGRAM_LIST.find(p => p.type === programType);

      // Nominal / Item
      let nominalOrItem = getVal(columnMapping.nominalOrItem);
      if (!nominalOrItem) {
        if (programType === 'BLT_DD') nominalOrItem = 'Rp 900.000 (Rp 300rb/bln)';
        else if (programType === 'BERAS_CPP') nominalOrItem = '10 Kg Beras Medium';
        else if (programType === 'BPNT') nominalOrItem = 'Rp 600.000 (Sembako)';
        else if (programType === 'PKH') nominalOrItem = 'Rp 750.000 / Tahap';
        else if (programType === 'KIS_PBI') nominalOrItem = 'Iuran BPJS Kesehatan Gratis';
        else nominalOrItem = 'Bantuan Tunai / Barang';
      }

      // Status
      const rawStat = getVal(columnMapping.status).toLowerCase();
      let status: BansosStatus = defaultStatus;
      if (rawStat.includes('salur') || rawStat.includes('terima') || rawStat.includes('selesai')) status = 'tersalurkan';
      else if (rawStat.includes('siap') || rawStat.includes('ambil') || rawStat.includes('undangan')) status = 'siap_diambil';
      else if (rawStat.includes('verif') || rawStat.includes('proses')) status = 'proses_verifikasi';
      else if (rawStat.includes('tangguh') || rawStat.includes('batal') || rawStat.includes('tolak')) status = 'ditangguhkan';

       const location = getVal(columnMapping.distributionLocation) || defaultLocation;

      const matchedResident = residents.find(r => r.nik.trim() === rawNik.trim());
      
      // Duplication check: only relevant in 'append' mode. 
      // In 'replace' mode, we don't care about existing duplicates as they will be wiped.
      const isDuplicate = importMode === 'append' && bansosRecipients.some(b => b.nik.trim() === rawNik.trim() && b.programType === programType);

      let stagingStatus: 'VALID' | 'PENDING' | 'DUPLICATE' = 'VALID';
      let validationError = '';

      if (!rawNik || rawNik.length !== 16) {
        stagingStatus = 'PENDING';
        validationError = 'Format NIK tidak valid (harus 16 digit)';
      } else if (!matchedResident) {
        stagingStatus = 'PENDING';
        validationError = 'NIK tidak terdaftar di Database Kependudukan (SSOT)';
      } else if (isDuplicate) {
        stagingStatus = 'DUPLICATE';
        validationError = 'Warga sudah terdaftar sebagai penerima program ini';
      }

      const isValid = stagingStatus === 'VALID';

      const recipient: Omit<BansosRecipient, 'id' | 'createdAt'> & { 
        isValid: boolean; 
        stagingStatus: 'VALID' | 'PENDING' | 'DUPLICATE'; 
        validationError: string;
      } = {
        nik: rawNik,
        nikMasked: maskNik(rawNik),
        noKk: rawKk || rawNik,
        noKkMasked: maskNik(rawKk || rawNik),
        name: matchedResident ? matchedResident.name : name,
        nameMasked: maskName(matchedResident ? matchedResident.name : name),
        gender: matchedResident ? (matchedResident.gender as any) : gender,
        dusun: matchedResident ? matchedResident.dusun : dusun,
        rt: matchedResident ? matchedResident.rt : rt,
        rw: matchedResident ? matchedResident.rw : rw,
        programType,
        programName: matchedProgram?.name || `Program ${programType}`,
        period: defaultPeriod,
        nominalOrItem,
        status,
        distributionDate: new Date().toISOString().split('T')[0],
        distributionTime: '08:30 - 12:00 WIB',
        distributionLocation: location,
        requirements: ['KTP Elektronik Asli', 'Kartu Keluarga (KK) Asli', 'Surat Undangan dari Ketua RT'],
        verifiedByKades: true,
        isValid,
        stagingStatus,
        validationError
      };

      return recipient;
    });
  }, [parsedGrid, hasHeader, columnMapping, defaultProgram, defaultPeriod, defaultLocation, defaultStatus, residents, bansosRecipients]);

  const validCount = processedRecipients.filter(r => r.stagingStatus === 'VALID').length;
  const pendingCount = processedRecipients.filter(r => r.stagingStatus === 'PENDING').length;
  const duplicateCount = processedRecipients.filter(r => r.stagingStatus === 'DUPLICATE').length;
  const invalidCount = pendingCount + duplicateCount;

  const displayedRecipients = useMemo(() => {
    return processedRecipients.filter(r => {
      if (previewTab === 'all') return true;
      if (previewTab === 'valid') return r.stagingStatus === 'VALID';
      if (previewTab === 'pending') return r.stagingStatus === 'PENDING';
      if (previewTab === 'duplicate') return r.stagingStatus === 'DUPLICATE';
      return true;
    });
  }, [processedRecipients, previewTab]);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      setInputMode('paste'); // switch to display the loaded data
    };
    reader.readAsText(file);
  };

  // Sample Template Downloader
  const downloadSampleTemplate = () => {
    const sampleCsv = `NIK;NO_KK;NAMA_LENGKAP;JENIS_KELAMIN;DUSUN;RT;RW;PROGRAM_BANSOS;BESARAN_BANTUAN;STATUS\n` +
      `1504011205900001;1504011205900001;Ahmad Sobri;Laki-laki;Dusun 1;01;01;BLT_DD;Rp 900.000;siap_diambil\n` +
      `1504015408930012;1504012005080002;Siti Rahma;Perempuan;Dusun 1;02;01;PKH;Rp 750.000;tersalurkan\n` +
      `1504014101680003;1504012005080003;Hasan Basri;Laki-laki;Dusun 2;04;02;BERAS_CPP;10 Kg Beras;siap_diambil\n` +
      `1504015507790018;1504012005080004;Rohani binti Saman;Perempuan;Dusun 2;04;02;BLT_DD;Rp 900.000;siap_diambil\n`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Template_Import_KPM_Bansos_Desa.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    const validItems = processedRecipients
      .filter(r => r.stagingStatus === 'VALID')
      .map(({ isValid, stagingStatus, validationError, ...rest }) => rest);
      
    if (validItems.length === 0) return;

    let count = 0;
    if (importMode === 'replace') {
      count = await replaceAll(validItems);
    } else {
      count = await bulkAdd(validItems);
    }

    onImportSuccess(count, importMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl p-5 sm:p-7 max-w-4xl w-full shadow-2xl border border-slate-200 space-y-5 my-6 max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 font-serif">
                  Import & Copas Data KPM Bansos dari Excel
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Auto-Detect Format
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Salin langsung tabel dari Excel / Google Sheets atau unggah file CSV data DTKS Kemensos & desa.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: INPUT DATA */}
        {step === 'input' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            
            {/* Input Method Selector & Template Download */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                    inputMode === 'paste'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copas dari Excel (Ctrl+V)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInputMode('upload');
                    fileInputRef.current?.click();
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                    inputMode === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Unggah File CSV / TXT</span>
                </button>
              </div>

              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center space-x-1 hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template Contoh (.csv)</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt,.tsv"
              className="hidden"
            />

            {/* Smart Paste Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tempelkan (Paste) Teks Tabel dari Excel / CSV di Bawah Ini:</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {parsedGrid.length > 0 ? `${parsedGrid.length} baris terdeteksi` : 'Mendukung format Tab/Koma/Titik-Koma'}
                </span>
              </div>

              <textarea
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Contoh salin dari Excel:&#10;NIK&#9;NO KK&#9;NAMA&#9;DUSUN&#9;RT&#9;PROGRAM&#10;1504011205900001&#9;1504011205900001&#9;Ahmad Sobri&#9;Dusun 1&#9;01&#9;BLT_DD&#10;1504015408930012&#9;1504012005080002&#9;Siti Rahma&#9;Dusun 1&#9;02&#9;PKH"
                className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:outline-none focus:bg-white resize-y"
              />
            </div>

            {/* Default Options for Missing Columns */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
              <div className="text-xs font-bold text-emerald-950 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Pengaturan Default (Jika Kolom Tertentu Tidak Tersedia di Tabel Excel):</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Program Bantuan Utama
                  </label>
                  <select
                    value={defaultProgram}
                    onChange={(e) => setDefaultProgram(e.target.value as BansosProgramType)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium"
                  >
                    {BANSOS_PROGRAM_LIST.map(p => (
                      <option key={p.type} value={p.type}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Periode Bantuan
                  </label>
                  <input
                    type="text"
                    value={defaultPeriod}
                    onChange={(e) => setDefaultPeriod(e.target.value)}
                    placeholder="Tahap 1 TA 2026"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Status Awal
                  </label>
                  <select
                    value={defaultStatus}
                    onChange={(e) => setDefaultStatus(e.target.value as BansosStatus)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium"
                  >
                    <option value="siap_diambil">Siap Diambil</option>
                    <option value="tersalurkan">Tersalurkan</option>
                    <option value="proses_verifikasi">Proses Verifikasi</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-1">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    onChange={(e) => setHasHeader(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                  />
                  <span>Baris Pertama Adalah Judul Kolom (Header)</span>
                </label>
              </div>
            </div>

          </div>
        )}

        {/* STEP 2: PREVIEW & COLUMN MAPPING */}
        {step === 'preview' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            
            {/* Summary Banner & Staging Segmented Stats */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 font-serif">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Baris</span>
                  <div className="text-lg font-black text-slate-900">{processedRecipients.length} KPM</div>
                </div>
                <div className="h-7 w-px bg-slate-200 hidden sm:block" />
                <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">VALID (Siap Impor)</span>
                  <div className="text-lg font-black text-emerald-950">{validCount} KPM</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">PENDING (NIK Baru)</span>
                  <div className="text-lg font-black text-amber-950">{pendingCount} KPM</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">DUPLIKAT (Terdaftar)</span>
                  <div className="text-lg font-black text-rose-950">{duplicateCount} KPM</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-700">Metode:</label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as 'append' | 'replace')}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="append">Tambahkan (+)</option>
                  <option value="replace">Ganti Semua (Overwrite)</option>
                </select>
              </div>
            </div>

            {/* Staging Interactive Tab Selectors */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setPreviewTab('all')}
                className={`py-2 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  previewTab === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua Data ({processedRecipients.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('valid')}
                className={`py-2 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  previewTab === 'valid'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                ✅ Valid ({validCount})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('pending')}
                className={`py-2 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  previewTab === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                ⏳ Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('duplicate')}
                className={`py-2 px-3 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  previewTab === 'duplicate'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                ⚠️ Duplikat ({duplicateCount})
              </button>
            </div>

            {/* Smart Column Mapping Selectors */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pemetaan Kolom Otomatis (Periksa kecocokan judul kolom):</span>
                </span>
                <span className="text-[11px] text-slate-400">Pilih kolom yang sesuai jika terdeteksi keliru</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom NIK *</label>
                  <select
                    value={columnMapping.nik}
                    onChange={(e) => setColumnMapping({ ...columnMapping, nik: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Tidak Ada --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom Nama KPM *</label>
                  <select
                    value={columnMapping.name}
                    onChange={(e) => setColumnMapping({ ...columnMapping, name: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Tidak Ada --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom Nomor KK</label>
                  <select
                    value={columnMapping.noKk}
                    onChange={(e) => setColumnMapping({ ...columnMapping, noKk: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Tidak Ada (Gunakan NIK) --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom Dusun</label>
                  <select
                    value={columnMapping.dusun}
                    onChange={(e) => setColumnMapping({ ...columnMapping, dusun: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Default (Dusun I) --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom RT</label>
                  <select
                    value={columnMapping.rt}
                    onChange={(e) => setColumnMapping({ ...columnMapping, rt: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Default (01) --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom RW</label>
                  <select
                    value={columnMapping.rw}
                    onChange={(e) => setColumnMapping({ ...columnMapping, rw: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Default (01) --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom Program</label>
                  <select
                    value={columnMapping.programType}
                    onChange={(e) => setColumnMapping({ ...columnMapping, programType: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Default ({defaultProgram}) --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom Lokasi Ambil</label>
                  <select
                    value={columnMapping.distributionLocation}
                    onChange={(e) => setColumnMapping({ ...columnMapping, distributionLocation: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Default --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom Besaran / Nominal</label>
                  <select
                    value={columnMapping.nominalOrItem}
                    onChange={(e) => setColumnMapping({ ...columnMapping, nominalOrItem: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Otomatis --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kolom Status</label>
                  <select
                    value={columnMapping.status}
                    onChange={(e) => setColumnMapping({ ...columnMapping, status: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs bg-slate-50 font-medium"
                  >
                    <option value={-1}>-- Default ({defaultStatus}) --</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="max-h-60 overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-100/80 sticky top-0 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">Nama & NIK</th>
                      <th className="py-2.5 px-3">No. KK</th>
                      <th className="py-2.5 px-3">Dusun & RT</th>
                      <th className="py-2.5 px-3">Program</th>
                      <th className="py-2.5 px-3">Nominal / Bantuan</th>
                      <th className="py-2.5 px-3 text-center">Status Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {displayedRecipients.slice(0, 50).map((item, idx) => (
                      <tr 
                        key={idx} 
                        className={`transition-colors ${
                          item.stagingStatus === 'VALID' 
                            ? 'hover:bg-slate-50' 
                            : item.stagingStatus === 'PENDING'
                            ? 'bg-amber-50/35 hover:bg-amber-50/50'
                            : 'bg-rose-50/35 hover:bg-rose-50/50'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{item.name || <span className="text-rose-500 font-italic">[Nama Kosong]</span>}</div>
                          <div className="text-[11px] text-slate-500 font-mono">NIK: {item.nik || '-'}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">{item.noKk || '-'}</td>
                        <td className="py-2 px-3 text-slate-700">
                          <div>{item.dusun}</div>
                          <div className="text-[10px] text-slate-400">RT {item.rt} / RW {item.rw}</div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {item.programType}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{item.nominalOrItem}</td>
                        <td className="py-2 px-3">
                          {item.stagingStatus === 'VALID' ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Valid (SSOT)</span>
                            </span>
                          ) : item.stagingStatus === 'PENDING' ? (
                            <div className="flex flex-col text-left">
                              <span className="inline-flex items-center space-x-1 text-amber-700 text-[11px] font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Pending / NIK Baru</span>
                              </span>
                              <span className="text-[9px] text-slate-500 font-medium leading-tight max-w-[200px]">
                                {item.validationError}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col text-left">
                              <span className="inline-flex items-center space-x-1 text-rose-700 text-[11px] font-bold">
                                <X className="w-3.5 h-3.5" />
                                <span>Duplikat</span>
                              </span>
                              <span className="text-[9px] text-slate-500 font-medium leading-tight max-w-[200px]">
                                {item.validationError}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {processedRecipients.length > 50 && (
                <div className="p-2 bg-slate-50 text-center text-slate-500 text-[11px] border-t border-slate-200">
                  Menampilkan 50 dari total {processedRecipients.length} data. Semua {validCount} data valid akan tetap diimpor.
                </div>
              )}
            </div>

            {pendingCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900 font-medium font-serif">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-950 block mb-0.5">⚠️ Terdeteksi {pendingCount} Data NIK Pending / Baru</strong>
                  Data NIK ini tidak ditemukan di Database Kependudukan (SSOT). Sesuai aturan arsitektur data, data ini tidak akan dimasukkan ke tabel bansos utama sebelum warga tersebut diregistrasi di panel <strong className="text-slate-900 underline">Database Kependudukan</strong>.
                </div>
              </div>
            )}

            {duplicateCount > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-950 font-medium font-serif">
                <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-rose-950 block mb-0.5">⚠️ Terdeteksi {duplicateCount} Data Penerima Duplikat</strong>
                  Sistem mendeteksi NIK tersebut sudah terdaftar pada program bansos yang sama. Data duplikat ini otomatis ditolak dan tidak akan diimpor kembali.
                </div>
              </div>
            )}

          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          {step === 'preview' ? (
            <button
              type="button"
              onClick={() => setStep('input')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Kembali ke Edit Teks
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
            >
              Batal
            </button>
          )}

          {step === 'input' ? (
            <button
              type="button"
              disabled={parsedGrid.length === 0}
              onClick={() => setStep('preview')}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              <span>Pratinjau & Sesuaikan Kolom</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={validCount === 0}
              onClick={handleExecuteImport}
              className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Simpan {validCount} Data KPM ke Sistem</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
