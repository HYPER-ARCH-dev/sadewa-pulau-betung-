import QRCode from 'qrcode';
import { VILLAGE_INFO } from '../constants/village';

/**
 * HELPER GENERASI QR CODE RESMI PEMERINTAH DESA PULAU BETUNG
 * Menggunakan pustaka qrcode untuk menghasilkan format Data URL image/png
 * Keyword: QR_VERIFICATION, QRCODE, OFFICIAL_LETTER
 */

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Buat URL verifikasi resmi dokumen surat: https://[domain-desa]/verify/[NOMOR_SURAT_ID]
 */
export function getLetterVerificationUrl(identifier: string, customDomain?: string): string {
  const cleanId = encodeURIComponent((identifier || '').trim());
  
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/verify/${cleanId}`;
  }
  
  const domain = customDomain || (typeof window !== 'undefined' ? window.location.origin : '') || VILLAGE_INFO.DOMAIN || 'pulaubetung.sadewa.id';
  const prefix = domain.startsWith('http') ? domain : `https://${domain}`;
  return `${prefix}/verify/${cleanId}`;
}

/**
 * Generate QR Code otomatis dalam format Data URL (image/png)
 * Menggunakan margin 2 (quiet zone standar ISO/IEC 18004) dan warna hitam pekat (#000000)
 * agar mudah dipindai oleh semua jenis sensor kamera smartphone dan aplikasi pemindai.
 */
export async function generateVerificationQrCode(
  contentUrl: string,
  options?: QrCodeOptions
): Promise<string> {
  const opts = {
    errorCorrectionLevel: options?.errorCorrectionLevel || 'H',
    margin: options?.margin ?? 2,
    width: options?.width ?? 320,
    color: {
      dark: options?.darkColor || '#000000',
      light: options?.lightColor || '#ffffff'
    }
  };

  try {
    const dataUrl = await QRCode.toDataURL(contentUrl, opts);
    return dataUrl;
  } catch (err) {
    console.error('Gagal generate QR Code verifikasi:', err);
    throw err;
  }
}
