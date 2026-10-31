// ============================================================================
// 🤖 KOMPONEN ASISTEN VIRTUAL PANJUL (FLOATING AI WIDGET)
// ============================================================================
// Komponen ini menampilkan tombol melayang (floating button) di pojok kanan bawah
// yang dapat diklik oleh warga atau admin desa untuk membuka ruang obrolan cerdas.
// Fitur-fitur unggulannya:
// 1. Tanya Jawab Cerdas seputar syarat surat, jam kantor, anggaran APBDes, dll.
// 2. Input Suara (Voice-to-Text): Warga cukup bicara lewat mikrofon HP.
// 3. Audio Pembaca Jawaban (TTS): Menyuarakkan jawaban dengan pilihan karakter suara:
//    - Sadewi: Suara perempuan ramah standar.
//    - Maple: Suara perempuan muda super lembut & akrab.
//    - Panjul: Suara laki-laki berat berwibawa & gagah.
//    - Bolang: Suara bocah petualang ceria & lincah.
// 4. Jawaban Cadangan Offline (Local Fallback): Tetap bisa menjawab jika kuota API habis.
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, RefreshCw, MessageSquare, ChevronDown, Check, Copy, PhoneCall, ShieldAlert, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { EmergencySosModal } from './EmergencySosModal';

// Tipe data tiap gelembung pesan chat
interface Message {
  id: string;              // ID unik pesan
  sender: 'user' | 'ai';   // Pengirim: 'user' (warga) atau 'ai' (Panjul)
  text: string;            // Isi teks pesan
  time: string;            // Jam kirim (HH:mm)
  isLive?: boolean;        // Apakah jawaban berasal langsung dari Gemini AI aktif
}

export const VillageAiAssistant: React.FC = () => {
  // Ambil data desa dan info user yang sedang login dari AppContext
  const { villageProfile, currentUser, services, officials, budget, umkm, addToast } = useApp();

  // --- STATE-STATE MANAJEMEN UI CHAT ---
  const [isOpen, setIsOpen] = useState(false);            // Buka / tutup jendela popup chat
  const [isSosOpen, setIsSosOpen] = useState(false);      // Buka / tutup modal tombol darurat SOS
  const [input, setInput] = useState('');                 // Teks yang sedang diketik di kolom input
  const [isLoading, setIsLoading] = useState(false);      // Status sedang menunggu jawaban dari server
  const [isListening, setIsListening] = useState(false);  // Status mikrofon sedang mendengarkan suara user
  const [copiedId, setCopiedId] = useState<string | null>(null);     // ID pesan yang baru saja disalin
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null); // ID pesan yang suaranya sedang berbunyi
  
  // Pilihan karakter suara untuk TTS (Default / Sadewi, Maple, Panjul, Bolang)
  const [voiceStyle, setVoiceStyle] = useState<'default' | 'maple' | 'panjul' | 'bolang'>('default');
  
  // Referensi ke elemen Audio HTML5 untuk memutar dan menghentikan suara
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cek apakah pengguna saat ini adalah staf/aparatur desa yang punya hak akses khusus
  const isAdmin = currentUser?.role === 'admin_desa' || currentUser?.role === 'super_admin' || currentUser?.role === 'operator' || currentUser?.role === 'editor';

  // --- REKOMENDASI PERTANYAAN KILAT (QUICK PROMPTS) ---
  // Ditampilkan di carousel atas agar warga/admin tidak perlu mengetik panjang lebar
  const QUICK_PROMPTS = isAdmin ? [
    'Lacak surat REQ-PB-2026-001',
    'Bagaimana cara ganti logo desa?',
    'Cara impor file GeoJSON BPN?',
    'Cara cetak Baliho APBDes 3x2m?',
    'Gimana cara verifikasi dokumen warga?'
  ] : [
    'Lacak surat REQ-PB-2026-001',
    'Apa saja syarat permohonan Surat Domisili & SKU?',
    'Berapa anggaran Dana Desa (APBDes) tahun ini?',
    `Siapa Kepala ${villageProfile.villageName || 'Desa'} saat ini?`,
    'Bagaimana cara lapor pengaduan warga?'
  ];

  // Kalimat salam pembuka yang ramah dan membedakan antara Warga vs Perangkat Desa
  const greetingMessage = isAdmin 
    ? `Siap 86 Bosku Pejabat ${villageProfile.villageName || 'Desa'}! 🫡 Panjul di sini, siap bantu beresin semua kerjaan sistem SADEWA hari ini biar gercep! 🚀 Mau nanya fitur, benerin error, atau ada perintah apa nih Bosku?`
    : `Halo Dunsanak Warga ${villageProfile.villageName || 'Desa'}! 👋 Kenalin, nama saya PANJUL. 🚀 Panjul siap bantu urus surat, cek duit desa, atau cari info apa aja biar urusan dunsanak beres tanpa pening! Ada yang bisa Panjul bantu?`;

  /**
   * Generator Jawaban Cerdas Offline (Local Fallback)
   * Jika server API tidak bisa dihubungi atau kuota Gemini AI sedang habis,
   * fungsi ini akan membaca kata kunci pertanyaan dan menyusun jawaban akurat
   * dari data yang tersimpan di memori browser.
   */
  const fallbackLocalAnswer = (question: string) => {
    const q = question.toLowerCase();
    const villageName = villageProfile?.villageName || 'Desa';
    
    // Panduan kerja khusus admin
    if (isAdmin && (q.includes('cara') || q.includes('ganti') || q.includes('error') || q.includes('cetak') || q.includes('impor'))) {
      return `Halo bosku Admin ${villageName}! 👋 Sebagai PANJUL, siap bantu beresin kerjaan! 🚀 Ini panduan kilatnya:
• **Ganti Logo/Profil**: Langsung aja ke menu **Profil Desa**, klik tombol **Edit**, terus upload gambar baru yang cakep.
• **Impor GeoJSON**: Gas ke menu **WebGIS & Peta Desa**, cari tombol **Impor Peta GeoJSON**.
• **Cetak Baliho**: Ke menu **Transparansi APBDes**, trus klik **Generator Baliho**. Bisa langsung cetak ukuran 3x2m!
• **Ada Error?**: Cek lagi format datanya ya bosku. Kalau masih bingung, tanya Panjul lagi aja!`;
    }

    // Informasi syarat pembuatan surat
    if (q.includes('syarat') || q.includes('bikin surat') || q.includes('buat surat') || q.includes('surat apa saja') || q.includes('layanan')) {
      const list = services.slice(0, 5).map(s => `• **${s.name}**: ${s.requirements.slice(0, 3).join(', ')} (Beres dalam ${s.estimatedDays})`).join('\n');
      return `Halo dunsanak Warga ${villageName}! 👋 Mau urus surat ya? Tenang, Panjul bantu biar nggak ribet! 🚀
Bisa langsung ajuin online lewat menu **Layanan Surat** lho. Ini beberapa layanannya:

${list}

Nanti dapet **Nomor Resi** buat pantau statusnya. Mantap kan?`;
    }

    // Informasi kepala desa dan perangkat
    if (q.includes('kepala desa') || q.includes('kades') || q.includes('perangkat') || q.includes('aparatur')) {
      const kades = officials.find(o => o.position.toLowerCase().includes('kepala desa')) || officials[0];
      return `Pemerintah ${villageName} saat ini dipimpin oleh **Bapak ${kades ? kades.name : 'Kepala Desa'}** (${kades ? kades.position : 'Kepala Desa'}). Beliau orangnya asik kok! Daftar lengkap perangkat desa lainnya bisa dunsanak liat di menu **Pemerintahan Desa** ya.`;
    }

    // Informasi jam operasional kantor desa
    if (q.includes('jam') || q.includes('buka') || q.includes('tutup') || q.includes('operasional') || q.includes('jadwal kantor')) {
      return `Catat ya dunsanak, jadwal Kantor ${villageName}:
• **Senin – Kamis**: 08.00 – 15.00 WIB
• **Jumat**: 08.00 – 15.00 WIB (Istirahat Sholat Jumat)
• **Sabtu & Minggu**: Libur tatap muka, tapi kalau mau ajuin surat lewat web ini, Panjul siaga **24 JAM!** 🔥`;
    }

    // Informasi transparansi anggaran APBDes
    if (q.includes('anggaran') || q.includes('apbdes') || q.includes('dana desa') || q.includes('keuangan')) {
      return `Transparansi keuangan ${villageName} Tahun ${budget.year}:
• **Total Pendapatan**: Rp ${budget.totalIncome.toLocaleString('id-ID')}
• **Total Belanja Realisasi**: Rp ${budget.totalExpenditure.toLocaleString('id-ID')}

Rincian lengkap duit desa dipake buat apa aja bisa dunsanak liat langsung di tab **Transparansi APBDes**. Terbuka buat siapa aja!`;
    }

    // Informasi kontak dan darurat
    if (q.includes('kontak') || q.includes('telepon') || q.includes('wa') || q.includes('alamat') || q.includes('darurat') || q.includes('ambulans')) {
      return `Butuh bantuan cepat? Ini kontak ${villageName}:
• **Alamat**: ${villageProfile.addressStreet || '-'}
• **Email**: ${villageProfile.email || '-'}
• **Darurat**: Ambulans & Bidan Desa siaga 24 Jam. Hubungi nomor darurat di banner atas web ini ya dunsanak!`;
    }

    // Promosi produk UMKM warga
    if (q.includes('umkm') || q.includes('usaha') || q.includes('produk') || q.includes('ikan') || q.includes('kerajinan')) {
      const umkmList = umkm.slice(0, 3).map(u => `• **${u.name}** (${u.category}): ${u.priceRange} - Kontak: ${u.phone}`).join('\n');
      return `Ayo borong produk warga ${villageName}! 😍 Ini beberapa UMKM di desa kita:
${umkmList}

Selengkapnya cek di menu **UMKM Desa** ya!`;
    }

    // Cara pengaduan warga
    if (q.includes('lapor') || q.includes('aduan') || q.includes('keluhan') || q.includes('masalah')) {
      return `Ada masalah? Laporin aja bosku lewat menu **Pengaduan Warga**. 📣 Bisa anonim (rahasiain nama) kok. Nanti dapet **Nomor Tiket** buat pantau sejauh mana laporan dunsanak diberesin.`;
    }

    return greetingMessage;
  };

  // Daftar seluruh pesan dalam obrolan saat ini
  const [messages, setMessages] = useState<Message[]>([]);

  // Tampilkan pesan pembuka pertama kali saat komponen dibuka atau saat role berganti
  useEffect(() => {
    setMessages([
      {
        id: `msg-welcome-${currentUser?.id || 'public'}`,
        sender: 'ai',
        text: greetingMessage,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        isLive: true
      }
    ]);
  }, [currentUser?.id, villageProfile.villageName]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gulir otomatis ke bagian pesan terbawah
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fokuskan kursor ke input saat jendela chat dibuka
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  /**
   * Mengirim pertanyaan ke API AI Panjul
   * @param queryText Pertanyaan langsung (misal saat klik tombol contoh pertanyaan)
   */
  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input.trim();
    if (!textToSend || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Masukkan pertanyaan pengguna ke daftar gelembung chat
    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, sender: 'user', text: textToSend, time: userTime }
    ];

    setMessages(newMessages);
    if (!queryText) setInput('');
    setIsLoading(true);

    try {
      // Bungkus 6 pesan terakhir sebagai konteks riwayat percakapan
      const historyPayload = newMessages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        content: m.text
      }));

      const userRole = currentUser?.role || 'warga';
      const userName = currentUser?.name || '';
      const roleTitle = currentUser?.roleTitle || '';
      const gender = currentUser?.gender;
      const birthDate = currentUser?.birthDate;
      
      // Panggil endpoint /api/ai/ask via service api
      const res = await api.askAi(textToSend, historyPayload, villageProfile, userRole, userName, roleTitle, gender, birthDate);
      const aiTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      if (res.success && res.data) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: res.data!.answer,
            time: aiTime,
            isLive: res.data!.isAiLive
          }
        ]);
      } else {
        // Jika server mengembalikan respon gagal, pakai generator jawaban lokal
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: fallbackLocalAnswer(textToSend),
            time: aiTime,
            isLive: false
          }
        ]);
      }
    } catch {
      // Jika terjadi error koneksi jaringan / internet putus, tangkap dan pakai fallback
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: fallbackLocalAnswer(textToSend),
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          isLive: false
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mengaktifkan Perekaman Suara Mikrofon (Speech-to-Text via Web Speech API)
   * Menggunakan pengenal suara bahasa Indonesia ('id-ID').
   * Hasil ucapan warga langsung diubah jadi teks di kotak input.
   */
  const startVoiceInput = () => {
    // Periksa apakah browser mendukung Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('speechRecognition' in window)) {
      addToast('warning', 'Browser Tidak Mendukung', 'Fitur suara tidak didukung di browser ini dunsanak. Gunakan Google Chrome atau Microsoft Edge ya!');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; // Bahasa Indonesia
    recognition.continuous = false; // Berhenti otomatis setelah satu kalimat selesai diucapkan
    recognition.interimResults = false; // Hanya ambil hasil final yang akurat

    // Saat mic mulai merekam
    recognition.onstart = () => {
      setIsListening(true);
      // Getar singkat di HP Android untuk memberi tahu pengguna mic sudah aktif
      if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    };

    // Saat ucapan suara berhasil diubah jadi teks
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript); // Pasang hasil ke kotak input
      setIsListening(false);
    };

    // Saat terjadi error perekaman
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      if (event.error === 'aborted') return; // Abaikan jika dibatalkan secara normal
      addToast('error', 'Gagal Mendengar', 'Maaf, Panjul kurang jelas denger suara dunsanak. Coba lagi ya!');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  /**
   * Menyalin teks jawaban ke clipboard HP / Komputer
   */
  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000); // Tampilkan ikon centang selama 2 detik
  };

  /**
   * Memutar suara jawaban AI menggunakan layanan Gemini TTS (Text-to-Speech)
   * @param id ID pesan yang suaranya ingin didengarkan
   * @param text Teks jawaban yang akan dibacakan
   */
  const playVoice = async (id: string, text: string) => {
    // Jika tombol speaker pada pesan yang sama diklik lagi saat sedang bunyi, hentikan pemutaran
    if (isPlayingId === id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingId(null);
      return;
    }

    // Hentikan suara sebelumnya jika ada yang masih berbunyi
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsPlayingId(id);
    try {
      // Bersihkan tanda markdown (*, _, #, bullet) agar tidak terbaca aneh oleh mesin suara
      const cleanText = text.replace(/[*_#]/g, '').replace(/•/g, ',').slice(0, 500);
      
      // Minta data audio base64 ke endpoint server /api/ai/speak
      const res = await api.textToSpeech(cleanText, voiceStyle);
      if (res.success && res.audio) {
        // Buat objek Audio dari data audio WAV base64
        const audio = new Audio(`data:audio/wav;base64,${res.audio}`);
        audioRef.current = audio;
        
        // Reset status playing jika audio sudah selesai berbunyi
        audio.onended = () => setIsPlayingId(null);
        audio.onerror = () => {
          setIsPlayingId(null);
          addToast('error', 'Gagal Memutar', 'Maaf bosku, audionya gak mau bunyi.');
        };
        await audio.play();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.error('TTS Playback Error:', err);
      setIsPlayingId(null);
      addToast('error', 'Gagal Generate Suara', 'Koneksi ke layanan suara Panjul lagi batuk nih bos.');
    }
  };

  /**
   * Mengosongkan riwayat obrolan dan memulai percakapan baru dari awal
   */
  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'ai',
        text: `Percakapan telah direset bosku. Silakan ajukan pertanyaan seputar administrasi dan informasi ${villageProfile.villageName || 'Desa'}.`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        isLive: true
      }
    ]);
  };

  return (
    <>
      {/* Floating Action Cluster: Emergency SOS & PANJUL Assistant */}
      <div className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[120] flex flex-col items-end gap-2.5 sm:gap-3 print:hidden">
        {/* Floating Emergency SOS Button */}
        <button
          onClick={() => setIsSosOpen(true)}
          aria-label="Panggilan Darurat SOS"
          title="Kontak Cepat Siaga Darurat 24 Jam"
          className="group relative flex items-center gap-2 bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 hover:from-rose-500 hover:to-red-600 text-white px-2.5 sm:px-4 py-2 sm:py-3.5 rounded-full shadow-2xl border-2 border-rose-400/40 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-rose-400/40 cursor-pointer"
          id="btn-floating-sos"
        >
          <div className="relative w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center bg-white/20 rounded-full shrink-0">
            <PhoneCall className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-300 group-hover:animate-bounce" />
            <span className="absolute -top-1 -right-1 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-amber-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-amber-400 rounded-full border border-rose-700" />
          </div>
          <div className="text-left hidden sm:block">
            <span className="block text-xs font-black tracking-wider uppercase text-white">SOS Darurat</span>
            <span className="block text-[10px] text-rose-100 font-medium leading-none">Kontak Siaga 24 Jam</span>
          </div>
          <span className="text-xs font-black uppercase sm:hidden pr-1">SOS</span>
        </button>

        {/* Floating PANJUL Launcher Button */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Buka PANJUL"
            className="group relative flex items-center gap-2 sm:gap-3 bg-emerald-700 hover:bg-emerald-800 text-white px-3 sm:pl-4 sm:pr-5 py-2 sm:py-3.5 rounded-full shadow-2xl border-2 border-emerald-500/30 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-300/50 cursor-pointer"
            id="btn-floating-panjul"
          >
            <div className="relative w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center bg-white/20 rounded-full shrink-0">
              <Bot className="w-4 sm:w-5 h-4 sm:h-5 text-amber-300 group-hover:rotate-12 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-amber-400 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-amber-400 rounded-full border border-emerald-700" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold tracking-wide sm:hidden pr-1">PANJUL</span>
              <span className="text-xs font-bold tracking-wide hidden sm:block">Tanya PANJUL</span>
              <span className="text-[10px] text-emerald-200 font-medium leading-none hidden sm:block">Bantuan Pelayanan 24 Jam</span>
            </div>
          </button>
        )}
      </div>

      {/* Emergency SOS Modal */}
      <EmergencySosModal isOpen={isSosOpen} onClose={() => setIsSosOpen(false)} />

      {/* Interactive Chat Window Modal */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[130] w-full sm:w-[420px] sm:max-w-[calc(100vw-32px)] h-full sm:h-[620px] sm:max-h-[85vh] bg-white sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200 print:hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-tight text-white">PANJUL</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-900/60 text-emerald-200 border border-emerald-500/30">
                    <Bot className="w-2.5 h-2.5 text-emerald-300" />
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Asisten Virtual {villageProfile.villageName || 'Desa'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                title="Mulai percakapan baru"
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Tutup jendela chat"
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronDown className="w-5 h-5 hidden sm:block" />
                <X className="w-5 h-5 sm:hidden" />
              </button>
            </div>
          </div>

          {/* Quick Questions Carousel */}
          <div className="bg-slate-50 border-b border-slate-200/70 px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-600 uppercase shrink-0 flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-emerald-600" />
              Contoh:
            </span>
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                disabled={isLoading}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors whitespace-nowrap shadow-2xs font-medium"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {messages.map((m) => {
              const isAi = m.sender === 'ai';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} group`}
                >
                  <div
                    className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                      isAi
                        ? 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
                        : 'bg-emerald-700 text-white rounded-tr-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line font-sans">
                      {m.text}
                    </div>

                    <div
                      className={`mt-1.5 flex items-center justify-between gap-3 text-[10px] ${
                        isAi ? 'text-slate-600' : 'text-emerald-200'
                      }`}
                    >
                      <span className="font-mono">{m.time}</span>
                      {isAi && (
                        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => playVoice(m.id, m.text)}
                            title={isPlayingId === m.id ? "Berhentikan suara" : "Dengarkan jawaban"}
                            className={`p-1 rounded transition-colors ${
                              isPlayingId === m.id 
                                ? 'bg-emerald-100 text-emerald-700 animate-pulse' 
                                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
                            }`}
                          >
                            {isPlayingId === m.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyText(m.id, m.text)}
                            title="Salin jawaban"
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-800"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Bot className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                    <span>Menghubungkan ke pangkalan data desa...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tanyakan syarat surat, profil desa, jadwal..."
                  disabled={isLoading}
                  className="w-full text-xs pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all text-slate-800 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={startVoiceInput}
                  disabled={isLoading}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isListening 
                      ? 'bg-rose-600 animate-pulse text-white shadow-lg' 
                      : 'bg-slate-200 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                  }`}
                  title="Input Suara (Pencarian Suara)"
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Kirim Pesan"
                className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Suara:</span>
                <div className="flex gap-1">
                  {(['default', 'maple', 'panjul', 'bolang'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setVoiceStyle(s)}
                      className={`text-[9px] px-2 py-0.5 rounded-md border transition-all font-bold uppercase ${
                        voiceStyle === s 
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {s === 'default' ? 'Sadewi' : s === 'maple' ? 'Maple' : s === 'panjul' ? 'Panjul' : 'Bolang'}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 italic">Official AI</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
