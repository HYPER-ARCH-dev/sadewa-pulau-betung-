import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, Upload, AlertCircle, BadgeCheck, CheckCircle2, Search, ArrowRight } from 'lucide-react';

interface QrCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

export const QrCameraScannerModal: React.FC<QrCameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const lastScanTimestamp = useRef<number>(0);
  const isScanningActive = useRef<boolean>(false);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Inisialisasi hardware BarcodeDetector jika didukung oleh browser (Chrome/Android/Edge)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code']
        });
      } catch (err) {
        console.warn('BarcodeDetector format qr_code tidak didukung:', err);
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  // Helper parsing URL barcode ke kode resi/surat yang bersih
  const extractCodeFromScan = (rawText: string): string => {
    let text = rawText.trim();
    if (!text) return '';

    try {
      // 1. Jika teks berformat URL (http://, https://, atau domain tanpa protocol)
      let urlString = text;
      if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        if (urlString.includes('/verify/') || urlString.includes('verify=') || urlString.includes('trackingCode=')) {
          urlString = `https://${urlString}`;
        }
      }

      if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
        const url = new URL(urlString);
        
        // Pola Path: /verify/REQ-PB-2026-001
        if (url.pathname.includes('/verify/')) {
          const parts = url.pathname.split('/verify/');
          if (parts[1]) {
            const extracted = decodeURIComponent(parts[1].split('/')[0].split('?')[0].split('#')[0]);
            if (extracted) return extracted.trim();
          }
        }

        // Pola Hash: #/verify/REQ-PB-2026-001
        if (url.hash && url.hash.includes('/verify/')) {
          const parts = url.hash.split('/verify/');
          if (parts[1]) {
            const extracted = decodeURIComponent(parts[1].split('?')[0].split('&')[0]);
            if (extracted) return extracted.trim();
          }
        }
        
        // Query Parameters
        const qCode = url.searchParams.get('trackingCode') || 
                      url.searchParams.get('resi') || 
                      url.searchParams.get('code') || 
                      url.searchParams.get('id') ||
                      url.searchParams.get('noSurat') ||
                      url.searchParams.get('verify');

        if (qCode && qCode !== 'surat') {
          return decodeURIComponent(qCode).trim();
        }
      }
    } catch {
      // URL parsing error, fallback ke regex
    }

    // 2. Regex matching untuk nomor resi resmi SADEWA (REQ-PB-...)
    const reqMatch = text.match(/REQ-PB-[A-Za-z0-9-]+/i);
    if (reqMatch && reqMatch[0]) {
      return reqMatch[0].trim();
    }

    // 3. Fallback gunakan text asli yang sudah dibersihkan
    return text.replace(/^["']|["']$/g, '').trim();
  };

  const stopCamera = () => {
    isScanningActive.current = false;
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanSuccessInternal = (extracted: string) => {
    if (!extracted) return;
    isScanningActive.current = false;

    // Haptic feedback jika didukung perangkat
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {}
    }

    setScannedResult(extracted);
    stopCamera();

    // Berikan jeda sejenak agar pengguna melihat animasi terdeteksi
    setTimeout(() => {
      onScanSuccess(extracted);
    }, 450);
  };

  const scanFrame = async () => {
    if (!isScanningActive.current) return;

    if (!videoRef.current || videoRef.current.readyState < 2) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const now = performance.now();

    // Throttling: Proses pemindaian setiap ~120ms agar video tetap 60fps tanpa lag
    if (now - lastScanTimestamp.current > 120 && video.videoWidth > 0 && video.videoHeight > 0) {
      lastScanTimestamp.current = now;

      // STRATEGI 1: Gunakan BarcodeDetector native (Hardware-accelerated) jika ada
      if (barcodeDetectorRef.current) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            const extracted = extractCodeFromScan(barcodes[0].rawValue);
            if (extracted) {
              handleScanSuccessInternal(extracted);
              return;
            }
          }
        } catch {
          // BarcodeDetector gagal frame ini, lanjut ke fallback jsQR
        }
      }

      // STRATEGI 2: Fallback ke jsQR dengan downscaling agar performa cepat (<10ms)
      const canvas = canvasRef.current || document.createElement('canvas');
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        // Downscale frame ke lebar optimal ~480px untuk pemindaian instan
        const targetWidth = 480;
        const scale = Math.min(1, targetWidth / video.videoWidth);
        const scanWidth = Math.round(video.videoWidth * scale);
        const scanHeight = Math.round(video.videoHeight * scale);

        canvas.width = scanWidth;
        canvas.height = scanHeight;
        ctx.drawImage(video, 0, 0, scanWidth, scanHeight);

        // Scan frame penuh dengan inversionAttempts: 'attemptBoth'
        const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
        let code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        // Jika belum terdeteksi, coba crop 60% area tengah (viewfinder zoom)
        if (!code) {
          const cropSize = Math.round(Math.min(scanWidth, scanHeight) * 0.65);
          const startX = Math.round((scanWidth - cropSize) / 2);
          const startY = Math.round((scanHeight - cropSize) / 2);

          const cropData = ctx.getImageData(startX, startY, cropSize, cropSize);
          code = jsQR(cropData.data, cropData.width, cropData.height, {
            inversionAttempts: 'attemptBoth'
          });
        }

        if (code && code.data) {
          const extracted = extractCodeFromScan(code.data);
          if (extracted) {
            handleScanSuccessInternal(extracted);
            return;
          }
        }
      }
    }

    if (isScanningActive.current) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    setScannedResult(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Perangkat Anda tidak mendukung akses kamera langsung pada peramban web ini.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Wajib untuk iOS Safari
        await videoRef.current.play();
        isScanningActive.current = true;
        setIsScanning(true);
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error('Gagal membuka kamera:', err);
      let msg = 'Gagal mengakses kamera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin kamera ditolak. Harap berikan izin kamera pada peramban untuk memindai QR code.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Kamera tidak ditemukan pada perangkat Anda.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Kamera sedang digunakan oleh aplikasi lain.';
      }
      setCameraError(msg);
      setIsScanning(false);
    }
  };

  // Upload foto dari galeri dengan resize otomatis aman memori
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = async () => {
        // Resize foto galeri agar tidak melebihi 1000px (mencegah crash memori foto smartphone 12-48MP)
        const maxDim = 1000;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const finalW = Math.round(img.width * scale);
        const finalH = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, finalW, finalH);

          // Coba BarcodeDetector native dulu jika ada
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(canvas);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                const extracted = extractCodeFromScan(barcodes[0].rawValue);
                if (extracted) {
                  handleScanSuccessInternal(extracted);
                  return;
                }
              }
            } catch {}
          }

          // Fallback jsQR
          const imageData = ctx.getImageData(0, 0, finalW, finalH);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (code && code.data) {
            const extracted = extractCodeFromScan(code.data);
            if (extracted) {
              handleScanSuccessInternal(extracted);
              return;
            }
          }
          setCameraError('QR Code tidak terdeteksi pada gambar. Harap gunakan foto dengan pencahayaan jelas dan fokus tajam.');
        }
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualInput.trim();
    if (!clean) return;
    const extracted = extractCodeFromScan(clean);
    handleScanSuccessInternal(extracted);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 text-white overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white">Pemindai Kamera QR Code</h3>
              <p className="text-[11px] text-slate-400">Pindai QR fisik surat resmi atau resi desa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stream / Frame Viewport */}
        <div className="relative bg-black aspect-square overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay Bingkai Pemindai (Scanner Target Viewfinder) */}
          {isScanning && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6">
              <div className="w-64 h-64 border-2 border-emerald-400/80 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
                {/* Laser scan animation */}
                <div 
                  className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" 
                  style={{ animation: 'scan 2s infinite ease-in-out' }} 
                />
                
                {/* Corner markers */}
                <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>
              <p className="text-xs font-semibold text-emerald-300 mt-4 bg-slate-950/80 px-3 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                Arahkan kamera tepat ke QR Code Surat
              </p>
            </div>
          )}

          {/* Success Overlay */}
          {scannedResult && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3 z-20 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <p className="text-sm font-bold text-white">QR Code Berhasil Terbaca!</p>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 break-all max-w-xs shadow-inner">
                {scannedResult}
              </div>
              <p className="text-[11px] text-slate-400">Sedang memverifikasi dokumen...</p>
            </div>
          )}

          {/* Error Message Display */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-300">Kamera Tidak Dapat Dibuka</p>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs">{cameraError}</p>
              </div>
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Buka Kamera Lagi</span>
              </button>
            </div>
          )}
        </div>

        {/* Fallback Manual Input */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Atau ketik Resi / Nomor Surat..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Cari</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
          {/* Change Camera Facing */}
          <button
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Ganti kamera depan / belakang"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ganti Kamera</span>
          </button>

          {/* Upload Image from Gallery */}
          <label className="p-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Pilih Foto QR dari Galeri</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
