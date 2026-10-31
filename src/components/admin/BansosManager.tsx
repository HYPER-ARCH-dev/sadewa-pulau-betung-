import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useResidents } from '../../hooks/useResidents';
import { BansosRecipient, BansosProgramType, BansosStatus, BansosComplaint } from '../../types/bansos';
import { BANSOS_PROGRAM_LIST } from '../../data/bansosData';
import { BansosImportModal } from './BansosImportModal';
import { BansosReceiptModal } from '../public/BansosReceiptModal';
import { BansosBatchPrintModal } from './BansosBatchPrintModal';
import { KpmTable } from '../KpmTable';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Printer,
  Grid,
  CheckSquare,
  Square,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  Users,
  Coins,
  Package,
  Building2,
  MapPin,
  FileText,
  FileSpreadsheet,
  Eye,
  Check,
  X,
  Calendar,
  AlertTriangle,
  Upload
} from 'lucide-react';

export const BansosManager: React.FC = () => {
  const {
    bansosRecipients,
    bansosComplaints,
    addBansosRecipient,
    bulkAddBansosRecipients,
    replaceBansosRecipients,
    updateBansosRecipient,
    deleteBansosRecipient,
    updateBansosComplaintStatus,
    territories,
    villageProfile,
    addToast
  } = useApp();

  const { residents } = useResidents();
  const [nikSearch, setNikSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<'kpm_list' | 'usulan_sanggahan'>('kpm_list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedDusun, setSelectedDusun] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal State for Excel/CSV Import
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedPrintRecipient, setSelectedPrintRecipient] = useState<BansosRecipient | null>(null);

  // Multi-Selection State for Batch Operations
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);

  const [formData, setFormData] = useState<Omit<BansosRecipient, 'id' | 'createdAt'>>({
    nik: '',
    nikMasked: '',
    noKk: '',
    noKkMasked: '',
    name: '',
    nameMasked: '',
    gender: 'Laki-laki',
    dusun: 'Dusun 1',
    rt: '01',
    rw: '01',
    programType: 'BLT_DD',
    programName: 'BLT Dana Desa (BLT-DD) TA 2026',
    period: 'Tahap 1 (Januari - Maret 2026)',
    nominalOrItem: 'Rp 900.000 (Rp 300rb/bln)',
    status: 'siap_diambil',
    distributionDate: '2026-03-25',
    distributionTime: '08:30 - 12:00 WIB',
    distributionLocation: 'Aula Utama Kantor Desa Pulau Betung',
    requirements: ['KTP Elektronik Asli', 'Kartu Keluarga (KK) Asli', 'Surat Undangan dari Ketua RT'],
    keterangan: '',
    verifiedByKades: true
  });

  // Filtered List
  const filteredRecipients = useMemo(() => {
    return bansosRecipients.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        item.nik.includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.noKk.includes(q);

      const matchProgram = selectedProgram === 'all' || item.programType === selectedProgram;
      const matchDusun = selectedDusun === 'all' || item.dusun.toLowerCase().includes(selectedDusun.toLowerCase());
      const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;

      return matchQuery && matchProgram && matchDusun && matchStatus;
    });
  }, [bansosRecipients, searchQuery, selectedProgram, selectedDusun, selectedStatus]);

  // Quick Stats
  const stats = useMemo(() => {
    const total = bansosRecipients.length;
    const blt = bansosRecipients.filter(r => r.programType === 'BLT_DD').length;
    const pkh = bansosRecipients.filter(r => r.programType === 'PKH').length;
    const bpnt = bansosRecipients.filter(r => r.programType === 'BPNT').length;
    const beras = bansosRecipients.filter(r => r.programType === 'BERAS_CPP').length;
    const kis = bansosRecipients.filter(r => r.programType === 'KIS_PBI').length;
    return { total, blt, pkh, bpnt, beras, kis };
  }, [bansosRecipients]);

  const maskNik = (raw: string) => {
    if (raw.length < 10) return raw;
    return `${raw.slice(0, 6)}******${raw.slice(-4)}`;
  };

  const maskName = (raw: string) => {
    const parts = raw.split(' ');
    return parts.map(p => p.length > 2 ? `${p.slice(0, 2)}***` : p).join(' ');
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setNikSearch('');
    setSelectedResident(null);
    setFormData({
      nik: '',
      nikMasked: '',
      noKk: '',
      noKkMasked: '',
      name: '',
      nameMasked: '',
      gender: 'Laki-laki',
      dusun: 'Dusun 1',
      rt: '01',
      rw: '01',
      programType: 'BLT_DD',
      programName: 'BLT Dana Desa (BLT-DD) TA 2026',
      period: 'Tahap 1 (Januari - Maret 2026)',
      nominalOrItem: 'Rp 900.000 (Rp 300rb/bln)',
      status: 'siap_diambil',
      distributionDate: '2026-03-25',
      distributionTime: '08:30 - 12:00 WIB',
      distributionLocation: 'Aula Utama Kantor Desa Pulau Betung',
      requirements: ['KTP Elektronik Asli', 'Kartu Keluarga (KK) Asli', 'Surat Undangan dari Ketua RT'],
      keterangan: '',
      verifiedByKades: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (recipient: BansosRecipient) => {
    setEditingId(recipient.id);
    setNikSearch(recipient.nik);
    const matchedRes = residents.find(r => r.nik === recipient.nik);
    setSelectedResident(matchedRes || null);
    setFormData({
      nik: recipient.nik,
      nikMasked: recipient.nikMasked,
      noKk: recipient.noKk,
      noKkMasked: recipient.noKkMasked,
      name: recipient.name,
      nameMasked: recipient.nameMasked,
      gender: recipient.gender,
      dusun: recipient.dusun,
      rt: recipient.rt,
      rw: recipient.rw || '01',
      programType: recipient.programType,
      programName: recipient.programName,
      period: recipient.period,
      nominalOrItem: recipient.nominalOrItem,
      status: recipient.status,
      distributionDate: recipient.distributionDate || '',
      distributionTime: recipient.distributionTime || '',
      distributionLocation: recipient.distributionLocation || '',
      requirements: recipient.requirements || [],
      keterangan: recipient.keterangan || '',
      verifiedByKades: recipient.verifiedByKades ?? true
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nik) {
      addToast('error', 'Data Belum Lengkap', 'Nama penerima dan NIK wajib diisi.');
      return;
    }

    // Validasi SSOT: Cegah pendaftaran KPM berstatus Meninggal
    if (selectedResident && (selectedResident.status || '').toLowerCase() === 'meninggal') {
      addToast('error', 'Validasi BIP Gagal', `Warga atas nama ${selectedResident.name} tercatat berstatus MENINGGAL di Buku Induk Penduduk dan tidak dapat didaftarkan sebagai KPM aktif.`);
      return;
    }

    const payload = {
      ...formData,
      nikMasked: formData.nikMasked || maskNik(formData.nik),
      noKkMasked: formData.noKkMasked || maskNik(formData.noKk),
      nameMasked: formData.nameMasked || maskName(formData.name)
    };

    if (editingId) {
      updateBansosRecipient(editingId, payload);
      addToast('success', 'Data KPM Diperbarui', `Data penerima ${formData.name} berhasil disimpan.`);
    } else {
      addBansosRecipient(payload);
      addToast('success', 'KPM Baru Ditambahkan', `Penerima ${formData.name} berhasil didaftarkan ke daftar bansos.`);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data KPM ${name}?`)) {
      deleteBansosRecipient(id);
      addToast('info', 'Data KPM Dihapus', `Data ${name} berhasil dihapus dari sistem.`);
    }
  };

  const handleQuickStatusChange = (id: string, newStatus: BansosStatus) => {
    updateBansosRecipient(id, { status: newStatus });
    addToast('success', 'Status Diperbarui', `Status penyaluran berhasil diubah.`);
  };

  const isAllFilteredSelected = filteredRecipients.length > 0 && filteredRecipients.every(r => selectedRowIds.includes(r.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredRecipients.map(r => r.id));
      setSelectedRowIds(prev => prev.filter(id => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedRowIds, ...filteredRecipients.map(r => r.id)]);
      setSelectedRowIds(Array.from(newIds));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchStatusChange = (newStatus: BansosStatus) => {
    if (selectedRowIds.length === 0) return;
    selectedRowIds.forEach(id => updateBansosRecipient(id, { status: newStatus }));
    addToast('success', 'Status Massal Diperbarui', `Berhasil mengubah status ${selectedRowIds.length} KPM menjadi ${newStatus.toUpperCase()}.`);
    setSelectedRowIds([]);
  };

  const handlePrintKpmList = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
            <span>SADEWA Bansos Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif">
            Manajemen Bantuan Sosial & KPM Desa
          </h2>
          <p className="text-xs text-slate-500">
            Kelola data penerima BLT-DD, PKH, BPNT, Beras CPP, serta cetak kartu resi massal (4 per lembar A4).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBatchPrintModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-emerald-500 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
            title="Cetak Kartu Undangan / Resi Massal (4 dalam 1 Kertas A4)"
          >
            <Grid className="w-4 h-4" />
            <span>Cetak Massal (4/Kertas A4)</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Import Excel / Copas</span>
          </button>

          <button
            onClick={handlePrintKpmList}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak Rekap Tabel</span>
          </button>
          
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah KPM Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Total KPM</div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-emerald-800 uppercase">BLT Dana Desa</div>
          <div className="text-2xl font-black text-emerald-950">{stats.blt}</div>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-blue-800 uppercase">PKH Kemensos</div>
          <div className="text-2xl font-black text-blue-950">{stats.pkh}</div>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-amber-800 uppercase">BPNT / Sembako</div>
          <div className="text-2xl font-black text-amber-950">{stats.bpnt}</div>
        </div>
        <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-teal-800 uppercase">Beras CPP</div>
          <div className="text-2xl font-black text-teal-950">{stats.beras}</div>
        </div>
        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 shadow-xs space-y-1">
          <div className="text-[11px] font-bold text-purple-800 uppercase">KIS PBI (BPJS)</div>
          <div className="text-2xl font-black text-purple-950">{stats.kis}</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('kpm_list')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-2 transition-colors ${
            activeTab === 'kpm_list'
              ? 'bg-emerald-700 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar KPM Aktif ({bansosRecipients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('usulan_sanggahan')}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-2 transition-colors ${
            activeTab === 'usulan_sanggahan'
              ? 'bg-emerald-700 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Usulan & Sanggahan Warga ({bansosComplaints.length})</span>
        </button>
      </div>

      {/* TAB 1: DAFTAR KPM */}
      {activeTab === 'kpm_list' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 w-full md:max-w-md relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari NIK atau Nama KPM..."
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative group">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <select 
                  className="pl-8 pr-8 py-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none appearance-none cursor-pointer"
                  value={selectedProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                >
                  <option value="all">Semua Program</option>
                  {BANSOS_PROGRAM_LIST.map(p => (
                    <option key={p.type} value={p.type}>{p.name}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              <div className="relative group">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <select 
                  className="pl-8 pr-8 py-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none appearance-none cursor-pointer"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="siap_diambil">Siap Diambil</option>
                  <option value="tersalurkan">Tersalurkan</option>
                  <option value="proses_verifikasi">Verifikasi</option>
                  <option value="ditangguhkan">Ditangguhkan</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <KpmTable 
            filters={{ 
              programType: selectedProgram === 'all' ? '' : selectedProgram,
              status: selectedStatus === 'all' ? undefined : (selectedStatus as any)
            }}
            isAdmin={true}
            onEdit={handleOpenEditModal}
            onDelete={handleDelete}
            onPrint={setSelectedPrintRecipient}
          />
        </div>
      )}

      {/* TAB 2: USULAN & SANGGAHAN */}
      {activeTab === 'usulan_sanggahan' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 font-serif">
              Daftar Usulan Mandiri & Sanggahan Publik Warga
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Laporan ini diverifikasi oleh BPD dan Tim Musdesus Desa untuk memastikan transparansi dan keadilan penyaluran bantuan sosial.
            </p>

            <div className="space-y-3 pt-2">
              {bansosComplaints.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada usulan atau sanggahan yang masuk dari warga.
                </div>
              ) : (
                bansosComplaints.map((comp) => (
                  <div
                    key={comp.id}
                    className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                          comp.type === 'usulan_baru'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {comp.type === 'usulan_baru' ? 'Usulan KPM Baru' : 'Sanggahan Ketidaklayakan'}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          Pelapor: {comp.namaPelapor} ({comp.dusun}, RT {comp.rt})
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(comp.createdAt).toLocaleDateString('id-ID')}
                        </span>
                        <select
                          value={comp.status}
                          onChange={(e) => updateBansosComplaintStatus(comp.id, e.target.value as any)}
                          className="px-2 py-1 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700"
                        >
                          <option value="menunggu_musdes">Menunggu Musdes</option>
                          <option value="diverifikasi">Diverifikasi Tim</option>
                          <option value="disetujui">Disetujui</option>
                          <option value="ditolak">Ditolak</option>
                        </select>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700">
                      <strong>Alasan / Keterangan:</strong> {comp.alasan}
                    </div>

                    {comp.targetNikOrName && (
                      <div className="text-xs text-rose-700 font-medium">
                        <strong>Target yang Disanggah:</strong> {comp.targetNikOrName}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT KPM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-serif">
                  {editingId ? 'Edit Data Penerima Bantuan (KPM)' : 'Tambah Penerima Bantuan Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi data lengkap sesuai KTP & KK untuk pendaftaran resmi bansos desa.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                &times;
              </button>
            </div>

             <form onSubmit={handleSaveModal} className="space-y-4">
              {!editingId ? (
                <div className="space-y-2 border-b border-slate-100 pb-4">
                  <label className="block text-xs font-black text-slate-700 uppercase">
                    Cari NIK / Nama Warga Terdaftar (SSOT) *
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={nikSearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNikSearch(val);
                        const found = residents.find(r => r.nik === val || r.name.toUpperCase() === val.toUpperCase());
                        if (found) {
                          setSelectedResident(found);
                          setFormData(prev => ({
                            ...prev,
                            nik: found.nik,
                            noKk: found.kk || found.kkNumber || '',
                            name: found.name,
                            gender: found.gender as any,
                            dusun: found.dusun || 'Dusun 1',
                            rt: found.rt || '01',
                            rw: found.rw || '01'
                          }));
                        } else {
                          setSelectedResident(null);
                        }
                      }}
                      placeholder="Masukkan 16 Digit NIK atau Nama Lengkap..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                  {nikSearch.trim().length > 1 && !selectedResident && (
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-sm">
                      {residents
                        .filter(r => 
                          r.nik.includes(nikSearch) || 
                          r.name.toLowerCase().includes(nikSearch.toLowerCase())
                        )
                        .slice(0, 5)
                        .map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelectedResident(r);
                              setNikSearch(r.nik);
                              setFormData(prev => ({
                                ...prev,
                                nik: r.nik,
                                noKk: r.kk || r.kkNumber || '',
                                name: r.name,
                                gender: r.gender as any,
                                dusun: r.dusun || 'Dusun 1',
                                rt: r.rt || '01',
                                rw: r.rw || '01'
                              }));
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between items-center text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900">{r.name}</span>
                              <span className="text-slate-500 ml-2 font-mono">{r.nik}</span>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">{r.dusun}</span>
                          </button>
                        ))}
                      {residents.filter(r => 
                        r.nik.includes(nikSearch) || 
                        r.name.toLowerCase().includes(nikSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="p-3 text-center text-xs text-rose-600 bg-rose-50 font-bold">
                          ⚠️ NIK tidak terdaftar, silakan input di Database Kependudukan terlebih dahulu.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedResident && (
                    <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Warga Terverifikasi SSOT</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedResident.status?.toUpperCase() === 'HIDUP' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                        }`}>
                          STATUS: {selectedResident.status?.toUpperCase() || 'HIDUP'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 font-serif">
                        <div><strong className="text-slate-500">Nama:</strong> {selectedResident.name}</div>
                        <div><strong className="text-slate-500">NIK:</strong> {selectedResident.nik}</div>
                        <div><strong className="text-slate-500">No. KK:</strong> {selectedResident.kk || selectedResident.kkNumber}</div>
                        <div><strong className="text-slate-500">Dusun:</strong> {selectedResident.dusun} (RT {selectedResident.rt}/RW {selectedResident.rw})</div>
                      </div>
                      {selectedResident.status?.toUpperCase() !== 'HIDUP' && (
                        <div className="text-xs text-rose-700 font-bold mt-1 p-2 bg-rose-100 border border-rose-200 rounded-lg">
                          ⚠️ PERINGATAN: Warga berstatus {selectedResident.status?.toUpperCase()}. Harap evaluasi kelayakan program bantuan!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">KPM Terdaftar (Mode Edit Transaksi)</span>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 mt-1">
                    <div><strong className="text-slate-500">Nama:</strong> {formData.name}</div>
                    <div><strong className="text-slate-500">NIK:</strong> {formData.nik}</div>
                    <div><strong className="text-slate-500">No. KK:</strong> {formData.noKk}</div>
                    <div><strong className="text-slate-500">Dusun:</strong> {formData.dusun} (RT {formData.rt}/RW {formData.rw})</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Program Bantuan
                  </label>
                  <select
                    value={formData.programType}
                    onChange={(e) => {
                      const pType = e.target.value as BansosProgramType;
                      const matched = BANSOS_PROGRAM_LIST.find(p => p.type === pType);
                      setFormData({
                        ...formData,
                        programType: pType,
                        programName: matched?.name || pType
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {BANSOS_PROGRAM_LIST.map(p => (
                      <option key={p.type} value={p.type}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periode Bantuan
                  </label>
                  <input
                    type="text"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    placeholder="Tahap 1 TA 2026"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Besaran / Bentuk Bantuan
                  </label>
                  <input
                    type="text"
                    value={formData.nominalOrItem}
                    onChange={(e) => setFormData({ ...formData, nominalOrItem: e.target.value })}
                    placeholder="Rp 900.000 (Rp 300rb/bln) atau 10 Kg Beras"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Penyaluran
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="siap_diambil">Siap Diambil</option>
                    <option value="tersalurkan">Tersalurkan</option>
                    <option value="proses_verifikasi">Proses Verifikasi</option>
                    <option value="ditangguhkan">Ditangguhkan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Jadwal Penyaluran
                  </label>
                  <input
                    type="date"
                    value={formData.distributionDate}
                    onChange={(e) => setFormData({ ...formData, distributionDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lokasi Pengambilan
                  </label>
                  <input
                    type="text"
                    value={formData.distributionLocation}
                    onChange={(e) => setFormData({ ...formData, distributionLocation: e.target.value })}
                    placeholder="Aula Kantor Desa Pulau Betung"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  placeholder="Kategori lansia tunggal / disabilitas..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!editingId && !selectedResident}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm transition-colors cursor-pointer ${
                    (!editingId && !selectedResident) 
                      ? 'bg-slate-300 border-slate-300 cursor-not-allowed text-slate-500' 
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {editingId ? 'Simpan Perubahan' : 'Daftarkan KPM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL IMPORT EXCEL / CSV */}
      <BansosImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        bulkAdd={bulkAddBansosRecipients}
        replaceAll={replaceBansosRecipients}
        onImportSuccess={(count, mode) => {
          addToast(
            'success',
            'Import KPM Berhasil',
            mode === 'replace'
              ? `Berhasil memperbarui dan menyinkronkan seluruh database dengan ${count} KPM baru.`
              : `Berhasil menambahkan ${count} penerima bantuan baru ke dalam sistem.`
          );
        }}
      />
      {/* MODAL RESI BANSOS CETAK TUNGGAL */}
      {selectedPrintRecipient && (
        <BansosReceiptModal
          recipient={selectedPrintRecipient}
          onClose={() => setSelectedPrintRecipient(null)}
          villageName={villageProfile?.villageName || 'Desa Pulau Betung'}
          villageAddress={villageProfile?.addressStreet || 'Jl. Lintas Jambi - Muara Bulian KM. 35, Kec. Pemayung, Kab. Batang Hari'}
          kadesName={villageProfile?.kadesName || 'M. Yamin, S.Pd'}
          onToast={addToast}
        />
      )}

      {/* MODAL CETAK MASSAL (4 PER LEMBAR A4 / 2 PER LEMBAR / 1 PER LEMBAR) */}
      <BansosBatchPrintModal
        isOpen={isBatchPrintModalOpen}
        onClose={() => setIsBatchPrintModalOpen(false)}
        recipients={
          selectedRowIds.length > 0
            ? bansosRecipients.filter(r => selectedRowIds.includes(r.id))
            : filteredRecipients
        }
        villageName={villageProfile?.villageName || 'Desa Pulau Betung'}
        villageAddress={villageProfile?.addressStreet || 'Jl. Lintas Jambi - Muara Bulian KM. 35, Kec. Pemayung, Kab. Batang Hari'}
        kadesName={villageProfile?.kadesName || 'M. Yamin, S.Pd'}
        onToast={addToast}
      />
    </div>
  );
};
