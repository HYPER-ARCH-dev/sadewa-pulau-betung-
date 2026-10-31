import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  Calendar,
  User,
  Clock,
  ArrowLeft,
  Printer,
  Search,
  ExternalLink,
  QrCode,
  Camera
} from 'lucide-react';
import { api } from '../../services/api';
import { VILLAGE_INFO } from '../../constants/village';
import { useApp } from '../../context/AppContext';
import { QrCameraScannerModal } from '../common/QrCameraScannerModal';

interface DocumentVerificationViewProps {
  initialCode?: string;
  onBack?: () => void;
}

export const DocumentVerificationView: React.FC<DocumentVerificationViewProps> = ({
  initialCode,
  onBack
}) => {
  const { navigateTo, villageProfile } = useApp();
  const [searchCode, setSearchCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.verifyDocument>> | null>(null);

  const performVerification = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await api.verifyDocument(clean);
      setResult(res);
    } catch (err: unknown) {
      setResult({
        success: false,
        verified: false,
        error: err instanceof Error ? err.message : String(err) || 'Gagal menghubungi server verifikasi desa.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      performVerification(initialCode);
    } else if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const resi = urlParams.get('resi') || urlParams.get('code') || urlParams.get('id');
      const pathname = window.location.pathname;
      const pathMatch = pathname.match(/\/verify\/([^/?#]+)/i);
      const targetCode = resi || (pathMatch ? decodeURIComponent(pathMatch[1]) : '');

      if (targetCode) {
        setSearchCode(targetCode);
        performVerification(targetCode);
      }
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      performVerification(searchCode.trim());
    }
  };

  const handlePrintVerification = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between no-print">
          <button
            onClick={onBack || (() => navigateTo('beranda'))}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda Desa</span>
          </button>
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Portal Verifikasi Tanda Tangan Elektronik</span>
          </div>
        </div>

        {/* Search / Input Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4 no-print">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Verifikasi Keabsahan Dokumen Resmi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Pemerintah {villageProfile.villageName || 'Desa'}, {villageProfile.district || 'Kecamatan'}, {villageProfile.regency || 'Kabupaten'}
            </p>
            <p className="text-[11px] text-slate-400">
              Gunakan halaman ini untuk memeriksa keaslian dan status legalitas surat keterangan/pengantar yang diterbitkan dengan barcode QR resmi.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 pt-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Masukkan Nomor Surat / Nomor Resi (misal: REQ-PB-2026-001)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xs sm:text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
            <button
              type="submit"
              disabled={loading || !searchCode.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-2 shrink-0"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Cek Nomor</span>
            </button>
          </form>

          {/* Camera QR Scanner Trigger Button */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs shadow-sm transition-all transform hover:scale-102 border border-slate-800"
            >
              <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Pindai Kode QR via Kamera HP</span>
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Menghubungkan ke basis data register desa...</p>
            <p className="text-xs text-slate-400">Memeriksa keaslian tanda tangan digital dan nomor surat</p>
          </div>
        )}

        {/* Verification Certificate Result */}
        {!loading && searched && result && (() => {
          const isCancelled = result.validityState === 'CANCELLED' || (result.status && (result.status.includes('DITOLAK') || result.status.includes('BATAL')));
          const isPending = result.validityState === 'PENDING' || (result.status && (result.status.includes('DIAJUKAN') || result.status.includes('DIPROSES')));
          const isVerified = (result.validityState === 'VALID' || (!!result.verified && !isCancelled && !isPending)) && !!result.certificate;
          const hasCertificate = !!result.certificate;

          return (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Status Banner */}
              <div
                className={`p-6 sm:p-8 text-white ${
                  isVerified
                    ? 'bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900'
                    : isCancelled
                    ? 'bg-gradient-to-r from-rose-950 via-red-900 to-slate-900'
                    : isPending
                    ? 'bg-gradient-to-r from-amber-950 via-amber-900 to-slate-900'
                    : 'bg-gradient-to-r from-rose-800 via-rose-900 to-slate-900'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      isVerified
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                        : isCancelled
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-400/30'
                        : isPending
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-400/30'
                    }`}
                  >
                    {isVerified ? (
                      <ShieldCheck className="w-9 h-9" />
                    ) : isCancelled ? (
                      <ShieldAlert className="w-9 h-9" />
                    ) : isPending ? (
                      <Clock className="w-9 h-9" />
                    ) : (
                      <XCircle className="w-9 h-9" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase mb-1 bg-white/10 backdrop-blur-xs border border-white/20">
                      {isVerified ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sertifikat Digital Terverifikasi SAH</span>
                        </>
                      ) : isCancelled ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Dokumen Dibatalkan / Ditolak (TIDAK SAH)</span>
                        </>
                      ) : isPending ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Dokumen Terdaftar (Proses Verifikasi)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Dokumen Tidak Terdaftar di Arsip</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight">
                      {isVerified
                        ? 'Dokumen Resmi Pemerintah Desa Pulau Betung'
                        : isCancelled
                        ? 'Dokumen Telah Dibatalkan / Ditolak Resmi'
                        : isPending
                        ? 'Permohonan Terdaftar dalam Proses Verifikasi'
                        : 'Pemeriksaan Keabsahan Dokumen Gagal'}
                    </h2>
                    <p className="text-xs text-white/80 max-w-xl">
                      {isVerified
                        ? 'Surat ini telah diverifikasi secara elektronik dan sah dikeluarkan oleh Pemerintah Desa Pulau Betung.'
                        : isCancelled
                        ? 'PERINGATAN RESMI: Dokumen ini telah DIBATALKAN / DITOLAK oleh Pemdes Pulau Betung. Berkas fisik atau digital dari surat ini TIDAK LAGI BERLAKU.'
                        : isPending
                        ? 'Surat terdaftar di sistem arsip desa, namun masih dalam tahapan verifikasi berkas (Belum ditandatangani resmi oleh Kepala Desa).'
                        : result.error || 'Nomor surat atau kode registrasi yang Anda masukkan tidak terdaftar di sistem arsip desa.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Certificate Details */}
              {hasCertificate && result.certificate ? (
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Alert banner in details */}
                  {isCancelled && (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-950 space-y-1.5">
                      <p className="font-bold flex items-center gap-2 text-rose-800">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>Status Hukum: DIBATALKAN / DITOLAK</span>
                      </p>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        Pengajuan atau lembaran surat ini telah dibatalkan oleh pihak berwenang. Segala salinan tercetak atau barcode QR yang menunjuk ke nomor registrasi ini tidak dapat digunakan sebagai bukti otentik.
                      </p>
                    </div>
                  )}

                  {isPending && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1.5">
                      <p className="font-bold flex items-center gap-2 text-amber-800">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Status Dokumen: DALAM PROSES VERIFIKASI</span>
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Permohonan surat sedang diproses oleh petugas/Sekdes/Kades. Setelah disetujui, surat resmi akan terbit dan barcode akan menjadi terverifikasi sah penuh.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        Nomor Surat Resmi
                      </span>
                      <p className="font-mono text-sm sm:text-base font-bold text-slate-900">
                        {result.certificate.officialLetterNumber || '-'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                        Nomor Resi / Kode Registrasi
                      </span>
                      <p className="font-mono text-sm sm:text-base font-bold text-emerald-800">
                        {result.certificate.trackingCode}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 md:col-span-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        Perihal / Jenis Layanan Surat
                      </span>
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {result.certificate.serviceName}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-600" />
                        Nama Pemohon / Warga
                      </span>
                      <p className="text-sm sm:text-base font-bold text-slate-900">
                        {result.certificate.citizenName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        NIK: {result.certificate.citizenNikMasked}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        Tanggal Penetapan / Pengesahan
                      </span>
                      <p className="text-sm font-semibold text-slate-900">
                        {result.certificate.completedAt || '-'}
                      </p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Dicek pada: {new Date(result.certificate.verificationTimestamp).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Legal Authority Footnote */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    isVerified ? 'bg-emerald-50/70 border-emerald-200/60' : 'bg-slate-50 border-slate-200'
                  }`}>
                    {isVerified ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                    )}
                    <div className="text-xs text-slate-800 space-y-0.5">
                      <p className="font-bold">Keabsahan Tanda Tangan Elektronik</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Sesuai UU No. 11 Tahun 2008 tentang ITE, barcode QR ini berfungsi sebagai bukti otentifikasi keaslian terpusat tanpa stempel basah konvensional.
                      </p>
                      <p className="text-[11px] text-slate-700 font-medium pt-1">
                        Otoritas Penerbit: {result.certificate.authority}
                      </p>
                    </div>
                  </div>

                  {/* Print Button */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100 no-print">
                    <button
                      onClick={handlePrintVerification}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center space-x-2"
                    >
                      <Printer className="w-4 h-4 text-slate-500" />
                      <span>Cetak Lembar Verifikasi</span>
                    </button>
                    <button
                      onClick={onBack || (() => navigateTo('layanan'))}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Kembali ke Layanan Warga</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 sm:p-8 space-y-4">
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 leading-relaxed space-y-2">
                    <p className="font-bold">Peringatan Keamanan:</p>
                    <p>
                      Dokumen dengan kode <strong className="font-mono">{searchCode}</strong> tidak dapat divalidasi. Hal ini dapat disebabkan oleh:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-[11px]">
                      <li>Nomor resi atau nomor surat tidak terdaftar dalam arsip desa.</li>
                      <li>Kode QR dipalsukan atau dibuat oleh pihak tidak berwenang.</li>
                    </ul>
                  </div>

                  <div className="flex justify-center pt-2 no-print">
                    <button
                      onClick={() => {
                        setSearchCode('');
                        setSearched(false);
                        setResult(null);
                      }}
                      className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
                    >
                      Coba Nomor Lain
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <QrCameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={(scannedCode) => {
          setIsCameraOpen(false);
          setSearchCode(scannedCode);
          performVerification(scannedCode);
        }}
      />
    </div>
  );
};
