/**
 * SADEWA DIGITAL SERVICE - Status Normalizer & Enum Mapper (server/utils/statusNormalizer.ts)
 * 
 * Melakukan mapping string mentah (termasuk compound status) ke Enum Prisma secara deterministik.
 */

export const RESIDENT_STATUS_MAP: Record<string, string> = {
  'hidup': 'HIDUP',
  'aktif': 'HIDUP',
  'tinggal': 'HIDUP',
  'meninggal': 'MENINGGAL',
  'wafat': 'MENINGGAL',
  'mati': 'MENINGGAL',
  'pindah': 'PINDAH',
  'keluar': 'PINDAH',
  'pindahkeluar': 'PINDAH',
  'pindahdomisili': 'PINDAH'
};

export const MUTATION_TYPE_MAP: Record<string, string> = {
  'masuk': 'MASUK',
  'datang': 'MASUK',
  'pindahmasuk': 'MASUK',
  'kelahiran': 'MASUK',
  'keluar': 'KELUAR',
  'pindah': 'KELUAR',
  'pindahkeluar': 'KELUAR',
  'kematian': 'KELUAR',
  'pisahkk': 'KELUAR',
  'gabungkk': 'MASUK'
};

export const SERVICE_STATUS_MAP: Record<string, string> = {
  'draft': 'DRAFT',
  'diajukan': 'DIAJUKAN',
  'pengajuan': 'DIAJUKAN',
  'baru': 'DIAJUKAN',
  'diverifikasi': 'DIVERIFIKASI',
  'verifikasi': 'DIVERIFIKASI',
  'diproses': 'DIPROSES',
  'proses': 'DIPROSES',
  'disetujui': 'DISETUJUI',
  'selesai': 'SELESAI',
  'terbit': 'SELESAI',
  'ditolak': 'DITOLAK',
  'batal': 'DITOLAK'
};

export const COMPLAINT_STATUS_MAP: Record<string, string> = {
  'diterima': 'DITERIMA',
  'baru': 'DITERIMA',
  'diverifikasi': 'DIVERIFIKASI',
  'diproses': 'DIPROSES',
  'tindaklanjut': 'DIPROSES',
  'selesai': 'SELESAI',
  'ditolak': 'DITOLAK'
};

export const BANSOS_STATUS_MAP: Record<string, string> = {
  'terdaftar': 'TERDAFTAR',
  'calon': 'TERDAFTAR',
  'usulan': 'TERDAFTAR',
  'salur': 'SALUR_SELESAI',
  'salurselesai': 'SALUR_SELESAI',
  'diterima': 'SALUR_SELESAI',
  'cair': 'SALUR_SELESAI',
  'tertunda': 'TERTUNDA',
  'pending': 'TERTUNDA',
  'gagal': 'GAGAL_SALUR',
  'batal': 'GAGAL_SALUR',
  'dicabut': 'GAGAL_SALUR'
};

export function normalizeStatus<T extends string>(
  raw: string | undefined | null,
  fallback: T,
  mapping: Record<string, string>
): T {
  if (!raw) return fallback;
  const clean = raw.toString().trim().toLowerCase().replace(/[\s_\-\/]+/g, '');
  if (mapping[clean]) {
    return mapping[clean] as T;
  }
  return fallback;
}
