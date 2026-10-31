import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ServiceRequest } from '../../types';
import {
  Search,
  Camera,
  CheckCircle2,
  Download,
  Printer,
  FileText
} from 'lucide-react';
import { ServiceStatusBadge } from '../common/StatusBadge';
import { OfficialLetterPrintModal } from '../letters/OfficialLetterPrintModal';
import { QrCameraScannerModal } from '../common/QrCameraScannerModal';

interface PrintPortalProps {
  initialTrackingCode?: string;
}

export const PrintPortal: React.FC<PrintPortalProps> = ({ initialTrackingCode = '' }) => {
  const { serviceRequests, villageProfile, addToast } = useApp();
  const [trackInput, setTrackInput] = useState(initialTrackingCode);
  const [trackedItem, setTrackedItem] = useState<ServiceRequest | null>(null);
  const [trackAttempted, setTrackAttempted] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  useEffect(() => {
    if (initialTrackingCode) {
      setTrackInput(initialTrackingCode);
      performTrackingSearch(initialTrackingCode);
    }
  }, [initialTrackingCode, serviceRequests]);

  const performTrackingSearch = (code: string) => {
    const trimmedCode = code.trim().toUpperCase();
    const found = serviceRequests.find((r) => r.trackingCode.toUpperCase() === trimmedCode);
    setTrackedItem(found || null);
    setTrackAttempted(true);
  };

  const handleSearchTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackInput.trim()) {
      addToast('warning', 'Input Kosong', 'Harap masukkan nomor resi terlebih dahulu.');
      return;
    }
    performTrackingSearch(trackInput);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pelacakan Status Permohonan</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ketik nomor resi yang Anda dapatkan saat mengajukan surat (misal: REQ-PB-2026-001).
          </p>
        </div>

        <form onSubmit={handleSearchTracking} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="REQ-PB-2026-XXX"
            value={trackInput}
            onChange={(e) => setTrackInput(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span>Lacak</span>
          </button>
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-800"
          >
            <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Pindai QR Kamera</span>
          </button>
        </form>

        {/* Tracking Result Details */}
        {trackAttempted && (
          <div className="pt-4 border-t border-slate-100">
            {!trackedItem ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 text-center">
                Permohonan dengan kode <strong className="font-mono">{trackInput}</strong> tidak ditemukan di database. Pastikan tidak ada salah ketik.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <span className="font-mono text-xs text-emerald-800 font-bold block">
                      {trackedItem.trackingCode}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {trackedItem.serviceName}
                    </h3>
                  </div>
                  <ServiceStatusBadge status={trackedItem.status} />
                </div>

                {/* Progress Steps */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-700 block">
                    Alur Pemrosesan Surat:
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] sm:text-xs">
                    <div
                      className={`p-2 rounded-xl border ${
                        ['diajukan', 'diverifikasi', 'diproses', 'disetujui', 'selesai'].includes(
                          trackedItem.status
                        )
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      1. Diajukan
                    </div>
                    <div
                      className={`p-2 rounded-xl border ${
                        ['diverifikasi', 'diproses', 'disetujui', 'selesai'].includes(
                          trackedItem.status
                        )
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      2. Verifikasi
                    </div>
                    <div
                      className={`p-2 rounded-xl border ${
                        ['disetujui', 'selesai'].includes(trackedItem.status)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      3. TTD Kades
                    </div>
                    <div
                      className={`p-2 rounded-xl border ${
                        trackedItem.status === 'selesai'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      4. Selesai
                    </div>
                  </div>
                </div>

                {/* Meta Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Nama Pemohon:</span>
                    <strong className="text-slate-900">{trackedItem.citizenName}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">NIK Terdaftar:</span>
                    <strong className="font-mono text-slate-900">{trackedItem.citizenNikMasked}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Dusun / Domisili:</span>
                    <strong className="text-slate-900">{trackedItem.addressDusun}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Tanggal Pengajuan:</span>
                    <strong className="text-slate-900">{trackedItem.requestDate}</strong>
                  </div>
                </div>

                {trackedItem.staffNotes && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <span className="font-bold block">Pemberitahuan dari Petugas Desa:</span>
                    <p className="text-amber-800">{trackedItem.staffNotes}</p>
                    {trackedItem.processedBy && (
                      <div className="text-[11px] text-amber-700/80 pt-1 border-t border-amber-200/50">
                        Diproses oleh: {trackedItem.processedBy}
                      </div>
                    )}
                  </div>
                )}

                {(trackedItem.status === 'selesai' || trackedItem.status === 'disetujui') && (
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs space-y-4 shadow-xs">
                    <div className="flex items-start space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="block text-sm text-emerald-950 font-bold">Surat Resmi Disetujui & Siap Diunduh!</strong>
                        <p className="text-emerald-800 text-[11px] mt-0.5">
                          Dokumen telah disahkan dengan Nomor Registrasi: <span className="font-mono font-bold text-emerald-950">{trackedItem.officialLetterNumber || 'Telah Teregistrasi di Buku Arsip'}</span> dan dilengkapi TTE QR Code resmi.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/80 rounded-xl border border-emerald-200 text-slate-700 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Arsip digital ini sah dan berkekuatan hukum dengan cap & QR Code desa.</span>
                      </div>
                      <span className="text-[10px] text-slate-500 italic">Dapat diunduh mandiri atau cetak langsung</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        onClick={() => setIsPrintModalOpen(true)}
                        className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
                        id="btn-download-letter-citizen"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh / Simpan PDF</span>
                      </button>
                      <button
                        onClick={() => setIsPrintModalOpen(true)}
                        className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
                        id="btn-print-letter-citizen"
                      >
                        <Printer className="w-4 h-4 text-emerald-400" />
                        <span>Buka Format Cetak A4</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Official Letter Print Modal inside PrintPortal */}
      {trackedItem && (
        <OfficialLetterPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          request={trackedItem}
        />
      )}

      {/* Camera QR Code Scanner Modal */}
      <QrCameraScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={async (scannedCode) => {
          setIsQrScannerOpen(false);
          setTrackInput(scannedCode);
          performTrackingSearch(scannedCode);
        }}
      />
    </div>
  );
};
