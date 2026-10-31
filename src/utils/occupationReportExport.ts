import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Resident } from '../types/resident';
import { VillageProfile } from '../types';

export interface SectorSummary {
  key: string;
  name: string;
  shortName: string;
  count: number;
  percentage: number;
  description: string;
}

/**
 * Generate dan Unduh Laporan PDF Statistik Pekerjaan Desa Resmi
 */
export const exportOccupationReportPDF = (
  residents: Resident[],
  sectorStats: SectorSummary[],
  villageProfile: VillageProfile
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const livingResidents = residents.filter(r => (r.status || '').toLowerCase() === 'hidup');
  const totalLiving = livingResidents.length || sectorStats.reduce((acc, s) => acc + s.count, 0);

  const villageName = villageProfile.villageName || 'Desa Pulau Betung';
  const district = villageProfile.district || 'Kecamatan Pampangan';
  const regency = villageProfile.regency || 'Kabupaten Ogan Komering Ilir';
  const leaderName = villageProfile.kadesName || 'Kepala Desa Pulau Betung';
  const leaderNip = villageProfile.kadesNip || '-';

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // --- KOP SURAT RESMI DESA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`PEMERINTAH ${regency.toUpperCase()}`, pageWidth / 2, 16, { align: 'center' });
  doc.text(`KECAMATAN ${district.replace(/^kecamatan\s*/i, '').toUpperCase()}`, pageWidth / 2, 21, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`PEMERINTAH ${villageName.toUpperCase()}`, pageWidth / 2, 27, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Alamat: ${villageProfile.addressStreet || 'Kantor Kepala Desa'} • Kode Pos: ${villageProfile.postalCode || '30654'} • Sistem Informasi SADEWA 360`, pageWidth / 2, 32, { align: 'center' });

  // Garis Pembatas Kop Surat Ganda
  doc.setLineWidth(0.8);
  doc.setDrawColor(15, 23, 42);
  doc.line(14, 35, pageWidth - 14, 35);
  doc.setLineWidth(0.3);
  doc.line(14, 36.2, pageWidth - 14, 36.2);

  // --- JUDUL LAPORAN ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN EKSEKUTIF STATISTIK MATA PENCAHARIAN PENDUDUK', pageWidth / 2, 44, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode Sensus / Update Data: ${todayStr} • Total Basis Data: ${totalLiving.toLocaleString('id-ID')} Jiwa Terdaftar`, pageWidth / 2, 49, { align: 'center' });

  // --- TABEL 1: REKAPITULASI SEKTOR PEKERJAAN ---
  const tableData = sectorStats.map((sector, index) => {
    let programFocus = '';
    if (sector.key === 'tani') programFocus = 'Bantuan Bibit, Pupuk Bersubsidi, Alsintan, Irigasi Desa';
    else if (sector.key === 'buruh') programFocus = 'Program PKT (Padat Karya Tunai), Pelatihan Vokasi, BPJS Ketenagakerjaan';
    else if (sector.key === 'wiraswasta') programFocus = 'Fasilitasi SKU, Akses Permodalan KUR, Pelatihan Digital Marketing';
    else if (sector.key === 'dagang') programFocus = 'Revitalisasi Pasar Desa, Kemitraan BUMDes, Akses Suplai Sembako';
    else programFocus = 'Pelayanan Administrasi Umum, Program Perlindungan Sosial & Pendidikan';

    return [
      (index + 1).toString(),
      sector.name,
      sector.description,
      `${sector.count.toLocaleString('id-ID')} Jiwa`,
      `${sector.percentage}%`,
      programFocus
    ];
  });

  autoTable(doc, {
    startY: 55,
    head: [['No', 'Sektor Pekerjaan', 'Cakupan Sub-Profesi', 'Jumlah', 'Porsi', 'Fokus Program / Kebijakan Desa']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 38 },
      2: { cellWidth: 42 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
      5: { cellWidth: 63 }
    },
    styles: {
      cellPadding: 2.5,
      valign: 'middle'
    }
  });

  let finalY = (doc as any).lastAutoTable?.finalY || 130;

  // --- TABEL 2: SEBARAN PER WILAYAH DUSUN (Jika ada data) ---
  if (livingResidents.length > 0) {
    const dusunList = Array.from(new Set(livingResidents.map(r => r.dusun || 'Dusun I Betung Jaya'))).sort();
    
    const dusunTableData = dusunList.map((dusunName, idx) => {
      const residentsInDusun = livingResidents.filter(r => (r.dusun || 'Dusun I Betung Jaya') === dusunName);
      const totalDusun = residentsInDusun.length;
      
      const taniCount = residentsInDusun.filter(r => /tani|kebun|petani|pekebun|nelayan|ternak/.test((r.occupation || '').toLowerCase())).length;
      const buruhCount = residentsInDusun.filter(r => /buruh|kuli|tukang|harian lepas/.test((r.occupation || '').toLowerCase())).length;
      const wiraswastaCount = residentsInDusun.filter(r => /wiraswasta|umkm|wirausaha|pengusaha/.test((r.occupation || '').toLowerCase())).length;
      const dagangCount = residentsInDusun.filter(r => /dagang|pedagang|toko|warung|pasar/.test((r.occupation || '').toLowerCase())).length;
      const lainnyaCount = totalDusun - (taniCount + buruhCount + wiraswastaCount + dagangCount);

      return [
        (idx + 1).toString(),
        dusunName,
        `${totalDusun} Jiwa`,
        `${taniCount} (${totalDusun > 0 ? ((taniCount / totalDusun) * 100).toFixed(0) : 0}%)`,
        `${buruhCount} (${totalDusun > 0 ? ((buruhCount / totalDusun) * 100).toFixed(0) : 0}%)`,
        `${wiraswastaCount} (${totalDusun > 0 ? ((wiraswastaCount / totalDusun) * 100).toFixed(0) : 0}%)`,
        `${dagangCount} (${totalDusun > 0 ? ((dagangCount / totalDusun) * 100).toFixed(0) : 0}%)`,
        `${lainnyaCount}`
      ];
    });

    // Check space on page, add page if needed
    if (finalY > 190) {
      doc.addPage();
      finalY = 15;
    } else {
      finalY += 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Distribusi Sektor Mata Pencaharian Menurut Wilayah Dusun', 14, finalY);

    autoTable(doc, {
      startY: finalY + 3,
      head: [['No', 'Wilayah Dusun', 'Total Warga', 'Tani', 'Buruh', 'Wiraswasta', 'Dagang', 'Lainnya']],
      body: dusunTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold', cellWidth: 45 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 24 },
        6: { halign: 'center', cellWidth: 22 },
        7: { halign: 'center', cellWidth: 18 }
      },
      styles: {
        cellPadding: 2,
        valign: 'middle'
      }
    });

    finalY = (doc as any).lastAutoTable?.finalY || finalY + 40;
  }

  // --- CATATAN ADMINISTRATIF DESA ---
  if (finalY > 220) {
    doc.addPage();
    finalY = 20;
  } else {
    finalY += 8;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('* Dokumen ini dicetak otomatis melalui Modul Sensus Digital SADEWA 360 Desa Pulau Betung.', 14, finalY);
  doc.text('* Digunakan sebagai dasar perencanaan APBDes, penerimaan bantuan sosial, dan pelaporan berkala ke Kecamatan/Dinas Sosial.', 14, finalY + 4);

  // --- BLOK TANDA TANGAN RESMI ---
  const signY = finalY + 12;
  const signX = pageWidth - 65;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`${villageName.replace(/^desa\s*/i, '')}, ${todayStr}`, signX, signY, { align: 'center' });
  doc.text('Mengetahui / Mengesahkan,', signX, signY + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Kepala Desa Pulau Betung', signX, signY + 9, { align: 'center' });

  // Ruang tanda tangan
  doc.setFont('helvetica', 'bold');
  doc.text(leaderName.toUpperCase(), signX, signY + 30, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`NIP. ${leaderNip}`, signX, signY + 34, { align: 'center' });

  // Unduh File PDF
  const cleanFilename = `Laporan_Statistik_Pekerjaan_${villageName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(cleanFilename);
};

/**
 * Generate dan Unduh Laporan CSV Statistik Pekerjaan Komprehensif
 */
export const exportOccupationReportCSV = (
  residents: Resident[],
  sectorStats: SectorSummary[],
  villageProfile: VillageProfile
) => {
  const villageName = villageProfile.villageName || 'Desa Pulau Betung';
  const todayStr = new Date().toISOString().split('T')[0];
  const livingResidents = residents.filter(r => (r.status || '').toLowerCase() === 'hidup');

  // Header & Metadata
  const metaRows = [
    `"LAPORAN DATA STATISTIK MATA PENCAHARIAN PENDUDUK DESA"`,
    `"Nama Desa","${villageName}"`,
    `"Kecamatan","${villageProfile.district || 'Pampangan'}"`,
    `"Kabupaten","${villageProfile.regency || 'Ogan Komering Ilir'}"`,
    `"Tanggal Ekspor","${todayStr}"`,
    `"Total Warga Sensus","${livingResidents.length}"`,
    `""`
  ];

  // Ringkasan Sektor
  const summaryHeader = `"REKAPITULASI SEKTOR PEKERJAAN"`;
  const summaryColumns = `"No","Nama Sektor","Kategori","Jumlah Jiwa","Persentase (%)","Deskripsi Cakupan"`;
  const summaryRows = sectorStats.map((s, idx) => 
    `"${idx + 1}","${s.name}","${s.shortName}","${s.count}","${s.percentage}%","${s.description}"`
  );

  // Rincian Data Warga (Detail Master)
  const detailHeader = `\n"DATA DETAIL PENDUDUK PER MATA PENCAHARIAN"`;
  const detailColumns = `"No","NIK","No KK","Nama Lengkap","Jenis Kelamin","Usia","Dusun","RT","RW","Pekerjaan Riil","Kategori Sektor","Penerima Bansos","Punya SKU Usaha","Status Ekonomi"`;
  
  const detailRows = livingResidents.map((r, idx) => {
    const occ = (r.occupation || '').toLowerCase();
    let sektorCategory = 'Lainnya';
    if (/tani|kebun|petani|pekebun|nelayan|ternak/.test(occ)) sektorCategory = 'Tani';
    else if (/buruh|kuli|tukang|harian lepas/.test(occ)) sektorCategory = 'Buruh';
    else if (/wiraswasta|umkm|wirausaha|pengusaha/.test(occ)) sektorCategory = 'Wiraswasta';
    else if (/dagang|pedagang|toko|warung|pasar/.test(occ)) sektorCategory = 'Dagang';

    // Calculate age
    let age = '-';
    if (r.birthDate) {
      const birth = new Date(r.birthDate);
      const diff = new Date().getFullYear() - birth.getFullYear();
      if (!isNaN(diff)) age = diff.toString();
    }

    return [
      `"${idx + 1}"`,
      `"'${r.nik}"`,
      `"'${r.kk || r.nik}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.gender}"`,
      `"${age}"`,
      `"${r.dusun || 'Dusun I Betung Jaya'}"`,
      `"'${r.rt || '01'}"`,
      `"'${r.rw || '01'}"`,
      `"${(r.occupation || 'Belum/Tidak Bekerja').replace(/"/g, '""')}"`,
      `"${sektorCategory}"`,
      `"${r.hasBansos ? 'Ya' : 'Tidak'}"`,
      `"${r.hasSku ? 'Ya' : 'Tidak'}"`,
      `"${r.economicStatus || 'Umum'}"`
    ].join(',');
  });

  const fullCsvContent = '\uFEFF' + [
    ...metaRows,
    summaryHeader,
    summaryColumns,
    ...summaryRows,
    detailHeader,
    detailColumns,
    ...detailRows
  ].join('\n');

  const blob = new Blob([fullCsvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Laporan_Statistik_Pekerjaan_${villageName.replace(/\s+/g, '_')}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
