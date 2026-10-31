// ============================================================================
// 🌐 LAYANAN KOMUNIKASI HTTP API (API SERVICE CLIENT)
// ============================================================================
// Berkas ini adalah "kurir" utama di sisi frontend yang bertugas mengirim dan
// menerima data ke/dari server backend Express (/api).
// Fitur penting:
// 1. Injeksi Otomatis Token: Membaca token dari localStorage dan menempelkannya
//    sebagai header Authorization: Bearer <token>.
// 2. Auto Logout Sesi Kedaluwarsa (401): Jika token admin sudah hangus di server,
//    pengguna akan otomatis diarahkan kembali ke halaman login.
// 3. Normalisasi Respon: Mengubah respon HTTP mentah menjadi format seragam
//    { success: boolean, data?: T, error?: string }.
// ============================================================================

import {
  VillageService,
  ServiceRequest,
  Complaint,
  NewsItem,
  Announcement,
  AgendaItem,
  DevelopmentProject,
  BudgetYearData,
  VillageOfficial,
  VillagePotential,
  UmkmItem,
  MapFacility,
  GalleryItem,
  AuditLog,
  User,
  VillageProfile,
  DusunRecord,
  DeletedServiceRequestRecord
} from '../types';
import { Resident } from '../types/resident';
import { compressImage, isImageFile, formatFileSize } from '../utils/imageCompressor';

// Struktur standar pembungkus balasan API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

// Alamat dasar semua endpoint backend
const BASE_URL = '/api';

/**
 * Menyiapkan header HTTP standar dan menyematkan token Bearer jika ada di localStorage.
 * @param token Token opsional jika ingin menggunakan token selain yang ada di localStorage
 */
function getAuthHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  const activeToken = token || localStorage.getItem('pulau_betung_auth_token');
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  return headers;
}

/**
 * Pembungkus terpusat untuk memproses semua respon HTTP dari server:
 * - Menangani error 401 (Sesi habis): Menghapus token kadaluwarsa & redirect otomatis ke login.
 * - Memastikan tipe konten berupa JSON.
 * - Mengembalikan format terstandar { success, data, error }.
 */
const processResponse = async <T>(res: Response): Promise<{ success: boolean; data?: T; error?: string }> => {
  // Jika server menolak dengan status 401 Unauthorized
  if (res.status === 401) {
    const isUrlAdmin = res.url.includes('/admin/');
    const hasToken = !!localStorage.getItem('pulau_betung_auth_token');
    
    // Hanya redirect paksa jika request ditujukan ke endpoint admin dan user memang punya token sebelumnya
    if (isUrlAdmin && hasToken) {
      localStorage.removeItem('pulau_betung_auth_token');
      if (typeof window !== 'undefined') {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('login') !== 'expired') {
          window.location.href = '/?login=expired';
        }
      }
    }
    
    return { success: false, error: 'Sesi berakhir atau tidak memiliki izin akses dunsanak. Silakan login kembali.' };
  }
  
  // Pastikan balasan dari server bertipe JSON
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { success: false, error: `Kesalahan server (HTTP ${res.status})` };
  }

  const json = await res.json();
  if (!res.ok || !json.success) {
    return { success: false, error: json.error || `Error ${res.status}` };
  }
  return { success: true, data: json.data };
};

// Objek penyedia seluruh fungsi pemanggil API backend
export const api = {
  // 1. Bootstrap all public data
  async getBootstrapData(): Promise<{
    profile: VillageProfile;
    services: VillageService[];
    news: NewsItem[];
    announcements: Announcement[];
    agendas: AgendaItem[];
    projects: DevelopmentProject[];
    budget: BudgetYearData;
    officials: VillageOfficial[];
    potentials: VillagePotential[];
    umkm: UmkmItem[];
    facilities: MapFacility[];
    gallery: GalleryItem[];
    territories?: DusunRecord[];
  } | null> {
    let retries = 3;
    while (retries > 0) {
      try {
        const res = await fetch(`${BASE_URL}/public/bootstrap`);
        const result = await processResponse<any>(res);
        if (result.success) return result.data;
        throw new Error(result.error || 'Gagal bootstrap');
      } catch (err) {
        retries--;
        if (retries === 0) {
          console.info('ℹ️ [SADEWA-SYNC] Menggunakan data lokal (Offline-First Mode) karena sinkronisasi tertunda:', err);
          return null;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    return null;
  },

  // 2. Authentication
  async login(username: string, password: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal masuk. Periksa username dan password.' };
      }
      if (json.token) {
        localStorage.setItem('pulau_betung_auth_token', json.token);
      }
      return { success: true, user: json.user, token: json.token };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Koneksi ke server gagal.' };
    }
  },

  async getCurrentUser(token?: string): Promise<User | null> {
    try {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: getAuthHeaders(token)
      });
      const result = await processResponse<any>(res);
      return result.success ? result.data.user || result.data : null;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } finally {
      localStorage.removeItem('pulau_betung_auth_token');
    }
  },

  // 3. Citizen Services & Tracking
  async applyService(data: {
    id?: string;
    trackingCode?: string;
    serviceId: string;
    citizenName: string;
    citizenNik?: string;
    phone: string;
    addressDusun: string;
    citizenGender?: 'Laki-laki' | 'Perempuan';
    citizenBirthPlace?: string;
    citizenBirthDate?: string;
    dusunId?: string;
    rwId?: string;
    rtId?: string;
    formData?: Record<string, any>;
    notes?: string;
    ktpAttachmentUrl?: string;
    fileAttachmentName?: string;
    fileAttachmentUrl?: string;
  }): Promise<ApiResponse<unknown>> {
    try {
      const res = await fetch(`${BASE_URL}/public/services/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Pengajuan gagal.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Koneksi ke server gagal.' };
    }
  },

  async trackRequest(code: string): Promise<ApiResponse<unknown>> {
    try {
      const res = await fetch(`${BASE_URL}/public/tracking/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Resi tidak ditemukan.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Gagal melacak resi.' };
    }
  },

  // 4. Complaints
  async submitComplaint(data: {
    category: string;
    title: string;
    content: string;
    reporterName?: string;
    isAnonymous?: boolean;
    reporterContact?: string;
    location: string;
    attachmentUrl?: string;
  }): Promise<ApiResponse<unknown>> {
    try {
      const res = await fetch(`${BASE_URL}/public/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Pengaduan gagal dikirim.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Koneksi ke server gagal.' };
    }
  },

  async trackComplaint(ticket: string): Promise<ApiResponse<unknown>> {
    try {
      const res = await fetch(`${BASE_URL}/public/complaints/track/${encodeURIComponent(ticket)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Tiket aduan tidak ditemukan.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Gagal melacak tiket aduan.' };
    }
  },

  // 4b. Official Letter QR Backend Verification
  async verifyDocument(trackingCodeOrIdentifier: string, letterNumber?: string): Promise<{
    success: boolean;
    verified: boolean;
    validityState?: 'VALID' | 'CANCELLED' | 'PENDING' | 'NOT_FOUND';
    isSystemError?: boolean;
    reason?: string;
    trackingCode?: string;
    letterNumber?: string;
    status?: string;
    message?: string;
    notes?: string;
    certificate?: {
      trackingCode: string;
      officialLetterNumber: string;
      serviceName: string;
      citizenName: string;
      citizenNikMasked: string;
      completedAt: string;
      authority: string;
      verificationTimestamp: string;
    };
    error?: string;
  }> {
    let raw = (trackingCodeOrIdentifier || '').trim();
    if (!raw) {
      return {
        success: false,
        verified: false,
        isSystemError: false,
        reason: 'MISSING_PARAMETER',
        error: 'Nomor identifikasi surat (Nomor Surat / Resi / ID) wajib disertakan untuk verifikasi.'
      };
    }

    // Extract code if raw string is a URL
    let cleanCode = raw;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('/verify')) {
      try {
        const fullUrl = raw.startsWith('http') ? raw : `https://example.com${raw.startsWith('/') ? '' : '/'}${raw}`;
        const urlObj = new URL(fullUrl);
        if (urlObj.pathname.includes('/verify/')) {
          const parts = urlObj.pathname.split('/verify/');
          if (parts[1]) {
            cleanCode = decodeURIComponent(parts[1].split('/')[0].split('?')[0]);
          }
        } else {
          const paramCode = urlObj.searchParams.get('trackingCode') || 
                            urlObj.searchParams.get('code') || 
                            urlObj.searchParams.get('resi') || 
                            urlObj.searchParams.get('id');
          if (paramCode) cleanCode = paramCode;
        }
      } catch {
        // fallback
      }
    }

    const matchReq = cleanCode.match(/REQ-PB-[A-Za-z0-9-]+/i);
    if (matchReq && matchReq[0]) {
      cleanCode = matchReq[0];
    }

    try {
      const params = new URLSearchParams({ trackingCode: cleanCode });
      if (letterNumber && letterNumber.trim()) {
        params.append('letterNumber', letterNumber.trim());
      }

      const res = await fetch(`${BASE_URL}/public/verify-document?${params.toString()}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      // REQUIREMENT 8: Inspect Content-Type BEFORE attempting to parse JSON!
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.toLowerCase().includes('application/json');

      if (!isJson) {
        console.warn('Endpoint verifikasi mengembalikan respons non-JSON:', contentType);
        return {
          success: false,
          verified: false,
          isSystemError: true,
          reason: 'SERVER_HTML_RESPONSE',
          error: 'Layanan verifikasi dokumen sedang mengalami gangguan.'
        };
      }

      let data: Record<string, any> | null = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('Gagal parsing JSON dari respons verifikasi:', parseErr);
        return {
          success: false,
          verified: false,
          isSystemError: true,
          reason: 'JSON_PARSE_ERROR',
          error: 'Layanan verifikasi dokumen sedang mengalami gangguan.'
        };
      }

      if (!res.ok) {
        // HTTP 404 (DOCUMENT_NOT_FOUND) or HTTP 400 (DOCUMENT_NOT_APPROVED / LETTER_NUMBER_MISMATCH / MISSING_PARAMETER)
        const isServerInternalError = res.status >= 500;
        return {
          success: false,
          verified: false,
          isSystemError: isServerInternalError,
          reason: data?.reason || (res.status === 404 ? 'DOCUMENT_NOT_FOUND' : 'VERIFICATION_FAILED'),
          trackingCode: data?.trackingCode || cleanCode,
          letterNumber: data?.letterNumber,
          status: data?.status,
          error: isServerInternalError
            ? 'Layanan verifikasi dokumen sedang mengalami gangguan.'
            : (data?.error || 'Dokumen tidak dapat diverifikasi.')
        };
      }

      return {
        success: true,
        verified: data?.verified === true,
        validityState: data?.validityState || (data?.verified ? 'VALID' : 'PENDING'),
        isSystemError: false,
        trackingCode: data?.trackingCode || data?.certificate?.trackingCode || cleanCode,
        letterNumber: data?.letterNumber || data?.certificate?.officialLetterNumber,
        status: data?.status || 'SELESAI',
        message: data?.message,
        notes: data?.notes,
        certificate: data?.certificate,
        error: data?.error
      };
    } catch (err: unknown) {
      console.error('Koneksi jaringan/fetch bermasalah saat memverifikasi dokumen:', err);
      return {
        success: false,
        verified: false,
        isSystemError: true,
        reason: 'NETWORK_ERROR',
        error: 'Layanan verifikasi dokumen sedang mengalami gangguan.'
      };
    }
  },

  // 5. Contact message
  async sendContactMessage(data: {
    name: string;
    phone?: string;
    email?: string;
    subject?: string;
    message: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal mengirim pesan.' };
      }
      return { success: true, message: json.message };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Koneksi ke server gagal.' };
    }
  },

  // 6. File Upload (Multer Multipart & Smart Client-Side Compression)
  async uploadFileMultipart(file: File): Promise<{
    success: boolean;
    url?: string;
    fileName?: string;
    error?: string;
    message?: string;
    size?: number;
    compressionStats?: {
      originalSize: number;
      compressedSize: number;
      savedPercentage: number;
    };
  }> {
    try {
      let fileToUpload: File = file;
      let compStats: { originalSize: number; compressedSize: number; savedPercentage: number } | undefined = undefined;

      // Jalankan Smart Client-Side Compression jika berkas merupakan gambar (KTP, KK, foto, dll)
      if (isImageFile(file)) {
        try {
          const compResult = await compressImage(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.78,
            preservePngTransparency: true
          });
          fileToUpload = compResult.file;
          compStats = {
            originalSize: compResult.originalSize,
            compressedSize: compResult.compressedSize,
            savedPercentage: compResult.savedPercentage
          };
        } catch (compErr) {
          console.warn('[uploadFileMultipart] Kompresi dilewati:', compErr);
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      const res = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          ...(localStorage.getItem('pulau_betung_auth_token') ? { 'Authorization': `Bearer ${localStorage.getItem('pulau_betung_auth_token')}` } : {})
        },
        body: formData
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textError = await res.text().catch(() => '');
        console.warn('Upload non-JSON response:', textError.slice(0, 150));
        const statusMsg = res.status === 413
          ? 'Ukuran berkas melebihi batas maksimal server (10MB). Harap kompres berkas Anda.'
          : `Gagal mengunggah berkas ke server (HTTP ${res.status}).`;
        return { success: false, error: statusMsg, message: statusMsg, compressionStats: compStats };
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || json.message || 'Gagal mengunggah berkas ke server.', message: json.message || json.error, compressionStats: compStats };
      }
      const url = json.url || json.data?.url;
      const fileName = json.data?.originalName || fileToUpload.name;
      return { success: true, url, fileName, size: json.data?.size || fileToUpload.size, message: json.message, compressionStats: compStats };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const cleanErrMsg = errMsg.includes('JSON') || errMsg.includes('Unexpected token')
        ? 'Respon unggah dari server tidak valid (bukan JSON).'
        : (errMsg || 'Koneksi unggah ke server gagal.');
      return { success: false, error: cleanErrMsg, message: cleanErrMsg };
    }
  },

  async uploadFile(base64Data: string, fileName: string, mimeType: string, isPrivate: boolean = false): Promise<{ success: boolean; url?: string; error?: string; message?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ base64Data, fileName, mimeType, isPrivate })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textError = await res.text().catch(() => '');
        console.warn('Upload Base64 non-JSON response:', textError.slice(0, 150));
        const statusMsg = res.status === 413
          ? 'Ukuran berkas melebihi batas maksimal server (10MB). Harap perkecil atau kompres berkas Anda.'
          : `Gagal mengunggah berkas (HTTP ${res.status}).`;
        return { success: false, error: statusMsg, message: statusMsg };
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || json.message || 'Gagal mengunggah berkas.', message: json.message || json.error };
      }
      return { success: true, url: json.url || json.data?.url, message: json.message };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const cleanErrMsg = errMsg.includes('JSON') || errMsg.includes('Unexpected token')
        ? 'Respon unggah dari server tidak valid (bukan JSON).'
        : (errMsg || 'Koneksi unggah gagal.');
      return { success: false, error: cleanErrMsg, message: cleanErrMsg };
    }
  },

// 7. Admin Protected Endpoints
  async getResidents(): Promise<{ success: boolean; data?: Resident[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/residents`, {
        headers: getAuthHeaders()
      });
      return processResponse<Resident[]>(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateResident(id: string, data: {
    fullName?: string;
    nik?: string;
    gender?: string;
    birthPlace?: string;
    birthDate?: string;
    address?: string;
    dusunId?: string | null;
    rwId?: string | null;
    rtId?: string | null;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/residents/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addResident(data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/residents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteResident(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/residents/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addToddler(data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/toddlers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateToddler(id: string, data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/toddlers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteToddler(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/toddlers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getToddlers(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/toddlers`, {
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateKpm(id: string, data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/kpm/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteKpm(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/kpm/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getKpmData(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/kpm`, {
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getPublicKpmData(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/public/kpm`);
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getAdminRequests(): Promise<{ success: boolean; data?: ServiceRequest[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal memuat daftar permohonan.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateRequestStatus(
    id: string,
    status: string,
    staffNotes?: string,
    officialLetterNumber?: string,
    extra?: {
      trackingCode?: string;
      completedAt?: string;
      letterheadSnapshot?: any;
      fullRequest?: any;
    }
  ): Promise<{ success: boolean; data?: ServiceRequest; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status,
          staffNotes,
          officialLetterNumber,
          trackingCode: extra?.trackingCode,
          completedAt: extra?.completedAt,
          letterheadSnapshot: extra?.letterheadSnapshot,
          fullRequest: extra?.fullRequest
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal memperbarui status surat.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteServiceRequest(id: string, reason?: string): Promise<{ success: boolean; data?: DeletedServiceRequestRecord; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: reason || 'Data Uji Coba / Testing' })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal menghapus permohonan surat.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async bulkDeleteServiceRequests(ids: string[], reason?: string): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids, reason: reason || 'Pembersihan Massal Data Uji Coba' })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal menghapus massal permohonan surat.' };
      }
      return { success: true, deletedCount: json.deletedCount };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getDeletedServiceRequests(): Promise<{ success: boolean; data?: DeletedServiceRequestRecord[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests/deleted`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal memuat log surat terhapus.' };
      }
      return { success: true, data: json.data || [] };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async restoreDeletedServiceRequest(id: string): Promise<{ success: boolean; data?: ServiceRequest; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests/deleted/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal memulihkan permohonan surat.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async permanentlyDeleteServiceRequestLog(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests/deleted/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal membersihkan log surat terhapus.' };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async clearAllDeletedServiceRequests(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/requests/deleted/clear-all`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal mengosongkan seluruh log surat terhapus.' };
      }
      return { success: true, message: json.message };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async respondComplaint(id: string, response: string, status?: string, fotoBuktiPenyelesaian?: string, catatanTindakLanjut?: string): Promise<{ success: boolean; data?: Complaint; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/complaints/${id}/respond`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ response, status, fotoBuktiPenyelesaian, catatanTindakLanjut })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal menanggapi aduan.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addNews(article: Partial<NewsItem>): Promise<{ success: boolean; data?: NewsItem; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/news`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(article)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateNews(id: string, updates: Partial<NewsItem>): Promise<{ success: boolean; data?: NewsItem; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/news/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteNews(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/news/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addAnnouncement(ann: Partial<Announcement>): Promise<{ success: boolean; data?: Announcement; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/announcements`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(ann)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<{ success: boolean; data?: Announcement; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/announcements/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addAgenda(agenda: Partial<AgendaItem>): Promise<{ success: boolean; data?: AgendaItem; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/agendas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(agenda)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteAgenda(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/agendas/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addProject(project: Partial<DevelopmentProject>): Promise<{ success: boolean; data?: DevelopmentProject; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/projects`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(project)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateProject(id: string, updates: Partial<DevelopmentProject>): Promise<{ success: boolean; data?: DevelopmentProject; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/projects/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async toggleUmkm(id: string): Promise<{ success: boolean; data?: UmkmItem; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/umkm/${id}/verify`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const res = await fetch(`${BASE_URL}/admin/audit-logs`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async resetDatabase(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/reset-database`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, message: json.message, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // Officials Management
  async addOfficial(official: Partial<VillageOfficial>): Promise<{ success: boolean; data?: VillageOfficial; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/officials`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(official)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateOfficial(id: string, official: Partial<VillageOfficial>): Promise<{ success: boolean; data?: VillageOfficial; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/officials/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(official)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteOfficial(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/officials/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async changePassword(userId: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(userId)}/password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newPassword })
      });
      const json = await res.json();
      return { success: res.ok && json.success, message: json.message, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async getUsers(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/users`, { headers: getAuthHeaders() });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async createUser(data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateUser(id: string, data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      const json = await res.json();
      return { success: res.ok && json.success, data: json.data, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteUser(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, message: json.message, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // Village Profile & Letterhead Identity Management
  async getVillageProfile(): Promise<{ success: boolean; data?: VillageProfile; error?: string; message?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/public/profile`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: 'Respon server bukan JSON.', message: 'Respon server bukan JSON.' };
      }
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error || json.message, message: json.message };
      return { success: true, data: json.data, message: json.message };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err), message: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateVillageProfile(profile: Partial<VillageProfile>): Promise<{ success: boolean; data?: VillageProfile; error?: string; message?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(profile)
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textError = await res.text().catch(() => '');
        console.warn('Server non-JSON response saat simpan profil desa:', textError.slice(0, 150));
        const statusMsg = res.status === 413
          ? 'Ukuran data profil desa/gambar melebihi batas (maksimal 10MB). Silakan kompres gambar sebelum menyimpan.'
          : !res.ok
          ? `Gagal terhubung ke server (HTTP ${res.status}).`
          : 'Respon dari server bukan format JSON yang valid.';
        return {
          success: false,
          message: statusMsg,
          error: statusMsg
        };
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          message: json.message || json.error || 'Gagal memperbarui profil desa.',
          error: json.error || json.message || 'Gagal memperbarui profil desa.'
        };
      }
      return { success: true, data: json.data, message: json.message };
    } catch (err: unknown) {
      console.warn('Exception saat updateVillageProfile:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const cleanErrMsg = errMsg.includes('JSON') || errMsg.includes('Unexpected token')
        ? 'Respon server tidak valid. Data disimpan secara lokal di peramban.'
        : (errMsg || 'Terjadi gangguan koneksi ke server.');
      return { success: false, message: cleanErrMsg, error: cleanErrMsg };
    }
  },

  async syncResidentProfile(): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/residents/sync-profile`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // Master Wilayah (Dusun -> RW -> RT)
  async getTerritories(): Promise<{ success: boolean; data?: DusunRecord[]; error?: string; message?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/public/territories`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: 'Respon server bukan JSON.', message: 'Respon server bukan JSON.' };
      }
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error, message: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err), message: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateTerritories(territories: DusunRecord[]): Promise<{ success: boolean; data?: DusunRecord[]; error?: string; message?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/territories`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ territories })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: 'Respon server bukan JSON.', message: 'Respon server bukan JSON.' };
      }
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error || json.message || 'Gagal menyimpan data wilayah.', message: json.message || json.error };
      return { success: true, data: json.data, message: json.message };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err), message: err instanceof Error ? err.message : String(err) };
    }
  },

  // Facilities Management
  async addFacility(facility: Partial<MapFacility>): Promise<{ success: boolean; data?: MapFacility; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/facilities`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(facility)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateFacility(id: string, facility: Partial<MapFacility>): Promise<{ success: boolean; data?: MapFacility; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/facilities/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(facility)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteFacility(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/facilities/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // WebGIS Land Parcels Management
  async getLandParcels(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/land-parcels`, {
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addLandParcel(data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/land-parcels`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updateLandParcel(id: string, data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/land-parcels/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteLandParcel(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/land-parcels/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // Projects & UMKM deletion
  async deleteProject(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/projects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async addUmkm(item: Partial<UmkmItem>): Promise<{ success: boolean; data?: UmkmItem; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/umkm`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(item)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteUmkm(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/umkm/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // 12. Potentials Management
  async addPotential(potential: Partial<VillagePotential>): Promise<{ success: boolean; data?: VillagePotential; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/potentials`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(potential)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async updatePotential(id: string, updates: Partial<VillagePotential>): Promise<{ success: boolean; data?: VillagePotential; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/potentials/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, error: json.error };
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deletePotential(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/admin/potentials/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      return { success: res.ok && json.success, error: json.error };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // 13. Gemini AI Smart Citizen Assistant
  async askAi(
    question: string, 
    history?: Array<{ role: 'user' | 'model'; content: string }>, 
    villageProfile?: VillageProfile, 
    userRole?: string,
    userName?: string,
    roleTitle?: string,
    gender?: string,
    birthDate?: string
  ): Promise<{
    success: boolean;
    data?: {
      answer: string;
      isAiLive: boolean;
      model: string;
    };
    error?: string;
  }> {
    try {
      const res = await fetch(`${BASE_URL}/ai/ask`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ question, history, villageProfile, userRole, userName, roleTitle, gender, birthDate })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal terhubung dengan layanan AI Desa.' };
      }
      return { success: true, data: json.data };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Koneksi ke asisten AI terputus.' };
    }
  },

  async analyzeDocument(imageBase64: string, mimeType: string, docType: string = 'ktp'): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${BASE_URL}/ai/ocr`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ imageBase64, mimeType, docType })
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Koneksi ke layanan OCR gagal.' };
    }
  },

  async textToSpeech(text: string, style: 'default' | 'maple' | 'panjul' | 'bolang' = 'default'): Promise<{ success: boolean; audio?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/ai/speak`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ text, style })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Gagal generate suara.' };
      }
      return { success: true, audio: json.audio };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) || 'Koneksi ke layanan suara gagal.' };
    }
  },

  // 14. Database Maintenance & Backup
  async getBackups(): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch(`${BASE_URL}/admin/maintenance/backups`, {
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async runBackup(): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${BASE_URL}/admin/maintenance/backups/run`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  async deleteBackup(filename: string): Promise<ApiResponse<unknown>> {
    try {
      const res = await fetch(`${BASE_URL}/admin/maintenance/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return processResponse(res);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};


