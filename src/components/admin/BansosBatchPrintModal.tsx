import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { BansosRecipient } from '../../types/bansos';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';
import { useApp } from '../../context/AppContext';
import { printRawHtml } from '../../utils/printHelper';
import { maskNik } from '../../utils/formatting';
import {
  Printer,
  Grid,
  FileText,
  X,
  CheckCircle2,
  Users,
  Copy,
  Download,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  BadgeCheck,
  Scissors
} from 'lucide-react';

interface BansosBatchPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: BansosRecipient[];
  villageName?: string;
  villageAddress?: string;
  kadesName?: string;
  onToast?: (type: 'success' | 'info' | 'error', title: string, msg: string) => void;
}

export const BansosBatchPrintModal: React.FC<BansosBatchPrintModalProps> = ({
  isOpen,
  onClose,
  recipients,
  villageName = 'Desa Pulau Betung',
  villageAddress = 'Jl. Lintas Jambi - Muara Bulian KM. 35, Kec. Pemayung, Kab. Batang Hari',
  kadesName = 'M. Yamin, S.Pd',
  onToast
}) => {
  const { villageProfile } = useApp();
  const [layoutMode, setLayoutMode] = useState<'4_per_page' | '2_per_page' | '1_per_page'>('4_per_page');
  const [selectedIds, setSelectedIds] = useState<string[]>(recipients.map(r => r.id));
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [batchDate, setBatchDate] = useState('Rabu, 25 Maret 2026 • Pukul 09:00 WIB');
  const [batchLocation, setBatchLocation] = useState(villageAddress || 'Kantor Desa Pulau Betung');
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const regencyLogo = villageProfile?.regencyLogoUrl;
  const villageLogo = villageProfile?.villageLogoUrl;
  const officialSignature = villageProfile?.officialSignatureUrl;

  // Synchronize selected recipients when incoming prop changes
  useEffect(() => {
    setSelectedIds(recipients.map(r => r.id));
  }, [recipients]);

  // Generate real dynamic QR codes for each recipient
  useEffect(() => {
    if (recipients.length > 0) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pulaubetung.desa.id';
      const map: Record<string, string> = {};
      
      Promise.all(
        recipients.map(async (r) => {
          try {
            const verifyUrl = `${origin}/?tab=bansos&nik=${encodeURIComponent(r.nik)}&verify=true`;
            const url = await QRCode.toDataURL(verifyUrl, {
              width: 220,
              margin: 1,
              color: { dark: '#020617', light: '#ffffff' },
              errorCorrectionLevel: 'H'
            });
            map[r.id] = url;
          } catch (e) {
            console.error('QR code generation error', e);
          }
        })
      ).then(() => {
        setQrMap({ ...map });
      });
    }
  }, [recipients]);

  if (!isOpen) return null;

  const activeRecipients = recipients.filter(r => selectedIds.includes(r.id));
  const perPage = layoutMode === '4_per_page' ? 4 : layoutMode === '2_per_page' ? 2 : 1;
  const estimatedPages = Math.ceil(activeRecipients.length / perPage) || 1;

  const handlePrint = () => {
    if (printableAreaRef.current) {
      printRawHtml(printableAreaRef.current.innerHTML, `Kartu_Bansos_Massal_${activeRecipients.length}_KPM`);
    } else {
      window.print();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(recipients.map(r => r.id));
  const deselectAll = () => setSelectedIds([]);

  return (
    <AnimatePresence>
      <div 
        id="bansos-batch-print-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 rounded-3xl p-4 sm:p-6 max-w-5xl w-full shadow-2xl border border-slate-700/80 my-4 flex flex-col max-h-[94vh]"
        >
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Cetak Massal Kartu Undangan / Resi Bansos KPM</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    {activeRecipients.length} KPM Terpilih
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Hemat kertas dengan layout multi-kartu (2 atau 4 kartu dalam 1 lembar A4) lengkap dengan Kop Surat resmi.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handlePrint}
                disabled={activeRecipients.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan PDF ({estimatedPages} Lembar A4)</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Configuration Toolbar */}
          <div className="py-3 px-4 bg-slate-800/60 rounded-2xl my-3 border border-slate-700/50 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            {/* Layout Mode Selector */}
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-300">Format Kertas:</span>
              <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setLayoutMode('4_per_page')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    layoutMode === '4_per_page'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>4 Kartu / Lembar A4 (Hemat)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('2_per_page')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    layoutMode === '2_per_page'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>2 Kartu / Lembar A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('1_per_page')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    layoutMode === '1_per_page'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1 Resi Penuh / Lembar</span>
                </button>
              </div>
            </div>

            {/* Selection Status & Toggles */}
            <div className="flex items-center space-x-3 text-slate-300">
              <span>Pilih:</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-emerald-400 hover:underline font-bold"
              >
                Pilih Semua ({recipients.length})
              </button>
              <span>&bull;</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-slate-400 hover:underline"
              >
                Batalkan Semua
              </button>
            </div>
          </div>

          {/* Schedule Settings Toolbar */}
          <div className="px-4 py-3 bg-slate-800/40 rounded-2xl mb-3 border border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold shrink-0 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Jadwal Pengambilan:
              </span>
              <input
                type="text"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-hidden focus:border-emerald-500"
                placeholder="Contoh: Rabu, 25 Maret 2026 09:00 WIB"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold shrink-0 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Lokasi Pengambilan:
              </span>
              <input
                type="text"
                value={batchLocation}
                onChange={(e) => setBatchLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-hidden focus:border-emerald-500"
                placeholder="Contoh: Kantor Desa Pulau Betung"
              />
            </div>
          </div>

          {/* Main Preview Screen */}
          <div className="flex-1 overflow-y-auto py-4 px-2 sm:px-4 bg-slate-950/70 rounded-2xl flex justify-center custom-scrollbar">
            {/* PRINTABLE CONTAINER (Simulated A4 Pages) */}
            <div 
              ref={printableAreaRef}
              id="printable-bansos-batch-area"
              className="w-full max-w-[840px] space-y-8 print:space-y-0"
            >
              {activeRecipients.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <AlertCircle className="w-12 h-12 mx-auto text-amber-400 mb-3" />
                  <h4 className="text-base font-bold text-white">Tidak ada KPM yang dipilih</h4>
                  <p className="text-xs mt-1">Silakan centang minimal 1 KPM untuk mencetak resi atau kartu undangan.</p>
                </div>
              ) : (
                // Group recipients by page chunk
                Array.from({ length: Math.ceil(activeRecipients.length / perPage) }).map((_, pageIndex) => {
                  const pageRecipients = activeRecipients.slice(pageIndex * perPage, (pageIndex + 1) * perPage);

                  return (
                    <div
                      key={`page-${pageIndex}`}
                      className={`bg-white text-slate-900 p-4 sm:p-6 shadow-2xl rounded-sm border border-slate-300 relative print:p-1.5 print:shadow-none print:border-none print:m-0 print:h-[268mm] print:max-h-[268mm] print:overflow-hidden ${pageIndex < estimatedPages - 1 ? 'page-break' : ''}`}
                      style={{ minHeight: '960px', maxHeight: '1020px' }}
                    >
                      {/* Page Header Indicator (Screen Only) */}
                      <div className="print:hidden absolute -top-3 left-4 bg-slate-800 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 shadow">
                        Lembar Kertas A4 #{pageIndex + 1} dari {estimatedPages}
                      </div>

                      {/* LAYOUT RENDER: 4 PER PAGE (2x2 GRID) */}
                      {layoutMode === '4_per_page' && (
                        <div className="grid grid-cols-2 gap-3 h-full content-between">
                          {pageRecipients.map((rec) => {
                            const serialNumber = `400.9/BANSOS-PLB/${new Date().getFullYear()}/${rec.programType}/${rec.id.replace(/\D/g, '').padStart(4, '0').slice(-4) || '0842'}`;
                            return (
                              <div
                                key={rec.id}
                                className="border-2 border-dashed border-slate-400 rounded-xl p-3 flex flex-col justify-between relative bg-slate-50/50 avoid-break"
                                style={{ height: '475px', maxHeight: '485px' }}
                              >
                                {/* Mini Scissors Icon on Border */}
                                <div className="absolute -top-2.5 right-3 bg-white px-1.5 text-[9px] font-mono text-slate-500 flex items-center gap-1 border border-slate-300 rounded">
                                  <span>✂ POTONG KARTU</span>
                                </div>

                                {/* Mini Kop Surat */}
                                <div>
                                  <div className="border-b-2 border-slate-900 pb-1.5 mb-2 flex items-center justify-between gap-2">
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {regencyLogo ? (
                                        <img src={regencyLogo} alt="Logo Kabupaten" className="w-full h-full object-contain" />
                                      ) : (
                                        <div className="w-8 h-8" />
                                      )}
                                    </div>
                                    <div className="flex-1 text-center">
                                      <h5 className="text-[8px] font-bold uppercase tracking-wider text-slate-700">
                                        PEMERINTAH {villageName ? villageName.toUpperCase() : 'DESA PULAU BETUNG'}
                                      </h5>
                                      <h4 className="text-[10px] font-black uppercase text-slate-950 font-serif leading-tight">
                                        KARTU PENGAMBILAN BANSOS
                                      </h4>
                                      <p className="text-[7px] text-slate-500 font-mono">
                                        No. Resi: {serialNumber}
                                      </p>
                                    </div>
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {villageLogo ? (
                                        <img src={villageLogo} alt="Logo Desa" className="w-full h-full object-contain" />
                                      ) : (
                                        <div className="w-8 h-8" />
                                      )}
                                    </div>
                                  </div>

                                  {/* KPM Identitas Mini */}
                                  <div className="bg-white rounded-lg p-2 border border-slate-300 text-[10px] space-y-1 mb-2">
                                    <div className="flex justify-between border-b border-slate-100 pb-0.5">
                                      <span className="text-slate-500">Nama Penerima:</span>
                                      <strong className="text-slate-950 uppercase text-[11px]">{rec.name}</strong>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 pb-0.5">
                                      <span className="text-slate-500">Nomor NIK:</span>
                                      <span className="font-mono font-bold text-slate-900">{maskNik(rec.nik)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Alamat Dusun:</span>
                                      <span className="text-slate-800 font-semibold">{rec.dusun}, RT {rec.rt}</span>
                                    </div>
                                  </div>

                                  {/* Program & Nominal Badge */}
                                  <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-300 text-[10px] space-y-0.5 mb-2">
                                    <div className="flex justify-between items-center">
                                      <span className="font-black text-emerald-950 uppercase text-[11px] font-serif">
                                        {rec.programName}
                                      </span>
                                      <span className="text-[8px] bg-emerald-200/80 text-emerald-900 font-bold px-1.5 py-0.2 rounded">
                                        {rec.period}
                                      </span>
                                    </div>
                                    <div className="text-xs font-black text-emerald-800">
                                      {rec.nominalOrItem}
                                    </div>
                                  </div>

                                  {/* Jadwal & Lokasi */}
                                  <div className="text-[9px] text-slate-600 space-y-0.5 mb-2">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-emerald-700 shrink-0" />
                                      <span>Jadwal: <strong>{rec.distributionDate || 'Sesuai Jadwal'}</strong> ({rec.distributionTime || '08:30 WIB'})</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                                      <span className="truncate">Lokasi: <strong>{rec.distributionLocation || 'Kantor Desa Pulau Betung'}</strong></span>
                                    </div>
                                  </div>

                                  {/* SOP Ringkas */}
                                  <div className="text-[8px] text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200">
                                    <strong>Syarat:</strong> Wajib bawa KTP Asli, KK Asli & Kartu ini. <em>100% Gratis & Bebas Biaya.</em>
                                  </div>
                                </div>

                                {/* Tanda Tangan & QR Code Verifikasi (Di Bawah) */}
                                <div className="pt-2 border-t border-slate-300 grid grid-cols-3 gap-2 text-center text-[8px] mt-2 items-end">
                                  <div className="flex flex-col justify-between h-14">
                                    <span>Penerima Manfaat,</span>
                                    <span className="font-bold underline uppercase">{rec.name.slice(0, 14)}</span>
                                  </div>
                                  <div className="flex flex-col items-center justify-end h-14">
                                    <div className="w-8 h-8 bg-white border border-slate-800 p-0.5 flex items-center justify-center overflow-hidden relative">
                                      {qrMap[rec.id] ? (
                                        <>
                                          <img src={qrMap[rec.id]} alt={`QR ${rec.name}`} className="w-full h-full object-contain" />
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-2.5 h-2.5 bg-white rounded-full p-[1px] border border-slate-900 shadow-xs flex items-center justify-center overflow-hidden">
                                              {villageLogo ? (
                                                <img src={villageLogo} alt="Logo Desa" className="w-full h-full object-contain" />
                                              ) : (
                                                <SadewaHouseLogo size={8} color="#10b981" />
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-[6px] font-black text-slate-950 uppercase font-mono">QR</div>
                                      )}
                                    </div>
                                    <span className="text-[6px] font-mono font-bold text-emerald-800 mt-0.5">✓ TERVERIFIKASI</span>
                                  </div>
                                  <div className="flex flex-col justify-between h-14">
                                    <span>Kepala Desa,</span>
                                    <div className="h-8 flex items-center justify-center">
                                      {officialSignature ? (
                                        <img src={officialSignature} alt="TTD Kades" className="max-h-8 object-contain" />
                                      ) : (
                                        <div className="h-8"></div>
                                      )}
                                    </div>
                                    <span className="font-bold underline">{kadesName}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* LAYOUT RENDER: 2 PER PAGE (2x1 GRID) */}
                      {layoutMode === '2_per_page' && (
                        <div className="grid grid-cols-1 gap-6 h-full divide-y-2 divide-dashed divide-slate-400">
                          {pageRecipients.map((rec, rIdx) => {
                            const serialNumber = `400.9/BANSOS-PLB/${new Date().getFullYear()}/${rec.programType}/${rec.id.replace(/\D/g, '').padStart(4, '0').slice(-4) || '0842'}`;
                            return (
                              <div
                                key={rec.id}
                                className={`flex flex-col justify-between relative bg-white p-4 avoid-break ${rIdx > 0 ? 'pt-6' : ''}`}
                                style={{ minHeight: '480px' }}
                              >
                                <div className="absolute -top-3 right-6 bg-white px-2 text-[10px] font-mono text-slate-500 border border-slate-300 rounded">
                                  ✂ GUNTING POTONGAN
                                </div>

                                {/* Kop Surat Medium */}
                                <div>
                                  <div className="border-b-2 border-slate-900 pb-2 mb-3 flex items-center justify-between gap-3">
                                    <div className="w-12 h-12 flex items-center justify-center shrink-0">
                                      {regencyLogo ? (
                                        <img src={regencyLogo} alt="Logo Kabupaten" className="w-full h-full object-contain" />
                                      ) : (
                                        <div className="w-12 h-12" />
                                      )}
                                    </div>
                                    <div className="flex-1 text-center">
                                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-serif">
                                        PEMERINTAH {villageName ? villageName.toUpperCase() : 'DESA PULAU BETUNG'}
                                      </h5>
                                      <h3 className="text-sm font-black uppercase text-slate-950 font-serif">
                                        KARTU PENGAMBILAN BANSOS
                                      </h3>
                                      <p className="text-[9px] text-slate-500 font-mono font-medium">
                                        NO. RESI: {serialNumber}
                                      </p>
                                    </div>
                                    <div className="w-12 h-12 flex items-center justify-center shrink-0">
                                      {villageLogo ? (
                                        <img src={villageLogo} alt="Logo Desa" className="w-full h-full object-contain" />
                                      ) : (
                                        <div className="w-12 h-12" />
                                      )}
                                    </div>
                                  </div>

                                  {/* Body Details */}
                                  <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Nama Penerima:</span>
                                        <strong className="text-slate-950 uppercase text-xs">{rec.name}</strong>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">NIK:</span>
                                        <span className="font-mono font-bold text-slate-900">{maskNik(rec.nik)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Alamat:</span>
                                        <span className="text-slate-800 font-semibold">{rec.dusun}, RT {rec.rt}</span>
                                      </div>
                                    </div>

                                    <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-300 space-y-1">
                                      <div className="text-[11px] font-bold text-emerald-950 uppercase">{rec.programName}</div>
                                      <div className="text-sm font-black text-emerald-900">{rec.nominalOrItem}</div>
                                      <div className="text-[10px] text-slate-600">
                                        Jadwal: {rec.distributionDate || 'Sesuai Jadwal'} ({rec.distributionTime || '08:30 WIB'})
                                      </div>
                                      <div className="text-[10px] text-slate-600">
                                        Lokasi: {rec.distributionLocation || 'Aula Kantor Desa'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-[10px] text-slate-600 bg-amber-50/60 p-2 rounded-lg border border-amber-200 mb-2">
                                    <strong>Catatan:</strong> Bawa KTP Asli dan KK Asli saat hadir. Pelayanan gratis 100% tanpa potongan.
                                  </div>
                                </div>

                                {/* Signatures & QR Code (Di Bawah) */}
                                <div className="grid grid-cols-3 gap-3 text-center text-[10px] pt-2 border-t border-slate-200 items-end">
                                  <div className="flex flex-col justify-between h-20">
                                    <span>Penerima Manfaat (KPM),</span>
                                    <span className="font-bold underline uppercase">{rec.name}</span>
                                  </div>
                                  <div className="flex flex-col items-center justify-end h-20">
                                    <span className="text-[8px] font-bold uppercase text-slate-600 mb-0.5">VERIFIKASI DIGITAL</span>
                                    <div className="w-12 h-12 bg-white border border-slate-800 p-0.5 flex items-center justify-center overflow-hidden relative">
                                      {qrMap[rec.id] ? (
                                        <>
                                          <img src={qrMap[rec.id]} alt={`QR ${rec.name}`} className="w-full h-full object-contain" />
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-3 h-3 bg-white rounded-full p-[1px] border border-slate-900 shadow-xs flex items-center justify-center overflow-hidden">
                                              {villageLogo ? (
                                                <img src={villageLogo} alt="Logo Desa" className="w-full h-full object-contain" />
                                              ) : (
                                                <SadewaHouseLogo size={9} color="#10b981" />
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-[8px] font-bold text-slate-950">QR</div>
                                      )}
                                    </div>
                                    <span className="text-[7px] font-mono font-bold text-emerald-800 mt-0.5">✓ SAH &amp; TERVERIFIKASI</span>
                                  </div>
                                  <div className="flex flex-col justify-between h-20">
                                    <span>Kepala Desa {villageName || 'Pulau Betung'},</span>
                                    <div className="h-10 flex items-center justify-center">
                                      {officialSignature ? (
                                        <img src={officialSignature} alt="TTD Kades" className="max-h-10 object-contain" />
                                      ) : (
                                        <div className="h-10"></div>
                                      )}
                                    </div>
                                    <span className="font-bold underline">{kadesName}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* LAYOUT RENDER: 1 PER PAGE */}
                      {layoutMode === '1_per_page' && (
                        <div>
                          {pageRecipients.map((rec) => {
                            const serialNumber = `400.9/BANSOS-PLB/${new Date().getFullYear()}/${rec.programType}/${rec.id.replace(/\D/g, '').padStart(4, '0').slice(-4) || '0842'}`;
                            return (
                              <div key={rec.id} className="space-y-4 border-2 border-slate-900 p-6 rounded-2xl bg-white">
                                <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-3">
                                  <div className="w-14 h-14 flex items-center justify-center shrink-0">
                                    {regencyLogo ? (
                                      <img src={regencyLogo} alt="Logo Kabupaten" className="w-full h-full object-contain" />
                                    ) : (
                                      <div className="w-14 h-14" />
                                    )}
                                  </div>
                                  <div className="flex-1 text-center space-y-0.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                      PEMERINTAH {villageName ? villageName.toUpperCase() : 'DESA PULAU BETUNG'}
                                    </h4>
                                    <h2 className="text-base sm:text-lg font-black uppercase text-slate-950 font-serif">
                                      KARTU PENGAMBILAN BANSOS
                                    </h2>
                                    <p className="text-[11px] font-mono text-slate-600 font-medium">
                                      No. Resi: <span className="text-slate-950 font-bold">{serialNumber}</span>
                                    </p>
                                  </div>
                                  <div className="w-14 h-14 flex items-center justify-center shrink-0">
                                    {villageLogo ? (
                                      <img src={villageLogo} alt="Logo Desa" className="w-full h-full object-contain" />
                                    ) : (
                                      <div className="w-14 h-14" />
                                    )}
                                  </div>
                                </div>

                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-slate-500 block">Nama Lengkap KPM:</span>
                                      <strong className="text-base font-black uppercase text-slate-950">{rec.name}</strong>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 block">Nomor NIK Kependudukan:</span>
                                      <span className="font-mono font-bold text-slate-900 text-sm">{maskNik(rec.nik)}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 block">Wilayah Domisili:</span>
                                      <span className="font-bold text-slate-800">{rec.dusun}, RT {rec.rt}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 block">Program Bantuan:</span>
                                      <span className="font-black text-emerald-900">{rec.programName}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-4 bg-emerald-50 rounded-xl border-2 border-emerald-500/80 flex items-center justify-between">
                                  <div>
                                    <span className="text-xs font-bold text-emerald-800 uppercase">Besaran / Hak Bantuan KPM:</span>
                                    <h3 className="text-xl font-black text-emerald-950 font-serif">{rec.nominalOrItem}</h3>
                                  </div>
                                  <div className="text-right text-xs text-slate-700">
                                    <div>Jadwal: <strong>{rec.distributionDate || 'Sesuai Jadwal'}</strong></div>
                                    <div>Lokasi: <strong>{rec.distributionLocation || 'Kantor Desa'}</strong></div>
                                  </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold">
                                  Syarat: Wajib bawa KTP Asli, KK Asli &amp; Kartu ini. 100% Gratis &amp; Bebas Biaya.
                                </div>

                                <div className="pt-4 grid grid-cols-3 gap-4 text-center text-xs border-t border-slate-200 items-end">
                                  <div className="flex flex-col justify-between h-24">
                                    <span>Penerima Manfaat (KPM),</span>
                                    <div className="h-14"></div>
                                    <strong className="underline uppercase text-[11px]">{rec.name}</strong>
                                  </div>
                                  <div className="flex flex-col items-center justify-end h-24">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-1">VERIFIKASI DIGITAL</span>
                                    <div className="w-14 h-14 bg-white p-0.5 rounded border border-slate-800 flex items-center justify-center overflow-hidden relative">
                                      {qrMap[rec.id] ? (
                                        <>
                                          <img src={qrMap[rec.id]} alt={`QR ${rec.name}`} className="w-full h-full object-contain" />
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-3.5 h-3.5 bg-white rounded-full p-0.5 border border-slate-900 shadow-xs flex items-center justify-center overflow-hidden">
                                              {villageLogo ? (
                                                <img src={villageLogo} alt="Logo Desa" className="w-full h-full object-contain" />
                                              ) : (
                                                <SadewaHouseLogo size={10} color="#10b981" />
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-[8px] font-bold text-slate-400">QR</div>
                                      )}
                                    </div>
                                    <span className="text-[8px] font-mono font-bold text-emerald-800 mt-1">✓ TERVERIFIKASI</span>
                                  </div>
                                  <div className="flex flex-col justify-between h-24">
                                    <span>Kepala Desa {villageName || 'Pulau Betung'},</span>
                                    <div className="h-14 flex items-center justify-center">
                                      {officialSignature ? (
                                        <img src={officialSignature} alt="TTD Kades" className="max-h-14 object-contain" />
                                      ) : (
                                        <div className="h-14"></div>
                                      )}
                                    </div>
                                    <strong className="underline text-[11px]">{kadesName}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Info */}
          <div className="pt-3 text-center text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <BadgeCheck className="w-4 h-4" />
              <span>Format dokumen otomatis dipaginasikan untuk pencetakan langsung kertas A4.</span>
            </span>
            <span className="font-mono text-slate-300">
              {activeRecipients.length} KPM &bull; {estimatedPages} Halaman A4
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
