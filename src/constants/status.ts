import { ServiceStatus, ComplaintStatus, ProjectStatus } from '../types';

/**
 * KONSTANTA STATUS PELAYANAN SURAT
 * Keyword: SERVICE_REQUEST, STATUS
 */
export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  draft: 'Draft',
  diajukan: 'Diajukan',
  diverifikasi: 'Diverifikasi',
  diproses: 'Sedang Diproses',
  perlu_perbaikan: 'Perlu Perbaikan',
  disetujui: 'Disetujui',
  selesai: 'Selesai',
  ditolak: 'Ditolak'
};

/**
 * KONSTANTA STATUS PENGADUAN WARGA
 * Keyword: COMPLAINT, STATUS
 */
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  diterima: 'Diterima',
  diverifikasi: 'Diverifikasi',
  diproses: 'Sedang Ditindaklanjuti',
  selesai: 'Selesai',
  ditolak: 'Ditolak'
};

/**
 * KONSTANTA STATUS PROYEK PEMBANGUNAN DESA
 * Keyword: APBDes, PROJECT_STATUS
 */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  perencanaan: 'Perencanaan',
  proses_lelang: 'Proses Lelang',
  sedang_berjalan: 'Sedang Berjalan',
  selesai: 'Selesai',
  pemeliharaan: 'Masa Pemeliharaan'
};
