import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ToddlerRecord } from '../../types/posyandu';
import { useApp } from '../../context/AppContext';
import { generateVerificationQrCode } from '../../utils/qrHelper';
import { calculateAgeInMonths } from '../../utils/whoZScoreCalculator';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';
import { uploadImageService } from '../../services/uploadService';
import {
  Printer,
  X,
  Share2,
  Copy,
  Check,
  Heart,
  Baby,
  ShieldCheck,
  Calendar,
  MapPin,
  BadgeCheck,
  Phone,
  Activity,
  Award,
  CheckCircle2,
  Smile,
  Palette,
  ExternalLink,
  Upload,
  Loader2,
  Download
} from 'lucide-react';

interface KiaCardPrintModalProps {
  toddler: ToddlerRecord;
  onClose: () => void;
  isNewRegistration?: boolean;
}

export const KiaCardPrintModal: React.FC<KiaCardPrintModalProps> = ({
  toddler,
  onClose,
  isNewRegistration = false
}) => {
  const { villageProfile, officials, addToast, updateVillageProfile } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKia, setCopiedKia] = useState(false);
  const [colorTheme, setColorTheme] = useState<'emerald' | 'cyan' | 'rose'>(
    toddler.gender === 'P' ? 'rose' : 'emerald'
  );
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>('both');

  // Jalur Logo Resmi dari Kop Surat & Profil Desa (Default KIA Logo)
  const defaultVillageLogoUrl = villageProfile?.villageLogoUrl?.trim() || '';
  const regencyLogoUrl = villageProfile?.regencyLogoUrl?.trim() || '';
  
  // Custom logo spesifik untuk kartu KIA saja (Satu Arah)
  const customKiaLogoUrl = (villageProfile?.settings?.kiaLogoUrl as string | undefined)?.trim() || '';
  const activeLogoUrl = customKiaLogoUrl || defaultVillageLogoUrl;

  const [villageLogoError, setVillageLogoError] = useState(false);
  const [regencyLogoError, setRegencyLogoError] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Handler upload / ganti logo desa khusus untuk panel Kartu KIA
  const handleUploadVillageLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast('error', 'Ukuran Terlalu Besar', 'Maksimal ukuran logo adalah 10MB.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const res = await uploadImageService(file);
      if (res.success && res.url) {
        await updateVillageProfile({ 
          settings: { 
            ...(villageProfile?.settings || {}),
            kiaLogoUrl: res.url
          }
        });
        setVillageLogoError(false);
        addToast(
          'success',
          'Logo KIA Diperbarui',
          'Logo pada Kartu KIA berhasil diubah tanpa memengaruhi logo resmi desa.'
        );
      } else {
        addToast('error', 'Gagal Mengunggah', res.error || 'Terjadi kesalahan saat memproses logo.');
      }
    } catch (err) {
      console.error('Upload logo error:', err);
      addToast('error', 'Gagal Mengunggah', 'Gagal memproses berkas gambar logo.');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  // Find Village Officials / Midwife
  const bidanOfficial = officials.find(
    (o) =>
      o.position.toLowerCase().includes('bidan') ||
      o.position.toLowerCase().includes('kesehatan') ||
      o.position.toLowerCase().includes('pkk')
  );
  const bidanName = bidanOfficial ? bidanOfficial.name : 'Bidan Desa Nining, S.Tr.Keb';
  const bidanNip = bidanOfficial?.nip || 'SIPB. 446/014/BIDAN/PMY/2024';

  const kadesName = villageProfile.kadesName || 'H. Sudirman';

  const todayStr = new Date().toISOString().split('T')[0];
  const ageMonths = calculateAgeInMonths(toddler.birthDate, todayStr);

  // Format Dates
  const formattedBirthDate = new Date(toddler.birthDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Generate QR Code with verifiable metadata
  useEffect(() => {
    let isMounted = true;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pulaubetung.sadewa.id';
    const verifyUrl = `${origin}/posyandu?kia=${encodeURIComponent(toddler.kmsCardNumber)}&nik=${encodeURIComponent(toddler.nik)}`;
    
    // Detailed payload for direct scanning
    const qrPayload = `KARTU IDENTITAS KESEHATAN ANAK (KIA)\n` +
      `No. KIA: ${toddler.kmsCardNumber}\n` +
      `Nama: ${toddler.name} (${toddler.gender === 'L' ? 'Laki-Laki' : 'Perempuan'})\n` +
      `NIK: ${toddler.nik}\n` +
      `Tgl Lahir: ${toddler.birthDate}\n` +
      `Ortu: ${toddler.parentName}\n` +
      `Wilayah: ${toddler.rtRw} ${toddler.dusunName}\n` +
      `Posyandu Desa Pulau Betung, Kec. Pemayung\n` +
      `Verifikasi Resmi: ${verifyUrl}`;

    generateVerificationQrCode(qrPayload, {
      width: 280,
      margin: 1,
      darkColor: colorTheme === 'emerald' ? '#064e3b' : colorTheme === 'cyan' ? '#0e7490' : '#881337',
      lightColor: '#ffffff'
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Gagal membuat QR Kartu KIA:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [toddler, colorTheme]);

  // Isolate body for printing
  useEffect(() => {
    document.body.classList.add('kia-modal-active');
    return () => {
      document.body.classList.remove('kia-modal-active');
    };
  }, []);

  const handleCopyKiaNumber = () => {
    navigator.clipboard.writeText(toddler.kmsCardNumber);
    setCopiedKia(true);
    addToast('success', 'Nomor KIA Disalin', `Nomor ${toddler.kmsCardNumber} berhasil disalin ke clipboard.`);
    setTimeout(() => setCopiedKia(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // Kualitas tinggi
        useCORS: true, // Untuk gambar eksternal (logo)
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // Menggunakan PDF A4 (potret) dan menyesuaikan ukuran canvas ke rasio halaman
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Kartu_KIA_${toddler.name.replace(/\s+/g, '_')}_${toddler.kmsCardNumber}.pdf`);
      
      addToast('success', 'PDF Berhasil Diunduh', 'Kartu KIA berhasil disimpan sebagai PDF.');
    } catch (error) {
      console.error('PDF generation error:', error);
      addToast('error', 'Gagal Mengunduh', 'Terjadi kesalahan saat membuat file PDF. Coba kembali.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendWhatsAppNotification = () => {
    const phoneClean = toddler.parentPhone.replace(/[^0-9]/g, '');
    const formattedPhone = phoneClean.startsWith('0') ? '62' + phoneClean.slice(1) : phoneClean;
    
    const text = `Assalamu’alaikum Warahmatullahi Wabarakatuh.\n\n` +
      `Pemberitahuan Resmi e-Posyandu & KIA Digital *${villageProfile.villageName || 'Desa Pulau Betung'}*:\n` +
      `Selamat! Ananda *${toddler.name}* telah terdaftar resmi dalam Sistem Kesehatan Ibu dan Anak (KIA).\n\n` +
      `📋 *Rincian Kartu Identitas Anak (KIA):*\n` +
      `• No. Registrasi KIA: *${toddler.kmsCardNumber}*\n` +
      `• NIK Balita: *${toddler.nik}*\n` +
      `• Tanggal Lahir: *${formattedBirthDate}* (${ageMonths} Bulan)\n` +
      `• Dusun Posyandu: *${toddler.dusunName}*\n\n` +
      `Silakan simpan nomor KIA ini. Harap selalu membawa Buku/Kartu KIA saat jadwal penimbangan rutin Posyandu bulanan untuk pemantauan tumbuh kembang dan imunisasi lengkap.\n\n` +
      `_Salam Hangat, Bidan Desa & Tim Pendamping Keluarga (TPK) ${villageProfile.villageName || 'Desa Pulau Betung'}_`;

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`, '_blank');
    addToast('success', 'WhatsApp Terbuka', 'Pesan rincian Kartu KIA siap dikirim ke nomor orang tua.');
  };

  // Theme-specific styles
  const themeStyles = {
    emerald: {
      cardBorder: 'border-emerald-500',
      headerBg: 'bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900',
      accentBadge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      heroNumberBg: 'bg-emerald-900/90 text-amber-300 border-emerald-400/50',
      pillBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      tagline: 'text-emerald-700',
      divider: 'border-emerald-200',
      avatarRing: 'ring-emerald-400 bg-emerald-100 text-emerald-800',
      backHeaderBg: 'bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-900',
      stunningTitle: 'text-emerald-800'
    },
    cyan: {
      cardBorder: 'border-cyan-500',
      headerBg: 'bg-gradient-to-r from-cyan-800 via-sky-700 to-teal-900',
      accentBadge: 'bg-cyan-100 text-cyan-900 border-cyan-300',
      heroNumberBg: 'bg-cyan-950/90 text-amber-300 border-cyan-400/50',
      pillBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      tagline: 'text-cyan-700',
      divider: 'border-cyan-200',
      avatarRing: 'ring-cyan-400 bg-cyan-100 text-cyan-800',
      backHeaderBg: 'bg-gradient-to-r from-cyan-900 via-sky-800 to-teal-900',
      stunningTitle: 'text-cyan-800'
    },
    rose: {
      cardBorder: 'border-rose-400',
      headerBg: 'bg-gradient-to-r from-rose-700 via-pink-700 to-rose-900',
      accentBadge: 'bg-rose-100 text-rose-900 border-rose-300',
      heroNumberBg: 'bg-rose-950/90 text-amber-300 border-rose-400/50',
      pillBg: 'bg-rose-50 text-rose-800 border-rose-200',
      tagline: 'text-rose-700',
      divider: 'border-rose-200',
      avatarRing: 'ring-rose-400 bg-rose-100 text-rose-800',
      backHeaderBg: 'bg-gradient-to-r from-rose-900 via-pink-800 to-rose-900',
      stunningTitle: 'text-rose-800'
    }
  }[colorTheme];

  // Immunization schedule checklist items
  const immunizationChecklist = [
    { age: '0 Bulan', vaccine: 'Hepatitis B (HB0)', done: true },
    { age: '1 Bulan', vaccine: 'BCG, Polio 1', done: ageMonths >= 1 },
    { age: '2 Bulan', vaccine: 'DPT-HB-Hib 1, Polio 2, PCV 1', done: ageMonths >= 2 },
    { age: '3 Bulan', vaccine: 'DPT-HB-Hib 2, Polio 3, PCV 2', done: ageMonths >= 3 },
    { age: '4 Bulan', vaccine: 'DPT-HB-Hib 3, Polio 4, IPV', done: ageMonths >= 4 },
    { age: '9 Bulan', vaccine: 'Campak-Rubella (MR), IPV 2', done: ageMonths >= 9 },
    { age: '18 Bulan', vaccine: 'DPT-HB-Hib & MR Lanjutan', done: ageMonths >= 18 }
  ];

  return createPortal(
    <div id="kia-card-portal" className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-5xl w-full border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:text-slate-950 print:rounded-none">
        
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  {isNewRegistration ? 'Pendaftaran Sukses • Panel Kartu KIA Baru' : 'Dokumen Resmi e-Posyandu'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold">
                  Standar Kemenkes RI
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Kartu Identitas Anak (KIA) & KMS</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 border border-slate-700">
                  {toddler.kmsCardNumber}
                </span>
              </h2>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Color Palette Switcher */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              <span className="px-2 text-slate-400 text-[11px] flex items-center gap-1 font-semibold">
                <Palette className="w-3.5 h-3.5" /> Tema:
              </span>
              <button
                onClick={() => setColorTheme('emerald')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  colorTheme === 'emerald' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Toska
              </button>
              <button
                onClick={() => setColorTheme('cyan')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  colorTheme === 'cyan' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Biru
              </button>
              <button
                onClick={() => setColorTheme('rose')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  colorTheme === 'rose' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Pink
              </button>
            </div>

            {/* Side View Switcher (Screen only) */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => setActiveSide('both')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeSide === 'both' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Keduanya (A4)
              </button>
              <button
                onClick={() => setActiveSide('front')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeSide === 'front' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Muka Depan
              </button>
              <button
                onClick={() => setActiveSide('back')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeSide === 'back' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Muka Belakang
              </button>
            </div>

            {/* Jalur Logo Desa dari Kop Surat */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              <span className="px-2 text-slate-400 text-[11px] flex items-center gap-1 font-semibold">
                Logo Kop:
              </span>
              {activeLogoUrl && !villageLogoError ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
                  <img
                    src={activeLogoUrl}
                    alt="Logo Kop"
                    className="w-4 h-4 object-contain rounded bg-white p-0.5 shadow-xs"
                    crossOrigin="anonymous"
                  />
                  <span className="hidden md:inline">{customKiaLogoUrl ? 'Khusus KIA' : 'Kop Surat'}</span>
                </div>
              ) : (
                <span className="px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-300 text-[11px] font-medium">
                  Default SADEWA
                </span>
              )}
              <label
                className={`ml-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isUploadingLogo
                    ? 'bg-slate-700 text-slate-400 cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                }`}
                title="Unggah atau ubah logo desa resmi yang otomatis terhubung ke Kop Surat dan Kartu KIA"
              >
                {isUploadingLogo ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3 text-amber-300" />
                )}
                <span>{isUploadingLogo ? 'Mengunggah...' : activeLogoUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={isUploadingLogo}
                  className="hidden"
                  onChange={handleUploadVillageLogo}
                />
              </label>
            </div>

            {/* WA Button */}
            <button
              onClick={handleSendWhatsAppNotification}
              title="Kirim detail kartu KIA ke WhatsApp orang tua"
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kirim ke WA Ortu</span>
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className={`px-3 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all ${
                isGeneratingPdf ? 'bg-slate-700 text-slate-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'
              }`}
              title="Unduh sebagai file PDF"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isGeneratingPdf ? 'Memproses...' : 'Unduh PDF'}</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Kartu KIA</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Notification Banner (For newly registered toddlers) */}
        {isNewRegistration && (
          <div className="bg-gradient-to-r from-emerald-900/60 via-teal-900/60 to-emerald-900/60 px-6 py-3 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200 print:hidden">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>
                <strong>Registrasi Berhasil!</strong> Nomor KIA balita <strong>{toddler.kmsCardNumber}</strong> telah diterbitkan secara otomatis dan terintegrasi dengan Database e-Posyandu.
              </span>
            </div>
            <button
              onClick={handleCopyKiaNumber}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
            >
              {copiedKia ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKia ? 'Tersalin' : 'Salin No. KIA'}</span>
            </button>
          </div>
        )}

        {/* Scrollable Printable Canvas Container */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-950/50 space-y-8 print:p-0 print:m-0 print:bg-white print:overflow-visible flex flex-col items-center">
          
          {/* Helpful printing instruction tip (Screen only) */}
          <div className="w-full max-w-4xl bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 text-slate-300 text-xs flex items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Panduan Cetak Fisik:</strong> Kartu dirancang dengan rasio standar ID Card / Buku KIA. Anda dapat mencetak pada kertas <strong>A4 HVS 100gr</strong> atau <strong>Kertas Foto Glossy</strong>, lalu menggunting dan melaminasinya sebagai kartu saku resmi anak.
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">Ukuran: 105mm &times; 74mm per muka</span>
          </div>

          {/* MAIN PRINTABLE KIA SHEET */}
          <div
            id="kia-card-printable"
            ref={printRef}
            className="w-full max-w-4xl space-y-6 print:space-y-6 print:w-full print:max-w-none print:m-0"
          >
            {/* WRAPPER: SISI DEPAN & SISI BELAKANG */}
            <div className={`grid gap-6 ${activeSide === 'both' ? 'grid-cols-1 lg:grid-cols-2 print:grid-cols-2' : 'grid-cols-1'}`}>

              {/* ========================================================= */}
              {/* 1. MUKA DEPAN (FRONT FACE) - IDENTITAS BALITA & QR CODE    */}
              {/* ========================================================= */}
              {(activeSide === 'both' || activeSide === 'front') && (
                <div className={`bg-white text-slate-900 rounded-3xl border-2 ${themeStyles.cardBorder} shadow-xl overflow-hidden flex flex-col justify-between relative print:shadow-none print:rounded-2xl print:border print:border-slate-400 print:break-inside-avoid`}>
                  
                  {/* Watermark Logo Background (Resmi dari Kop Surat Desa) */}
                  <div className="absolute right-4 bottom-12 opacity-[0.06] pointer-events-none select-none flex items-center justify-center">
                    {activeLogoUrl && !villageLogoError ? (
                      <img
                        src={activeLogoUrl}
                        alt="Watermark Logo Desa"
                        className="w-56 h-56 object-contain grayscale"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <SadewaHouseLogo size={220} color="#059669" />
                    )}
                  </div>

                  {/* Card Header */}
                  <div className={`${themeStyles.headerBg} text-white p-4 sm:p-5 relative overflow-hidden`}>
                    {/* Decorative elements */}
                    <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
                    <div className="absolute left-1/3 top-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between gap-3 relative z-10">
                      {/* Left: Official Village Logo (Jalur Kop Surat Resmi) */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white p-1 shadow-md shrink-0 flex items-center justify-center overflow-hidden border border-white/40">
                          {activeLogoUrl && !villageLogoError ? (
                            <img
                              src={activeLogoUrl}
                              alt="Logo Desa Resmi"
                              className="w-full h-full object-contain"
                              crossOrigin="anonymous"
                              onError={() => setVillageLogoError(true)}
                            />
                          ) : regencyLogoUrl && !regencyLogoError ? (
                            <img
                              src={regencyLogoUrl}
                              alt="Lambang Daerah"
                              className="w-full h-full object-contain"
                              crossOrigin="anonymous"
                              onError={() => setRegencyLogoError(true)}
                            />
                          ) : (
                            <SadewaHouseLogo size={28} color="#059669" />
                          )}
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-emerald-200">
                            {villageProfile.district || 'Kecamatan Pemayung'} • {villageProfile.regency || 'Kabupaten Batang Hari'}
                          </div>
                          <h3 className="text-sm sm:text-base font-black tracking-tight leading-none text-white mt-0.5">
                            {villageProfile.villageName || 'DESA PULAU BETUNG'}
                          </h3>
                          <p className="text-[10px] text-emerald-100/90 font-medium">
                            Unit Pelayanan Terpadu e-Posyandu & KIA
                          </p>
                        </div>
                      </div>

                      {/* Right: National Logo / Health Badge & Regional Emblem */}
                      <div className="flex items-center gap-2 shrink-0">
                        {regencyLogoUrl && activeLogoUrl && !regencyLogoError && (
                          <div className="hidden sm:flex w-9 h-9 rounded-lg bg-white/20 p-1 items-center justify-center border border-white/30 shadow-xs">
                            <img
                              src={regencyLogoUrl}
                              alt="Lambang Daerah"
                              className="max-h-full max-w-full object-contain"
                              crossOrigin="anonymous"
                              onError={() => setRegencyLogoError(true)}
                            />
                          </div>
                        )}
                        <div className="text-right">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 border border-white/30 text-[10px] font-extrabold text-amber-300">
                            <ShieldCheck className="w-3 h-3 text-amber-300" />
                            <span>KEMENKES RI</span>
                          </div>
                          <div className="text-[9px] text-emerald-100 font-bold mt-0.5">
                            STANDAR WHO 2026
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ribbon Title */}
                    <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-rose-300 fill-rose-300" />
                        <span className="text-xs font-black tracking-wider uppercase text-white">
                          KARTU KESEHATAN IBU DAN ANAK (KIA)
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black tracking-wide">
                        BUKU SAKU KMS
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Identitas & QR Code */}
                  <div className="p-4 sm:p-5 space-y-4 relative z-10 flex-1 flex flex-col justify-between">
                    
                    {/* Top Row: KIA Number & Current Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Nomor Registrasi KIA Digital:
                        </span>
                        <div className="font-mono text-sm sm:text-base font-black px-3 py-1 rounded-xl bg-slate-900 text-amber-400 border border-slate-700 shadow-inner inline-flex items-center gap-2">
                          <span>{toddler.kmsCardNumber}</span>
                          <button
                            type="button"
                            onClick={handleCopyKiaNumber}
                            className="text-slate-400 hover:text-white print:hidden"
                            title="Salin Nomor"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${themeStyles.accentBadge}`}>
                          {toddler.gender === 'L' ? '👦 BALITA LAKI-LAKI' : '👧 BALITA PEREMPUAN'}
                        </span>
                        <div className="text-[10px] text-slate-500 font-semibold mt-1">
                          Usia: <strong className="text-slate-900">{ageMonths} Bulan</strong>
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Biodata & QR Code Side-by-Side */}
                    <div className="grid grid-cols-12 gap-3 items-center">
                      
                      {/* Left: Avatar & Identity Details (8 cols) */}
                      <div className="col-span-8 space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Nama Lengkap Balita:</span>
                          <h4 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                            {toddler.name}
                          </h4>
                          <span className="font-mono text-[11px] text-slate-600 block">
                            NIK: <strong>{toddler.nik}</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Tanggal Lahir:</span>
                            <span className="font-bold text-slate-800">{formattedBirthDate}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">BB / TB Lahir:</span>
                            <span className="font-bold text-emerald-800">
                              {toddler.birthWeightKg} kg • {toddler.birthHeightCm} cm
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] space-y-0.5 pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400 text-[10px]">Orang Tua:</span>{' '}
                            <strong className="text-slate-800">{toddler.parentName}</strong>{' '}
                            <span className="text-slate-500 font-mono text-[10px]">({toddler.parentPhone})</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Wilayah Domisili:</span>{' '}
                            <span className="font-semibold text-slate-800">{toddler.rtRw}, {toddler.dusunName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">Posyandu Induk:</span>{' '}
                            <span className="font-bold text-emerald-700">Posyandu {toddler.dusunName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Official Verifiable QR Code (4 cols) */}
                      <div className="col-span-4 flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50 border border-slate-200">
                        {qrDataUrl ? (
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
                            <img
                              src={qrDataUrl}
                              alt={`QR Code ${toddler.kmsCardNumber}`}
                              className="w-full h-full object-contain rounded-xl border border-slate-300 shadow-xs bg-white"
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                              <div className="w-5 h-5 bg-white rounded-full p-0.5 border border-slate-900 shadow-xs flex items-center justify-center overflow-hidden">
                                {villageProfile?.villageLogoUrl ? (
                                  <img src={villageProfile.villageLogoUrl} alt="Logo Desa" className="w-full h-full object-contain" />
                                ) : (
                                  <SadewaHouseLogo size={12} color="#10b981" />
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-24 h-24 bg-slate-200 animate-pulse rounded-xl" />
                        )}
                        <span className="text-[9px] font-black text-center text-slate-700 mt-1.5 leading-tight flex items-center justify-center gap-0.5">
                          <BadgeCheck className="w-2.5 h-2.5 text-amber-500" />
                          <span>PINDAI VERIFIKASI</span>
                        </span>
                        <span className="text-[8px] text-center text-slate-400 leading-none">
                          KMS & Rekam Medis
                        </span>
                        <div className="mt-1 flex items-center gap-1 opacity-60">
                          {villageProfile.sadewaLogoUrl || villageProfile.sadewaIconUrl ? (
                            <img 
                              src={villageProfile.sadewaLogoUrl || villageProfile.sadewaIconUrl} 
                              alt="SADEWA" 
                              className="h-2.5 sm:h-3 w-auto object-contain brightness-0 invert" 
                            />
                          ) : (
                            <>
                              <SadewaHouseLogo size={8} className="text-slate-400" />
                              <span className="text-[7px] font-black tracking-widest uppercase">SADEWA Digital</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Ribbon / Tagline */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-1 font-semibold text-emerald-800">
                        <Smile className="w-3 h-3 text-emerald-600" />
                        <span>Generasi Bebas Stunting Desa Pulau Betung</span>
                      </div>
                      <span className="font-mono text-[9px] text-slate-400">
                        Dicetak: {printDateStr}
                      </span>
                    </div>

                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* 2. MUKA BELAKANG (BACK FACE) - CHECKLIST IMUNISASI & GIZI */}
              {/* ========================================================= */}
              {(activeSide === 'both' || activeSide === 'back') && (
                <div className={`bg-white text-slate-900 rounded-3xl border-2 ${themeStyles.cardBorder} shadow-xl overflow-hidden flex flex-col justify-between relative print:shadow-none print:rounded-2xl print:border print:border-slate-400 print:break-inside-avoid`}>
                  
                  {/* Back Header */}
                  <div className={`${themeStyles.backHeaderBg} text-white p-3.5 sm:p-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white p-0.5 shadow-sm flex items-center justify-center shrink-0 overflow-hidden border border-white/30">
                        {activeLogoUrl && !villageLogoError ? (
                          <img
                            src={activeLogoUrl}
                            alt="Logo Desa"
                            className="w-full h-full object-contain"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <Activity className="w-4 h-4 text-emerald-700" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white leading-none">
                          LEMBAR KONTROL IMUNISASI & GIZI
                        </h4>
                        <p className="text-[9px] text-emerald-200 font-medium mt-0.5">
                          Posyandu {villageProfile.villageName || 'Desa Pulau Betung'} • Imunisasi Dasar Lengkap (IDL)
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-[10px] font-bold text-amber-300">
                        {toddler.kmsCardNumber}
                      </span>
                    </div>
                  </div>

                  {/* Back Body: Immunization Table & Stunting Education */}
                  <div className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between text-xs">
                    
                    {/* Immunization Table */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                        <span>Vaksinasi / Imunisasi Wajib</span>
                        <span>Sasaran & Checklist</span>
                      </div>

                      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-[10px]">
                        {immunizationChecklist.map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between px-2.5 py-1 ${
                              item.done ? 'bg-emerald-50/50' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-14 font-bold text-slate-600 shrink-0 font-mono">
                                {item.age}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {item.vaccine}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  item.done
                                    ? 'bg-emerald-600 border-emerald-700 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {item.done && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className={`text-[9px] font-bold ${item.done ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {item.done ? 'Tercatat' : 'Jadwal'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Vitamin A & Obat Cacing Quick Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-900">
                        <Award className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <strong className="block leading-none">Vitamin A</strong>
                          <span className="text-[9px] text-amber-800">Februari & Agustus</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-2 text-teal-900">
                        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                        <div>
                          <strong className="block leading-none">Obat Cacing</strong>
                          <span className="text-[9px] text-teal-800">Setiap 6 Bulan Sekali</span>
                        </div>
                      </div>
                    </div>

                    {/* 4 Pilar Cegah Stunting Edukasi */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span>Pesan Kunci Emas Tumbuh Kembang:</span>
                      </span>
                      <p className="text-[9px] leading-relaxed text-slate-600">
                        1. ASI Eksklusif 0-6 bulan • 2. MP-ASI Kaya Protein Hewani (Ikan, Telur, Daging) • 3. Rutin Timbang di Posyandu • 4. Cuci Tangan Pakai Sabun & Sanitasi Bersih.
                      </p>
                    </div>

                    {/* Signature & Seal Area */}
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-4 items-end text-center text-[10px]">
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[9px]">Mengetahui Orang Tua:</span>
                        <div className="h-8 flex items-end justify-center font-bold text-slate-800 border-b border-slate-300 border-dashed pb-0.5">
                          ({toddler.parentName})
                        </div>
                        <span className="text-slate-400 text-[8px] block">Tanda Tangan Ibu / Ayah</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[9px]">
                          {villageProfile.villageName ? villageProfile.villageName.replace(/^Desa\s+/i, '') : 'Pulau Betung'}, {printDateStr}
                        </span>
                        <div className="h-8 flex flex-col items-center justify-end border-b border-slate-300 pb-0.5 relative">
                          {/* Digital Stamp Watermark with Official Seal */}
                          <div className="absolute -top-3 inset-x-0 flex items-center justify-center opacity-30 pointer-events-none select-none">
                            <div className="border border-emerald-700 text-emerald-800 rounded-full px-2 py-0.5 rotate-[-8deg] flex items-center gap-1 bg-emerald-50/50">
                              {activeLogoUrl && !villageLogoError && (
                                <img
                                  src={activeLogoUrl}
                                  alt="Cap"
                                  className="w-3.5 h-3.5 object-contain"
                                  crossOrigin="anonymous"
                                />
                              )}
                              <span className="text-[7px] font-mono font-black tracking-tight">
                                TERDAFTAR e-POSYANDU
                              </span>
                            </div>
                          </div>
                          <span className="font-bold text-slate-900 leading-tight relative z-10">
                            {bidanName}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[8px] block font-mono">
                          {bidanNip}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>

            {/* Cut and Fold Guide Line (Shown for physical card making) */}
            {activeSide === 'both' && (
              <div className="text-center pt-2 print:pt-4">
                <div className="relative flex items-center justify-center">
                  <div className="border-t-2 border-dashed border-slate-300 w-full" />
                  <span className="bg-slate-900 text-slate-400 px-3 text-[10px] font-mono uppercase tracking-widest absolute print:bg-white print:text-slate-500">
                    &bull; Garis Lipat / Potong Kartu Bolak-Balik &bull;
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 print:text-slate-500">
                  Setelah dicetak, gunting sesuai garis tepi kartu lalu lipat menjadi dua sisi untuk dimasukkan ke dalam plastik mika / dilaminasi.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer Controls (Hidden on Print) */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-400">
            <span>Nomor KIA: </span>
            <strong className="text-emerald-400 font-mono">{toddler.kmsCardNumber}</strong>
            <span className="mx-2">&bull;</span>
            <span>Balita: <strong>{toddler.name}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Kartu KIA Sekarang</span>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
