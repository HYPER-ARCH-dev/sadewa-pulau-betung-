import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BudgetYearData, ApbdesItem } from '../../types';
import {
  TrendingUp,
  BarChart3,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Save,
  Printer,
  Landmark,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCheck,
  RefreshCw,
  Eye,
  Download,
  FileSpreadsheet,
  DollarSign,
  ShieldCheck,
  Calendar,
  HardHat,
  RotateCcw
} from 'lucide-react';
import { ProjectsManager } from './ProjectsManager';

// Helper function to dynamically calculate totals from items
const calculateTotalsFromItems = (data: BudgetYearData): BudgetYearData => {
  const incItems = data.incomeItems || [];
  const expItems = data.expenditureItems || [];
  const finItems = data.financingItems || [];

  const totalIncome = incItems.reduce((acc, item) => acc + (Number(item.targetBudget) || 0), 0);
  const totalIncomeRealized = incItems.reduce((acc, item) => acc + (Number(item.realizedBudget) || 0), 0);

  const totalExpenditure = expItems.reduce((acc, item) => acc + (Number(item.targetBudget) || 0), 0);
  const totalExpenditureRealized = expItems.reduce((acc, item) => acc + (Number(item.realizedBudget) || 0), 0);

  const totalFinancing = finItems.reduce((acc, item) => acc + (Number(item.targetBudget) || 0), 0);
  const totalFinancingRealized = finItems.reduce((acc, item) => acc + (Number(item.realizedBudget) || 0), 0);

  const totalTarget = totalIncome || 1;
  const realizationPercentage = totalIncome > 0 ? Number(Math.min(100, (totalIncomeRealized / totalTarget) * 100).toFixed(1)) : 0;

  return {
    ...data,
    totalIncome,
    totalIncomeRealized,
    totalExpenditure,
    totalExpenditureRealized,
    totalFinancing,
    totalFinancingRealized,
    realizationPercentage
  };
};

export const ApbdesManager: React.FC = () => {
  const { budget, budgetHistory, updateBudget, villageProfile, officials, developmentProjects, addToast } = useApp();

  const [selectedYear, setSelectedYear] = useState<number>(budget.year || 2026);
  const [selectedDocType, setSelectedDocType] = useState<'murni' | 'perubahan'>(
    budget.documentType || 'murni'
  );
  const [apbdesSubTab, setApbdesSubTab] = useState<'summary' | 'projects'>('summary');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Available fiscal years from budget history
  const availableYears = Array.from(
    new Set([2026, 2025, 2024, selectedYear, ...budgetHistory.map((b) => b.year)])
  ).sort((a, b) => b - a);

  // Active dataset selected
  const activeBudget: BudgetYearData = useMemo(() => {
    const found = budgetHistory.find(
      (b) => b.year === selectedYear && (b.documentType || 'murni') === selectedDocType
    );
    return found ? calculateTotalsFromItems(found) : calculateTotalsFromItems(budget);
  }, [budgetHistory, budget, selectedYear, selectedDocType]);

  // Form State for editing
  const [editForm, setEditForm] = useState<BudgetYearData>({ ...activeBudget });

  useEffect(() => {
    if (!isEditing) {
      setEditForm({ ...activeBudget });
    }
  }, [activeBudget, isEditing]);

  // Update edit form when switching year / doctype
  const handleSelectBudget = (year: number, docType: 'murni' | 'perubahan') => {
    setSelectedYear(year);
    setSelectedDocType(docType);
    let target = budgetHistory.find((b) => b.year === year && (b.documentType || 'murni') === docType);
    if (!target) {
      const baseBudget = budgetHistory.find((b) => b.year === year) || budget;
      target = calculateTotalsFromItems({
        ...baseBudget,
        id: `apbdes-${year}-${docType}`,
        year,
        documentType: docType,
        legalRefNumber: docType === 'perubahan' ? `Perdes No. 05 Tahun ${year} (APBDes-P)` : `Perdes No. 02 Tahun ${year}`,
        status: 'BERLAKU'
      });
      updateBudget(target);
    }
    setEditForm({ ...target });
    setIsEditing(false);
  };

  // Recalculate totals on item change
  const handleItemChange = (
    type: 'income' | 'expenditure' | 'financing',
    index: number,
    field: 'targetBudget' | 'realizedBudget' | 'category' | 'source',
    value: string | number | null | undefined
  ) => {
    setEditForm((prev) => {
      const itemsKey =
        type === 'income'
          ? 'incomeItems'
          : type === 'expenditure'
          ? 'expenditureItems'
          : 'financingItems';

      const currentItems: ApbdesItem[] = [...(prev[itemsKey] || [])];

      if (currentItems[index]) {
        const newValue = field === 'targetBudget' || field === 'realizedBudget' ? Number(value) || 0 : value;
        
        // CRITICAL AUDIT FIX: Prevent Realization > Target Budget (Defisit Prevention)
        if (field === 'realizedBudget' && Number(newValue) > currentItems[index].targetBudget) {
          addToast('error', 'Input Melebihi Pagu', `Maaf, realisasi untuk "${currentItems[index].category}" tidak boleh melebihi sisa pagu anggaran (Rp ${currentItems[index].targetBudget.toLocaleString('id-ID')}).`);
          return prev;
        }

        currentItems[index] = {
          ...currentItems[index],
          [field]: newValue
        };
      }

      return calculateTotalsFromItems({
        ...prev,
        [itemsKey]: currentItems
      });
    });
  };

  // Add Item to breakdown
  const handleAddItem = (type: 'income' | 'expenditure' | 'financing') => {
    setEditForm((prev) => {
      const itemsKey =
        type === 'income'
          ? 'incomeItems'
          : type === 'expenditure'
          ? 'expenditureItems'
          : 'financingItems';

      const currentItems = [...(prev[itemsKey] || [])];
      currentItems.push({
        id: 'item-' + Date.now(),
        code: type === 'income' ? `4.${currentItems.length + 1}` : type === 'expenditure' ? `5.${currentItems.length + 1}` : `6.${currentItems.length + 1}`,
        category: type === 'income' ? 'Sumber Dana Baru' : type === 'expenditure' ? 'Bidang Kegiatan Baru' : 'Penerimaan/Pengeluaran Pembiayaan Baru',
        targetBudget: 10000000,
        realizedBudget: 0,
        source: 'Kas Desa'
      });

      return calculateTotalsFromItems({ ...prev, [itemsKey]: currentItems });
    });
  };

  // Delete Item & recalculate
  const handleDeleteItem = (type: 'income' | 'expenditure' | 'financing', index: number) => {
    setEditForm((prev) => {
      const itemsKey =
        type === 'income'
          ? 'incomeItems'
          : type === 'expenditure'
          ? 'expenditureItems'
          : 'financingItems';

      const currentItems = [...(prev[itemsKey] || [])];
      currentItems.splice(index, 1);
      return calculateTotalsFromItems({ ...prev, [itemsKey]: currentItems });
    });
  };

  // Public Documents management
  const handlePublicDocChange = (index: number, field: string, value: string) => {
    setEditForm((prev) => {
      const docs = [...(prev.publicDocuments || [])];
      docs[index] = { ...docs[index], [field]: value };
      return { ...prev, publicDocuments: docs };
    });
  };

  const handleAddPublicDoc = () => {
    setEditForm((prev) => {
      const docs = [...(prev.publicDocuments || [])];
      docs.push({
        id: 'doc-' + Date.now(),
        title: 'Peraturan Desa No. -- Tahun 2026',
        category: 'Peraturan Desa',
        fileSize: '2.0 MB',
        uploadDate: new Date().toISOString().split('T')[0],
        downloadUrl: '#'
      });
      return { ...prev, publicDocuments: docs };
    });
  };

  const handleDeletePublicDoc = (index: number) => {
    setEditForm((prev) => {
      const docs = [...(prev.publicDocuments || [])];
      docs.splice(index, 1);
      return { ...prev, publicDocuments: docs };
    });
  };

  const handleDocFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      setEditForm((prev) => {
        const docs = [...(prev.publicDocuments || [])];
        docs[index] = {
          ...docs[index],
          title: file.name.replace(/\.[^/.]+$/, ''),
          fileSize: sizeMB,
          downloadUrl: dataUrl
        };
        return { ...prev, publicDocuments: docs };
      });
    };
    reader.readAsDataURL(file);
  };

  // Reset all realization to 0
  const handleZeroOutRealization = () => {
    setShowResetConfirmModal(true);
  };

  const confirmResetRealization = () => {
    const zeroInc = (editForm.incomeItems || []).map((item) => ({ ...item, realizedBudget: 0 }));
    const zeroExp = (editForm.expenditureItems || []).map((item) => ({ ...item, realizedBudget: 0 }));
    const zeroFin = (editForm.financingItems || []).map((item) => ({ ...item, realizedBudget: 0 }));
    
    const resetData = calculateTotalsFromItems({
      ...editForm,
      totalIncomeRealized: 0,
      totalExpenditureRealized: 0,
      totalFinancingRealized: 0,
      realizationPercentage: 0,
      incomeItems: zeroInc,
      expenditureItems: zeroExp,
      financingItems: zeroFin
    });

    setEditForm(resetData);
    updateBudget(resetData);
    setShowResetConfirmModal(false);
  };

  // Save changes
  const handleSaveBudget = () => {
    const finalForm = calculateTotalsFromItems(editForm);
    updateBudget(finalForm);
    setIsEditing(false);
  };

  // Create new Fiscal Year template
  const handleCreateNewYear = () => {
    const newYear = selectedYear + 1;
    const newBudget: BudgetYearData = calculateTotalsFromItems({
      id: `apbdes-${newYear}-murni`,
      year: newYear,
      documentType: 'murni',
      status: 'DRAFT',
      legalRefNumber: `Perdes No. 01 Tahun ${newYear}`,
      enactmentDate: `10 Januari ${newYear}`,
      totalIncome: 0,
      totalIncomeRealized: 0,
      totalExpenditure: 0,
      totalExpenditureRealized: 0,
      totalFinancing: 0,
      totalFinancingRealized: 0,
      realizationPercentage: 0,
      incomeBreakdown: activeBudget.incomeBreakdown || [],
      expenditureBreakdown: activeBudget.expenditureBreakdown || [],
      incomeItems: activeBudget.incomeItems ? [...activeBudget.incomeItems] : [],
      expenditureItems: activeBudget.expenditureItems ? [...activeBudget.expenditureItems] : [],
      financingItems: activeBudget.financingItems ? [...activeBudget.financingItems] : [],
      publicDocuments: []
    });

    updateBudget(newBudget);
    setSelectedYear(newYear);
    setSelectedDocType('murni');
    setEditForm(newBudget);
    setIsEditing(true);
  };

  // Real-time synchronization of Development Projects to Bidang Pembangunan APBDes
  const projectTargetForYear = developmentProjects
    .filter((p) => p.fiscalYear === selectedYear)
    .reduce((sum, p) => sum + (p.budget || 0), 0);

  const projectRealizedForYear = developmentProjects
    .filter((p) => p.fiscalYear === selectedYear)
    .reduce((sum, p) => sum + Math.round((p.budget || 0) * ((p.progressPercent || 0) / 100)), 0);

  const rawExpItems = (isEditing ? editForm.expenditureItems : activeBudget.expenditureItems) || [];

  const synchronizedExpenditureItems: ApbdesItem[] = rawExpItems.map((item) => {
    if (
      item.code === '5.2' ||
      item.category.toLowerCase().includes('pembangunan')
    ) {
      if (projectTargetForYear > 0 || projectRealizedForYear > 0) {
        return {
          ...item,
          targetBudget: projectTargetForYear > 0 ? projectTargetForYear : item.targetBudget,
          realizedBudget: projectRealizedForYear > 0 ? projectRealizedForYear : item.realizedBudget
        };
      }
    }
    return item;
  });

  const activeIncItems = (isEditing ? editForm.incomeItems : activeBudget.incomeItems) || [];
  const activeFinItems = (isEditing ? editForm.financingItems : activeBudget.financingItems) || [];

  const incTotal = activeIncItems.reduce((acc, item) => acc + (Number(item.targetBudget) || 0), 0);
  const incRealized = activeIncItems.reduce((acc, item) => acc + (Number(item.realizedBudget) || 0), 0);
  const incPct = incTotal > 0 ? Math.min(100, (incRealized / incTotal) * 100) : 0;

  const expTotal = synchronizedExpenditureItems.reduce((acc, item) => acc + (Number(item.targetBudget) || 0), 0);
  const expRealized = synchronizedExpenditureItems.reduce((acc, item) => acc + (Number(item.realizedBudget) || 0), 0);
  const expPct = expTotal > 0 ? Math.min(100, (expRealized / expTotal) * 100) : 0;

  const finTotal = activeFinItems.reduce((acc, item) => acc + (Number(item.targetBudget) || 0), 0);
  const finRealized = activeFinItems.reduce((acc, item) => acc + (Number(item.realizedBudget) || 0), 0);

  const syncedBudgetData: BudgetYearData = {
    ...activeBudget,
    expenditureItems: synchronizedExpenditureItems,
    totalIncome: incTotal,
    totalIncomeRealized: incRealized,
    totalExpenditure: expTotal,
    totalExpenditureRealized: expRealized,
    totalFinancing: finTotal,
    totalFinancingRealized: finRealized
  };

  const exportApbdesCSV = () => {
    const headers = ['Kelompok', 'Kode Rincian', 'Bidang / Kategori', 'Sumber / Asal Dana', 'Anggaran Pagu (Rp)', 'Realisasi Lapangan (Rp)', 'Persentase Capaian (%)'];
    
    const incRows = activeIncItems.map(item => {
      const pct = item.targetBudget > 0 ? ((item.realizedBudget / item.targetBudget) * 100).toFixed(1) : '0';
      return ['"PENDAPATAN DESA"', `"${item.code || '-'}"`, `"${item.category}"`, `"${item.source || '-'}"`, item.targetBudget, item.realizedBudget, `"${pct}%"`];
    });

    const expRows = synchronizedExpenditureItems.map(item => {
      const pct = item.targetBudget > 0 ? ((item.realizedBudget / item.targetBudget) * 100).toFixed(1) : '0';
      return ['"BELANJA DESA"', `"${item.code || '-'}"`, `"${item.category}"`, `"${item.source || '-'}"`, item.targetBudget, item.realizedBudget, `"${pct}%"`];
    });

    const finRows = activeFinItems.map(item => {
      const pct = item.targetBudget > 0 ? ((item.realizedBudget / item.targetBudget) * 100).toFixed(1) : '0';
      return ['"PEMBIAYAAN DESA"', `"${item.code || '-'}"`, `"${item.category}"`, `"${item.source || '-'}"`, item.targetBudget, item.realizedBudget, `"${pct}%"`];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      `"LAPORAN APBDES TA ${selectedYear} (${selectedDocType.toUpperCase()}) - ${villageProfile?.villageName || 'DESA'}"`,
      `"Total Pendapatan: Rp ${incTotal.toLocaleString('id-ID')} | Total Belanja: Rp ${expTotal.toLocaleString('id-ID')} | Pembiayaan: Rp ${finTotal.toLocaleString('id-ID')}"`,
      '',
      headers.join(','),
      ...incRows.map(r => r.join(',')),
      ...expRows.map(r => r.join(',')),
      ...finRows.map(r => r.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `APBDes_${selectedYear}_${selectedDocType}_${villageProfile?.villageName || 'Desa'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-emerald-800/80 text-emerald-200 text-xs px-3 py-1 rounded-full border border-emerald-700/50 font-bold">
              <Landmark className="w-3.5 h-3.5" />
              <span>Modul Transparansi APBDes Kemendagri</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Kelola Realisasi Keuangan & APBDes
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Atur pagu anggaran dan realisasi lapangan Desa Pulau Betung secara transparan, akurat, dan sesuai dengan standar regulasi desa.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportApbdesCSV}
              className="px-4 py-2.5 rounded-2xl bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs flex items-center space-x-2 border border-teal-600 transition-all active:scale-95 cursor-pointer shadow-md"
              title="Unduh Rekap APBDes Format CSV / Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Export CSV (Excel)</span>
            </button>

            <button
              onClick={handleCreateNewYear}
              className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tahun Anggaran Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAHUN ANGGARAN & APBDES-P SELECTOR BAR */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-emerald-700" />
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Pilih Tahun Anggaran & Dokumen:
          </span>
          <div className="flex items-center space-x-2">
            {availableYears.map((yr) => (
              <button
                key={yr}
                onClick={() => handleSelectBudget(yr, selectedDocType)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedYear === yr
                    ? 'bg-slate-900 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                TA {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Document Type Switcher (Murni vs Perubahan / APBDes-P) */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => handleSelectBudget(selectedYear, 'murni')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedDocType === 'murni'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            APBDes Murni
          </button>
          <button
            onClick={() => handleSelectBudget(selectedYear, 'perubahan')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedDocType === 'perubahan'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            APBDes Perubahan (APBDes-P)
          </button>
        </div>
      </div>

      {/* SUB-TAB SEGMENTED CONTROL NAVIGATION */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setApbdesSubTab('summary')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
              apbdesSubTab === 'summary'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Sub-Tab 1: Ringkasan & Baliho APBDes</span>
          </button>

          <button
            onClick={() => setApbdesSubTab('projects')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
              apbdesSubTab === 'projects'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <HardHat className="w-4 h-4 text-amber-400" />
            <span>Sub-Tab 2: Proyek Pembangunan Fisik</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900">
              {developmentProjects.filter((p) => p.fiscalYear === selectedYear).length} Proyek
            </span>
          </button>
        </div>

        {apbdesSubTab === 'summary' && (
          <div className="text-xs text-slate-600 font-medium flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Real. Bidang Pembangunan: <strong className="text-emerald-950 font-mono ml-1">Rp {projectRealizedForYear.toLocaleString('id-ID')}</strong> (Tersinkronisasi {developmentProjects.filter(p => p.fiscalYear === selectedYear).length} Proyek T.A {selectedYear})
            </span>
          </div>
        )}
      </div>

      {apbdesSubTab === 'projects' ? (
        <ProjectsManager />
      ) : (
        <>
          {/* STATUS & LEGAL INFO BAR */}
      <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-200 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-emerald-950">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
          <div>
            <span className="font-bold">Landasan Hukum Dokumen: </span>
            <span className="font-extrabold text-emerald-900">
              {activeBudget.legalRefNumber || `Peraturan Desa No. 02 Tahun ${activeBudget.year}`}
            </span>
            <span className="text-slate-500 ml-2">
              (Disahkan BPD pada {
                typeof activeBudget.enactmentDate === 'object' && activeBudget.enactmentDate !== null
                  ? (activeBudget.enactmentDate as any).toLocaleDateString('id-ID')
                  : String(activeBudget.enactmentDate || '15 Januari 2026')
              })
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <button
              onClick={() => {
                setEditForm({ ...activeBudget });
                setIsEditing(true);
              }}
              className="px-4 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Anggaran & Realisasi</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleZeroOutRealization}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-xs cursor-pointer"
                title="Kosongkan/nolkan seluruh angka realisasi untuk diisi dari awal"
              >
                Reset Realisasi (Ke Rp 0)
              </button>
              <button
                onClick={handleSaveBudget}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center space-x-1.5 shadow-md transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EXECUTIVE 3 PILARS SUMMARY DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* PILAR 1: PENDAPATAN */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  PENDAPATAN DESA
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Dana Masuk APBDes</p>
              </div>
            </div>
            <span className="text-xs font-black bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
              {incPct.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-extrabold uppercase">Pagu Anggaran:</div>
            <div className="text-xl font-black text-slate-900">
              Rp {incTotal.toLocaleString('id-ID')}
            </div>
            <div className="text-xs font-bold text-emerald-700 flex justify-between">
              <span>Realisasi Lapangan:</span>
              <span>
                Rp {incRealized.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${incPct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* PILAR 2: BELANJA */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  BELANJA DESA
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Pengeluaran Program</p>
              </div>
            </div>
            <span className="text-xs font-black bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg">
              {expPct.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-extrabold uppercase">Pagu Anggaran:</div>
            <div className="text-xl font-black text-slate-900">
              Rp {expTotal.toLocaleString('id-ID')}
            </div>
            <div className="text-xs font-bold text-amber-800 flex justify-between">
              <span>Realisasi Lapangan:</span>
              <span>
                Rp {expRealized.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${expPct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* PILAR 3: PEMBIAYAAN */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  PEMBIAYAAN DESA
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">SILPA & Modal</p>
              </div>
            </div>
            <span className="text-xs font-black bg-blue-100 text-blue-900 px-2.5 py-1 rounded-lg">
              NETO
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-extrabold uppercase">Pagu Pembiayaan:</div>
            <div className="text-xl font-black text-slate-900">
              Rp {finTotal.toLocaleString('id-ID')}
            </div>
            <div className="text-xs font-bold text-blue-800 flex justify-between">
              <span>Realisasi Lapangan:</span>
              <span>Rp {finRealized.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

      </div>

      {/* BREAKDOWN EDITABLE TABLES / FORM */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Rincian Pagu Anggaran & Realisasi Lapangan
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Mode Edit Aktif: Ubah angka Pagu dan Realisasi untuk memperbarui grafik secara otomatis.'
                : 'Tampilan rincian Pagu vs Realisasi seluruh bidang APBDes Desa Pulau Betung.'}
            </p>
          </div>

          {isEditing && (
            <div className="text-xs font-extrabold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>Jangan lupa klik "Simpan Perubahan" di atas!</span>
            </div>
          )}
        </div>

        {/* TABEL RINCIAN PENDAPATAN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>RINCIAN SUMBER DANA PENDAPATAN DESA</span>
            </h4>
            {isEditing && (
              <button
                onClick={() => handleAddItem('income')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Sumber Dana</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200 uppercase">
                <tr>
                  <th className="p-3">Kategori / Sumber Dana</th>
                  <th className="p-3">Asal Dana</th>
                  <th className="p-3">Pagu Anggaran (Rp)</th>
                  <th className="p-3">Realisasi Lapangan (Rp)</th>
                  <th className="p-3 text-right">% Capaian</th>
                  {isEditing && <th className="p-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {(isEditing ? editForm.incomeItems : activeBudget.incomeItems || [])?.map(
                  (item, idx) => {
                    const target = item.targetBudget || 1;
                    const real = item.realizedBudget || 0;
                    const pct = Math.min(100, (real / target) * 100);

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) =>
                                handleItemChange('income', idx, 'category', e.target.value)
                              }
                              className="w-full px-2 py-1 rounded border border-slate-300 font-bold"
                            />
                          ) : (
                            item.category
                          )}
                        </td>
                        <td className="p-3 text-slate-500">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.source || ''}
                              onChange={(e) =>
                                handleItemChange('income', idx, 'source', e.target.value)
                              }
                              className="w-full px-2 py-1 rounded border border-slate-300"
                            />
                          ) : (
                            item.source || 'APBN / APBD'
                          )}
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">
                          {isEditing ? (
                            <input
                              type="number"
                              value={item.targetBudget}
                              onChange={(e) =>
                                handleItemChange('income', idx, 'targetBudget', e.target.value)
                              }
                              className="w-36 px-2 py-1 rounded border border-slate-300 font-extrabold"
                            />
                          ) : (
                            `Rp ${item.targetBudget.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="p-3 font-bold text-emerald-800">
                          {isEditing ? (
                            <input
                              type="number"
                              value={item.realizedBudget}
                              onChange={(e) =>
                                handleItemChange('income', idx, 'realizedBudget', e.target.value)
                              }
                              className="w-36 px-2 py-1 rounded border border-slate-300 font-bold text-emerald-800"
                            />
                          ) : (
                            `Rp ${item.realizedBudget.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-900">
                          {pct.toFixed(1)}%
                        </td>
                        {isEditing && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteItem('income', idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABEL RINCIAN BELANJA */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-amber-700" />
              <span>RINCIAN 5 BIDANG BELANJA DESA</span>
            </h4>
            {isEditing && (
              <button
                onClick={() => handleAddItem('expenditure')}
                className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Bidang Belanja</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200 uppercase">
                <tr>
                  <th className="p-3">Bidang Kegiatan Belanja</th>
                  <th className="p-3">Pagu Anggaran (Rp)</th>
                  <th className="p-3">Realisasi Lapangan (Rp)</th>
                  <th className="p-3 text-right">% Capaian</th>
                  {isEditing && <th className="p-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {synchronizedExpenditureItems.map(
                  (item, idx) => {
                    const target = item.targetBudget || 1;
                    const real = item.realizedBudget || 0;
                    const pct = Math.min(100, (real / target) * 100);

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) =>
                                handleItemChange('expenditure', idx, 'category', e.target.value)
                              }
                              className="w-full px-2 py-1 rounded border border-slate-300 font-bold"
                            />
                          ) : (
                            item.category
                          )}
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">
                          {isEditing ? (
                            <input
                              type="number"
                              value={item.targetBudget}
                              onChange={(e) =>
                                handleItemChange('expenditure', idx, 'targetBudget', e.target.value)
                              }
                              className="w-36 px-2 py-1 rounded border border-slate-300 font-extrabold"
                            />
                          ) : (
                            `Rp ${item.targetBudget.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="p-3 font-bold text-amber-900">
                          {isEditing ? (
                            <input
                              type="number"
                              value={item.realizedBudget}
                              onChange={(e) =>
                                handleItemChange('expenditure', idx, 'realizedBudget', e.target.value)
                              }
                              className="w-36 px-2 py-1 rounded border border-slate-300 font-bold text-amber-900"
                            />
                          ) : (
                            `Rp ${item.realizedBudget.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-amber-950">
                          {pct.toFixed(1)}%
                        </td>
                        {isEditing && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteItem('expenditure', idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABEL RINCIAN PEMBIAYAAN DESA */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>TABEL RINCIAN PEMBIAYAAN DESA (SILPA / PENYERTAAN MODAL)</span>
            </h3>
            {isEditing && (
              <button
                onClick={() => handleAddItem('financing')}
                className="px-3 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold text-xs hover:bg-blue-200 transition-colors cursor-pointer"
              >
                + Tambah Pembiayaan
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-blue-50/80 text-blue-950 uppercase font-black">
                <tr>
                  <th className="p-3 rounded-l-xl">Kode</th>
                  <th className="p-3">Pos Pembiayaan</th>
                  <th className="p-3">Anggaran Pagu (Rp)</th>
                  <th className="p-3">Realisasi (Rp)</th>
                  <th className="p-3 text-right">Capaian</th>
                  {isEditing && <th className="p-3 text-center rounded-r-xl">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {((isEditing ? editForm.financingItems : activeBudget.financingItems) || []).map(
                  (item, idx) => {
                    const pct =
                      item.targetBudget > 0
                        ? Math.min(100, (item.realizedBudget / item.targetBudget) * 100)
                        : 0;
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {item.code || `6.${idx + 1}`}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) =>
                                handleItemChange('financing', idx, 'category', e.target.value)
                              }
                              className="w-full px-2 py-1 rounded border border-slate-300 font-bold"
                            />
                          ) : (
                            item.category
                          )}
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">
                          {isEditing ? (
                            <input
                              type="number"
                              value={item.targetBudget}
                              onChange={(e) =>
                                handleItemChange('financing', idx, 'targetBudget', e.target.value)
                              }
                              className="w-36 px-2 py-1 rounded border border-slate-300 font-extrabold"
                            />
                          ) : (
                            `Rp ${item.targetBudget.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="p-3 font-bold text-blue-900">
                          {isEditing ? (
                            <input
                              type="number"
                              value={item.realizedBudget}
                              onChange={(e) =>
                                handleItemChange('financing', idx, 'realizedBudget', e.target.value)
                              }
                              className="w-36 px-2 py-1 rounded border border-slate-300 font-bold text-blue-900"
                            />
                          ) : (
                            `Rp ${item.realizedBudget.toLocaleString('id-ID')}`
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-blue-950">
                          {pct.toFixed(1)}%
                        </td>
                        {isEditing && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteItem('financing', idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                              title="Hapus Rincian Pembiayaan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABEL MANAJEMEN DOKUMEN PUBLIK & PERATURAN DESA */}
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>MANAJEMEN DOKUMEN PUBLIK & PERATURAN DESA APBDES</span>
            </h4>
            {isEditing && (
              <button
                onClick={handleAddPublicDoc}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-900 flex items-center space-x-1 cursor-pointer bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Unggah Dokumen / Perdes Baru</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {((isEditing ? editForm.publicDocuments : activeBudget.publicDocuments) || []).map(
              (doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between gap-3"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                          Dokumen #{idx + 1}
                        </span>
                        <button
                          onClick={() => handleDeletePublicDoc(idx)}
                          className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Judul Dokumen</label>
                        <input
                          type="text"
                          value={doc.title}
                          onChange={(e) => handlePublicDocChange(idx, 'title', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Kategori</label>
                          <input
                            type="text"
                            value={doc.category}
                            onChange={(e) => handlePublicDocChange(idx, 'category', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Ukuran File</label>
                          <input
                            type="text"
                            value={doc.fileSize}
                            onChange={(e) => handlePublicDocChange(idx, 'fileSize', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">Unggah Berkas (PDF/Dokumen)</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          onChange={(e) => handleDocFileUpload(idx, e)}
                          className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-dashed border-emerald-300 rounded-lg p-1 bg-emerald-50/30"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                            {doc.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold uppercase">
                              {doc.category}
                            </span>
                            <span className="text-[11px] text-slate-400">Ukuran: {doc.fileSize}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>

      </div>
      </>
      )}

      {/* MODAL KONFIRMASI RESET REALISASI */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowResetConfirmModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 z-10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-3 bg-amber-100 rounded-2xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Konfirmasi Reset Realisasi</h3>
                <p className="text-xs text-slate-500">Menolkan Angka Capaian Lapangan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed font-medium">
              Apakah Anda yakin ingin <strong className="text-slate-900">menolkan (reset ke Rp 0)</strong> seluruh nilai realisasi Pendapatan, Belanja, dan Pembiayaan untuk tahun anggaran <strong className="text-emerald-700">TA {selectedYear} ({selectedDocType.toUpperCase()})</strong>?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmResetRealization}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ya, Reset ke Rp 0</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
