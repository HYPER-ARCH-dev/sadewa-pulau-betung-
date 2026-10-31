import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Share2, CheckCircle2, Download, QrCode, Layers, Printer } from 'lucide-react';
import { generateVerificationQrCode, getLetterVerificationUrl } from '../../utils/qrHelper';
import { useApp } from '../../context/AppContext';
import { generateOfficialLetterNumber, getLetterClassification } from '../../utils/letterNumbering';
import { getLetterFormatConfig } from '../../data/letterClassification';
import { WhatsAppService } from '../../services/whatsappService';
import { VILLAGE_INFO } from '../../constants/village';
import { OfficialLetterPrintModalProps, LetterPageDetails } from './types';
import { sanitizeText, getUnmaskedOfficialNik } from './sanitizer';
import { resolveLetterTemplate } from './templates';
import { createLetterVillageContext } from './villageContext';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';

export * from './types';
export * from './sanitizer';
export * from './templates';
export * from './LetterPreviewContainer';
export * from './villageContext';


/**
 * MODAL CETAK SURAT RESMI DESA PULAU BETUNG
 * Standar Naskah Dinas Kementerian Dalam Negeri RI • Standar Cetak A4
 * Mendukung single-page dan multi-page bundel (misal: Paket Nikah N1-N4)
 * Keyword: OFFICIAL_LETTER, PRINT_DOCUMENT, PDF, QR_VERIFICATION, LETTER_NUMBER, TRACKING_CODE
 */
export const OfficialLetterPrintModal: React.FC<OfficialLetterPrintModalProps> = ({
  isOpen,
  onClose,
  request,
  kadesName: customKadesName,
  kadesNip: customKadesNip,
  isAdminView = false
}) => {
  const { officials, services, serviceRequests, villageProfile } = useApp();

  // Snapshot or Dynamic Village Identity (Immutability for archived documents)
  const snapshot = request?.letterheadSnapshot;
  const villageName = snapshot?.villageName || villageProfile?.villageName || VILLAGE_INFO.NAME;
  const district = snapshot?.district || villageProfile?.district || VILLAGE_INFO.KECAMATAN;
  const regency = snapshot?.regency || villageProfile?.regency || VILLAGE_INFO.KABUPATEN;
  const province = snapshot?.province || villageProfile?.province || VILLAGE_INFO.PROVINCE;
  const postalCode = snapshot?.postalCode || villageProfile?.postalCode || VILLAGE_INFO.POSTAL_CODE;
  const addressStreet = snapshot?.addressStreet || villageProfile?.addressStreet || VILLAGE_INFO.ADDRESS_STREET;
  const email = snapshot?.email || villageProfile?.email || VILLAGE_INFO.EMAIL;
  const domain = snapshot?.domain || villageProfile?.website || VILLAGE_INFO.DOMAIN;
  const villageLogoUrl = snapshot?.villageLogoUrl ?? villageProfile?.villageLogoUrl ?? '';
  const regencyLogoUrl = snapshot?.regencyLogoUrl ?? villageProfile?.regencyLogoUrl ?? '';
  const officialSignatureUrl = snapshot?.officialSignatureUrl || villageProfile?.officialSignatureUrl || '';
  const heroBackgroundUrl = villageProfile?.heroBackgroundUrl || '';

  // Find active Kepala Desa from the village structure
  const activeKades = officials.find(
    (o) => (o.section === 'kepala_desa' || o.position.toLowerCase().includes('kepala desa')) && o.isActive !== false
  ) || officials.find((o) => o.section === 'kepala_desa');

  const kadesName = customKadesName || snapshot?.kadesName || (activeKades ? activeKades.name : VILLAGE_INFO.DEFAULT_KADES_NAME);
  const kadesNip = customKadesNip || snapshot?.kadesNip || (activeKades?.nip ? activeKades.nip : VILLAGE_INFO.DEFAULT_KADES_NIP);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [showQrVerification, setShowQrVerification] = useState<boolean>(true);
  const [paperSize, setPaperSize] = useState<'A4' | 'F4' | 'Legal'>('A4');

  // Generate standardized official letter number with automatic monthly reset & classification codes
  const computedLetterNumber = request ? generateOfficialLetterNumber(
    request.serviceId || request.serviceName,
    request.completedAt || request.requestDate,
    serviceRequests,
    request.id
  ) : '';

  // Auto-correct existing letter numbers if present but malformed/outdated
  let finalLetterNumber = request?.officialLetterNumber || computedLetterNumber;
  if (request && finalLetterNumber) {
    const correctClass = getLetterClassification(request.serviceId || request.serviceName);
    const parts = finalLetterNumber.split('/').map((p: string) => p.trim());
    if (parts.length >= 5) {
      parts[0] = correctClass.code;
      parts[2] = correctClass.label;
      finalLetterNumber = parts.join(' / ');
    }
  }

  // Jika Validasi QR Elektronik di-off-kan, nomor surat diset manual (titik-titik / kosong) sesuai permintaan
  const activeLetterNumber = showQrVerification ? finalLetterNumber : (finalLetterNumber ? finalLetterNumber.replace(/\/\s*\d{3}\s*\//, ' / ....... /') : '... / ....... / ...');

  // Clone request to ensure all templates use the strictly correct letter number
  const safeRequest = request ? { ...request, officialLetterNumber: activeLetterNumber } as typeof request : request;


  const printDate = request?.completedAt || new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Manage body class for 100% complete print isolation
  useEffect(() => {
    if (isOpen && request) {
      document.body.classList.add('letter-modal-active');
      return () => {
        document.body.classList.remove('letter-modal-active');
      };
    }
  }, [isOpen, request]);

  // Generate genuine scannable QR Code containing official verification URL
  useEffect(() => {
    if (!isOpen || !request) return;
    const identifier = request.trackingCode || request.id;
    const verificationUrl = getLetterVerificationUrl(identifier);

    generateVerificationQrCode(verificationUrl, {
      width: 256,
      margin: 1,
      darkColor: '#0f172a',
      lightColor: '#ffffff'
    })
      .then((url) => {
        setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('Gagal generate QR Code:', err);
      });
  }, [isOpen, request, finalLetterNumber]);

  if (!isOpen || !request) return null;

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('window.print() error in iframe sandbox, fallback to download:', e);
      handleDownloadOfflineDoc();
    }
  };

  const handleDownloadOfflineDoc = () => {
    const printableEl = document.getElementById('official-letter-printable');
    if (!printableEl) return;

    const safeTitle = (details.title || 'Surat_Keterangan').replace(/[^a-zA-Z0-9]/g, '_');
    const safeCitizenName = (request.citizenName || 'Warga').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTrackingCode = (request.trackingCode || 'REQ').replace(/[^a-zA-Z0-9]/g, '_');

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${details.title} - ${request.citizenName}</title>
  <style>
    @page { 
      size: ${paperSize === 'F4' ? '215mm 330mm' : paperSize === 'Legal' ? '215.9mm 355.6mm' : 'A4'} portrait; 
      margin: 8mm 12mm 10mm 12mm; 
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 0;
      line-height: 1.5;
      font-size: 12pt;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 20px auto 24px auto;
      max-width: 210mm;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 999;
    }
    .print-btn {
      background: #059669;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover { background: #047857; }
    .official-letter-page-item, .official-letter-sheet {
      background: #fff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08);
      border-radius: 8px;
      padding: 35px 45px;
      width: ${paperSize === 'A4' ? '210mm' : '215mm'};
      max-width: 100%;
      margin: 0 auto;
      min-height: ${paperSize === 'F4' ? '290mm' : paperSize === 'Legal' ? '320mm' : '260mm'};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .official-letter-page-item {
      margin-bottom: 30px;
    }
    .official-letter-page-item:not(:last-child) {
      page-break-after: always;
      break-after: page;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-toolbar { display: none !important; }
      .official-letter-page-item, .official-letter-sheet {
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: ${paperSize === 'F4' ? '290mm' : paperSize === 'Legal' ? '320mm' : '260mm'} !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div>
      <strong style="font-size: 15px; display: block;">Dokumen Resmi Pemerintah {villageName}</strong>
      <span style="font-size: 12px; color: #94a3b8;">Format Standar Naskah Dinas Kementerian Dalam Negeri RI • Kertas ${paperSize}</span>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Cetak / Simpan ke PDF</button>
  </div>
  ${printableEl.innerHTML}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Surat_Resmi_${safeTrackingCode}_${safeCitizenName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  };

  const handleShareWa = () => {
    const matchedService = services?.find(
      (s) => s.id === request.serviceName || s.name.toLowerCase() === request.serviceName.toLowerCase()
    );

    const notifyRes = WhatsAppService.generateNotification({
      citizenName: request.citizenName,
      serviceName: request.serviceName,
      trackingCode: request.trackingCode,
      status: request.status,
      phone: request.phone || '',
      adminNotes: request.staffNotes,
      officialLetterNumber: details.customLetterNumber || finalLetterNumber,
      villageName,
      district,
      regency,
      documentUrl: getLetterVerificationUrl(request.trackingCode),
      requirements: matchedService?.requirements,
      isDraft: showDraftWatermark
    });
    window.open(notifyRes.shareUrl, '_blank');
  };

  // Create unified dynamic village context for all letter templates
  const villageCtx = createLetterVillageContext(
    villageProfile,
    customKadesName,
    customKadesNip,
    snapshot,
    officials
  );

  // Resolve master template based on service request with dynamic village context
  const details = resolveLetterTemplate(safeRequest!, printDate, villageCtx);

  const formatConfig = getLetterFormatConfig(request.serviceId || request.serviceName);
  const documentClass = formatConfig.documentClass || 'B';
  const isClassA = documentClass === 'A';
  const isFinished = request.status === 'selesai' || request.status === 'disetujui';

  let showDraftWatermark = false;
  let customDraftText = '';
  let disablePrint = false;
  let printWarningText = '';

  if (!isAdminView) {
    if (isFinished) {
      if (isClassA) {
        showDraftWatermark = true;
        customDraftText = 'DRAFT - BELUM SAH UNTUK KEPERLUAN LEGAL';
      }
    } else {
      showDraftWatermark = true;
      customDraftText = 'DRAFT - BELUM SAH UNTUK KEPERLUAN LEGAL';
      disablePrint = true;
      printWarningText = '* Dokumen belum disahkan. Cetak dinonaktifkan.';
    }
  }

  // FIX 4: Blokir cetak jika NIK tidak lengkap (16 digit tanpa bintang)
  const citizenCleanNik = getUnmaskedOfficialNik(request);
  if (!citizenCleanNik) {
    disablePrint = true;
    printWarningText = '* NIK pemohon tidak lengkap/masking. Harap lengkapi NIK 16 digit untuk mencetak.';
  }

  const citizenCleanName = sanitizeText(request.citizenName, `WARGA ${villageName.toUpperCase()}`);
  const citizenCleanDusun = sanitizeText(request.addressDusun, VILLAGE_INFO.DEFAULT_DUSUN);
  const citizenCleanPhone = sanitizeText(request.phone, '-');

  // Format Tempat & Tanggal Lahir
  const formData = (request.formData || {}) as Record<string, any>;
  const rawBirthPlace = request.citizenBirthPlace || formData.birth_place || formData.tempat_lahir;
  const rawBirthDate = request.citizenBirthDate || formData.birth_date || formData.tanggal_lahir;
  let citizenTtl = '';
  if (rawBirthPlace && rawBirthDate) {
    try {
      const d = new Date(String(rawBirthDate));
      const formattedDate = !isNaN(d.getTime())
        ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : String(rawBirthDate);
      citizenTtl = `${rawBirthPlace}, ${formattedDate}`;
    } catch {
      citizenTtl = `${rawBirthPlace}, ${rawBirthDate}`;
    }
  } else if (rawBirthPlace) {
    citizenTtl = String(rawBirthPlace);
  } else if (rawBirthDate) {
    try {
      const d = new Date(String(rawBirthDate));
      citizenTtl = !isNaN(d.getTime())
        ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : String(rawBirthDate);
    } catch {
      citizenTtl = String(rawBirthDate);
    }
  }

  const citizenGender = request.citizenGender || formData.gender || formData.jenis_kelamin;

  // Helper render Kop Surat Resmi (Refined to match Screenshot precisely)
  const renderKopSurat = () => {
    const isAhliWaris = request.serviceId === 'srv-ahli-waris' || request.serviceName?.toLowerCase().includes('ahli waris');
    return (
      <div className={`relative ${isAhliWaris ? 'mb-2.5' : 'mb-6'}`}>
        <div className="flex items-center justify-between gap-4 pb-1">
          {/* Left Logo / Regional Emblem (Kabupaten) */}
          <div className="w-20 h-24 flex-shrink-0 flex items-center justify-center">
            {regencyLogoUrl && regencyLogoUrl.trim() !== '' && !logoLoadError ? (
              <img
                src={regencyLogoUrl.trim()}
                alt="Logo Daerah"
                className="max-w-full max-h-20 object-contain"
                crossOrigin="anonymous"
                onError={() => setLogoLoadError(true)}
              />
            ) : (
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">LOGO</div>
            )}
          </div>

          {/* Center Letterhead Text (Standardized Weights) */}
          <div className="flex-1 text-center font-sans">
            <h1 className="text-base sm:text-lg font-bold tracking-widest uppercase text-slate-900 leading-tight">
              Pemerintah {regency}
            </h1>
            <h2 className="text-sm sm:text-base font-bold tracking-widest uppercase text-slate-800 leading-tight">
              {district}
            </h2>
            <h3 className="text-lg sm:text-2xl font-black tracking-widest uppercase text-slate-950 leading-tight">
              KANTOR KEPALA {villageName.toUpperCase()}
            </h3>
            <p className="text-[10.5px] text-slate-700 mt-1 leading-snug font-medium">
              {addressStreet}, Kode Pos {postalCode}
              <br />
              Email: {email} • Laman Resmi: {domain}
            </p>
          </div>

          {/* Right Village Logo */}
          <div className="w-20 h-24 flex-shrink-0 flex items-center justify-center">
            {villageLogoUrl && villageLogoUrl.trim() !== '' ? (
              <img
                src={villageLogoUrl.trim()}
                alt="Logo Desa"
                className="max-w-full max-h-20 object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">LOGO</div>
            )}
          </div>
        </div>

        {/* Standard Thick-Thin Double Line (Kop Surat Line) */}
        <div className="border-b-[2.5pt] border-slate-900 mb-[0.5pt]"></div>
        <div className="border-b-[1pt] border-slate-900"></div>
      </div>
    );
  };

  // Helper render Blok Biodata Pemohon
  const renderBiodataPemohon = () => {
    const isAhliWaris = request.serviceId === 'srv-ahli-waris' || request.serviceName?.toLowerCase().includes('ahli waris');

    if (isAhliWaris) {
      return (
        <div className="pl-6 sm:pl-10 text-[11px] leading-tight font-sans mb-2 grid grid-cols-2 gap-x-6 gap-y-1">
          {/* Column 1 */}
          <div className="space-y-0.5">
            <div className="flex items-start py-0.5">
              <span className="w-24 text-slate-700 shrink-0">Nama Lengkap</span>
              <span className="px-1 text-slate-700">:</span>
              <span className="font-bold uppercase text-slate-900 truncate">{citizenCleanName}</span>
            </div>
            <div className="flex items-start py-0.5">
              <span className="w-24 text-slate-700 shrink-0">NIK / No. KTP</span>
              <span className="px-1 text-slate-700">:</span>
              <span className="font-mono font-semibold text-slate-800">{citizenCleanNik}</span>
            </div>
            {citizenTtl && (
              <div className="flex items-start py-0.5">
                <span className="w-24 text-slate-700 shrink-0">Tempat, Tgl Lahir</span>
                <span className="px-1 text-slate-700">:</span>
                <span className="text-slate-800">{citizenTtl}</span>
              </div>
            )}
          </div>
          {/* Column 2 */}
          <div className="space-y-0.5">
            {Boolean(citizenGender) && (
              <div className="flex items-start py-0.5">
                <span className="w-24 text-slate-700 shrink-0">Jenis Kelamin</span>
                <span className="px-1 text-slate-700">:</span>
                <span className="text-slate-800">{String(citizenGender)}</span>
              </div>
            )}
            <div className="flex items-start py-0.5">
              <span className="w-24 text-slate-700 shrink-0">Dusun / Domisili</span>
              <span className="px-1 text-slate-700">:</span>
              <span className="text-slate-800 truncate">{citizenCleanDusun}, {villageName}</span>
            </div>
            <div className="flex items-start py-0.5">
              <span className="w-24 text-slate-700 shrink-0">No. Telepon/WA</span>
              <span className="px-1 text-slate-700">:</span>
              <span className="text-slate-800 font-mono">{citizenCleanPhone}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`pl-6 sm:pl-10 text-xs sm:text-sm font-sans ${details.isBundle ? 'space-y-1 mb-2.5' : 'space-y-2 mb-4'}`}>
        <div className="grid grid-cols-12 gap-1 sm:gap-2">
          <span className="col-span-5 sm:col-span-4 text-slate-800">Nama Lengkap</span>
          <span className="col-span-1 text-center">:</span>
          <span className="col-span-6 sm:col-span-7 font-bold uppercase text-slate-900">{citizenCleanName}</span>
        </div>
        <div className="grid grid-cols-12 gap-1 sm:gap-2">
          <span className="col-span-5 sm:col-span-4 text-slate-800">NIK / No. KTP</span>
          <span className="col-span-1 text-center">:</span>
          <span className="col-span-6 sm:col-span-7 font-mono font-semibold tracking-wider text-slate-800">
            {citizenCleanNik}
          </span>
        </div>
        {citizenTtl && (
          <div className="grid grid-cols-12 gap-1 sm:gap-2">
            <span className="col-span-5 sm:col-span-4 text-slate-800">Tempat, Tgl Lahir</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-6 sm:col-span-7 text-slate-800">
              {citizenTtl}
            </span>
          </div>
        )}
        {Boolean(citizenGender) && (
          <div className="grid grid-cols-12 gap-1 sm:gap-2">
            <span className="col-span-5 sm:col-span-4 text-slate-800">Jenis Kelamin</span>
            <span className="col-span-1 text-center">:</span>
            <span className="col-span-6 sm:col-span-7 text-slate-800">
              {String(citizenGender)}
            </span>
          </div>
        )}
        <div className="grid grid-cols-12 gap-1 sm:gap-2">
          <span className="col-span-5 sm:col-span-4 text-slate-800">Dusun / Domisili</span>
          <span className="col-span-1 text-center">:</span>
          <span className="col-span-6 sm:col-span-7 text-slate-800">
            {citizenCleanDusun}, {villageName}, {district}, {regency}, {province}
          </span>
        </div>

        <div className="grid grid-cols-12 gap-1 sm:gap-2">
          <span className="col-span-5 sm:col-span-4 text-slate-800">No. Telepon/WA</span>
          <span className="col-span-1 text-center">:</span>
          <span className="col-span-6 sm:col-span-7 text-slate-800 font-mono">
            {citizenCleanPhone}
          </span>
        </div>
      </div>
    );
  };

  // Helper render QR & Tanda Tangan Kades
  const renderKadesSignature = () => (
    <div className="grid grid-cols-12 items-end pt-1 font-sans text-xs">
      {/* Sisi Kiri: Kotak Validasi Keaslian Dokumen & QR Code */}
      <div className="col-span-6 pr-2">
        {showQrVerification ? (
          <div className="p-2 border border-slate-300 rounded-xl bg-slate-50 flex items-center gap-3">
            <div className="relative w-[84px] h-[84px] print:w-[24mm] print:h-[24mm] shrink-0 bg-white p-1 border border-slate-300 rounded-lg shadow-2xs flex items-center justify-center">
              {qrCodeDataUrl && qrCodeDataUrl.trim() !== '' ? (
                <>
                  <img
                    src={qrCodeDataUrl.trim()}
                    alt={`QR Verifikasi Resi ${request.trackingCode}`}
                    className="w-full h-full object-contain relative z-10"
                  />
                  {/* Center Logo Branding Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-5 h-5 print:w-[6mm] print:h-[6mm] bg-white rounded-full p-0.5 border border-slate-900 shadow-xs flex items-center justify-center overflow-hidden">
                      {villageLogoUrl ? (
                        <img src={villageLogoUrl} alt="Logo Desa" className="w-full h-full object-contain" />
                      ) : (
                        <SadewaHouseLogo size={12} color="#10b981" />
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 relative z-10">
                  <QrCode className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="space-y-0.5 text-[9.5px] text-slate-600 leading-tight">
              <div className="flex items-center gap-1 font-bold text-emerald-800 uppercase tracking-tight text-[10px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terverifikasi Elektronik</span>
              </div>
              <p className="text-slate-600">Kode Resi: <span className="font-mono font-bold text-slate-900">{request.trackingCode}</span></p>
              <p className="text-slate-500 text-[8.5px]">Pindai QR ini dengan kamera HP untuk validasi keabsahan dokumen {villageName}.</p>
              
              <div className="flex items-center gap-1.5 mt-1 border-t border-slate-200 pt-1.5 opacity-70">
                {villageProfile.sadewaLogoUrl || villageProfile.sadewaIconUrl ? (
                  <img 
                    src={villageProfile.sadewaLogoUrl || villageProfile.sadewaIconUrl} 
                    alt="SADEWA" 
                    className="h-3 sm:h-4 w-auto object-contain" 
                  />
                ) : (
                  <>
                    <SadewaHouseLogo size={12} className="text-emerald-700" />
                    <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase">SADEWA Digital Ecosystem</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden print:hidden text-[10px] text-slate-400 italic">
            {/* Kosong saat dicetak agar bersih untuk stempel basah */}
          </div>
        )}
      </div>

      {/* Sisi Kanan: Tanda Tangan Kepala Desa */}
      <div className="col-span-6 pl-4 text-center space-y-0.5">
        <p className="text-slate-700 text-[11px]">Dikeluarkan di : {villageName.replace(/^(desa|kelurahan)\s+/i, '')}</p>
        <p className="text-slate-700 text-[11px]">Pada Tanggal : {printDate}</p>
        <p className="font-bold uppercase tracking-wide text-slate-900 pt-0.5 text-[11px]">
          Kepala {villageName}
        </p>

        <div className="relative h-20 flex items-center justify-center my-0.5">
          {officialSignatureUrl && officialSignatureUrl.trim() !== '' ? (
            <img
              src={officialSignatureUrl.trim()}
              alt={`Tanda Tangan ${kadesName}`}
              className="max-h-20 max-w-40 object-contain"
            />
          ) : (
            <div className="h-20 w-full" />
          )}
        </div>

        <p className="font-bold text-slate-950 underline uppercase tracking-wide leading-tight text-[11px]">
          {kadesName}
        </p>
        <p className="text-[9.5px] text-slate-600 leading-tight">
          {kadesNip}
        </p>
      </div>
    </div>
  );

  // Render halaman individual dari bundel (misal: N1, N2, N3, N4)
  const renderBundlePage = (page: LetterPageDetails, idx: number, total: number) => {
    const isAhliWaris = request.serviceId === 'srv-ahli-waris' || request.serviceName?.toLowerCase().includes('ahli waris');
    return (
      <div
        key={page.pageNumber || idx}
        className="official-letter-page-item relative overflow-hidden p-8 sm:p-12 font-serif text-slate-900 leading-relaxed bg-white print:px-8 print:py-4 mb-8 print:mb-0 border border-slate-200 print:border-none shadow-sm print:shadow-none rounded-xl print:rounded-none flex flex-col justify-between"
        style={{
          pageBreakBefore: idx > 0 ? 'always' : 'auto',
          breakBefore: idx > 0 ? 'page' : 'auto',
          minHeight: paperSize === 'F4' ? '290mm' : paperSize === 'Legal' ? '320mm' : '260mm'
        }}
      >
        {showDraftWatermark && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 p-4">
            <div className="flex flex-col items-center justify-center -rotate-45 text-center">
              <span className="text-red-900/15 sm:text-red-900/20 text-3xl sm:text-5xl font-black uppercase tracking-widest font-sans border-4 border-red-900/20 px-6 py-2 rounded-xl">
                {customDraftText || 'DRAFT - BELUM SAH UNTUK KEPERLUAN LEGAL'}
              </span>
            </div>
          </div>
        )}
        <div className="relative z-10">
          {/* Header Model Tag */}
          <div className={`flex items-center justify-between text-xs font-sans text-slate-500 ${isAhliWaris ? 'mb-1 print:mb-0.5' : 'mb-2 print:mb-1'}`}>
            <span className="font-bold text-slate-700">{page.pageCode || `Halaman ${idx + 1}`}</span>
            <span className="text-[11px] text-slate-400">Lembar {idx + 1} dari {total}</span>
          </div>

          {/* KOP SURAT */}
          {renderKopSurat()}

          {/* JUDUL HALAMAN & NOMOR */}
          <div className={`text-center ${isAhliWaris ? 'mt-1 mb-2' : details.isBundle ? 'mt-2 mb-3.5' : 'mt-4 mb-5'}`}>
            <h4 className={`font-bold underline uppercase tracking-wide ${isAhliWaris ? 'text-[13px] leading-tight' : 'text-sm sm:text-base'}`}>
              {page.title}
            </h4>
            {page.subtitle && (
              <p className={`font-sans italic ${isAhliWaris ? 'text-[10px] mt-0.5' : 'text-[11px] mt-0.5 text-slate-600'}`}>
                {page.subtitle}
              </p>
            )}
            <p className={`font-sans font-medium text-slate-700 ${isAhliWaris ? 'text-[10.5px] mt-0.5' : 'text-xs mt-1'}`}>
              Nomor : {details.customLetterNumber || finalLetterNumber}
            </p>
          </div>

          {/* PEMBUKA (jika halaman 1 atau 2) */}
          {idx === 0 && (
            <p className={`text-justify indent-8 ${isAhliWaris ? 'text-[11px] leading-tight mb-1.5' : details.isBundle ? 'text-xs sm:text-sm mb-2.5' : 'text-xs sm:text-sm mb-4'}`}>
              {page.customOpening || `Yang bertanda tangan di bawah ini Kepala ${villageName}, ${district}, ${regency}, ${province}, dengan ini menerangkan dengan sebenarnya bahwa:`}
            </p>
          )}

          {/* BIODATA PEMOHON */}
          {idx === 0 && renderBiodataPemohon()}

          {/* ISI PERNYATAAN */}
          <p className={`text-justify indent-8 ${isAhliWaris ? 'text-[11px] leading-tight mb-1.5' : details.isBundle ? 'text-xs sm:text-sm mb-2.5' : 'text-xs sm:text-sm mb-3'}`}>
            {page.statement}
          </p>

          {/* EXTRA FIELDS PER HALAMAN */}
          {page.extraFields && page.extraFields.length > 0 && (
            <div className="pl-6 sm:pl-10 my-4 p-4 border border-slate-300 rounded-xl text-xs sm:text-sm font-sans bg-white">
              <div className="grid grid-cols-1 space-y-2">
                {page.extraFields.map((field, fIdx) => (
                  <div key={fIdx} className="grid grid-cols-12 gap-1 sm:gap-2">
                    <span className="col-span-5 sm:col-span-4 text-slate-800">{field.label}</span>
                    <span className="col-span-1 text-center text-slate-800">:</span>
                    <span className="col-span-6 sm:col-span-7 font-bold text-slate-950">{field.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CUSTOM RENDER CONTENT (e.g. Sporadik Sketch) */}
          {page.renderCustom && page.renderCustom()}

          {/* KEPERLUAN */}
          {page.purpose && (
            <p className={`text-justify indent-8 ${isAhliWaris ? 'text-[11px] leading-tight mb-1.5' : details.isBundle ? 'text-xs sm:text-sm mb-2.5' : 'text-xs sm:text-sm mb-4'}`}>
              Keperluan: <strong className={`font-semibold text-slate-900 ${isAhliWaris ? 'text-[11px]' : ''}`}>{page.purpose}</strong>.
            </p>
          )}

          {/* PENUTUP */}
          {page.closingStatement !== 'none' && (
            <p className={`text-justify indent-8 ${isAhliWaris ? 'text-[11px] leading-tight mt-1 mb-1' : details.isBundle ? 'text-xs sm:text-sm mt-1.5 mb-1.5' : 'text-xs sm:text-sm mt-2 mb-2'}`}>
              {page.closingStatement || 'Demikian surat keterangan ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya.'}
            </p>
          )}
        </div>

        {/* BLOK TANDA TANGAN */}
        <div className="break-inside-avoid h-fit mt-3 sm:mt-4">
          {page.signType === 'none' ? null : page.signType === 'mempelai' && page.customSigners ? (
            <div className="grid grid-cols-12 items-end pt-4 font-sans text-xs">
              <div className="col-span-6 text-center space-y-1 pr-4">
                <p className="font-semibold text-slate-800">{page.customSigners.leftTitle || 'Calon Suami / Istri'}</p>
                <div className="h-20 flex items-center justify-center" />
                <p className="font-bold underline text-slate-950 uppercase">{page.customSigners.leftName}</p>
                {page.customSigners.leftSub && <p className="text-[10px] text-slate-500">{page.customSigners.leftSub}</p>}
              </div>

              <div className="col-span-6 text-center space-y-1 pl-4">
                <p className="text-slate-600">{villageName.replace(/^(desa|kelurahan)\s+/i, '')}, {printDate}</p>
                <p className="font-semibold text-slate-800">{page.customSigners.rightTitle || 'Calon Pasangan'}</p>
                <div className="h-20 flex items-center justify-center" />
                <p className="font-bold underline text-slate-950 uppercase">{page.customSigners.rightName}</p>
                {page.customSigners.rightSub && <p className="text-[10px] text-slate-500">{page.customSigners.rightSub}</p>}
              </div>
            </div>
          ) : page.signType === 'orang_tua' && page.customSigners ? (
            <div className="grid grid-cols-12 items-end pt-4 font-sans text-xs">
              <div className="col-span-6 text-center space-y-1 pr-4">
                <p className="font-semibold text-slate-800">{page.customSigners.leftTitle || 'Ayah Kandung / Wali'}</p>
                <div className="h-20 flex items-center justify-center" />
                <p className="font-bold underline text-slate-950 uppercase">{page.customSigners.leftName}</p>
                {page.customSigners.leftSub && <p className="text-[10px] text-slate-500">{page.customSigners.leftSub}</p>}
              </div>

              <div className="col-span-6 text-center space-y-1 pl-4">
                <p className="text-slate-600">{villageName.replace(/^(desa|kelurahan)\s+/i, '')}, {printDate}</p>
                <p className="font-semibold text-slate-800">{page.customSigners.rightTitle || 'Ibu Kandung'}</p>
                <div className="h-20 flex items-center justify-center" />
                <p className="font-bold underline text-slate-950 uppercase">{page.customSigners.rightName}</p>
                {page.customSigners.rightSub && <p className="text-[10px] text-slate-500">{page.customSigners.rightSub}</p>}
              </div>
            </div>
          ) : page.signType === 'pemohon' ? (
            <div className="flex justify-end pt-4 font-sans text-xs">
              <div className="w-1/2 text-center space-y-1">
                <p className="text-slate-600">{villageName.replace(/^(desa|kelurahan)\s+/i, '')}, {printDate}</p>
                <p className="font-semibold text-slate-800">Yang Membuat Pernyataan</p>
                <div className="h-20 flex items-center justify-center relative">
                  <div className="absolute border-2 border-slate-200 border-dashed p-1 w-[70px] h-[35px] text-[8px] flex items-center justify-center text-slate-200 font-bold -rotate-12 left-6">
                    MATERAI<br/>10.000
                  </div>
                </div>
                <p className="font-bold underline text-slate-950 uppercase">{request.citizenName}</p>
              </div>
            </div>
          ) : (
            renderKadesSignature()
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div id="official-letter-portal" className="official-letter-overlay fixed inset-0 z-[100] overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'F4' ? '215mm 330mm' : paperSize === 'Legal' ? '215.9mm 355.6mm' : 'A4'} portrait !important;
            margin: 8mm 12mm 10mm 12mm !important;
          }
          .official-letter-page-item,
          .official-letter-sheet {
            min-height: ${paperSize === 'F4' ? '290mm' : paperSize === 'Legal' ? '320mm' : '260mm'} !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-inside: avoid !important;
          }
          .official-letter-page-item:not(:last-child) {
            page-break-after: always !important;
          }
          /* Matikan margin body bawaan browser */
          body { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
      {/* Container Dialog */}
      <div className="official-letter-card bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none">
        
        {/* Action Header Bar (Hidden in Print) */}
        <div className="official-letter-actionbar bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              {details.pages && details.pages.length > 0 ? (
                <Layers className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm tracking-wide">Pratinjau Dokumen Resmi {villageName}</h2>

                {details.pages && details.pages.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Bundel {details.pages.length} Halaman
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Format Resmi Standar Kementerian Dalam Negeri RI • Standar Cetak {paperSize}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper Size Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs">
              <span className="text-slate-400 text-[10px] font-semibold uppercase">Kertas:</span>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as 'A4' | 'F4' | 'Legal')}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer border-none p-0 pr-1 select-none"
              >
                <option value="A4" className="bg-slate-900 text-white font-semibold">A4 (Standar)</option>
                <option value="F4" className="bg-slate-900 text-white font-semibold">F4 (Folio/HVS)</option>
                <option value="Legal" className="bg-slate-900 text-white font-semibold">Legal (Panjang)</option>
              </select>
            </div>

            {request.phone && (
              <button
                type="button"
                onClick={handleShareWa}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Kirim pemberitahuan ke WhatsApp pemohon"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={disablePrint}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer ${
                disablePrint 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
              title={disablePrint ? printWarningText : "Buka dialog cetak atau simpan ke PDF langsung dari browser"}
              id="btn-print-official-modal"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin Toggle Banner (Clean Administrative Phrasing) */}
        {isAdminView && (
          <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex items-center justify-between text-xs text-slate-300 no-print">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-400 uppercase tracking-wide text-[10px]">Panel Kontrol Dokumen Desa</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 hover:bg-slate-750 transition-colors">
              <input
                type="checkbox"
                checked={showQrVerification}
                onChange={(e) => setShowQrVerification(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-emerald-400 w-3.5 h-3.5 cursor-pointer bg-slate-900 border-slate-600"
              />
              <span className="font-semibold text-white text-[11px]">Sertakan Validasi QR Elektronik</span>
            </label>
          </div>
        )}

        {/* Printable Document Body: Pure A4 Sheet Container */}
        <div id="official-letter-printable" className="p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
          {disablePrint && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-3 no-print">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <p className="font-bold uppercase tracking-tight">{printWarningText}</p>
            </div>
          )}
          {paperSize !== 'A4' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2 no-print animate-pulse">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span><strong>PENTING:</strong> Pastikan pengaturan <strong>"Ukuran Kertas"</strong> di dialog cetak browser/printer juga diatur ke <strong>{paperSize === 'F4' ? 'Folio / F4 / 215 x 330 mm' : 'Legal'}</strong> agar tata letak pas.</span>
            </div>
          )}
          {details.pages && details.pages.length > 0 ? (
            /* Multi-Page Bundle Rendering (e.g. Nikah N1-N4) */
            <div className="space-y-6 print:space-y-0">
              {details.pages.map((page, idx) =>
                renderBundlePage(page, idx, details.pages!.length)
              )}
            </div>
          ) : (
            /* Single-Page Standard Letter Rendering (14 services + kematian) */
            <div 
              className="official-letter-sheet relative overflow-hidden p-8 sm:p-12 font-serif text-slate-900 leading-relaxed bg-white print:px-8 print:py-5 rounded-xl print:rounded-none border border-slate-200 print:border-none shadow-sm print:shadow-none flex flex-col justify-between"
              style={{
                minHeight: paperSize === 'F4' ? '290mm' : paperSize === 'Legal' ? '320mm' : '260mm'
              }}
            >
              {showDraftWatermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 p-4">
                  <div className="flex flex-col items-center justify-center -rotate-45 text-center">
                    <span className="text-red-900/15 sm:text-red-900/20 text-3xl sm:text-5xl font-black uppercase tracking-widest font-sans border-4 border-red-900/20 px-6 py-2 rounded-xl">
                      {customDraftText || 'DRAFT - BELUM SAH UNTUK KEPERLUAN LEGAL'}
                    </span>
                  </div>
                </div>
              )}
              <div className="relative z-10">
              {/* KOP SURAT RESMI */}
              {renderKopSurat()}

              {/* JUDUL SURAT & NOMOR */}
              <div className="text-center mt-4 mb-4">
                <h4 className="text-sm sm:text-base font-bold underline uppercase tracking-wide">
                  {details.title}
                </h4>
                <p className="text-xs font-sans mt-1 font-medium text-slate-700">
                  Nomor : {details.customLetterNumber || finalLetterNumber}
                </p>
              </div>

              {/* PEMBUKA */}
              <p className="text-xs sm:text-sm text-justify indent-8 mb-3">
                {details.customOpening || `Yang bertanda tangan di bawah ini Kepala ${villageName}, ${district}, ${regency}, ${province}, dengan ini menerangkan dengan sebenarnya bahwa:`}
              </p>

              {/* TABEL BIODATA PEMOHON */}
              {renderBiodataPemohon()}

              {/* ISI PERNYATAAN */}
              <p className="text-xs sm:text-sm text-justify indent-8 mb-2.5">
                {details.statement}
              </p>

              {/* DETAIL TAMBAHAN */}
              {details.extraFields && details.extraFields.length > 0 && (
                <div className="pl-6 sm:pl-10 my-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans space-y-1">
                  {details.extraFields.map((field, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1">
                      <span className="col-span-4 text-slate-600">{field.label}</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-bold text-slate-900">{field.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* KEPERLUAN */}
              <p className="text-xs sm:text-sm text-justify indent-8 mb-3">
                Surat Keterangan ini diberikan untuk keperluan: <strong className="font-semibold text-slate-900">{details.purpose}</strong>.
              </p>

              {/* PENUTUP */}
              <p className="text-xs sm:text-sm text-justify indent-8 mt-2 mb-2">
                Demikian surat keterangan ini kami buat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya oleh pihak yang berkepentingan.
              </p>
              </div>

              {/* TANDA TANGAN DAN CAP KEPALA DESA + QR CODE */}
              <div className="break-inside-avoid h-fit mt-3 sm:mt-4 relative z-10">
                {renderKadesSignature()}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls (Hidden in Print) */}
        <div className="official-letter-footer-bar bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Status Permohonan: <strong className="text-slate-800 uppercase">{request.status}</strong></span>
            {details.pages && details.pages.length > 0 && (
              <span className="text-slate-400">• Bundel Multi-Halaman: Model N1 - N4 ({details.pages.length} Lembar)</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Tutup
            </button>
            {disablePrint && printWarningText && (
              <span className="text-amber-600 text-[10px] font-bold italic px-2">
                {printWarningText}
              </span>
            )}
            {!disablePrint && (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                id="btn-print-download-final"
              >
                <Download className="w-4 h-4 text-emerald-300" />
                <span>Unduh / Cetak Dokumen (PDF)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
