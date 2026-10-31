import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { BansosRecipient } from '../../types/bansos';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';
import { useApp } from '../../context/AppContext';
import { printRawHtml } from '../../utils/printHelper';
import {
  Printer,
  Share2,
  Copy,
  Check,
  X,
  ShieldCheck,
  Calendar,
  MapPin,
  Clock,
  QrCode,
  FileText,
  AlertCircle,
  Download,
  Building2,
  CheckCircle2
} from 'lucide-react';

interface BansosReceiptModalProps {
  recipient: BansosRecipient | null;
  onClose: () => void;
  villageName?: string;
  villageAddress?: string;
  kadesName?: string;
  onToast?: (type: 'success' | 'info' | 'error', title: string, msg: string) => void;
}

export const BansosReceiptModal: React.FC<BansosReceiptModalProps> = ({
  recipient,
  onClose,
  villageName = 'Desa Pulau Betung',
  villageAddress = 'Jl. Lintas Jambi - Muara Bulian KM. 35, Kec. Pemayung, Kab. Batang Hari',
  kadesName = 'M. Yamin, S.Pd',
  onToast
}) => {
  const { villageProfile } = useApp();
  const [copied, setCopied] = React.useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const printableRef = useRef<HTMLDivElement>(null);

  const regencyLogo = villageProfile?.regencyLogoUrl;
  const villageLogo = villageProfile?.villageLogoUrl;
  const officialSignature = villageProfile?.officialSignatureUrl;

  useEffect(() => {
    if (recipient) {
      document.body.classList.add('bansos-receipt-active');
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pulaubetung.desa.id';
      const verifyUrl = `${origin}/?tab=bansos&nik=${encodeURIComponent(recipient.nik)}&verify=true`;
      
      QRCode.toDataURL(verifyUrl, {
        width: 260,
        margin: 1,
        color: {
          dark: '#020617',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      }).then(url => {
        setQrCodeDataUrl(url);
      }).catch(err => {
        console.error('Failed to generate QR code', err);
      });
    }
    return () => {
      document.body.classList.remove('bansos-receipt-active');
    };
  }, [recipient]);

  if (!recipient) return null;

  const serialNumber = `400.9/BANSOS-PLB/${new Date().getFullYear()}/${recipient.programType}/${recipient.id.replace(/\D/g, '').padStart(4, '0').slice(-4) || '0842'}`;
  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const printTimeFormatted = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    if (printableRef.current) {
      printRawHtml(printableRef.current.innerHTML, `Resi_Bansos_${recipient.name.replace(/\s+/g, '_')}`);
    } else {
      window.print();
    }
  };

  const handleCopy = () => {
    const summary = `*BUKTI RESI PENYALURAN BANSOS DESA PULAU BETUNG*
No. Registrasi: ${serialNumber}
Nama KPM: ${recipient.name}
NIK: ${recipient.nik}
Alamat: ${recipient.dusun}, RT ${recipient.rt}
Program: ${recipient.programName}
Bentuk Bantuan: ${recipient.nominalOrItem}
Periode: ${recipient.period}
Jadwal Ambil: ${recipient.distributionDate || 'Sesuai Jadwal'} (${recipient.distributionTime || '08:30 - 12:00 WIB'})
Lokasi: ${recipient.distributionLocation || 'Kantor Desa Pulau Betung'}
Status: ${recipient.status.toUpperCase()}

_Harap bawa KTP Asli & KK Asli saat pengambilan. 100% Bebas Biaya._`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    if (onToast) {
      onToast('success', 'Resi Disalin', 'Rincian resi berhasil disalin ke clipboard.');
    }
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = `*SURAT RESI PENGAMBILAN BANTUAN SOSIAL - PEMDES PULAU BETUNG*\n\n` +
      `📌 *No. Resi:* ${serialNumber}\n` +
      `👤 *Nama KPM:* ${recipient.name}\n` +
      `💳 *NIK:* ${recipient.nikMasked}\n` +
      `🏡 *Alamat:* ${recipient.dusun}, RT ${recipient.rt}\n` +
      `🎁 *Program:* ${recipient.programName}\n` +
      `💰 *Bantuan:* ${recipient.nominalOrItem} (${recipient.period})\n` +
      `📅 *Jadwal:* ${recipient.distributionDate || 'Sesuai Jadwal'} ${recipient.distributionTime ? `(${recipient.distributionTime})` : ''}\n` +
      `📍 *Lokasi:* ${recipient.distributionLocation || 'Kantor Desa Pulau Betung'}\n` +
      `⚡ *Status:* ${recipient.status === 'siap_diambil' ? 'SIAP DIAMBIL' : recipient.status === 'tersalurkan' ? 'TELAH TERSALURKAN' : 'PROSES VERIFIKASI'}\n\n` +
      `*Persyaratan:* Wajib bawa KTP Asli, KK Asli & Bukti Resi ini.\n` +
      `_Pemerintah Desa Pulau Betung &bull; Layanan Cek Bansos Transparan_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <AnimatePresence>
      <div 
        id="bansos-receipt-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 rounded-3xl p-3 sm:p-5 max-w-4xl w-full shadow-2xl border border-slate-700/80 my-4 sm:my-8 flex flex-col max-h-[92vh]"
        >
          {/* Top Interactive Modal Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Bukti Resi Pengambilan Bansos KPM</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 uppercase">
                    Resmi Pemdes
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Pratinjau tanda terima resmi ber-Kop Surat dan QR Code Pengesahan.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
              <button
                id="btn-copy-bansos-receipt"
                onClick={handleCopy}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 active:scale-95"
                title="Salin ringkasan ke clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>

              <button
                id="btn-share-wa-bansos-receipt"
                onClick={handleShareWhatsApp}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Kirim bukti ke WhatsApp warga"
              >
                <Share2 className="w-4 h-4" />
                <span>Kirim WA</span>
              </button>

              <button
                id="btn-print-bansos-receipt"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                title="Cetak atau Simpan sebagai PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan PDF</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Tutup Pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Paper Container Preview */}
          <div className="flex-1 overflow-y-auto py-3 px-1 sm:px-4 bg-slate-950/60 rounded-2xl mt-3 flex justify-center custom-scrollbar">
            {/* PAPER SIMULATION - CLEAN KARTU PENGAMBILAN BANSOS */}
            <div 
              ref={printableRef}
              id="printable-bansos-receipt-card"
              className="bg-white text-slate-900 w-full max-w-[680px] p-6 sm:p-8 shadow-2xl rounded-2xl border-2 border-slate-900 font-sans relative overflow-hidden text-sm my-auto"
            >
              {/* 1. KOP KARTU RINGKAS */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between gap-3">
                {/* Logo Kabupaten (If uploaded, else blank) */}
                <div className="w-12 h-12 flex items-center justify-center shrink-0">
                  {regencyLogo ? (
                    <img
                      src={regencyLogo}
                      alt="Logo Kabupaten"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12" />
                  )}
                </div>

                <div className="flex-1 text-center space-y-0.5">
                  <h4 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                    PEMERINTAH {villageName ? villageName.toUpperCase() : 'DESA PULAU BETUNG'}
                  </h4>
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase font-serif">
                    KARTU PENGAMBILAN BANSOS
                  </h2>
                  <p className="text-[10px] font-mono text-slate-600 font-medium">
                    No. Resi: <span className="text-slate-950 font-bold">{serialNumber}</span>
                  </p>
                </div>

                {/* Logo Desa (If uploaded, else blank) */}
                <div className="w-12 h-12 flex items-center justify-center shrink-0">
                  {villageLogo ? (
                    <img
                      src={villageLogo}
                      alt="Logo Desa"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12" />
                  )}
                </div>
              </div>

              {/* 2. IDENTITAS PENERIMA MANFAAT (KPM) */}
              <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3 mb-3">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500 font-medium">Nama Penerima:</span>
                  <span className="col-span-2 font-black text-slate-950 uppercase text-sm sm:text-base tracking-wide">
                    {recipient.name}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500 font-medium">Nomor NIK:</span>
                  <span className="col-span-2 font-mono font-bold text-slate-900">
                    {recipient.nik}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500 font-medium">Alamat Dusun:</span>
                  <span className="col-span-2 font-bold text-slate-900">
                    {recipient.dusun}, RT {recipient.rt}
                  </span>
                </div>
              </div>

              {/* 3. RINCIAN PROGRAM BANTUAN */}
              <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-300 text-slate-900 space-y-2 mb-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5 gap-2">
                  <span className="font-extrabold text-emerald-950 text-xs sm:text-sm uppercase font-serif">
                    {recipient.programName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-200/90 text-emerald-950 text-[10px] font-bold border border-emerald-300">
                    {recipient.period}
                  </span>
                </div>

                <div className="text-base sm:text-lg font-black text-emerald-950 font-mono">
                  {recipient.nominalOrItem}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-800 pt-1 border-t border-emerald-200/80">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span><strong>Jadwal:</strong> {recipient.distributionDate || 'Rabu, 25 Maret 2026'} ({recipient.distributionTime || '08:30 - 12:00 WIB'})</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span><strong>Lokasi:</strong> {recipient.distributionLocation || 'Aula Kantor Desa Pulau Betung'}</span>
                  </div>
                </div>
              </div>

              {/* 4. PETUNJUK RINGKAS */}
              <div className="p-2.5 rounded-lg bg-amber-50/90 border border-amber-300 text-amber-950 text-[11px] flex items-center space-x-2 mb-4">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-bold">
                  Syarat: Wajib bawa KTP Asli, KK Asli &amp; Kartu ini. 100% Gratis &amp; Bebas Biaya.
                </span>
              </div>

              {/* 5. TANDA TANGAN & QR CODE VERIFIKASI (DI BAWAH) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="grid grid-cols-3 gap-3 text-center text-xs items-end">
                  {/* Penerima Manfaat */}
                  <div className="flex flex-col justify-between h-24">
                    <span className="text-slate-600 font-medium text-[11px]">Penerima Manfaat,</span>
                    <div className="h-14"></div>
                    <strong className="underline uppercase text-slate-900 font-black text-[11px]">{recipient.name}</strong>
                  </div>

                  {/* QR Code Verifikasi (Di Bawah) */}
                  <div className="flex flex-col items-center justify-end h-24">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-1">VERIFIKASI DIGITAL</span>
                    <div className="w-14 h-14 bg-white p-0.5 rounded border border-slate-800 shadow-xs flex items-center justify-center overflow-hidden relative">
                      {qrCodeDataUrl ? (
                        <>
                          <img
                            src={qrCodeDataUrl}
                            alt={`QR Verifikasi ${recipient.name}`}
                            className="w-full h-full object-contain"
                          />
                          {/* Center Logo Branding Overlay */}
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

                  {/* Kepala Desa */}
                  <div className="flex flex-col justify-between h-24">
                    <span className="text-slate-600 font-medium text-[11px]">Kepala Desa {villageName || 'Pulau Betung'},</span>
                    <div className="h-14 flex items-center justify-center">
                      {officialSignature ? (
                        <img
                          src={officialSignature}
                          alt="TTD Kades"
                          className="max-h-14 object-contain"
                        />
                      ) : (
                        <div className="h-14"></div>
                      )}
                    </div>
                    <strong className="underline text-slate-900 font-bold text-[11px]">{kadesName}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-2 text-center text-xs text-slate-400">
            Tekan tombol <strong>Cetak / Simpan PDF</strong> untuk mencetak langsung ke kertas HVS / A4 atau mengunduh dalam bentuk file dokumen PDF.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
