import { StuntingCategory, WeightCategory, OverallNutritionalStatus } from '../types/posyandu';

/**
 * WHO Child Growth Standards (0-60 Bulan) Reference Data
 * Mengacu pada Standar Antropometri Anak Kementerian Kesehatan RI & WHO 2006
 */

interface WhoAgeReference {
  month: number;
  // TB/U Laki-laki
  boysHeightMedian: number;
  boysHeightSd: number;
  // TB/U Perempuan
  girlsHeightMedian: number;
  girlsHeightSd: number;
  // BB/U Laki-laki
  boysWeightMedian: number;
  boysWeightSd: number;
  // BB/U Perempuan
  girlsWeightMedian: number;
  girlsWeightSd: number;
}

// Sampling Data Referensi WHO 0 - 60 Bulan
const WHO_AGE_REF: WhoAgeReference[] = [
  { month: 0, boysHeightMedian: 49.9, boysHeightSd: 1.89, girlsHeightMedian: 49.1, girlsHeightSd: 1.85, boysWeightMedian: 3.3, boysWeightSd: 0.45, girlsWeightMedian: 3.2, girlsWeightSd: 0.43 },
  { month: 1, boysHeightMedian: 54.7, boysHeightSd: 2.05, girlsHeightMedian: 53.7, girlsHeightSd: 2.00, boysWeightMedian: 4.5, boysWeightSd: 0.58, girlsWeightMedian: 4.2, girlsWeightSd: 0.53 },
  { month: 2, boysHeightMedian: 58.4, boysHeightSd: 2.15, girlsHeightMedian: 57.1, girlsHeightSd: 2.10, boysWeightMedian: 5.6, boysWeightSd: 0.68, girlsWeightMedian: 5.1, girlsWeightSd: 0.62 },
  { month: 3, boysHeightMedian: 61.4, boysHeightSd: 2.22, girlsHeightMedian: 59.8, girlsHeightSd: 2.18, boysWeightMedian: 6.4, boysWeightSd: 0.76, girlsWeightMedian: 5.8, girlsWeightSd: 0.70 },
  { month: 6, boysHeightMedian: 67.6, boysHeightSd: 2.38, girlsHeightMedian: 65.7, girlsHeightSd: 2.35, boysWeightMedian: 7.9, boysWeightSd: 0.90, girlsWeightMedian: 7.3, girlsWeightSd: 0.85 },
  { month: 9, boysHeightMedian: 72.0, boysHeightSd: 2.50, girlsHeightMedian: 70.1, girlsHeightSd: 2.48, boysWeightMedian: 8.9, boysWeightSd: 0.99, girlsWeightMedian: 8.2, girlsWeightSd: 0.93 },
  { month: 12, boysHeightMedian: 75.7, boysHeightSd: 2.60, girlsHeightMedian: 74.0, girlsHeightSd: 2.60, boysWeightMedian: 9.6, boysWeightSd: 1.05, girlsWeightMedian: 8.9, girlsWeightSd: 1.00 },
  { month: 18, boysHeightMedian: 82.3, boysHeightSd: 2.85, girlsHeightMedian: 80.7, girlsHeightSd: 2.85, boysWeightMedian: 10.9, boysWeightSd: 1.18, girlsWeightMedian: 10.2, girlsWeightSd: 1.15 },
  { month: 24, boysHeightMedian: 87.8, boysHeightSd: 3.10, girlsHeightMedian: 86.4, girlsHeightSd: 3.10, boysWeightMedian: 12.2, boysWeightSd: 1.30, girlsWeightMedian: 11.5, girlsWeightSd: 1.25 },
  { month: 30, boysHeightMedian: 92.4, boysHeightSd: 3.35, girlsHeightMedian: 91.1, girlsHeightSd: 3.35, boysWeightMedian: 13.3, boysWeightSd: 1.45, girlsWeightMedian: 12.7, girlsWeightSd: 1.40 },
  { month: 36, boysHeightMedian: 96.1, boysHeightSd: 3.60, girlsHeightMedian: 95.1, girlsHeightSd: 3.60, boysWeightMedian: 14.3, boysWeightSd: 1.60, girlsWeightMedian: 13.9, girlsWeightSd: 1.55 },
  { month: 42, boysHeightMedian: 99.9, boysHeightSd: 3.80, girlsHeightMedian: 99.0, girlsHeightSd: 3.80, boysWeightMedian: 15.3, boysWeightSd: 1.75, girlsWeightMedian: 15.0, girlsWeightSd: 1.70 },
  { month: 48, boysHeightMedian: 103.3, boysHeightSd: 4.00, girlsHeightMedian: 102.7, girlsHeightSd: 4.00, boysWeightMedian: 16.3, boysWeightSd: 1.90, girlsWeightMedian: 16.1, girlsWeightSd: 1.85 },
  { month: 54, boysHeightMedian: 106.7, boysHeightSd: 4.15, girlsHeightMedian: 106.2, girlsHeightSd: 4.15, boysWeightMedian: 17.3, boysWeightSd: 2.05, girlsWeightMedian: 17.2, girlsWeightSd: 2.00 },
  { month: 60, boysHeightMedian: 110.0, boysHeightSd: 4.30, girlsHeightMedian: 109.4, girlsHeightSd: 4.30, boysWeightMedian: 18.3, boysWeightSd: 2.20, girlsWeightMedian: 18.2, girlsWeightSd: 2.15 }
];

/**
 * Interpolasi linier parameter WHO untuk bulan usia tertentu (0-60)
 */
function getWhoReferenceForAge(month: number): WhoAgeReference {
  const boundedMonth = Math.max(0, Math.min(60, month));
  
  // Temukan interval bulan
  let lower = WHO_AGE_REF[0];
  let upper = WHO_AGE_REF[WHO_AGE_REF.length - 1];

  for (let i = 0; i < WHO_AGE_REF.length - 1; i++) {
    if (boundedMonth >= WHO_AGE_REF[i].month && boundedMonth <= WHO_AGE_REF[i + 1].month) {
      lower = WHO_AGE_REF[i];
      upper = WHO_AGE_REF[i + 1];
      break;
    }
  }

  if (lower.month === upper.month) return lower;

  const ratio = (boundedMonth - lower.month) / (upper.month - lower.month);

  const lerp = (a: number, b: number) => a + (b - a) * ratio;

  return {
    month: boundedMonth,
    boysHeightMedian: lerp(lower.boysHeightMedian, upper.boysHeightMedian),
    boysHeightSd: lerp(lower.boysHeightSd, upper.boysHeightSd),
    girlsHeightMedian: lerp(lower.girlsHeightMedian, upper.girlsHeightMedian),
    girlsHeightSd: lerp(lower.girlsHeightSd, upper.girlsHeightSd),
    boysWeightMedian: lerp(lower.boysWeightMedian, upper.boysWeightMedian),
    boysWeightSd: lerp(lower.boysWeightSd, upper.boysWeightSd),
    girlsWeightMedian: lerp(lower.girlsWeightMedian, upper.girlsWeightMedian),
    girlsWeightSd: lerp(lower.girlsWeightSd, upper.girlsWeightSd)
  };
}

/**
 * Menghitung selisih usia dalam bulan dari Tanggal Lahir dan Tanggal Penimbangan
 */
export function calculateAgeInMonths(birthDateStr: string, measurementDateStr: string = new Date().toISOString().split('T')[0]): number {
  const birth = new Date(birthDateStr);
  const measure = new Date(measurementDateStr);

  let months = (measure.getFullYear() - birth.getFullYear()) * 12 + (measure.getMonth() - birth.getMonth());
  if (measure.getDate() < birth.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * Kalkulasi Z-Score TB/U (Tinggi/Panjang Badan menurut Usia)
 */
export function calculateZScoreHeightForAge(
  heightCm: number,
  ageInMonths: number,
  gender: 'L' | 'P'
): { zScore: number; category: StuntingCategory } {
  const ref = getWhoReferenceForAge(ageInMonths);
  const median = gender === 'L' ? ref.boysHeightMedian : ref.girlsHeightMedian;
  const sd = gender === 'L' ? ref.boysHeightSd : ref.girlsHeightSd;

  const zScore = parseFloat(((heightCm - median) / sd).toFixed(2));

  let category: StuntingCategory = 'Normal';
  if (zScore < -3.0) {
    category = 'Severely Stunted';
  } else if (zScore >= -3.0 && zScore < -2.0) {
    category = 'Stunted';
  } else if (zScore >= -2.0 && zScore <= +2.0) {
    category = 'Normal';
  } else {
    category = 'Tinggi';
  }

  return { zScore, category };
}

/**
 * Kalkulasi Z-Score BB/U (Berat Badan menurut Usia)
 */
export function calculateZScoreWeightForAge(
  weightKg: number,
  ageInMonths: number,
  gender: 'L' | 'P'
): { zScore: number; category: WeightCategory } {
  const ref = getWhoReferenceForAge(ageInMonths);
  const median = gender === 'L' ? ref.boysWeightMedian : ref.girlsWeightMedian;
  const sd = gender === 'L' ? ref.boysWeightSd : ref.girlsWeightSd;

  const zScore = parseFloat(((weightKg - median) / sd).toFixed(2));

  let category: WeightCategory = 'Normal';
  if (zScore < -3.0) {
    category = 'Gizi Buruk';
  } else if (zScore >= -3.0 && zScore < -2.0) {
    category = 'Gizi Kurang';
  } else if (zScore >= -2.0 && zScore <= +2.0) {
    category = 'Normal';
  } else if (zScore > +2.0 && zScore <= +3.0) {
    category = 'Beresiko Lebih';
  } else {
    category = 'Obesitas';
  }

  return { zScore, category };
}

/**
 * Kalkulasi Z-Score BB/TB (Berat Badan menurut Tinggi Badan / Wasting Index)
 */
export function calculateZScoreWeightForHeight(
  weightKg: number,
  heightCm: number,
  gender: 'L' | 'P'
): { zScore: number } {
  // Estimasi rasio standar BB terhadap TB
  // Secara rata-rata BB ideal = 0.15 * TB - 3.5 (untuk anak di bawah 5 tahun)
  const idealWeight = Math.max(2.5, 0.145 * heightCm - 2.8);
  const estimatedSd = Math.max(0.4, idealWeight * 0.11);
  const zScore = parseFloat(((weightKg - idealWeight) / estimatedSd).toFixed(2));
  return { zScore };
}

/**
 * Evaluasi Status Gizi Keseluruhan Balita
 */
export function evaluateOverallStatus(
  stuntingCategory: StuntingCategory,
  weightCategory: WeightCategory
): OverallNutritionalStatus {
  if (stuntingCategory === 'Severely Stunted') {
    return 'Sangat Pendek (Stunting Berat)';
  }
  if (stuntingCategory === 'Stunted') {
    return 'Pendek (Stunting)';
  }
  if (weightCategory === 'Gizi Buruk' || weightCategory === 'Gizi Kurang') {
    return 'Gizi Kurang (Wasting)';
  }
  if (weightCategory === 'Beresiko Lebih' || weightCategory === 'Obesitas') {
    return 'Beresiko Obesitas';
  }
  return 'Normal (Gizi Baik)';
}

/**
 * Generasi Kurva Standar WHO untuk Grafik KMS (0 - 60 Bulan)
 */
export function generateWhoGrowthCurves(gender: 'L' | 'P') {
  const points: {
    month: number;
    minus3Sd: number;
    minus2Sd: number;
    median: number;
    plus2Sd: number;
  }[] = [];

  for (let m = 0; m <= 60; m += 3) {
    const ref = getWhoReferenceForAge(m);
    const median = gender === 'L' ? ref.boysHeightMedian : ref.girlsHeightMedian;
    const sd = gender === 'L' ? ref.boysHeightSd : ref.girlsHeightSd;

    points.push({
      month: m,
      minus3Sd: parseFloat((median - 3 * sd).toFixed(1)),
      minus2Sd: parseFloat((median - 2 * sd).toFixed(1)),
      median: parseFloat(median.toFixed(1)),
      plus2Sd: parseFloat((median + 2 * sd).toFixed(1))
    });
  }

  return points;
}

/**
 * Generasi Rekomendasi Gizi Spesifik Berdasarkan Z-Score
 */
export function generateNutritionAdvice(
  toddlerName: string,
  stuntingCategory: StuntingCategory,
  weightCategory: WeightCategory
): string {
  if (stuntingCategory === 'Severely Stunted' || stuntingCategory === 'Stunted') {
    return `Ananda ${toddlerName} terindikasi berisiko stunting (${stuntingCategory === 'Severely Stunted' ? 'Sangat Pendek' : 'Pendek'}). Disarankan konseling gizi intensif TPK, pemberian Makanan Tambahan (PMT) kaya protein hewani (Telur, Ikan Asam Pedas/Patin Lokal, Daging), serta suplementasi Zink/Vitamin A rutin.`;
  }
  if (weightCategory === 'Gizi Kurang' || weightCategory === 'Gizi Buruk') {
    return `Ananda ${toddlerName} menunjukkan kenaikan berat badan belum optimal (${weightCategory}). Prioritaskan asupan kalori padat gizi, cek pola asuh pemberian makan (Pemberian Makanan Bayi & Anak/PMBA), dan pemantauan mingguan oleh Bidan Desa.`;
  }
  return `Pertumbuhan Ananda ${toddlerName} berada pada jalur ideal (Gizi Baik/Normal). Pertahankan pemberian Makanan Pendamping ASI (MP-ASI) bergizi seimbang dan hadir rutin setiap bulan di Posyandu.`;
}
