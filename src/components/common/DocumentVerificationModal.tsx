import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, X, Calendar, User, FileText, Building2, Clock, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface DocumentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingCode: string;
  letterNumber?: string;
}

export const DocumentVerificationModal: React.FC<DocumentVerificationModalProps> = ({
  isOpen,
  onClose,
  trackingCode,
  letterNumber
}) => {
  const { serviceRequests, villageProfile } = useApp();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.verifyDocument>> | null>(null);

  const fetchVerification = () => {
    if (!trackingCode) return;
    setLoading(true);
    api.verifyDocument(trackingCode, letterNumber).then((res) => {
      // If server doesn't find it or is not completed, fallback to local state if available
      if ((!res.success || !res.certificate) && serviceRequests && serviceRequests.length > 0) {
        const cleanTrack = trackingCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const cleanLetter = (letterNumber || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const local = serviceRequests.find((r) => {
          const rTrack = (r.trackingCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const rId = (r.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const rLet = (r.officialLetterNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          return (
            (cleanTrack && (rTrack === cleanTrack || rId === cleanTrack || rLet === cleanTrack)) ||
            (cleanLetter && (rLet === cleanLetter || rTrack === cleanLetter))
          );
        });

        if (local) {
          const isDone = ['selesai', 'disetujui'].includes(local.status);
          const isRej = ['ditolak', 'dibatalkan', 'batal'].includes(local.status);
          const validityState: 'VALID' | 'CANCELLED' | 'PENDING' = isRej ? 'CANCELLED' : isDone ? 'VALID' : 'PENDING';

          // Ensure local record is synced to server database
          api.updateRequestStatus(local.id, local.status, local.staffNotes, local.officialLetterNumber, {
            trackingCode: local.trackingCode,
            completedAt: local.completedAt,
            letterheadSnapshot: local.letterheadSnapshot,
            fullRequest: local
          }).catch(() => {});

          setResult({
            success: true,
            verified: isDone,
            validityState,
            isSystemError: false,
            trackingCode: local.trackingCode,
            letterNumber: local.officialLetterNumber,
            status: local.status.toUpperCase(),
            message: isDone
              ? `Dokumen RESMI TERVERIFIKASI SAH dan terdaftar secara elektronik oleh Pemerintah ${villageProfile.villageName || 'Desa'}.`
              : isRej
              ? `PERINGATAN: Dokumen ini telah DIBATALKAN / DITOLAK oleh Pemerintah ${villageProfile.villageName || 'Desa'}.`
              : 'Dokumen terdaftar dalam sistem desa, namun MASIH DALAM PROSES VERIFIKASI / PERSETUJUAN.',
            notes: local.staffNotes,
            certificate: {
              trackingCode: local.trackingCode,
              officialLetterNumber: local.officialLetterNumber || `470 / ${local.id.replace('req-', '')} / SK-DESA / PB-PMY / IX / 2026`,
              serviceName: local.serviceName,
              citizenName: local.citizenName,
              citizenNikMasked: local.citizenNikMasked || '150401******',
              completedAt: local.completedAt || local.requestDate,
              authority: `Kepala ${villageProfile.villageName || 'Desa'}`,
              verificationTimestamp: new Date().toISOString()
            }
          });
          setLoading(false);
          return;
        }
      }

      setResult(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!isOpen || !trackingCode) return;
    fetchVerification();
  }, [isOpen, trackingCode, letterNumber]);

  if (!isOpen) return null;

  const isCancelled = result?.validityState === 'CANCELLED' || (result?.status && (result.status.includes('DITOLAK') || result.status.includes('BATAL')));
  const isPending = result?.validityState === 'PENDING' || (result?.status && (result.status.includes('DIAJUKAN') || result.status.includes('DIPROSES')));
  const isVerified = (result?.validityState === 'VALID' || (!!result?.verified && !isCancelled && !isPending)) && !!result?.certificate;
  const isSystemError = !!result?.isSystemError;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div
          className={`p-6 text-white relative ${
            isVerified
              ? 'bg-gradient-to-r from-emerald-900 to-slate-900'
              : isCancelled
              ? 'bg-gradient-to-r from-rose-950 via-red-900 to-slate-900'
              : isPending
              ? 'bg-gradient-to-r from-amber-950 via-amber-900 to-slate-900'
              : isSystemError
              ? 'bg-gradient-to-r from-amber-900 via-slate-900 to-slate-900'
              : 'bg-gradient-to-r from-rose-900 to-slate-900'
          }`}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                loading
                  ? 'bg-white/10 text-white'
                  : isVerified
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isCancelled
                  ? 'bg-rose-500/20 text-rose-400'
                  : isPending
                  ? 'bg-amber-500/20 text-amber-400'
                  : isSystemError
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {loading ? (
                <Clock className="w-6 h-6 animate-spin" />
              ) : isVerified ? (
                <ShieldCheck className="w-6 h-6" />
              ) : isCancelled ? (
                <ShieldAlert className="w-6 h-6" />
              ) : isPending ? (
                <Clock className="w-6 h-6" />
              ) : isSystemError ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Verifikasi Dokumen Elektronik</h2>
              <p className="text-xs text-slate-300">Pemerintah {villageProfile.villageName || 'Desa'} • Sertifikasi Keabsahan Surat</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Memverifikasi keabsahan dokumen ke server desa...</p>
            </div>
          ) : result?.certificate ? (
            <div className="space-y-4">
              {/* Status Alert Banner */}
              {isVerified ? (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900">
                    <p className="font-bold">DOKUMEN RESMI TERVERIFIKASI SAH</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Dokumen ini terdaftar secara sah dan berlaku penuh di bawah pangkalan data resmi Pemerintah {villageProfile.villageName || 'Desa'}.
                    </p>
                  </div>
                </div>
              ) : isCancelled ? (
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-300 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-950">
                    <p className="font-bold text-rose-900 uppercase">DOKUMEN DIBATALKAN / DITOLAK (TIDAK SAH)</p>
                    <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                      <strong>PERINGATAN:</strong> Permohonan atau surat ini telah <strong>DIBATALKAN / DITOLAK</strong> secara resmi. Berkas ini <strong>TIDAK BERLAKU LAGI</strong> untuk keperluan administrasi atau hukum apapun.
                    </p>
                    {result.notes && (
                      <p className="text-[11px] text-rose-900 bg-rose-100/80 p-2 rounded-lg mt-2 font-medium border border-rose-200">
                        Catatan Petugas: "{result.notes}"
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950">
                    <p className="font-bold text-amber-900 uppercase">BELUM DITERBITKAN RESMI (DALAM PROSES)</p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Dokumen terdaftar di sistem desa, namun <strong>MASIH DALAM PROSES VERIFIKASI BERKAS</strong> (Belum disetujui / ditandatangani resmi oleh Kepala Desa).
                    </p>
                  </div>
                </div>
              )}

              {/* Certificate Details */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Nomor Surat Resmi</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">{result.certificate.officialLetterNumber || '-'}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Nomor Registrasi / Resi</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-800">{result.certificate.trackingCode}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Jenis Layanan</span>
                  </span>
                  <span className="font-semibold text-slate-800 text-right">{result.certificate.serviceName}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Nama Pemohon</span>
                  </span>
                  <span className="font-semibold text-slate-800 uppercase">{result.certificate.citizenName}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>NIK (Sesuai UU PDP)</span>
                  </span>
                  <span className="font-mono text-slate-700">{result.certificate.citizenNikMasked}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Tanggal Terbit / Permohonan</span>
                  </span>
                  <span className="text-slate-800 font-medium">{result.certificate.completedAt || '-'}</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Instansi Penerbit</span>
                  </span>
                  <span className="text-slate-700 text-[11px] text-right font-medium">Pemdes {villageProfile.villageName ? villageProfile.villageName.replace(/^Desa\s+/i, '') : 'Desa'}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                Waktu verifikasi server: {new Date(result.certificate.verificationTimestamp).toLocaleString('id-ID')}
              </p>
            </div>
          ) : isSystemError ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-bold">LAYANAN VERIFIKASI SEDANG MENGALAMI GANGGUAN</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {result?.error || 'Layanan verifikasi dokumen sedang mengalami gangguan.'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">Keterangan Teknis:</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Sistem tidak dapat menghubungi layanan verifikasi dokumen atau respons server tidak valid saat ini. Status dokumen Anda <strong>belum tentu tidak sah</strong>. Mohon coba beberapa saat lagi atau verifikasi langsung ke Kantor Pelayanan {villageProfile.villageName || 'Desa'}.
                </p>
              </div>

              <button
                onClick={fetchVerification}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Lagi Verifikasi</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900">
                  <p className="font-bold">DOKUMEN TIDAK TERVERIFIKASI</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    {result?.error || 'Dokumen ini tidak dapat divalidasi keasliannya oleh pangkalan data desa.'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800">Kemungkinan Penyebab:</p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-500">
                  <li>Kode permohonan / resi ({trackingCode}) tidak terdaftar dalam arsip desa.</li>
                  <li>Surat belum disetujui atau masih dalam proses verifikasi berkas dinas.</li>
                  <li>Nomor surat pada lembaran fisik tidak sesuai dengan catatan resmi.</li>
                  <li>QR Code dipalsukan atau dimodifikasi oleh pihak tidak berwenang.</li>
                </ul>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              Tutup Jendela Verifikasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
