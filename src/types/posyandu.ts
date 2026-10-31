// Definisi Tipe Data e-Posyandu & Monitoring Stunting Spasial (KIA Digital) SADEWA

export type StuntingCategory = 'Severely Stunted' | 'Stunted' | 'Normal' | 'Tinggi';
export type WeightCategory = 'Gizi Buruk' | 'Gizi Kurang' | 'Normal' | 'Beresiko Lebih' | 'Gizi Lebih' | 'Obesitas';
export type OverallNutritionalStatus = 
  | 'Sangat Pendek (Stunting Berat)'
  | 'Pendek (Stunting)'
  | 'Gizi Kurang (Wasting)'
  | 'Normal (Gizi Baik)'
  | 'Beresiko Obesitas';

export interface ToddlerMeasurement {
  id: string;
  toddlerId: string;
  measurementDate: string; // YYYY-MM-DD
  ageInMonths: number;
  weightKg: number;
  heightCm: number;
  headCircumferenceCm: number;
  vitA: boolean;
  deworming: boolean; // Obat Cacing
  immunizationStatus: string; // Misal: "Imunisasi Dasar Lengkap", "DPT 3 + Polio 4", dll
  zScoreHeightForAge: number; // TB/U
  zScoreWeightForAge: number; // BB/U
  zScoreWeightForHeight: number; // BB/TB
  stuntingCategory: StuntingCategory;
  weightCategory: WeightCategory;
  overallStatus: OverallNutritionalStatus;
  cadreNotes?: string;
  measuredBy?: string; // Nama Kader / Bidan Desa
}

export interface ToddlerRecord {
  id: string;
  nik: string;
  name: string;
  gender: 'L' | 'P';
  birthDate: string; // YYYY-MM-DD
  birthWeightKg: number;
  birthHeightCm: number;
  parentName: string; // Nama Ibu / Ayah
  parentNik?: string;
  parentPhone: string; // WhatsApp Orang Tua
  dusunName: string; // Misal: "Dusun Betung Indah"
  rtRw: string; // Misal: "RT 02 / RW 01"
  address: string;
  coordinates: [number, number]; // [Latitude, Longitude]
  kmsCardNumber: string; // Misal: KIA-2026-0812
  isInterventionTarget: boolean; // Flag intervensi khusus TPK / BPD
  measurements: ToddlerMeasurement[];
}

export interface PosyanduSchedule {
  id: string;
  posyanduName: string; // Misal: "Posyandu Melati 1"
  dusunName: string;
  location: string; // Misal: "Poskesdes Dusun Betung Indah"
  scheduleDate: string; // YYYY-MM-DD
  startTime: string; // Misal: "08:30"
  endTime: string; // Misal: "11:30"
  cadreInCharge: string;
  bidanInCharge: string;
  notes?: string;
}

export interface StuntingSummaryStats {
  totalToddlers: number;
  totalMeasuredThisMonth: number;
  normalCount: number;
  stuntedCount: number;
  severelyStuntedCount: number;
  wastedCount: number;
  stuntingPrevalencePercentage: number;
  highRiskDusun: string;
}
