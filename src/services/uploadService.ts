import {
  compressImage,
  CompressImageOptions,
  CompressImageResult,
  formatFileSize
} from '../utils/imageCompressor';

/**
 * ============================================================================
 * KONFIGURASI URL BACKEND (FUTURE-PROOF IMAGE UPLOAD SERVICE)
 * ============================================================================
 * Menggunakan relative path "/api/upload" agar selalu mengarah ke server-side
 * (Storage fisik) alih-alih Base64, guna efisiensi bandwidth dan penyimpanan.
 */
export const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || "/api";

export interface UploadImageResult {
  success: boolean;
  url: string;
  isLocalFallback: boolean;
  error?: string;
  stats?: {
    originalSize: number;
    compressedSize: number;
    savedPercentage: number;
    formattedOriginal: string;
    formattedCompressed: string;
  };
}

/**
 * Utilitas Upload Gambar Future-Proof & Smart Client-Side Compression
 * Menangani kompresi canvas instan dan upload berkas foto
 * (Foto Kepala Desa, Logo, Aparatur, Berita, Dokumen KTP/KK, dll):
 * 
 * 1. SMART COMPRESSION (Client-Side Canvas Engine):
 *    - Merampingkan dimensi foto maks 1200px (aspek rasio terkunci).
 *    - Mengompresi kualitas 78% JPEG (memangkas MB menjadi KB, teks KTP/KK tetap tajam).
 *    - Menjaga transparansi PNG untuk logo resmi & tanda tangan.
 * 
 * 2. JALUR REAL SERVER (Jika API_URL tersedia):
 *    - Mengirim File/Blob hasil kompresi via FormData ke server backend asli.
 * 
 * 3. JALUR FALLBACK / LOKAL (Jika API_URL kosong atau server offline):
 *    - Menggunakan Base64 terkompresi langsung di browser (sangat hemat memori).
 *
 * @param file Berkas gambar (File) dari input browser
 * @param options Opsi kompresi tambahan (resolusi maks, kualitas, format)
 * @returns Promise<UploadImageResult> Objek hasil upload berisi URL/Base64, status, dan statistik kompresi
 */
export async function uploadImageService(
  file: File,
  options?: CompressImageOptions
): Promise<UploadImageResult> {
  // Validasi tipe berkas
  if (!file || !file.type.startsWith('image/')) {
    return {
      success: false,
      url: '',
      isLocalFallback: false,
      error: 'Berkas harus berupa gambar yang valid (JPEG, PNG, WEBP, GIF, dll).'
    };
  }

  let processedFile: File = file;
  let compressedBase64: string = '';
  let compressionStats: UploadImageResult['stats'] | undefined = undefined;

  // ==========================================================================
  // TAHAP 1: SMART CLIENT-SIDE IMAGE COMPRESSION (CANVAS API)
  // ==========================================================================
  try {
    const compResult: CompressImageResult = await compressImage(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.78,
      preservePngTransparency: true,
      ...options
    });

    processedFile = compResult.file;
    compressedBase64 = compResult.dataUrl;
    compressionStats = {
      originalSize: compResult.originalSize,
      compressedSize: compResult.compressedSize,
      savedPercentage: compResult.savedPercentage,
      formattedOriginal: formatFileSize(compResult.originalSize),
      formattedCompressed: formatFileSize(compResult.compressedSize)
    };
  } catch (compressErr) {
    console.warn(
      '[uploadImageService] Kompresi canvas gagal atau dilewati, menggunakan berkas asli:',
      compressErr
    );
  }

  // ==========================================================================
  // JALUR 1: REAL BACKEND SERVER (Jika API_URL sudah ditentukan / tidak kosong)
  // ==========================================================================
  if (API_URL && API_URL.trim() !== '') {
    try {
      const formData = new FormData();
      // Gunakan berkas yang sudah dikompresi
      formData.append('file', processedFile);

      // Ambil token autentikasi jika backend Anda memerlukan Bearer token
      const token = localStorage.getItem('pulau_betung_auth_token');

      const uploadEndpoint = `${API_URL.replace(/\/$/, '')}/upload`;

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const serverUrl = json.url || json.imageUrl || json.data?.url || json.data?.fileUrl;

      if (serverUrl) {
        return {
          success: true,
          url: serverUrl,
          isLocalFallback: false,
          stats: compressionStats
        };
      }

      throw new Error('Respon backend tidak menyertakan URL gambar yang valid.');
    } catch (serverErr: unknown) {
      console.warn(
        '[uploadImageService] Gagal menghubungi backend server, beralih ke Fallback Base64 lokal terkompresi:',
        serverErr instanceof Error ? serverErr.message : serverErr
      );
    }
  }

  // ==========================================================================
  // JALUR 2: FALLBACK / LOKAL (Jika API_URL kosong atau server belum aktif)
  // Menggunakan Base64 hasil kompresi cerdas untuk efisiensi LocalStorage
  // ==========================================================================
  if (compressedBase64) {
    return {
      success: true,
      url: compressedBase64,
      isLocalFallback: true,
      stats: compressionStats
    };
  }

  return new Promise<UploadImageResult>((resolve) => {
    try {
      const reader = new FileReader();

      reader.onload = () => {
        const base64String = reader.result as string;
        resolve({
          success: true,
          url: base64String,
          isLocalFallback: true,
          stats: compressionStats
        });
      };

      reader.onerror = (readErr) => {
        console.error('[uploadImageService] Gagal membaca berkas lokal:', readErr);
        resolve({
          success: false,
          url: '',
          isLocalFallback: true,
          error: 'Gagal memproses berkas gambar di peramban.'
        });
      };

      reader.readAsDataURL(processedFile);
    } catch (err: unknown) {
      resolve({
        success: false,
        url: '',
        isLocalFallback: true,
        error: err instanceof Error ? err.message : String(err) || 'Gagal membaca berkas gambar.'
      });
    }
  });
}
