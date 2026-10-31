import { getLetterFormatConfig, LetterClass } from '../data/letterClassification';
import { getLetterVerificationUrl } from '../utils/qrHelper';

export interface SendWhatsAppNotificationParams {
  citizenName: string;
  serviceName: string;
  trackingCode: string;
  status: string; // 'diajukan' | 'diverifikasi' | 'disetujui' | 'selesai' | 'ditolak' | 'dibatalkan'
  phone?: string;
  adminNotes?: string;
  officialLetterNumber?: string;
  villageName?: string;
  district?: string;
  regency?: string;
  verificationUrl?: string;
  documentUrl?: string; // Tautan unduh / pratinjau dokumen PDF dinamis
  requirements?: string[]; // Daftar berkas persyaratan fisik spesifik per layanan
  isDraft?: boolean;
  isGatewayActive?: boolean; // Toggle status: true = Auto Gateway ON, false = Manual Fallback Mode
}

export interface WhatsAppNotificationResult {
  message: string;
  targetPhone: string;
  shareUrl: string;
  documentClass: 'A' | 'B';
  isDraft: boolean;
  statusLabel: string;
  isGatewayActive: boolean;
  documentUrl: string;
}

/**
 * ============================================================================
 * SADEWA WHATSAPP GATEWAY & NOTIFICATION ENGINE
 * ============================================================================
 * Standar Komunikasi & Notifikasi Resmi Birokrasi Digital Desa Pulau Betung
 * 
 * ATURAN DAN PROTOKOL:
 * 1. Salam Inklusif Nusantara (Wajib pada setiap pesan resmi):
 *    "Assalamu’alaikum warahmatullahi wabarakatuh, Shalom, Om Swastiastu, Namo Buddhaya, Salam Kebajikan."
 * 
 * 2. Logika Pemisahan Klasifikasi Surat (Kelas A vs Kelas B):
 *    - KELAS A (Sensitif & Hak Yuridis - SPORADIK, Ahli Waris, Paket Nikah N1-N4, SKU):
 *      Teks WhatsApp menyertakan Link Pratinjau Draf PDF ("DRAFT - BELUM SAH"),
 *      menghimbau warga datang ke Kantor Desa membawa berkas fisik asli (KTP, KK, Surat Pengantar RT/saksi)
 *      untuk cap stempel dan tanda tangan basah Kepala Desa.
 *    - KELAS B (Keterangan Umum / Administratif Rutin - SKTM, Domisili, Kelahiran, Kematian, dll):
 *      Teks WhatsApp menyertakan Link Unduh PDF Resmi sah ber-TTE/QR Code,
 *      sehingga dokumen dapat langsung diunduh serta dicetak mandiri oleh warga dengan kertas A4.
 * 
 * 3. Mode Manual / Cadangan (Gateway Toggle OFF):
 *      Menyediakan templat pesan birokrasi digital standar agar petugas desa dapat
 *      menyalin/mengirimkan konfirmasi bahwa berkas telah tercatat di arsip pusat SADEWA
 *      sesuai SOP manual kantor.
 */
export class WhatsAppService {
  /**
   * Salam Resmi Inklusif Kenegaraan / Nusantara
   */
  static readonly NUSANTARA_GREETING =
    "Assalamu’alaikum warahmatullahi wabarakatuh, Shalom, Om Swastiastu, Namo Buddhaya, Salam Kebajikan.";

  /**
   * Format nomor HP ke format standar internasional WA (62xxxxxxxx)
   */
  static formatPhoneNumber(phone: string = ''): string {
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      return `62${clean.slice(1)}`;
    }
    if (clean.startsWith('62')) {
      return clean;
    }
    return clean ? `62${clean}` : '';
  }

  /**
   * Bangun URL WhatsApp Web / Deep Link App dengan encodeURIComponent aman
   */
  static buildShareUrl(phone: string, message: string): string {
    const target = this.formatPhoneNumber(phone);
    const encoded = encodeURIComponent(message);
    return target ? `https://wa.me/${target}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }

  /**
   * Format Pesan Manual / Cadangan (Ketika Saklar Gateway OFF)
   */
  static generateManualFallbackMessage(params: {
    citizenName: string;
    serviceName: string;
    trackingCode: string;
    villageName?: string;
    documentUrl?: string;
  }): string {
    const {
      citizenName,
      serviceName,
      trackingCode,
      villageName = 'Pemerintah Desa',
      documentUrl
    } = params;

    const docUrlToUse = documentUrl || getLetterVerificationUrl(trackingCode);
    const docLinkSection = docUrlToUse ? `\n\n🔗 *Akses Portal Dokumen:* ${docUrlToUse}` : '';

    return `${this.NUSANTARA_GREETING}\n\n` +
      `Kepada Yth. Warga ${villageName} (*${citizenName}*),\n\n` +
      `Kami informasikan bahwa permohonan *${serviceName}* dengan Nomor Resi *${trackingCode}* telah selesai ditinjau dan dicatat dalam sistem arsip pusat SADEWA.${docLinkSection}\n\n` +
      `Mengingat sistem pengiriman otomatis sedang disesuaikan dengan SOP manual kantor, Anda dipersilakan untuk memantau status berkas secara berkala atau mendatangi Kantor ${villageName} pada jam kerja guna mengambil lembar fisik atau mendapatkan validasi lanjutan.\n\n` +
      `Demikian pemberitahuan resmi ini disampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.\n\n` +
      `_Pemerintah ${villageName} - Layanan Administrasi Digital SADEWA_`;
  }

  /**
   * Buat pesan WhatsApp resmi dan kembalikan metadata lengkap
   */
  static generateNotification(params: SendWhatsAppNotificationParams): WhatsAppNotificationResult {
    const {
      citizenName,
      serviceName,
      trackingCode,
      status,
      phone = '',
      adminNotes,
      officialLetterNumber,
      villageName = 'Pemerintah Desa',
      district = 'Kecamatan',
      regency = 'Kabupaten',
      verificationUrl,
      documentUrl,
      isGatewayActive = true
    } = params;

    const docUrlToUse = documentUrl || verificationUrl || getLetterVerificationUrl(trackingCode);
    const cleanStatus = (status || '').toLowerCase().trim();
    const letterConfig = getLetterFormatConfig(serviceName);
    const documentClass: 'A' | 'B' = (letterConfig.documentClass as 'A' | 'B') || (letterConfig.category === 'CLASS_A' ? 'A' : 'B');
    const isClassA = documentClass === 'A';

    // Jika Gateway Dinonaktifkan (Mode Manual / Cadangan)
    if (!isGatewayActive) {
      const manualMsg = this.generateManualFallbackMessage({
        citizenName,
        serviceName,
        trackingCode,
        villageName,
        documentUrl: docUrlToUse
      });
      const targetPhone = this.formatPhoneNumber(phone);
      const shareUrl = this.buildShareUrl(phone, manualMsg);

      return {
        message: manualMsg,
        targetPhone,
        shareUrl,
        documentClass,
        isDraft: isClassA,
        statusLabel: 'Mode Manual / Cadangan (SOP Kantor)',
        isGatewayActive: false,
        documentUrl: docUrlToUse
      };
    }

    // Status draf: jika belum berstatus 'selesai'/'disetujui' ATAU jika Kelas A (perlu legalisasi fisik desa)
    const isApprovedOrCompleted = cleanStatus.includes('selesai') ||
      cleanStatus.includes('disetujui') ||
      cleanStatus.includes('approved') ||
      cleanStatus.includes('terbit') ||
      cleanStatus.includes('completed');

    const isDraft = params.isDraft !== undefined
      ? params.isDraft
      : (!isApprovedOrCompleted || isClassA);

    let message = '';
    let statusLabel = 'Sedang Diproses';

    // =========================================================================
    // KONDISI 1: STATUS DITOLAK / REJECTED
    // =========================================================================
    if (cleanStatus.includes('tolak') || cleanStatus === 'ditolak' || cleanStatus === 'rejected') {
      statusLabel = 'Ditolak';
      const rawNote = adminNotes && adminNotes.trim()
        ? adminNotes.trim().replace(/\.+$/, '')
        : 'Persyaratan berkas belum lengkap atau data identitas belum sesuai';

      const docUrlSection = docUrlToUse ? `\n🔗 *Portal Perbaikan Berkas:* ${docUrlToUse}\n` : '';

      message = `${this.NUSANTARA_GREETING}\n\n` +
        `*PEMBERITAHUAN LAYANAN SADEWA*\n` +
        `Pemerintah ${villageName}, ${district}\n\n` +
        `Yth. Bpk/Ibu *${citizenName}*,\n\n` +
        `Permohonan surat dinas Anda:\n` +
        `📄 *Layanan:* ${serviceName}\n` +
        `🔖 *Kode Resi:* ${trackingCode}\n` +
        `❌ *Status:* DITOLAK / PERLU PERBAIKAN\n\n` +
        `📝 *Catatan Petugas Desa:*\n` +
        `"${rawNote}"\n\n` +
        `${docUrlSection}` +
        `Silakan mengajukan ulang berkas perbaikan melalui portal mandiri SADEWA atau datang langsung ke loket pelayanan Kantor ${villageName} pada jam kerja. Mohon maaf atas ketidaknyamanannya.\n\n` +
        `_Layanan Administrasi Digital & Efisiensi Warga (SADEWA)_`;
    }

    // =========================================================================
    // KONDISI 2: STATUS DIBATALKAN / TIDAK SAH
    // =========================================================================
    else if (
      cleanStatus.includes('batal') ||
      cleanStatus.includes('cabut') ||
      cleanStatus.includes('tidak sah') ||
      cleanStatus.includes('tidaksah') ||
      cleanStatus === 'dibatalkan' ||
      cleanStatus === 'cancelled'
    ) {
      statusLabel = 'Dibatalkan / Tidak Sah';
      const docUrlSection = docUrlToUse ? `\n🔗 *Link Cek Register Dokumen:* ${docUrlToUse}\n` : '';

      message = `${this.NUSANTARA_GREETING}\n\n` +
        `⚠️ *PERINGATAN PEMBATALAN DOKUMEN SADEWA*\n` +
        `Pemerintah ${villageName}, ${district}\n\n` +
        `Yth. Bpk/Ibu *${citizenName}*,\n\n` +
        `Dokumen surat dinas:\n` +
        `📄 *Layanan:* ${serviceName}\n` +
        `🔖 *Kode Resi:* ${trackingCode}\n` +
        `⛔ *Status:* DIBATALKAN / DICABUT\n\n` +
        `${docUrlSection}` +
        `Dokumen fisik maupun digital dengan nomor resi tersebut dinyatakan *TIDAK BERLAKU LAGI* dalam register resmi desa. Jika ada kekeliruan, silakan konfirmasi ke kantor desa.\n\n` +
        `_Pemerintah ${villageName}_`;
    }

    // =========================================================================
    // KONDISI 3: STATUS SELESAI / DISETUJUI
    // =========================================================================
    else if (isApprovedOrCompleted) {
      statusLabel = isClassA ? 'Disetujui (Wajib Pengesahan Fisik)' : 'Selesai & Sah (Cetak Mandiri)';
      const letterNumInfo = officialLetterNumber ? `\n📋 *Nomor Surat:* ${officialLetterNumber}` : '';
      const notesInfo = adminNotes && adminNotes.trim() ? `\n📌 *Catatan:* ${adminNotes.trim()}` : '';

      if (isClassA) {
        // DOKUMEN KELAS A: Dokumen Sensitif / Hak Milik / Peristiwa Hukum (SPORADIK, Waris, Nikah, SKU)
        const docUrlSection = docUrlToUse ? `\n🔗 *Link Pratinjau Draf PDF (Watermark):*\n${docUrlToUse}\n` : '';

        // Tentukan daftar persyaratan fisik secara modular dan spesifik per jenis layanan
        let requirementsListText = '';
        const specificReqs = (params.requirements && params.requirements.length > 0)
          ? params.requirements
          : (letterConfig.requirements && letterConfig.requirements.length > 0)
            ? letterConfig.requirements
            : null;

        if (specificReqs && specificReqs.length > 0) {
          requirementsListText = specificReqs.map((req, idx) => `   ${idx + 1}. ${req}`).join('\n');
        } else {
          requirementsListText = '   - Dokumen identitas asli (KTP & Kartu Keluarga)\n   - Surat pengantar RT setempat serta berkas pendukung fisik asli terkait';
        }

        message = `${this.NUSANTARA_GREETING}\n\n` +
          `*PEMBERITAHUAN RESMI LAYANAN SADEWA*\n` +
          `Pemerintah ${villageName}, ${district}\n\n` +
          `Yth. Bpk/Ibu *${citizenName}*,\n\n` +
          `Permohonan surat dinas Anda telah *DISETUJUI & SIAP PROSES AKHIR*:\n` +
          `📄 *Layanan:* ${serviceName} (Dokumen Kelas A - Sensitif / Hak Yuridis)\n` +
          `🔖 *Kode Resi:* ${trackingCode}${letterNumInfo}\n` +
          `⚠️ *Status Dokumen Digital:* DRAF BELUM SAH (Untuk Pengecekan Awal)${notesInfo}\n\n` +
          `${docUrlSection}` +
          `*PENTING - PENGESAHAN DOKUMEN KELAS A:*\n` +
          `File digital yang terlampir pada tautan portal berstatus *DRAF* dengan watermark *"DRAFT - BELUM SAH UNTUK KEPERLUAN LEGAL"*. Hal ini demi mencegah penyalahgunaan dokumen yuridis.\n\n` +
          `👉 *Langkah Selanjutnya:*\n` +
          `1. Silakan periksa kesesuaian data identitas, nomor NIK, dan rincian pada draf portal.\n` +
          `2. Datanglah ke Kantor ${villageName} pada jam kerja membawa dokumen persyaratan fisik asli:\n` +
          `${requirementsListText}\n` +
          `3. Petugas desa akan mencetak lembaran naskah dinas resmi untuk penandatanganan basah, stempel dinas, dan legalisasi akhir oleh Kepala Desa.\n\n` +
          `Terima kasih atas kerja samanya.\n\n` +
          `_Pemerintah ${villageName}_`;
      } else {
        // DOKUMEN KELAS B: Dokumen Keterangan Umum (SKTM, Domisili, Kelahiran, Kematian, Belum Menikah, dll)
        const docUrlSection = docUrlToUse ? `\n🔗 *Link Unduh PDF Resmi (TTE/QR Code):*\n${docUrlToUse}\n` : '';

        message = `${this.NUSANTARA_GREETING}\n\n` +
          `*PEMBERITAHUAN RESMI LAYANAN SADEWA*\n` +
          `Pemerintah ${villageName}, ${district}\n\n` +
          `Yth. Bpk/Ibu *${citizenName}*,\n\n` +
          `Permohonan surat dinas Anda telah *SELESAI & SAH TERBIT*:\n` +
          `📄 *Layanan:* ${serviceName} (Dokumen Kelas B - Umum / Administratif Rutin)\n` +
          `🔖 *Kode Resi:* ${trackingCode}${letterNumInfo}\n` +
          `✅ *Status:* SELESAI & TERVERIFIKASI TTE/QR CODE DESA${notesInfo}\n\n` +
          `${docUrlSection}` +
          `Dokumen resmi ini telah disahkan dan dilengkapi QR Code Validasi Elektronik resmi. Anda dapat *mengunduh dan mencetak langsung file PDF menggunakan kertas A4 tanpa perlu datang ke kantor desa* melalui Portal Warga SADEWA.\n\n` +
          `Terima kasih telah menggunakan layanan digital mandiri ${villageName}.\n\n` +
          `_Pemerintah ${villageName}_`;
      }
    }

    // =========================================================================
    // KONDISI 4: DEFAULT (DALAM PROSES VERIFIKASI AWAL)
    // =========================================================================
    else {
      statusLabel = 'Dalam Proses Verifikasi';
      const classNote = isClassA
        ? `\nℹ️ _Catatan: Dokumen ini termasuk Kelas A (Pertanahan/Hukum/Keluarga) yang memerlukan verifikasi fisik berkas asli di kantor desa sebelum penerbitan resmi._`
        : `\nℹ️ _Catatan: Dokumen ini termasuk Kelas B (Administratif Rutin) yang dapat diunduh & dicetak mandiri di rumah setelah selesai disetujui._`;

      const docUrlSection = docUrlToUse ? `\n🔗 *Link Lacak & Pratinjau:* ${docUrlToUse}\n` : '';

      message = `${this.NUSANTARA_GREETING}\n\n` +
        `*KONFIRMASI PENGAJUAN LAYANAN SADEWA*\n` +
        `Pemerintah ${villageName}, ${district}\n\n` +
        `Yth. Bpk/Ibu *${citizenName}*,\n\n` +
        `Pengajuan permohonan surat dinas Anda telah kami terima:\n` +
        `📄 *Layanan:* ${serviceName}\n` +
        `🔖 *Kode Resi:* ${trackingCode}\n` +
        `⏳ *Status:* SEDANG DIVERIFIKASI PETUGAS DESA${classNote}\n\n` +
        `${docUrlSection}` +
        `Anda dapat memantau progres permohonan secara berkala di Portal SADEWA dengan memasukkan Kode Resi di atas.\n\n` +
        `Terima kasih,\n` +
        `_Tim Pelayanan Administrasi ${villageName}_`;
    }

    const targetPhone = this.formatPhoneNumber(phone);
    const shareUrl = this.buildShareUrl(phone, message);

    return {
      message,
      targetPhone,
      shareUrl,
      documentClass,
      isDraft,
      statusLabel,
      isGatewayActive: true,
      documentUrl: docUrlToUse
    };
  }
}

/**
 * Helper kompatibilitas lama
 */
export function generateWAMessage(options: {
  citizenName: string;
  serviceName: string;
  trackingCode: string;
  status: string;
  category?: LetterClass | string;
  adminNotes?: string;
  officialLetterNumber?: string;
  villageName?: string;
  district?: string;
  regency?: string;
  verificationUrl?: string;
  documentUrl?: string;
  requirements?: string[];
  isDraft?: boolean;
  isGatewayActive?: boolean;
}): string {
  const res = WhatsAppService.generateNotification({
    citizenName: options.citizenName,
    serviceName: options.serviceName,
    trackingCode: options.trackingCode,
    status: options.status,
    adminNotes: options.adminNotes,
    officialLetterNumber: options.officialLetterNumber,
    villageName: options.villageName,
    district: options.district,
    regency: options.regency,
    verificationUrl: options.verificationUrl,
    documentUrl: options.documentUrl,
    requirements: options.requirements,
    isDraft: options.isDraft,
    isGatewayActive: options.isGatewayActive
  });
  return res.message;
}

export function buildWhatsAppShareUrl(phone: string, message: string): string {
  return WhatsAppService.buildShareUrl(phone, message);
}

export function formatPhoneNumberForWA(phone: string = ''): string {
  return WhatsAppService.formatPhoneNumber(phone);
}
