import imageCompression from 'browser-image-compression';

/**
 * ============================================================================
 * SADEWA SMART CLIENT-SIDE IMAGE COMPRESSOR (V2 - PRO)
 * ============================================================================
 * Menggunakan browser-image-compression untuk hasil lebih profesional,
 * menjaga ketajaman teks pada dokumen (KTP/KK) sambil memangkas ukuran berkas.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  preservePngTransparency?: boolean;
}

export interface CompressImageResult {
  file: File;
  blob: Blob;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  format: string;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function isImageFile(file: File | Blob): boolean {
  if (!file || !file.type) return false;
  return file.type.startsWith('image/') && !file.type.includes('svg');
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const {
    maxWidth = 1200,
    quality = 0.75,
  } = options;

  const originalSize = file.size;
  
  // --- KONFIGURASI KOMPRESI DATA ---
  // maxSizeMB: Target ukuran maksimal berkas. Kita set 0.3 (300KB) agar ukuran unggah efisien dan cepat.
  // maxWidthOrHeight: Batas dimensi pixel tertinggi agar gambar tidak pecah saat diperbesar.
  // useWebWorker: Menggunakan thread latar belakang agar UI tidak membeku saat memproses gambar berat.
  const compressionOptions = {
    maxSizeMB: 0.3, 
    maxWidthOrHeight: maxWidth,
    useWebWorker: true,
    initialQuality: quality,
  };

  try {
    // Eksekusi proses kompresi asinkron menggunakan library browser-image-compression
    const compressedFile = await imageCompression(file, compressionOptions);
    // Konversi hasil kompresi menjadi Data URL (Base64) untuk ditampilkan di UI secara instan
    const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
    
    const compressedSize = compressedFile.size;
    const savedBytes = Math.max(0, originalSize - compressedSize);
    // Menghitung persentase efisiensi penyimpanan untuk log sistem
    const savedPercentage = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

    return {
      file: compressedFile,
      blob: compressedFile,
      dataUrl,
      originalSize,
      compressedSize,
      savedPercentage,
      originalWidth: 0, // Not easily available without loading image, but okay for stats
      originalHeight: 0,
      newWidth: maxWidth,
      newHeight: maxWidth,
      format: compressedFile.type
    };
  } catch (error) {
    console.error('Compression error:', error);
    throw error;
  }
}

/**
 * Helper ringkas: Langsung menghasilkan string Base64 yang sudah terkompresi
 */
export async function compressImageToBase64(
  file: File | Blob,
  options?: CompressImageOptions
): Promise<string> {
  const fileToCompress = file instanceof File ? file : new File([file], 'image.jpg', { type: file.type });
  const result = await compressImage(fileToCompress, options);
  return result.dataUrl;
}

/**
 * Helper ringkas: Langsung menghasilkan objek File yang sudah terkompresi
 */
export async function compressImageToFile(
  file: File | Blob,
  options?: CompressImageOptions
): Promise<File> {
  const fileToCompress = file instanceof File ? file : new File([file], 'image.jpg', { type: file.type });
  const result = await compressImage(fileToCompress, options);
  return result.file;
}
