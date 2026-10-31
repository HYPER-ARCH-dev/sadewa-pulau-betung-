/**
 * UTILITY FORMATTING
 * Standardisasi format tanggal Indonesia, mata uang Rupiah, sensor privasi NIK, dan nomor telepon.
 * Keyword: FORMATTING, APBDes
 */

/**
 * Format tanggal standar Indonesia (contoh: "5 September 2026")
 */
export function formatIndonesianDate(
  dateInput?: string | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    // Jika format string non-standar (misal "2026-09-05 14:00 WIB")
    return String(dateInput);
  }

  return date.toLocaleDateString('id-ID', options || {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format mata uang Rupiah untuk transparansi anggaran desa (APBDes)
 * Keyword: APBDes, CURRENCY
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  if (isNaN(numeric)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(numeric);
}

/**
 * Masking NIK 16 digit untuk menjaga kepatuhan privasi UU PDP
 * Contoh: "150401******0001"
 */
export function maskNik(nik?: string | null): string {
  if (!nik) return '150401******0001';
  const clean = nik.replace(/\D/g, '');
  if (clean.length !== 16) {
    if (clean.length > 6) {
      return `${clean.slice(0, 6)}******${clean.slice(-4)}`;
    }
    return clean;
  }
  return `${clean.slice(0, 6)}******${clean.slice(-4)}`;
}

/**
 * Normalisasi nomor WhatsApp/Telepon ke format 62xxx internasional
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    return `62${clean.slice(1)}`;
  }
  if (clean.startsWith('62')) {
    return clean;
  }
  return clean ? `62${clean}` : '';
}

/**
 * Membersihkan awalan "Nama:" / "NAMA:" dari string nama penduduk
 * agar tidak redundan saat ditampilkan di tabel atau form.
 */
export function cleanCitizenName(name?: string | null): string {
  if (!name) return '';
  return name.replace(/^nama\s*:\s*/i, '').trim();
}

/**
 * Membersihkan awalan "NIK:" atau nomor urut "1. NIK: " dari string NIK
 * agar murni berisi 16 digit angka kependudukan tanpa label ganda.
 */
export function cleanCitizenNik(nik?: string | null): string {
  if (!nik) return '';
  return nik.replace(/^[\d]+\.\s*/i, '').replace(/nik\s*:\s*/gi, '').replace(/\s/g, '').trim();
}
