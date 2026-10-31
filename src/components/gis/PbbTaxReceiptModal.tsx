import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { LandParcel } from '../../types/webgis';
import { calculatePbbTax } from '../../utils/geometryEngine';
import { generateVerificationQrCode, getLetterVerificationUrl } from '../../utils/qrHelper';
import { X, Printer, CheckCircle, Download, FileText, ShieldCheck, Building2 } from 'lucide-react';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';

interface PbbTaxReceiptModalProps {
  parcel: LandParcel | null;
  villageName?: string;
  district?: string;
  regency?: string;
  onClose: () => void;
}

export const PbbTaxReceiptModal: React.FC<PbbTaxReceiptModalProps> = ({
  parcel,
  villageName: propVillageName,
  district: propDistrict,
  regency: propRegency,
  onClose
}) => {
  const { villageProfile } = useApp();

  const villageName = propVillageName || villageProfile.villageName || 'Desa';
  const district = propDistrict || villageProfile.district || 'Kecamatan';
  const regency = propRegency || villageProfile.regency || 'Kabupaten';
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!parcel) return;
    const rawContent = getLetterVerificationUrl(parcel.nop);
    generateVerificationQrCode(rawContent, { width: 150 })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [parcel]);

  if (!parcel) return null;

  const taxCalc = calculatePbbTax(
    parcel.landAreaSqM,
    parcel.njopLandPerSqM,
    parcel.buildingAreaSqM,
    parcel.njopBuildingPerSqM
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-fadeIn">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-800/80 flex items-center justify-center text-emerald-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">SPPT PBB-P2 & Bukti Setor Pajak Daerah</h3>
              <p className="text-xs text-emerald-200/80">Nomor Objek Pajak (NOP): {parcel.nop}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak SPPT</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-6 sm:p-8 font-sans text-slate-800 space-y-6 max-h-[80vh] overflow-y-auto bg-white" id="printable-sppt">
          {/* Header Lembaga Pajak Daerah */}
          <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
            <div className="text-xs uppercase tracking-wider font-extrabold text-slate-600">PEMERINTAH KABUPATEN BATANG HARI</div>
            <div className="text-sm font-black uppercase text-slate-900">BADAN KEUNGAN DAERAH / KANTOR {villageName.toUpperCase()}</div>
            <div className="text-xs font-bold text-emerald-800">SURAT PEMBERITAHUAN PAJAK TERHUTANG (SPPT) PBB-P2 TAHUN 2026</div>
            <p className="text-[10px] text-slate-500 font-serif italic">Kecamatan: {district} | Desa/Kelurahan: {villageName}</p>
          </div>

          {/* Status Lunas Badge */}
          <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Status Pembayaran PBB-P2</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <CheckCircle className={`w-4 h-4 ${parcel.pbbStatus === 'LUNAS' ? 'text-emerald-600' : 'text-amber-600'}`} />
                <strong className={`text-sm font-black ${parcel.pbbStatus === 'LUNAS' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {parcel.pbbStatus === 'LUNAS' ? 'LUNAS - TERVERIFIKASI KAS DAERAH' : 'BELUM LUNAS - LEMBAR TAGIHAN'}
                </strong>
              </div>
            </div>
            {parcel.pbbReceiptNumber && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-bold">No. Tanda Terima:</span>
                <span className="text-xs font-mono font-bold text-slate-800">{parcel.pbbReceiptNumber}</span>
              </div>
            )}
          </div>

          {/* Rincian Subjek & Objek Pajak */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">A. DATA SUBJEK PAJAK (WAJIB PAJAK)</span>
              <div>
                <span className="text-slate-500 block">Nama Wajib Pajak:</span>
                <strong className="text-slate-900 text-sm font-bold">{parcel.ownerName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">NIK Wajib Pajak:</span>
                <span className="font-mono font-semibold text-slate-800">{parcel.ownerNik}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Alamat Wajib Pajak:</span>
                <span className="text-slate-800 font-medium">{parcel.addressDusun}, {villageName}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">B. DATA OBJEK PAJAK (BIDANG TANAH)</span>
              <div>
                <span className="text-slate-500 block">Nomor Objek Pajak (NOP):</span>
                <strong className="text-slate-900 font-mono font-bold text-sm text-emerald-800">{parcel.nop}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Kategori Penggunaan:</span>
                <span className="font-bold text-slate-800 uppercase">{parcel.landUseCategory.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Status Hak & SPORADIK:</span>
                <span className="font-semibold text-blue-700">{parcel.sporadikCertificateNumber || 'Proses Register Desa'}</span>
              </div>
            </div>
          </div>

          {/* Tabel Perhitungan NJOP & PBB-P2 */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">C. PERHITUNGAN NILAI JUAL OBJEK PAJAK (NJOP) & TAGIHAN</h4>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Objek Pajak</th>
                    <th className="p-2.5 text-right">Luas (m²)</th>
                    <th className="p-2.5 text-right">NJOP per m² (Rp)</th>
                    <th className="p-2.5 text-right">Total NJOP (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  <tr>
                    <td className="p-2.5 font-semibold">1. Tanah / Bumi (Hasil Shoelace)</td>
                    <td className="p-2.5 text-right font-bold">{parcel.landAreaSqM.toLocaleString('id-ID')} m²</td>
                    <td className="p-2.5 text-right">Rp {parcel.njopLandPerSqM.toLocaleString('id-ID')}</td>
                    <td className="p-2.5 text-right font-bold">Rp {taxCalc.njopLandTotal.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold">2. Bangunan Gedung / Pemukiman</td>
                    <td className="p-2.5 text-right font-bold">{parcel.buildingAreaSqM.toLocaleString('id-ID')} m²</td>
                    <td className="p-2.5 text-right">Rp {parcel.njopBuildingPerSqM.toLocaleString('id-ID')}</td>
                    <td className="p-2.5 text-right font-bold">Rp {taxCalc.njopBuildingTotal.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="p-2.5 text-slate-700">TOTAL NJOP SEBAGAI DASAR PENGENAAN PBB</td>
                    <td className="p-2.5 text-right text-slate-900 font-black">Rp {taxCalc.njopTotal.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr className="text-slate-600">
                    <td colSpan={3} className="p-2.5">NJOP Tidak Kena Pajak (NJOPTKP {regency})</td>
                    <td className="p-2.5 text-right text-red-600 font-semibold">- Rp {taxCalc.njoptkp.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr className="bg-emerald-50 text-emerald-950 font-extrabold border-t-2 border-emerald-600">
                    <td colSpan={3} className="p-3 text-sm">TOTAL TAGIHAN PBB-P2 TERHUTANG ({taxCalc.taxRatePercent}%)</td>
                    <td className="p-3 text-right text-base text-emerald-700 font-black">Rp {taxCalc.taxAmount.toLocaleString('id-ID')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* QR Code Validation & Legal Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {qrDataUrl && (
                <div className="relative w-20 h-20 shrink-0">
                  <img src={qrDataUrl} alt="QR Code PBB" className="w-20 h-20 rounded-xl border border-slate-200 shadow-2xs p-1 bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="w-4.5 h-4.5 bg-white rounded-full p-0.5 border border-slate-900 shadow-xs flex items-center justify-center overflow-hidden">
                      {villageProfile?.villageLogoUrl ? (
                        <img src={villageProfile.villageLogoUrl} alt="Logo Desa" className="w-full h-full object-contain" />
                      ) : (
                        <SadewaHouseLogo size={10} color="#10b981" />
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="text-[10px] text-slate-500 space-y-0.5">
                <span className="font-extrabold text-slate-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Validasi Elektronik BPKPAD & SADEWA
                </span>
                <p>Dokumen ini diterbitkan secara sah oleh Sistem Informasi Administrasi & WebGIS {villageName}.</p>
                <div className="flex items-center gap-1 mt-1 opacity-70">
                  {villageProfile.sadewaLogoUrl || villageProfile.sadewaIconUrl ? (
                    <img 
                      src={villageProfile.sadewaLogoUrl || villageProfile.sadewaIconUrl} 
                      alt="SADEWA" 
                      className="h-3 sm:h-4 w-auto object-contain" 
                    />
                  ) : (
                    <>
                      <SadewaHouseLogo size={10} className="text-emerald-700" />
                      <span className="text-[7px] font-black tracking-widest uppercase">SADEWA Digital Service</span>
                    </>
                  )}
                </div>
                <p className="font-mono text-slate-400">Ref: {parcel.id} | TS: {new Date().toLocaleDateString('id-ID')}</p>
              </div>
            </div>

            <div className="text-center sm:text-right text-xs text-slate-700 space-y-1">
              <p>{villageName}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="font-bold text-slate-900">Petugas Pemungut PBB-P2 / BPD Desa</p>
              <div className="h-10"></div>
              <p className="font-extrabold text-slate-900 underline">Ahmad Fauzi, S.AP</p>
              <p className="text-[10px] text-slate-500">NIP. 19850412 201001 1 008</p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak SPPT PBB-P2</span>
          </button>
        </div>
      </div>
    </div>
  );
};
