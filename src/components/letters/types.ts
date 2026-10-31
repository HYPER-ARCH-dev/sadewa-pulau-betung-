import React from 'react';
import { ServiceRequest } from '../../types';

/**
 * Tipe data field tambahan pada template naskah surat resmi
 * Keyword: OFFICIAL_LETTER, TEMPLATE_TYPES
 */
export interface LetterExtraField {
  label: string;
  value: string;
}

/**
 * Struktur sub-halaman untuk template naskah surat multi-halaman (misal: Bundel Nikah N1-N4)
 */
export interface LetterPageDetails {
  pageNumber: number;
  pageCode?: string; // misal: 'Model N1', 'Model N2', 'Model N3', 'Model N4'
  title: string;
  subtitle?: string;
  customOpening?: string;
  statement: string;
  extraFields?: LetterExtraField[];
  purpose?: string;
  closingStatement?: string;
  signType?: 'kades' | 'mempelai' | 'orang_tua' | 'kades_dan_pihak' | 'pemohon' | 'none';
  customSigners?: {
    leftTitle?: string;
    leftName?: string;
    leftSub?: string;
    rightTitle?: string;
    rightName?: string;
    rightSub?: string;
  };
  renderCustom?: () => React.ReactNode;
}

/**
 * Struktur konten template surat naskah dinas resmi
 * Keyword: OFFICIAL_LETTER, TEMPLATE_DETAILS
 */
export interface LetterTemplateDetails {
  title: string;
  customOpening?: string;
  statement: string;
  purpose: string;
  extraFields?: LetterExtraField[];
  /** Penanda administratif jika format belum ditetapkan perbup/SK bupati definitif */
  isDraftFormatPendingValidation?: boolean;
  administrativeNote?: string;
  customLetterNumber?: string;
  /** Dukungan multi-halaman bundel resmi (misal N1-N4) */
  isBundle?: boolean;
  pages?: LetterPageDetails[];
}

/**
 * Properti dialog/modal cetak surat resmi
 * Keyword: PRINT_DOCUMENT, OFFICIAL_LETTER
 */
export interface OfficialLetterPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: ServiceRequest | null;
  kadesName?: string;
  kadesNip?: string;
  isAdminView?: boolean;
}

export * from './villageContext';

