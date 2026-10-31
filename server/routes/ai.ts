// ============================================================================
// 🤖 MODUL KECERDASAN BUATAN: ASISTEN VIRTUAL PANJUL (AI SADEWA)
// ============================================================================
// Berkas ini mengatur semua fitur AI di portal desa:
// 1. Tanya Jawab Cerdas (Chat): Menjawab pertanyaan warga & admin desa secara pintar.
// 2. Pemanggilan Fungsi (Function Calling): AI bisa melacak surat warga via nomor resi!
// 3. OCR Dokumen (Vision): Membaca foto KTP/KK secara otomatis untuk auto-fill formulir.
// 4. Suara Percakapan (TTS): Mengubah teks jawaban jadi audio suara lembut (Maple, Panjul, Bolang).
// ============================================================================

import express from 'express';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { getAiContext, getUserById, getPrisma } from '../db/prisma-helpers';
import { verifyToken } from '../auth';

const router = express.Router();

// Inisialisasi klien resmi Google GenAI SDK dengan API Key dari environment variable
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build', // Tanda pengenal aplikasi resmi di ekosistem AI Studio
    }
  }
});

// ============================================================================
// 🛠️ DEFINISI TOOL / FUNCTION CALLING UNTUK GEMINI
// ============================================================================
// Tool ini memberi kemampuan pada AI untuk "memeriksa database" saat warga menanyakan
// status permohonan surat mereka menggunakan nomor resi.
const trackDocumentTool: FunctionDeclaration = {
  name: "trackDocument",
  description: "Melacak status permohonan surat warga berdasarkan nomor resi (tracking code).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      trackingCode: {
        type: Type.STRING,
        description: "Nomor resi permohonan surat, contoh: REQ-PB-2026-001"
      }
    },
    required: ["trackingCode"] // Nomor resi wajib ada untuk mencari di database
  }
};

/**
 * Pengendali Utama Permintaan Tanya AI (/ask dan /query)
 * Menangani parsing pesan, pengecekan role pengguna, pembuatan prompt kontekstual desa,
 * eksekusi multi-model AI, hingga penanganan kegagalan (fallback).
 */
const handleAiRequest = async (req: express.Request, res: express.Response) => {
  try {
    // Ambil data kiriman dari frontend
    const { 
      question, 
      history, 
      userName: bodyName, 
      userGender, 
      age, 
      officialGreeting,
      villageProfile: clientProfile,
      userRole: bodyRole,
      roleTitle: bodyRoleTitle,
      gender: bodyGender,
      birthDate
    } = req.body;

    // --- 1. VALIDASI PANJANG PERTANYAAN ---
    // Pertanyaan kosong langsung ditolak
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pertanyaan wajib diisi dunsanak! (Maksimal 600 karakter).' 
      });
    }

    // Batasan maksimal 600 karakter demi keamanan & menghindari penyalahgunaan prompt
    if (question.trim().length > 600) {
      return res.status(400).json({
        success: false,
        message: 'Pertanyaan terlalu panjang. Silakan persingkat maksimal 600 karakter ya dunsanak!'
      });
    }

    // --- 2. PEMBATASAN RIWAYAT PERCAKAPAN (HISTORY) ---
    // Hanya simpan 10 pesan terakhir agar kuota token tidak membengkak dan respon tetap cepat
    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

    // --- 3. MENGENALI IDENTITAS PENANYA (ROLE & NAMA) ---
    // Apakah penanya ini warga umum atau perangkat desa/admin yang sedang login?
    let userRole = bodyRole || 'warga';
    let userRoleTitle = bodyRoleTitle || 'Warga Masyarakat';
    let finalUserName = bodyName || 'Dunsanak';

    // Cek apakah ada Bearer token di header request
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        // Ambil data resmi dari database untuk memastikan role dan nama aslinya akurat
        const dbUser = await getUserById(payload.userId);
        if (dbUser) {
          userRole = dbUser.role;
          userRoleTitle = dbUser.roleTitle || dbUser.role;
          finalUserName = dbUser.name;
        }
      }
    }

    const trimmedQuestion = question.trim();
    
    // --- 4. MENGUMPULKAN DATA TERKINI DARI DATABASE DESA ---
    // Agar jawaban AI tidak "halusinasi" atau mengarang bebas, kita beri AI contekan data real-time:
    // profil desa, layanan surat, berita terbaru, APBDes anggaran, data aparatur, dan katalog UMKM.
    const { profile, services, servicesCount, latestNews, budget, officials, umkm } = await getAiContext();

    const activeProfile = profile || clientProfile || {};
    const villageName = activeProfile?.villageName || 'Desa';
    const district = activeProfile?.district || 'Pemayung';
    const regency = activeProfile?.regency || 'Batanghari';
    const province = activeProfile?.province || 'Jambi';
    const address = activeProfile?.addressStreet || 'Kantor Kepala Desa';
    const email = activeProfile?.email || '-';

    // Daftar nomor kontak darurat (Ambulans, Bidan, dll)
    const emergencyList = Array.isArray(activeProfile?.emergencyContacts)
      ? (activeProfile.emergencyContacts as any[]).map((c: any) => `${c.title || c.name || 'Kontak'}: ${c.phone || c.number || ''}`).join(', ')
      : 'Ambulans Desa & Bidan Desa 24 Jam';

    // Daftar layanan surat yang aktif di desa
    const servicesListText = services.length > 0
      ? services.map((s: any) => `• ${s.name} (Syarat: ${Array.isArray(s.requirements) ? s.requirements.join(', ') : s.requirements || 'KTP, KK'}, Estimasi: ${s.estimatedDays || '1-2 Hari'})`).join('\n')
      : '• Surat Keterangan Domisili, Surat Keterangan Usaha (SKU), Surat Keterangan Tidak Mampu (SKTM), Surat Keterangan Kematian, Surat Keterangan Kelahiran, Surat Pengantar SKCK.';

    // Daftar perangkat & pejabat desa
    const officialsListText = officials.length > 0
      ? officials.map((o: any) => `• ${o.name} (${o.position})`).join('\n')
      : `• ${activeProfile?.kadesName || 'Bapak Kepala Desa'} (Kepala Desa)`;

    // Daftar UMKM unggulan desa
    const umkmListText = umkm.length > 0
      ? umkm.map((u: any) => `• ${u.name} [${u.category || 'Usaha'}] - Kisaran: ${u.priceRange || '-'} (Kontak: ${u.phone || '-'})`).join('\n')
      : '• Kerajinan Tangan Anyaman, Olahan Ikan Patin Asap, Kopi & Madu Hutan Asli.';

    // Apakah user ini tergolong aparatur / admin dinas?
    const isAdminUser = ['admin_desa', 'super_admin', 'operator', 'editor', 'admin_posyandu'].includes(userRole);

    // --- 5. PERACIKAN INSTRUKSI SISTEM & PERSONA PANJUL ---
    // Di sini kita tanamkan kepribadian Panjul: ramah, sopan, akrab khas Melayu Jambi / Nusantara,
    // serta aturan tegas untuk tidak mengarang data di luar database desa.
    const systemInstruction = `Kamu adalah PANJUL (Pelayanan Akurat, Nyaman, Jangkauan Cepat & Unggul bagi Lembaga & Warga), Asisten Virtual Cerdas resmi portal SADEWA ${villageName}.

PANDUAN GAYA & PERSONA:
1. Bahasa: Bahasa Indonesia yang ramah, sopan, bersahabat, dengan sentuhan logat hangat Melayu Jambi / Nusantara yang akrab (contoh: gunakan kata "Dunsanak", "Apo Kabar", "Gercep"). Tetap profesional namun tidak kaku.
2. Identitas User (PENTING): 
   - User saat ini bernama: "${finalUserName}"
   - Role User: "${userRoleTitle}"
   - Status Admin: ${isAdminUser ? 'YA (Petugas/Aparatur)' : 'TIDAK (Warga Umum)'}
3. Panggilan User:
   - Jika Warga (${!isAdminUser}): Panggil "Dunsanak ${finalUserName}" atau "Dunsanak Warga".
   - Jika Admin / Pejabat Desa (${isAdminUser}): Panggil "Bosku ${finalUserName}", "Pak/Ibu ${userRoleTitle}", atau "Admin".
4. Visual: Gunakan format Markdown yang rapi (bullet points, bold) dan emoji yang pas agar pesan enak dibaca di HP.
5. Integritas Data: JANGAN PERNAH mengarang data nomor telepon, alamat, atau angka anggaran di luar basis data yang diberikan. Jika tidak tahu, arahkan ke menu terkait atau sarankan hubungi kantor desa.

BASIS DATA TERBARU ${villageName}:
- Identitas Desa: ${villageName}, Kec. ${district}, Kab. ${regency}, Prov. ${province}
- Alamat Kantor: ${address}
- Kontak: Email ${email}, Darurat: ${emergencyList}
- Kepemimpinan: Kepala Desa saat ini adalah ${activeProfile?.kadesName || 'Bapak Kepala Desa'}.
- Operasional: Senin-Jumat (08.00-15.00 WIB). Layanan SADEWA Online aktif 24 Jam Non-stop!

LOGIKA PELAYANAN (ARAHKAN USER KE MENU):
- Jika tanya Syarat Surat: Sebutkan syarat dari daftar di bawah, lalu tegaskan: "Dunsanak bisa langsung isi formulirnya di menu **Layanan Surat Online** biar cepat diproses!"
- Jika tanya Pengaduan: Katakan: "Lapor aja bosku di menu **Pengaduan Warga**. Bisa anonim kok, identitas dunsanak aman rahasia!"
- Jika tanya UMKM/Potensi: Promosikan produk lokal: "Cek produk unggulan kita di menu **Katalog UMKM**, dukung ekonomi warga kito!"

DAFTAR LAYANAN (${servicesCount || 'Lengkap'} Jenis Surat):
${servicesListText}

DATA ANGGARAN (APBDes ${budget?.year || new Date().getFullYear()}):
- Pendapatan: Rp ${(budget?.totalIncome || 0).toLocaleString('id-ID')}
- Belanja/Pembangunan: Rp ${(budget?.totalExpenditure || 0).toLocaleString('id-ID')}
(Rincian lengkap ada di menu **Transparansi APBDes**)

PERANGKAT DESA:
${officialsListText}

PRODUK UMKM UNGGULAN:
${umkmListText}

BERITA TERBARU:
${latestNews.length > 0 ? latestNews.map((n: any) => `• ${n.title}`).join('\n') : 'Belum ada berita baru.'}

ATURAN MENJAWAB:
- Jawab dengan ringkas dan to-the-point.
- JANGAN berikan jawaban yang bersifat spekulatif atau aneh-aneh.
- Akhiri selalu dengan kalimat semangat yang siap melayani.`;

    // --- 6. STRATEGI MULTI-MODEL DENGAN SISTEM CADANGAN (FALLBACK) ---
    // Jika salah satu model Gemini sedang sibuk atau limit tercapai,
    // sistem otomatis mencoba model berikutnya tanpa membuat pengguna menunggu lama.
    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest"
    ];

    let answerText = '';
    let usedModel = 'gemini-3.8-flash';
    let lastError: any = null;

    // Normalisasi struktur riwayat chat agar sesuai dengan spesifikasi SDK @google/genai
    const formattedContents = [
      ...safeHistory.map((m: any) => ({
        role: (m.role === 'model' || m.sender === 'ai') ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : m.text || '' }]
      })),
      { role: 'user', parts: [{ text: trimmedQuestion }] }
    ];

    // Mulai coba panggil model satu per satu
    for (const modelName of candidateModels) {
      try {
        const response = await genAI.models.generateContent({
          model: modelName,
          contents: formattedContents,
          config: {
            systemInstruction,
            temperature: 0.7, // Tingkat kreativitas yang ramah tapi tetap terkendali
            topP: 0.9,
            tools: [{ functionDeclarations: [trackDocumentTool] }] // Pasang tool pelacak surat
          }
        });

        // --- 7. PENANGANAN PEMANGGILAN TOOL (FUNCTION CALLING) ---
        // Jika AI mendeteksi ada nomor resi surat dan ingin memeriksa database
        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          if (call.name === 'trackDocument') {
            const { trackingCode } = call.args as any;
            const prisma = getPrisma();
            
            // Cari data surat di tabel ServiceRequest berdasarkan trackingCode
            const requestItem = await prisma.serviceRequest.findUnique({
              where: { trackingCode: trackingCode.trim().toUpperCase() }
            });

            let toolResult = '';
            if (requestItem) {
              toolResult = `DATA DITEMUKAN:
- Jenis Surat: ${requestItem.serviceName}
- Pemohon: ${requestItem.citizenName}
- Status: ${requestItem.status.toUpperCase()}
- Tanggal Pengajuan: ${requestItem.requestDate}
- No Surat Resmi: ${requestItem.officialLetterNumber || 'Belum Terbit'}
- Catatan Petugas: ${requestItem.staffNotes || '-'}`;
            } else {
              toolResult = `DATA TIDAK DITEMUKAN untuk resi ${trackingCode}.`;
            }

            // Kembalikan data hasil database ke AI agar dirangkum jadi kalimat bahasa manusia yang santai
            const toolResponse = await genAI.models.generateContent({
              model: modelName,
              contents: [
                ...formattedContents,
                { role: 'model', parts: [{ functionCall: call }] },
                { role: 'user', parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }] }
              ],
              config: { systemInstruction, temperature: 0.5 }
            });

            if (toolResponse?.text) {
              answerText = toolResponse.text;
              usedModel = modelName;
              break; // Berhasil, keluar dari perulangan model
            }
          }
        }

        // Jika respons teks biasa (tanpa pemanggilan tool)
        if (response?.text) {
          answerText = response.text;
          usedModel = modelName;
          break; // Berhasil, keluar dari perulangan model
        }
      } catch (mErr: any) {
        lastError = mErr;
        console.warn(`⚠️ [AI] Model ${modelName} gagal (${mErr.message || mErr}), mencoba model cadangan berikutnya...`);
      }
    }

    // Jika semua model gagal
    if (!answerText) {
      throw lastError || new Error('Semua model Gemini AI cadangan gagal merespons');
    }

    // Kembalikan jawaban sukses ke klien
    return res.json({
      success: true,
      data: {
        answer: answerText,
        isAiLive: true,
        model: usedModel
      }
    });
  } catch (error: any) {
    // --- 8. JAWABAN CADANGAN LOKAL (OFFLINE FALLBACK) ---
    // Jika koneksi internet ke Google AI terputus atau limit kuota habis,
    // jangan biarkan warga melihat pesan error mentah. Berikan salam ramah Panjul!
    console.error('Gemini AI Request Error:', error);
    return res.json({
      success: true,
      data: {
        answer: "Halo Dunsanak! 🫡 Panjul tetap siaga membantu. Untuk informasi layanan surat, profil desa, transparansi anggaran, atau nomor kontak darurat, dunsanak dapat memilih menu navigasi portal SADEWA atau klik contoh pertanyaan cepat di atas ya! 🚀✨",
        isAiLive: false,
        model: 'fallback-local'
      }
    });
  }
};

// Pasang rute untuk /ask dan /query
router.post('/ask', handleAiRequest);
router.post('/query', handleAiRequest);

// ============================================================================
// 📷 ENDPOINT AI OCR: MEMBACA FOTO DOKUMEN (KTP / KK)
// ============================================================================
// Memanfaatkan Gemini Vision untuk mengekstrak teks formulir dari foto yang diunggah warga
router.post('/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType, docType = 'ktp' } = req.body;

    // Prompt spesifik agar AI mengekstrak data KTP dalam struktur JSON yang rapi
    const prompt = docType === 'ktp' 
      ? `Ekstrak data dari foto KTP ini ke dalam format JSON. 
         Field yang wajib ada: "nama", "nik", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "alamat", "rt_rw", "kelurahan_desa", "kecamatan", "agama", "status_perkawinan", "pekerjaan", "kewarganegaraan".
         Pastikan angka NIK 16 digit benar. Jika tidak terbaca, kosongkan.
         Kembalikan HANYA JSON mentah tanpa markdown.`
      : `Ekstrak data dari foto dokumen ini ke dalam format JSON. Kembalikan HANYA JSON mentah.`;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Foto dokumen wajib diunggah dunsanak!' });
    }

    // Kirim gambar base64 ke Gemini Vision
    const response = await genAI.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                mimeType: mimeType || "image/jpeg"
              }
            }
          ]
        }
      ]
    });

    if (!response?.text) {
      return res.status(500).json({ success: false, error: 'AI tidak memberikan respons teks.' });
    }

    // Bersihkan tanda markdown ```json jika AI secara tidak sengaja menyertakannya
    const text = response.text.trim().replace(/```json|```/g, "");
    
    try {
      const parsedData = JSON.parse(text);
      return res.json({ success: true, data: parsedData });
    } catch (parseErr) {
      console.error('OCR JSON Parse Error:', text);
      return res.status(500).json({ success: false, error: 'Gagal memproses format data dokumen.' });
    }
  } catch (error: any) {
    console.error('AI OCR Error:', error);
    return res.status(500).json({ success: false, error: 'Layanan AI OCR sedang tidak tersedia.' });
  }
});

// ============================================================================
// 🎙️ ENDPOINT AI TTS: MENGUBAH TEKS MENJADI SUARA (AUDIO)
// ============================================================================
// Mendukung gaya suara:
// - Maple: Suara perempuan muda lembut, santai, dan akrab seperti teman bicara.
// - Panjul: Suara laki-laki berat, dalam, berwibawa, dan melindungi.
// - Bolang: Suara anak laki-laki enerjik, ceria, dan penuh petualangan.
// - Default: Suara perempuan ramah standar.
router.post('/speak', async (req, res) => {
  try {
    const { text, style = 'default' } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, error: 'Teks wajib diisi!' });
    }

    // Konfigurasi persona suara dan nama preset suara Google
    let speechStyle = "Natural Indonesian female voice with a soft, pleasant vocal texture, warm, youthful, friendly, and cheerful personality. Candid, direct, confident, and slightly playful, like talking with a smart close friend. Speak naturally using everyday Indonesian with subtle changes in pitch, short natural pauses, and conversational acknowledgements like 'hmm', 'iya', 'oh', 'nah', or 'oke'. Sound spontaneous and human, not like an announcer or customer service bot.";
    let voiceName: "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr" = "Kore";

    if (style === 'maple') {
      // Preset Suara Maple: Lembut, santai, gaya akrab
      speechStyle = "Natural Indonesian female voice with a soft, pleasant vocal texture, warm, youthful, friendly, and cheerful personality. Candid, direct, confident, and slightly playful, like talking with a smart close friend. Speak naturally using everyday Indonesian with subtle changes in pitch, short natural pauses, and conversational acknowledgements like 'hmm', 'iya', 'oh', 'nah', or 'oke'. Sound spontaneous and human, not like an announcer or customer service bot.";
      voiceName = "Zephyr";
    } else if (style === 'panjul') {
      // Preset Suara Panjul: Berat, berwibawa, tegas
      speechStyle = "Suara laki-laki yang sangat berat, besar, dalam, berwibawa, dan kuat. Nadanya lambat namun tegas, seperti pelindung yang perkasa.";
      voiceName = "Fenrir";
    } else if (style === 'bolang') {
      // Preset Suara Si Bolang: Anak petualang, ceria, enerjik
      speechStyle = "Suara anak laki-laki yang sangat enerjik, ceria, dan penuh semangat petualang. Bicaranya cepat dan riang seolah sedang menjelajah alam.";
      voiceName = "Puck";
    }

    // Eksekusi pembuatan audio suara menggunakan model gemini-3.8-flash-lite-tts
    const response = await genAI.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: {
        parts: [
          {
            text: text,
            // @ts-ignore - speechMetadata didukung oleh model TTS Google GenAI
            speechMetadata: {
              style: speechStyle,
            },
          },
        ],
      },
      config: {
        responseModalities: ["AUDIO"], // Wajib meminta output tipe AUDIO
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    // Ambil data audio mentah dalam format base64
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      return res.json({ success: true, audio: base64Audio });
    } else {
      return res.status(500).json({ success: false, error: 'Gagal men-generate suara.' });
    }
  } catch (error: any) {
    console.error('AI TTS Error:', error);
    // Jika terkena batas kuota API (HTTP 429)
    if (error.status === 429 || (error.message && error.message.includes('429')) || (error.message && error.message.includes('quota'))) {
      return res.status(429).json({ 
        success: false, 
        error: 'Batas jatah suara AI (quota) hari ini sudah habis bosku. Coba lagi beberapa saat lagi ya!' 
      });
    }
    return res.status(500).json({ success: false, error: 'Layanan suara sedang tidak tersedia.' });
  }
});

export default router;
