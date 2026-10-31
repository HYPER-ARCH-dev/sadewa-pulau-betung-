import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  ShieldCheck,
  PhoneCall,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Globe
} from 'lucide-react';

export const ContactView: React.FC = () => {
  const { addToast, villageProfile } = useApp();
  const [name, setName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const defaultEmergencyContacts = [
    {
      title: 'Bhabinkamtibmas Polsek Pemayung (Aipda M. Nasir)',
      phone: '0812-7890-1122',
      desc: 'Keamanan, ketertiban, dan tindak pidana'
    },
    {
      title: 'Babinsa Koramil 0415-04/Pemayung (Sertu Hendra)',
      phone: '0813-6655-4433',
      desc: 'Kesiapsiagaan bencana & pertahanan teritorial'
    },
    {
      title: 'UGD Puskesmas Pemayung (Ambulans Desa)',
      phone: '(0743) 21088',
      desc: 'Pelayanan gawat darurat medis & rujukan bersalin'
    },
    {
      title: 'Pemadam Kebakaran Kab. Batang Hari',
      phone: '113',
      desc: 'Penanganan kebakaran pemukiman & lahan'
    }
  ];

  const emergencyList = Array.isArray(villageProfile.emergencyContacts) && villageProfile.emergencyContacts.length > 0
    ? villageProfile.emergencyContacts
    : defaultEmergencyContacts;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    addToast(
      'success',
      'Pesan Terkirim ke Sekretariat',
      `Terima kasih telah menghubungi Pemerintah ${villageProfile.villageName || 'Desa'}. Pesan Anda akan dibalas pada jam kerja kantor desa.`
    );
    setName('');
    setEmailOrPhone('');
    setSubject('');
    setMessage('');
  };

  const cleanWaNumber = (villageProfile.whatsappCenter || '0822-8199-0112')
    .replace(/[^0-9]/g, '')
    .replace(/^0/, '62');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 sm:pb-6">
        <span className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
          Hubungi Kami
        </span>
        <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 leading-tight">
          Kontak & Pelayanan Kantor {villageProfile.villageName || 'Desa'}
        </h1>
        <p className="text-[11px] sm:text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl leading-relaxed">
          Pemerintah {villageProfile.villageName || 'Desa'} siap memberikan pelayanan terbaik bagi seluruh masyarakat. Silakan datang langsung ke kantor desa pada jam pelayanan atau hubungi saluran resmi kami.
        </p>
      </div>

      {/* Primary Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900">Alamat Kantor Desa</h3>
          <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
            {villageProfile.addressStreet || 'Alamat Kantor'}, {villageProfile.district || 'Kecamatan'}, {villageProfile.regency || 'Kabupaten'}, {villageProfile.province || 'Provinsi'}, Kode Pos {villageProfile.postalCode || '36657'}.
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900">Jam Operasional Pelayanan</h3>
          <div className="text-[11px] sm:text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Senin - Kamis:</span>
              <strong className="text-slate-900">
                {villageProfile.operatingHours?.weekdays?.replace(/^senin\s*-\s*kamis:\s*/i, '') || '08.00 - 15.00 WIB'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Jumat:</span>
              <strong className="text-slate-900">
                {villageProfile.operatingHours?.friday?.replace(/^jumat:\s*/i, '') || '08.00 - 11.30 WIB'}
              </strong>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Sabtu - Minggu:</span>
              <strong>
                {villageProfile.operatingHours?.weekend?.replace(/^sabtu\s*-\s*minggu:\s*/i, '') || 'Libur Pelayanan Tatap Muka'}
              </strong>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3 sm:col-span-2 md:col-span-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
            <Phone className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900">Saluran Resmi Desa</h3>
          <div className="text-[11px] sm:text-xs text-slate-600 space-y-1.5">
            <div>
              <span className="text-slate-400 block text-[10px]">WhatsApp Center:</span>
              <a
                href={`https://wa.me/${cleanWaNumber}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-emerald-700 font-bold hover:underline"
              >
                {villageProfile.whatsappCenter || villageProfile.phone || 'Saluran WhatsApp'}
              </a>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Email Resmi:</span>
              <span className="font-mono text-slate-800 font-medium">
                {villageProfile.email || 'sekretariat@sadewa.id'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Domain Web:</span>
              <span className="font-mono text-slate-800 font-medium">
                {villageProfile.website || 'sadewa.id'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Call Numbers & Citizen Message Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Emergency Hotlines */}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Kedaruratan 24 Jam
            </span>
            <h3 className="text-xl sm:text-2xl font-bold">Nomor Kontak Penting & Darurat</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Simpan nomor kontak darurat ini untuk keperluan pertolongan medis segera, laporan keamanan, atau bencana alam di sekitar {villageProfile.villageName || 'wilayah desa'}.
            </p>
          </div>

          <div className="space-y-3">
            {emergencyList.map((hotline, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-between hover:bg-white/15 transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-white">{hotline.title}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">{hotline.desc}</div>
                </div>
                <a
                  href={`tel:${hotline.phone.replace(/[^0-9+]/g, '')}`}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center space-x-1 shrink-0 ml-2 hover:bg-amber-300 transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{hotline.phone}</span>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Form Kirim Pesan / Pertanyaan */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Kirim Pesan atau Pertanyaan</h3>
            <p className="text-xs text-slate-500">
              Sampaikan pertanyaan mengenai prosedur administrasi, usulan kegiatan, atau konfirmasi berkas ke aparat {villageProfile.villageName || 'desa'}.
            </p>
          </div>

          {submitted && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Pesan Anda telah berhasil disampaikan ke tim administrasi kantor desa.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Lengkap Anda: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Ahmad Yani"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor WhatsApp / Email Aktif: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="0812-xxxx-xxxx atau nama@email.com"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Subjek / Hal: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Pertanyaan Syarat Surat Pengantar SKCK"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Isi Pesan: <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Tuliskan pesan, permohonan informasi, atau masukan Anda dengan sopan dan jelas..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Kirimkan Pesan ke Kantor Desa</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
