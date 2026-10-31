import React from 'react';
import { ServiceStatus, ComplaintStatus, ProjectStatus, PriorityLevel } from '../../types';

export const ServiceStatusBadge: React.FC<{ status: ServiceStatus | string }> = ({ status }) => {
  const s = (status || '').toLowerCase();
  if (s.includes('ditolak') || s.includes('batal') || s.includes('cancelled') || s.includes('rejected')) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5"></span>
        Dibatalkan / Ditolak
      </span>
    );
  }

  switch (status) {
    case 'diajukan':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
          Diajukan
        </span>
      );
    case 'diverifikasi':
    case 'diproses':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-spin"></span>
          Diproses Petugas
        </span>
      );
    case 'perlu_perbaikan':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
          Perlu Perbaikan Berkas
        </span>
      );
    case 'disetujui':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Disetujui Kades
        </span>
      );
    case 'selesai':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>
          Selesai / Siap Diambil
        </span>
      );
    case 'ditolak':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5"></span>
          Dibatalkan / Ditolak
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
          Draft
        </span>
      );
  }
};

export const ComplaintStatusBadge: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
  switch (status) {
    case 'diterima':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          Laporan Diterima
        </span>
      );
    case 'diverifikasi':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          Diverifikasi
        </span>
      );
    case 'diproses':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
          Sedang Ditindaklanjuti
        </span>
      );
    case 'selesai':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Selesai Ditangani
        </span>
      );
    case 'ditolak':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          Tidak Memenuhi Kriteria
        </span>
      );
  }
};

export const ProjectStatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  switch (status) {
    case 'perencanaan':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          Tahap Perencanaan
        </span>
      );
    case 'proses_lelang':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
          Pengadaan Bahan / TPK
        </span>
      );
    case 'sedang_berjalan':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          Sedang Dikerjakan
        </span>
      );
    case 'selesai':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          100% Selesai
        </span>
      );
    case 'pemeliharaan':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
          Masa Pemeliharaan
        </span>
      );
  }
};

export const PriorityBadge: React.FC<{ priority: PriorityLevel }> = ({ priority }) => {
  switch (priority) {
    case 'mendesak':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-600 text-white tracking-wide uppercase">
          Mendesak
        </span>
      );
    case 'penting':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500 text-white tracking-wide">
          Penting
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
          Biasa
        </span>
      );
  }
};
