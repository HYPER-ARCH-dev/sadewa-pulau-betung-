import { VILLAGE_INFO } from '../../constants/village';
import { VillageProfile, LetterheadSnapshot, VillageOfficial } from '../../types';

export interface LetterVillageContext {
  villageName: string;         // e.g. "Desa Pulau Betung"
  villagePureName: string;     // e.g. "Pulau Betung"
  subDistrict: string;         // e.g. "Kecamatan Pemayung"
  districtPureName: string;    // e.g. "Pemayung"
  regency: string;             // e.g. "Kabupaten Batang Hari"
  regencyPureName: string;     // e.g. "Batang Hari"
  province: string;            // e.g. "Provinsi Jambi"
  provincePureName: string;    // e.g. "Jambi"
  postalCode: string;          // e.g. "36657"
  addressStreet: string;       // e.g. "Jalan Lintas Muara Bulian - Jambi KM. 25, Desa Pulau Betung"
  headName: string;            // e.g. "H. Sudirman"
  headNip: string;             // e.g. "NIAP. 19780412 201201 1 004"
  letterCodePrefix: string;    // e.g. "PB-PMY"
  fullLocationString: string;  // e.g. "Desa Pulau Betung, Kecamatan Pemayung, Kabupaten Batang Hari, Provinsi Jambi"
  kuaName: string;             // e.g. "Kantor Urusan Agama (KUA) Kecamatan Pemayung"
  polsekName: string;          // e.g. "Polsek Pemayung"
  polresName: string;          // e.g. "Polres Batang Hari"
  dukcapilName: string;        // e.g. "Dinas Dukcapil Kabupaten Batang Hari"
}

export function createLetterVillageContext(
  villageProfile?: VillageProfile | null,
  customKadesName?: string,
  customKadesNip?: string,
  snapshot?: LetterheadSnapshot | null,
  officials?: VillageOfficial[]
): LetterVillageContext {
  const rawVillage = (snapshot?.villageName || villageProfile?.villageName || VILLAGE_INFO.NAME || 'Desa Pulau Betung').trim();
  const rawDistrict = (snapshot?.district || villageProfile?.district || VILLAGE_INFO.KECAMATAN || 'Kecamatan Pemayung').trim();
  const rawRegency = (snapshot?.regency || villageProfile?.regency || VILLAGE_INFO.KABUPATEN || 'Kabupaten Batang Hari').trim();
  const rawProvince = (snapshot?.province || villageProfile?.province || VILLAGE_INFO.PROVINCE || 'Provinsi Jambi').trim();
  const postalCode = (snapshot?.postalCode || villageProfile?.postalCode || VILLAGE_INFO.POSTAL_CODE || '36657').trim();
  const addressStreet = (snapshot?.addressStreet || villageProfile?.addressStreet || VILLAGE_INFO.ADDRESS_STREET || '').trim();
  const letterCodePrefix = (villageProfile?.letterCodePrefix || VILLAGE_INFO.LETTER_CODE_PREFIX || 'PB-PMY').trim();

  // Cari Kepala Desa aktif dari aparatur jika ada
  const activeKades = officials?.find(
    (o) => (o.section === 'kepala_desa' || o.position.toLowerCase().includes('kepala desa')) && o.isActive !== false
  ) || officials?.find((o) => o.section === 'kepala_desa');

  const headName = (
    customKadesName ||
    snapshot?.kadesName ||
    villageProfile?.kadesName ||
    (activeKades ? activeKades.name : VILLAGE_INFO.DEFAULT_KADES_NAME) ||
    'Kepala Desa'
  ).trim();

  const headNip = (
    customKadesNip ||
    snapshot?.kadesNip ||
    villageProfile?.kadesNip ||
    (activeKades?.nip ? activeKades.nip : VILLAGE_INFO.DEFAULT_KADES_NIP) ||
    ''
  ).trim();

  // Helper untuk membersihkan prefix standar agar dapat dikomposisikan secara luwes
  const stripPrefix = (text: string, prefix: RegExp) => text.replace(prefix, '').trim();

  const villagePureName = stripPrefix(rawVillage, /^(Desa|Kelurahan)\s+/i) || rawVillage;
  const villageName = /^(Desa|Kelurahan)\s+/i.test(rawVillage)
    ? rawVillage
    : `Desa ${rawVillage}`;

  const districtPureName = stripPrefix(rawDistrict, /^Kecamatan\s+/i) || rawDistrict;
  const subDistrict = /^Kecamatan\s+/i.test(rawDistrict)
    ? rawDistrict
    : `Kecamatan ${rawDistrict}`;

  const regencyPureName = stripPrefix(rawRegency, /^(Kabupaten|Kota)\s+/i) || rawRegency;
  const regency = /^(Kabupaten|Kota)\s+/i.test(rawRegency)
    ? rawRegency
    : `Kabupaten ${rawRegency}`;

  const provincePureName = stripPrefix(rawProvince, /^Provinsi\s+/i) || rawProvince;
  const province = /^Provinsi\s+/i.test(rawProvince)
    ? rawProvince
    : `Provinsi ${rawProvince}`;

  const fullLocationString = `${villageName}, ${subDistrict}, ${regency}, ${province}`;
  const kuaName = `Kantor Urusan Agama (KUA) ${subDistrict}`;
  const polsekName = `Polsek ${districtPureName}`;
  const polresName = `Polres ${regencyPureName}`;
  const dukcapilName = `Dinas Dukcapil ${regency}`;

  return {
    villageName,
    villagePureName,
    subDistrict,
    districtPureName,
    regency,
    regencyPureName,
    province,
    provincePureName,
    postalCode,
    addressStreet,
    headName,
    headNip,
    letterCodePrefix,
    fullLocationString,
    kuaName,
    polsekName,
    polresName,
    dukcapilName
  };
}

export const DEFAULT_LETTER_VILLAGE_CONTEXT = createLetterVillageContext();
