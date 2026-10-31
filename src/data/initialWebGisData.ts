import { LandParcel, DusunSpatialBoundary } from '../types/webgis';
import { calculatePolygonAreaShoelace, calculatePbbTax } from '../utils/geometryEngine';

/**
 * Data Awal Batas Spasial Administrasi Dusun Desa Pulau Betung
 */
export const INITIAL_DUSUN_BOUNDARIES: DusunSpatialBoundary[] = [
  {
    dusunId: 'dsn-1',
    name: 'Dusun 1',
    color: '#059669', // Emerald
    leaderName: 'M. Ali, S.Pd',
    coordinates: [
      [-1.6010, 103.3420],
      [-1.6010, 103.3490],
      [-1.6080, 103.3490],
      [-1.6080, 103.3420]
    ]
  },
  {
    dusunId: 'dsn-2',
    name: 'Dusun 2',
    color: '#2563eb', // Blue
    leaderName: 'H. Syamsudin',
    coordinates: [
      [-1.6010, 103.3490],
      [-1.6010, 103.3560],
      [-1.6090, 103.3560],
      [-1.6080, 103.3490]
    ]
  },
  {
    dusunId: 'dsn-3',
    name: 'Dusun 3',
    color: '#d97706', // Amber
    leaderName: 'Zulkifli, S.E',
    coordinates: [
      [-1.6080, 103.3420],
      [-1.6090, 103.3560],
      [-1.6150, 103.3560],
      [-1.6150, 103.3420]
    ]
  }
];

// Helper kalkulasi bidang tanah sampel
function createParcel(
  id: string,
  nop: string,
  ownerName: string,
  ownerNik: string,
  phone: string,
  addressDusun: string,
  category: LandParcel['landUseCategory'],
  buildingSqM: number,
  coordinates: [number, number][],
  boundaries: LandParcel['boundaries'],
  njopLand: number,
  njopBuilding: number,
  pbbStatus: LandParcel['pbbStatus'],
  sporadikStatus: LandParcel['sporadikStatus'],
  requestCode?: string,
  certNo?: string,
  witnesses?: string[]
): LandParcel {
  const areaCalc = calculatePolygonAreaShoelace(coordinates);
  const taxCalc = calculatePbbTax(areaCalc.areaSqM, njopLand, buildingSqM, njopBuilding);

  return {
    id,
    nop,
    ownerName,
    ownerNik,
    phone,
    addressDusun,
    landUseCategory: category,
    landAreaSqM: areaCalc.areaSqM,
    landAreaHectares: areaCalc.areaHectares,
    buildingAreaSqM: buildingSqM,
    coordinates,
    boundaries,
    njopLandPerSqM: njopLand,
    njopBuildingPerSqM: njopBuilding,
    pbbTaxAmount: taxCalc.taxAmount,
    pbbStatus,
    pbbPaymentDate: pbbStatus === 'LUNAS' ? '2026-05-12' : undefined,
    pbbReceiptNumber: pbbStatus === 'LUNAS' ? `STTS-PBB-2026-${id.toUpperCase()}` : undefined,
    sporadikStatus,
    sporadikRequestCode: requestCode,
    sporadikCertificateNumber: certNo,
    sporadikIssuedDate: sporadikStatus === 'SPORADIK_TERBIT' ? '2026-06-10' : undefined,
    surveyorName: 'Ahmad Fauzi, S.AP (Sekdes) & Kadus',
    witnesses: witnesses || ['H. Usman (Ketua RT)', 'Budi Haryanto (Pemilik Utara)', 'Syarifuddin (Pemilik Selatan)'],
    createdAt: '2026-01-15',
    updatedAt: '2026-08-20'
  };
}

/**
 * Data Sampel Master Bidang Tanah WebGIS Desa Pulau Betung
 */
export const INITIAL_LAND_PARCELS: LandParcel[] = [
  createParcel(
    'PARCEL-PB-001',
    '15.04.010.001.002-0012.0',
    'H. Ismail Ibrahim',
    '1504011205750001',
    '0812-7489-1122',
    'Dusun 1 RT 02',
    'PERKEBUNAN_SAWIT',
    0,
    [
      [-1.6022, 103.3430],
      [-1.6022, 103.3455],
      [-1.6045, 103.3455],
      [-1.6045, 103.3430]
    ],
    [
      { direction: 'UTARA', neighborName: 'Jalan Usaha Tani / Budi Haryanto', distanceMeters: 278.1 },
      { direction: 'TIMUR', neighborName: 'Perkebunan Sawit Syarifuddin', distanceMeters: 255.8 },
      { direction: 'SELATAN', neighborName: 'Tanah Kas Desa / Parit Sekunder', distanceMeters: 278.1 },
      { direction: 'BARAT', neighborName: 'Kebun Karet Hasan Basri', distanceMeters: 255.8 }
    ],
    120000,
    0,
    'LUNAS',
    'SPORADIK_TERBIT',
    'REQ-PB-2026-012',
    '593.2/045/SPT/PB/2026',
    ['H. Usman (Ketua RT 02)', 'Budi Haryanto (Saksi Batas Utara)', 'Syarifuddin (Saksi Batas Timur)']
  ),
  createParcel(
    'PARCEL-PB-002',
    '15.04.010.001.002-0015.0',
    'Siti Hajar, S.Pd',
    '1504014808820003',
    '0813-6677-8899',
    'Dusun 2 RT 01',
    'PEMUKIMAN',
    120,
    [
      [-1.6025, 103.3500],
      [-1.6025, 103.3515],
      [-1.6038, 103.3515],
      [-1.6038, 103.3500]
    ],
    [
      { direction: 'UTARA', neighborName: 'Jalan Lintas Pemayung - Jambi', distanceMeters: 166.8 },
      { direction: 'TIMUR', neighborName: 'Rumah & Toko M. Yasin', distanceMeters: 144.6 },
      { direction: 'SELATAN', neighborName: 'Kebun Kelapa H. Zakaria', distanceMeters: 166.8 },
      { direction: 'BARAT', neighborName: 'Pekarangan Hj. Aminah', distanceMeters: 144.6 }
    ],
    250000,
    650000,
    'LUNAS',
    'TERVERIFIKASI',
    'REQ-PB-2026-024',
    '593.2/089/SPT/PB/2026',
    ['Kaharuddin (Ketua RT 01)', 'M. Yasin (Tetangga Timur)', 'Hj. Aminah (Tetangga Barat)']
  ),
  createParcel(
    'PARCEL-PB-003',
    '15.04.010.001.003-0008.0',
    'Bambang Wijaya',
    '1504011504800002',
    '0821-9988-7766',
    'Dusun 3 RT 04',
    'SAWAH_PERTANIAN',
    0,
    [
      [-1.6100, 103.3450],
      [-1.6100, 103.3480],
      [-1.6125, 103.3480],
      [-1.6125, 103.3450]
    ],
    [
      { direction: 'UTARA', neighborName: 'Sawah Irigasi M. Ridwan', distanceMeters: 333.7 },
      { direction: 'TIMUR', neighborName: 'Saluran Tersier Desa', distanceMeters: 278.1 },
      { direction: 'SELATAN', neighborName: 'Sawah H. Sulaiman', distanceMeters: 333.7 },
      { direction: 'BARAT', neighborName: 'Jalan Usaha Tani RT 04', distanceMeters: 278.1 }
    ],
    85000,
    0,
    'BELUM_LUNAS',
    'DRAF_SURVEI',
    'REQ-PB-2026-051',
    undefined,
    ['M. Ridwan (Saksi Utara)', 'H. Sulaiman (Saksi Selatan)']
  ),
  createParcel(
    'PARCEL-PB-004',
    '15.04.010.001.001-0003.0',
    'Pemerintah Desa Pulau Betung',
    '1504010000000000',
    '0812-7489-0002',
    'Dusun 2 RT 02',
    'FASILITAS_UMUM',
    350,
    [
      [-1.6040, 103.3520],
      [-1.6040, 103.3532],
      [-1.6052, 103.3532],
      [-1.6052, 103.3520]
    ],
    [
      { direction: 'UTARA', neighborName: 'Jalan Utama Desa Pulau Betung', distanceMeters: 133.5 },
      { direction: 'TIMUR', neighborName: 'Puskesmas Pembatu (Pustu)', distanceMeters: 133.5 },
      { direction: 'SELATAN', neighborName: 'Lapangan Sepak Bola Desa', distanceMeters: 133.5 },
      { direction: 'BARAT', neighborName: 'Masjid Raya Al-Ikhlas', distanceMeters: 133.5 }
    ],
    300000,
    800000,
    'BEBAS_PAJAK',
    'SPORADIK_TERBIT',
    'REQ-PB-2026-001',
    '593.2/001/ASSET-DESA/2026',
    ['BPD Desa Pulau Betung', 'LPM Desa Pulau Betung']
  )
];
