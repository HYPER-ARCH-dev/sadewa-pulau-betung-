import React, { useRef, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Download,
  Printer,
  FileText,
  QrCode,
  ShieldCheck,
  Building2,
  ExternalLink,
  FileDown
} from 'lucide-react';
import { ServiceRequest, VillageProfile } from '../../types';
import { getLetterFormatConfig, LetterClass } from '../../data/letterClassification';
import { useApp } from '../../context/AppContext';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';
import { getUnmaskedOfficialNik } from './sanitizer';

export interface LetterPreviewContainerProps {
  request: ServiceRequest;
  children?: React.ReactNode;
  bannerUrl?: string;
  heroImageUrl?: string;
  villageProfile?: VillageProfile | null;
  kadesName?: string;
  kadesNip?: string;
  officialSignatureUrl?: string;
  printDate?: string;
  qrCodeDataUrl?: string;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  isModal?: boolean;
  isAdmin?: boolean;
}

/**
 * =========================================================================
 * BAGIAN 1: KOMPONEN WRAPPER PREVIEW DOKUMEN (LetterPreviewContainer.tsx)
 * =========================================================================
 * Komponen wrapper tingkat tinggi untuk seluruh format surat dinas di SADEWA.
 * Bertanggung jawab atas:
 * 1. Edu Banner Alert dinamis di luar kontainer surat (Kelas A vs Kelas B).
 * 2. Watermark Dinamis & Sticky khusus KELAS A ("DRAFT - KHUSUS VERIFIKASI KANTOR DESA").
 * 3. Digital Verification Badge bergaris & Simulasi TTE resmi Kepala Desa di footer.
 * 4. Proteksi Hak Unduh (Conditional Download / Disabled Lock Icon).
 *    *KHUSUS ADMIN/STAFF: Berhak mengunduh dan mencetak seluruh surat Kelas A & B untuk keperluan dinas.
 * 5. Visibilitas NIK (Unmasked Data) secara utuh untuk keabsahan hukum.
 * 6. Asset gambar via tag <img> standar (tanpa SVG manual).
 */
export const LetterPreviewContainer: React.FC<LetterPreviewContainerProps> = ({
  request,
  children,
  bannerUrl,
  heroImageUrl,
  villageProfile,
  kadesName,
  kadesNip,
  officialSignatureUrl = '/images/sample-signature.png',
  printDate,
  qrCodeDataUrl,
  onPrint,
  onDownloadPdf,
  isModal = false,
  isAdmin = false
}) => {
  const { currentUser, villageProfile: appVillageProfile } = useApp();
  const activeVillageLogo = villageProfile?.villageLogoUrl || appVillageProfile?.villageLogoUrl;
  const printRef = useRef<HTMLDivElement>(null);
  const [heroImgError, setHeroImgError] = React.useState(false);

  // Deteksi role admin / staff
  const userIsAdmin = Boolean(
    isAdmin ||
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'admin_desa' ||
      currentUser?.role === 'operator'
  );

  // Deteksi klasifikasi format surat (Kelas A: Sensitif vs Kelas B: Umum)
  const formatConfig = useMemo(() => {
    return getLetterFormatConfig(request.serviceName || request.serviceId);
  }, [request.serviceName, request.serviceId]);

  const isClassA = formatConfig.category === 'CLASS_A';
  const isClassB = formatConfig.category === 'CLASS_B';
  // Admin selalu memiliki hak download penuh untuk mencetak fisik atau mengarsip
  const allowDownload = userIsAdmin ? true : formatConfig.allowDownload;

  // =========================================================================
  // CATATAN ARSITEKTUR & VISIBILITAS NIK:
  // Di lembaran naskah surat dinas fisik privat untuk urusan birokrasi ke lembaga
  // instansi lain (KUA, Kepolisian, Bank, Dukcapil, BPN), NIK wajib tampil 16 digit utuh.
  // =========================================================================
  const rawCitizenNik = useMemo(() => {
    return getUnmaskedOfficialNik(request);
  }, [request]);

  const villageName = villageProfile?.villageName || 'Desa';
  const district = villageProfile?.district || 'Kecamatan';
  const regency = villageProfile?.regency || 'Kabupaten';
  const province = villageProfile?.province || 'Provinsi';
  const addressStreet = villageProfile?.addressStreet || 'Alamat Kantor';
  const postalCode = villageProfile?.postalCode || '366xx';
  const villagePureName = villageName.replace(/^(desa|kelurahan)\s+/i, '');

  // Asset gambar banner/logo desa untuk Watermark & Badge
  const activeBannerSrc = heroImageUrl || bannerUrl || villageProfile?.heroBackgroundUrl || '';


  // Format tanggal terbit dokumen resmi
  const formattedDate = useMemo(() => {
    if (printDate) return printDate;
    if (request.completedAt) {
      try {
        return new Date(request.completedAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      } catch {
        return request.completedAt;
      }
    }
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [printDate, request.completedAt]);

  // Default handler jika callback tidak diprovide
  const handlePrintAction = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDownloadAction = () => {
    if (!allowDownload) return;
    if (onDownloadPdf) {
      onDownloadPdf();
    } else {
      window.print();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-2 space-y-2">
      {/* =====================================================================
          3. EDU BANNER ALERT DINAMIS (DI LUAR KONTAINER DOKUMEN SURAT)
          ===================================================================== */}
      <div className="print:hidden">
        {isClassA ? (
          <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-3 sm:p-4 shadow-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-start space-x-2">
              <div className="p-1.5 bg-amber-200/80 rounded-lg text-amber-800 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 rounded-md">
                    Dokumen Kelas A (Sensitif)
                  </span>
                  <span className="text-[11px] font-semibold text-amber-800">
                    {formatConfig.name}
                  </span>
                  {userIsAdmin && (
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md">
                      Akses Aparatur Aktif
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs font-medium leading-snug text-amber-900">
                  {userIsAdmin ? (
                    <>
                      🏛️ <strong>Otorisasi Aparat Desa:</strong> Anda memiliki wewenang penuh untuk mengunduh dan mencetak naskah fisik surat ini untuk ditandatangani basah/disahkan bagi warga pemohon di kantor desa.
                    </>
                  ) : (
                    <>
                      ⚠️ <strong>Pemberitahuan Warga:</strong> Surat ini termasuk <strong>Dokumen Sensitif (Kelas A)</strong>. Demi keabsahan hukum, Anda wajib datang ke Kantor Desa membawa berkas asli untuk mengambil lembaran fisik resmi bertanda tangan basah dan cap stempel.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {userIsAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadAction}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center space-x-1 transition-colors shadow-xs"
                    title="Aparatur desa dapat mengunduh dokumen resmi Kelas A"
                    id="btn-admin-download-class-a"
                  >
                    <Download className="w-3 h-3" />
                    <span>Unduh PDF Dinas</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintAction}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-800 hover:bg-amber-900 text-white flex items-center space-x-1 transition-colors shadow-xs"
                    title="Cetak lembaran fisik kantor desa"
                    id="btn-admin-print-class-a"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Cetak Fisik</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    title="Dokumen Sensitif tidak dapat diunduh langsung oleh warga untuk menjaga keabsahan hukum"
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-200/60 text-amber-800/70 border border-amber-300 cursor-not-allowed flex items-center space-x-1 shadow-none"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Unduh PDF Dibatasi</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintAction}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-700 hover:bg-amber-800 text-white flex items-center space-x-1 transition-colors shadow-xs"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Pratinjau Cetak</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50 border-2 border-emerald-300 p-3 sm:p-4 shadow-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-start space-x-2">
              <div className="p-1.5 bg-emerald-200/80 rounded-lg text-emerald-800 shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 rounded-md">
                    Dokumen Kelas B (Umum)
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    {formatConfig.name}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs font-medium leading-snug text-emerald-900">
                  ✅ <strong>Pemberitahuan:</strong> Surat ini termasuk <strong>Dokumen Umum (Kelas B)</strong>. Anda dapat mengunduh dan mencetak file PDF secara mandiri.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={handleDownloadAction}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center space-x-1 transition-colors shadow-xs"
              >
                <Download className="w-3 h-3" />
                <span>Unduh PDF Resmi</span>
              </button>
              <button
                type="button"
                onClick={handlePrintAction}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center space-x-1 transition-colors"
              >
                <Printer className="w-3 h-3" />
                <span>Cetak</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          KONTAINER UTAMA SURAT DINAS RESMI (PRINTABLE DOCUMENT)
          ===================================================================== */}
      <div
        ref={printRef}
        className="relative bg-white border border-slate-300 shadow-md rounded-xl p-8 text-black font-serif print:border-none print:shadow-none print:p-0 print:m-0 print:w-full min-h-0 h-auto"
      >
        {/* ===================================================================
            4. WATERMARK DINAMIS (HANYA KELAS A ATAU STATUS DRAF)
            Sticky / fixed di tengah dokumen meskipun dokumen multi-halaman.
            =================================================================== */}
        {isClassA && (
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden flex items-center justify-center p-6">
            <div className="sticky top-1/2 -translate-y-1/2 flex flex-col items-center justify-center select-none text-center transform -rotate-45 pointer-events-none">
              {/* Logo asset via standard <img> tag (NO SVG manual) */}
              <img
                src={activeBannerSrc}
                alt="Watermark SADEWA"
                className="w-72 sm:w-96 max-w-full opacity-10 blur-[0.5px] object-contain mb-3"
              />
              <div className="px-6 py-2 border-4 border-red-900/30 rounded-2xl bg-red-50/20">
                <span className="text-xl sm:text-2xl md:text-3xl font-black font-sans tracking-widest text-red-950 uppercase opacity-20 whitespace-nowrap">
                  DRAFT - BELUM SAH UNTUK KEPERLUAN LEGAL
                </span>
              </div>
            </div>
          </div>
        )}

        {/* KOP SURAT RESMI PEMERINTAH {villageName.toUpperCase()} */}
        <div className="relative z-10 mb-6 font-sans">
          <div className="flex items-center justify-between gap-4 pb-1">
            <div className="w-20 h-24 flex items-center justify-center shrink-0">
              <img
                src={villageProfile?.villageLogoUrl || "/images/logo-batanghari.png"}
                alt="Lambang Daerah"
                className="max-h-20 max-w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 px-2 text-center">
              <h4 className="text-sm font-bold uppercase tracking-widest text-black">
                Pemerintah {regency}
              </h4>
              <h3 className="text-base font-bold uppercase tracking-widest text-black">
                {district}
              </h3>
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-widest text-black mt-0.5">
                KANTOR KEPALA {villagePureName.toUpperCase()}
              </h2>
              <p className="text-[10.5px] text-slate-800 leading-tight mt-1">
                Alamat: {addressStreet}, Kode Pos {postalCode}
                <br />
                Email: {villageProfile?.email || 'kontak@desa.id'} • Laman Resmi: {villageProfile?.website || 'desa.id'}
              </p>
            </div>
            <div className="w-20 h-24 hidden sm:flex items-center justify-center shrink-0">
              <img
                src="/images/logo.png"
                alt="Logo SADEWA"
                className="max-h-16 max-w-full object-contain opacity-40"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>
          {/* Standard Thick-Thin Double Line */}
          <div className="border-b-[2.5pt] border-black mb-[0.5pt]"></div>
          <div className="border-b-[1pt] border-black"></div>
        </div>

        {/* JUDUL DOKUMEN & NOMOR REGISTER RESMI */}
        <div className="relative z-10 text-center mb-4">
          <h1 className="text-base font-black underline tracking-wide uppercase text-black">
            {formatConfig.name}
          </h1>
          <p className="text-xs font-serif mt-0.5 font-semibold text-slate-900">
            Nomor: {request.officialLetterNumber || `470 / ${request.trackingCode.replace(/[^0-9]/g, '') || '001'} / SK / ${villageProfile?.letterCodePrefix || 'DS'} / ${new Date().getFullYear()}`}
          </p>
        </div>

        {/* ISI DOKUMEN (CHILDREN TEMPLATE DENGAN UNMASKED RAW DATA) */}
        <div className="relative z-10 space-y-2 text-xs leading-relaxed text-justify text-black">
          {children ? (
            children
          ) : (
            <div className="space-y-2">
              <p>
                Yang bertanda tangan di bawah ini Kepala {villageName}, {district}, {regency}, {province}, dengan ini menerangkan dengan sebenarnya bahwa:
              </p>

              <div className="pl-6 space-y-1 font-sans text-xs">
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-4 font-semibold text-slate-900">Nama Lengkap</span>
                  <span className="col-span-8">: <strong>{request.citizenName}</strong></span>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-4 font-semibold text-slate-900">NIK Pemohon</span>
                  {/* Visibilitas NIK secara raw/unmasked untuk legalitas lembaga */}
                  <span className="col-span-8">: <strong className="font-mono text-black">{rawCitizenNik}</strong></span>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-4 font-semibold text-slate-900">Tempat, Tanggal Lahir</span>
                  <span className="col-span-8">: {request.citizenBirthPlace || villagePureName}, {request.citizenBirthDate || '15 Mei 1992'}</span>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-4 font-semibold text-slate-900">Jenis Kelamin</span>
                  <span className="col-span-8">: {request.citizenGender || 'Laki-laki'}</span>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-4 font-semibold text-slate-900">Agama / Kebangsaan</span>
                  <span className="col-span-8">: Islam / Warga Negara Indonesia (WNI)</span>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-4 font-semibold text-slate-900">Pekerjaan</span>
                  <span className="col-span-8">: {(request.formData as Record<string, any>)?.job || (request.formData as Record<string, any>)?.pekerjaan || 'Petani / Wiraswasta'}</span>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-4 font-semibold text-slate-900">Alamat KTP</span>
                  <span className="col-span-8">: {request.addressDusun || 'Dusun Setempat'}, {villageName}, {district}, {regency}</span>
                </div>
              </div>

              <p className="pt-1">
                {formatConfig.description}
              </p>

              {request.notes && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] font-sans text-slate-800">
                  <strong>Keperluan / Keterangan Tambahan:</strong> {request.notes}
                </div>
              )}

              <p>
                Demikian surat keterangan ini kami berikan dengan sebenarnya kepada yang bersangkutan untuk dapat dipergunakan sebagaimana mestinya dan sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.
              </p>
            </div>
          )}
        </div>

        {/* ===================================================================
            5. FOOTER INJEKSI: DIGITAL VERIFICATION BADGE & TTE (2 KOLOM)
            =================================================================== */}
        <div className="break-inside-avoid h-fit relative z-10 mt-3 pt-2 border-t border-slate-300 grid grid-cols-2 gap-3 items-end">
          {/* KOLOM KIRI: KOTAK DIGITAL VERIFICATION BADGE */}
          <div className="max-w-[110mm]">
            {/* Kotak Badge Original */}
            <div className="border border-emerald-300 bg-emerald-50/60 rounded-lg p-2 flex items-center gap-2.5">
              <div className="w-[72px] h-[72px] print:w-[22mm] print:h-[22mm] shrink-0 bg-white p-1 border border-slate-200 rounded-lg shadow-2xs flex items-center justify-center relative">
                {qrCodeDataUrl ? (
                  <>
                    <img
                      src={qrCodeDataUrl}
                      alt={`QR Code Resi ${request.trackingCode}`}
                      className="w-full h-full object-contain relative z-10"
                    />
                    {/* Center Logo Branding Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="w-4.5 h-4.5 print:w-[5.5mm] print:h-[5.5mm] bg-white rounded-full p-0.5 border border-slate-900 shadow-xs flex items-center justify-center overflow-hidden">
                        {activeVillageLogo ? (
                          <img src={activeVillageLogo} alt="Logo Desa" className="w-full h-full object-contain" />
                        ) : (
                          <SadewaHouseLogo size={10} color="#10b981" />
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <QrCode className="w-8 h-8 text-slate-700" />
                )}
              </div>
              <div className="flex flex-col justify-between min-w-0 flex-1">
                <span className="text-[10px] font-bold text-emerald-900 leading-none">
                  TERVERIFIKASI ELEKTRONIK
                </span>
                <p className="text-[9px] text-slate-600 font-mono mt-0.5">
                  Kode Resi: {request.trackingCode}
                </p>
                <p className="text-[8px] text-slate-500 leading-tight mt-0.5">
                  Pindai QR ini untuk memvalidasi keabsahan dokumen {villageName}
                </p>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: SIMULASI TTE (TANDA TANGAN ELEKTRONIK) KEPALA DESA */}
          <div className="text-right font-serif space-y-0">
            <p className="text-xs text-black">
              Dikeluarkan di: {villagePureName}
            </p>
            <p className="text-xs text-black">
              Pada tanggal: {formattedDate}
            </p>
            <p className="text-xs font-bold uppercase text-black pt-0.5">
              Kepala {villageName}
            </p>

            {/* Area TTE / Digital Signature */}
            <div className="my-1 flex justify-end">
              <div className="relative w-36 h-16 border border-emerald-500/40 rounded-lg bg-emerald-50/40 p-1 flex flex-col items-center justify-center text-center font-sans">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mb-0" />
                <span className="text-[8px] font-bold text-emerald-900 uppercase tracking-tight">
                  Ditandatangani Elektronik
                </span>
                <span className="text-[7px] text-emerald-700 font-mono">
                  BSrE - BSSN RI Certified
                </span>
                <span className="text-[7px] text-slate-500">
                  {villageName}
                </span>
              </div>
            </div>


            <div className="pt-0">
              <p className="text-xs font-black underline uppercase text-black">
                {kadesName}
              </p>
              <p className="text-[10px] font-sans text-slate-700">
                {kadesNip}
              </p>

              {/* Branding SADEWA di Bawah NIAP */}
              <div className="mt-2 flex flex-col items-center justify-center gap-0.5">
                <span className="text-[7.5px] text-slate-400 font-medium italic">
                  Powered by
                </span>
                <img 
                  src={villageProfile?.sadewaLogoUrl || villageProfile?.heroBackgroundUrl || ''} 
                  alt="SADEWA" 
                  crossOrigin="anonymous"
                  className="h-3.5 w-auto object-contain max-w-[100px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.classList.remove('hidden');
                    }
                  }}
                />
                <span className="hidden text-[8.5px] font-black text-emerald-800 tracking-wider">
                  SADEWA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Catatan Dokumen Multi Halaman jika Paket Pengantar Nikah N1-N4 */}
        {formatConfig.isMultiPage && (
          <div className="mt-4 pt-2 border-t border-dashed border-slate-300 text-center font-sans text-[10px] text-slate-500 print:hidden">
            Dokumen Bundel Multi-Halaman: <strong>Paket Pengantar Nikah (Model N1 - N4)</strong>. Halaman 1 dari {formatConfig.pageCount || 4}.
          </div>
        )}
      </div>
    </div>
  );
};
