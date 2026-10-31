import React from 'react';
import { createPortal } from 'react-dom';
import { ToddlerRecord, PosyanduSchedule } from '../../types/posyandu';
import { useApp } from '../../context/AppContext';
import { Printer, X, Download, ShieldCheck } from 'lucide-react';

interface PosyanduReportPrintModalProps {
  toddlers: ToddlerRecord[];
  schedules: PosyanduSchedule[];
  onClose: () => void;
}

export const PosyanduReportPrintModal: React.FC<PosyanduReportPrintModalProps> = ({
  toddlers,
  schedules,
  onClose
}) => {
  const { villageProfile, officials } = useApp();

  // Find Kades & Bidan / Posyandu Official
  const kadesOfficial = officials.find(
    (o) => (o.section === 'kepala_desa' || o.position.toLowerCase().includes('kepala desa')) && o.isActive !== false
  );
  const kadesName = villageProfile.kadesName || kadesOfficial?.name || 'Kepala Desa';
  const kadesNip = villageProfile.kadesNip || kadesOfficial?.nip || '';

  const bidanOfficial = officials.find(
    (o) => o.position.toLowerCase().includes('bidan') || o.position.toLowerCase().includes('pkk')
  );
  const bidanName = bidanOfficial ? bidanOfficial.name : 'Bidan Desa Nining, S.Tr.Keb';
  const bidanNip = bidanOfficial?.nip || 'NIP. 19850614 201001 2 018';

  // Stats calculation
  const total = toddlers.length;
  const severelyStunted = toddlers.filter((t) => {
    const m = t.measurements[t.measurements.length - 1];
    return m && m.stuntingCategory === 'Severely Stunted';
  }).length;

  const stunted = toddlers.filter((t) => {
    const m = t.measurements[t.measurements.length - 1];
    return m && m.stuntingCategory === 'Stunted';
  }).length;

  const normal = toddlers.filter((t) => {
    const m = t.measurements[t.measurements.length - 1];
    return m && m.stuntingCategory === 'Normal';
  }).length;

  const totalStunted = severelyStunted + stunted;
  const prevalencePct = total > 0 ? ((totalStunted / total) * 100).toFixed(1) : '0';

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Chunking logic untuk memisahkan tabel menjadi maksimal 10 baris per halaman
  const PAGE_SIZE = 10;
  const chunkArray = (arr: ToddlerRecord[], size: number) => {
    const chunked: ToddlerRecord[][] = [];
    let i = 0;
    while (i < arr.length) {
      chunked.push(arr.slice(i, size + i));
      i += size;
    }
    return chunked;
  };
  const chunkedToddlers = chunkArray(toddlers, PAGE_SIZE);
  if (chunkedToddlers.length === 0) chunkedToddlers.push([]); // Pastikan minimal ada 1 halaman kosong

  // Handle Export to CSV (Excel)
  const handleExportCsv = () => {
    const headers = [
      'No',
      'NIK Balita',
      'Nama Balita',
      'Gender',
      'Tgl Lahir',
      'Orang Tua',
      'Dusun',
      'RT/RW',
      'Usia (Bln)',
      'BB (kg)',
      'TB (cm)',
      'Z-Score TB/U',
      'Status Stunting (WHO)',
      'Status Gizi'
    ];

    const rows = toddlers.map((t, index) => {
      const latest = t.measurements[t.measurements.length - 1];
      return [
        index + 1,
        `'${t.nik}`,
        t.name,
        t.gender,
        t.birthDate,
        t.parentName,
        t.dusunName,
        t.rtRw,
        latest ? latest.ageInMonths : '',
        latest ? latest.weightKg : '',
        latest ? latest.heightCm : '',
        latest ? latest.zScoreHeightForAge : '',
        latest ? latest.stuntingCategory : 'Belum Ditimbang',
        latest ? latest.overallStatus : ''
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((cell) => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Stunting_${villageProfile.villageName || 'Desa'}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    try {
      document.body.classList.add('letter-modal-active');
      window.print();
      setTimeout(() => {
        document.body.classList.remove('letter-modal-active');
      }, 500);
    } catch (e) {
      console.warn('Print error:', e);
    }
  };

  return createPortal(
    <div id="official-letter-portal" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 official-letter-overlay">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 official-letter-card">
        {/* Modal Action Header (No-Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between official-letter-actionbar no-print border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">Pratinjau Cetak Laporan KIA & Rekapitulasi Stunting</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Excel (CSV)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak (PDF)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div id="official-letter-printable" className="p-8 sm:p-12 text-slate-900 font-serif leading-relaxed bg-white print:p-0">
          
          {chunkedToddlers.map((toddlerChunk, pageIndex) => (
            <div key={pageIndex} className={`space-y-6 ${pageIndex < chunkedToddlers.length - 1 ? 'print:break-after-page mb-16' : ''}`}>
              
              {/* Kop Surat & Judul - Ditampilkan di setiap halaman atau hanya halaman 1 tergantung kebutuhan. Kita tampilkan di setiap halaman agar lebih rapi saat diprint berlembar-lembar */}
              {pageIndex === 0 && (
                <>
                  {/* Official Government Kop Surat */}
                  <div className="text-center border-b-[3px] border-double border-slate-900 pb-4 space-y-1 relative flex items-center justify-center">
                    <div className="absolute left-2 top-0 bottom-0 flex items-center">
                      {(villageProfile.villageLogoUrl || villageProfile.regencyLogoUrl) && (
                        <img
                          src={villageProfile.villageLogoUrl || villageProfile.regencyLogoUrl}
                          alt="Logo Instansi"
                          className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                          crossOrigin="anonymous"
                        />
                      )}
                    </div>
                    
                    <div className="px-24">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-slate-700">
                        PEMERINTAH {villageProfile.regency || 'KABUPATEN BATANG HARI'}
                      </h4>
                      <h4 className="text-sm font-bold uppercase tracking-widest text-slate-700">
                        KECAMATAN {villageProfile.district || 'PEMAYUNG'}
                      </h4>
                      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-950 mt-0.5">
                        PEMERINTAH {villageProfile.villageName || 'DESA PULAU BETUNG'}
                      </h2>
                      <p className="text-[11px] font-sans font-medium text-slate-600 italic">
                        {villageProfile.addressStreet || 'Jl. Lintas Muara Bulian - Jambi KM. 25'}, Kode Pos {villageProfile.postalCode || '36657'}
                      </p>
                    </div>
                  </div>

                  {/* Document Title */}
                  <div className="text-center space-y-1 pt-2 font-sans">
                    <h3 className="text-base font-extrabold uppercase text-slate-900 tracking-wide underline">
                      LAPORAN REKAPITULASI PEMANTAUAN TUMBUH KEMBANG BALITA & PREVALENSI STUNTING
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                      Standar Antropometri WHO • Periode September 2026
                    </p>
                  </div>

                  {/* Ringkasan Eksekutif Statistics */}
                  <div className="font-sans grid grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-300 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Terdata</span>
                      <span className="text-base font-black text-slate-900">{total} Balita</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Sangat Pendek</span>
                      <span className="text-base font-black text-rose-700">{severelyStunted} Anak</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Pendek (Stunting)</span>
                      <span className="text-base font-black text-amber-700">{stunted} Anak</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Prevalensi Desa</span>
                      <span className="text-base font-black text-emerald-800">{prevalencePct}%</span>
                    </div>
                  </div>
                </>
              )}

              {/* Tabel Rekapitulasi Data Balita */}
              <div className="font-sans space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {pageIndex === 0 ? 'I. Data Individu Balita & Evaluasi Z-Score TB/U per Dusun' : `Lanjutan Data Individu Balita... (Halaman ${pageIndex + 1})`}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">Halaman {pageIndex + 1} dari {chunkedToddlers.length}</span>
                </div>
                
                <table className="w-full text-left border-collapse border border-slate-400 text-[11px]">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-400">
                      <th className="py-2 px-2 border border-slate-400 text-center w-10">No</th>
                      <th className="py-2 px-2 border border-slate-400">NIK & Nama Balita</th>
                      <th className="py-2 px-2 border border-slate-400 w-24">JK / Tgl Lahir</th>
                      <th className="py-2 px-2 border border-slate-400 w-32">Nama Orang Tua</th>
                      <th className="py-2 px-2 border border-slate-400 w-32">Dusun / RT</th>
                      <th className="py-2 px-2 border border-slate-400 text-center w-14">Usia</th>
                      <th className="py-2 px-2 border border-slate-400 text-center w-14">TB (cm)</th>
                      <th className="py-2 px-2 border border-slate-400 text-center w-16">Z-Score</th>
                      <th className="py-2 px-2 border border-slate-400 text-center w-24">Status WHO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {toddlerChunk.map((t, localIdx) => {
                      const globalIdx = (pageIndex * PAGE_SIZE) + localIdx + 1;
                      const latest = t.measurements[t.measurements.length - 1];
                      const isStunted = latest && (latest.stuntingCategory === 'Severely Stunted' || latest.stuntingCategory === 'Stunted');

                      return (
                        <tr key={t.id} className={isStunted ? 'bg-rose-50/60' : ''}>
                          <td className="py-2 px-2 border border-slate-400 text-center font-bold">{globalIdx}</td>
                          <td className="py-2 px-2 border border-slate-400">
                            <div className="font-bold text-slate-900">{t.name}</div>
                            <div className="text-[9px] font-mono text-slate-500">{t.nik}</div>
                          </td>
                          <td className="py-2 px-2 border border-slate-400">
                            {t.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                            <div className="text-[9px] text-slate-500">{t.birthDate}</div>
                          </td>
                          <td className="py-2 px-2 border border-slate-400">{t.parentName}</td>
                          <td className="py-2 px-2 border border-slate-400">{t.dusunName} ({t.rtRw})</td>
                          <td className="py-2 px-2 border border-slate-400 text-center font-semibold">
                            {latest ? `${latest.ageInMonths} Bln` : '-'}
                          </td>
                          <td className="py-2 px-2 border border-slate-400 text-center font-bold">
                            {latest ? `${latest.heightCm}` : '-'}
                          </td>
                          <td className="py-2 px-2 border border-slate-400 text-center font-mono font-bold">
                            {latest ? `${latest.zScoreHeightForAge} SD` : '-'}
                          </td>
                          <td className="py-2 px-2 border border-slate-400 text-center font-extrabold uppercase text-[10px]">
                            <span className={isStunted ? 'text-rose-800' : 'text-emerald-800'}>
                              {latest ? latest.stuntingCategory : '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signature Block (SSOT Compliant) - Hanya tampil di halaman terakhir */}
              {pageIndex === chunkedToddlers.length - 1 && (
                <div className="font-sans pt-12 grid grid-cols-2 gap-8 text-xs text-center leading-relaxed avoid-page-break">
                  <div>
                    <p className="text-slate-600">Mengetahui,</p>
                    <p className="font-bold text-slate-900">Kepala {villageProfile.villageName || 'Desa'}</p>
                    <div className="h-20 flex items-center justify-center">
                      {villageProfile.officialSignatureUrl && (
                        <img
                          src={villageProfile.officialSignatureUrl}
                          alt="TTD Kades"
                          className="h-16 object-contain"
                          crossOrigin="anonymous"
                        />
                      )}
                    </div>
                    <p className="font-extrabold text-slate-900 underline uppercase">{kadesName}</p>
                    <p className="text-[11px] text-slate-600 font-mono">{kadesNip || 'NIAP. KEPALA DESA'}</p>
                  </div>

                  <div>
                    <p className="text-slate-600">
                      {villageProfile.villageName || 'Pulau Betung'}, {todayStr}
                    </p>
                    <p className="font-bold text-slate-900">Bidan Desa / Penanggung Jawab Posyandu</p>
                    <div className="h-20" />
                    <p className="font-extrabold text-slate-900 underline uppercase">{bidanName}</p>
                    <p className="text-[11px] text-slate-600 font-mono">{bidanNip}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};
