import React, { useState } from 'react';
import {
  PhoneCall,
  X,
  ShieldAlert,
  Ambulance,
  ShieldCheck,
  Flame,
  Phone,
  MessageCircle,
  Copy,
  Check,
  MapPin,
  Clock,
  AlertTriangle,
  HeartPulse
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface EmergencySosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencySosModal: React.FC<EmergencySosModalProps> = ({ isOpen, onClose }) => {
  const { villageProfile } = useApp();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const contacts = [
    {
      id: 'kades-hotline',
      role: `Posko Siaga & Hotline Kades`,
      name: `Pemerintah ${villageProfile.villageName || 'Desa Pulau Betung'}`,
      phone: villageProfile.whatsappCenter || villageProfile.phone || '0822-8199-0112',
      badge: '24 Jam',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: <PhoneCall className="w-5 h-5 text-emerald-600" />,
      desc: 'Koordinasi tanggap darurat, musibah, dan keamanan umum desa.'
    },
    {
      id: 'ambulans-nakes',
      role: 'Ambulans & Nakes Siaga Desa',
      name: 'Poskesdes / Bidan Desa Siaga',
      phone: '0812-7489-3321',
      badge: 'Gawat Darurat',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      icon: <HeartPulse className="w-5 h-5 text-rose-600" />,
      desc: 'Layanan medis darurat, ibu bersalin, dan rujukan Puskesmas Pemayung.'
    },
    {
      id: 'bhabinkamtibmas',
      role: 'Bhabinkamtibmas (Polsek Pemayung)',
      name: 'Aipda Hendra Wijaya',
      phone: '0852-6632-1190',
      badge: 'Kamtibmas',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      desc: 'Keamanan, ketertiban masyarakat, dan penanganan tindak kriminalitas.'
    },
    {
      id: 'babinsa',
      role: 'Babinsa (Koramil 0415-04/Pemayung)',
      name: 'Serka M. Yusuf',
      phone: '0813-6644-8822',
      badge: 'TNI Siaga',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: <ShieldAlert className="w-5 h-5 text-amber-600" />,
      desc: 'Bantuan bencana alam, pencarian dan pertolongan warga.'
    },
    {
      id: 'damkar',
      role: 'Pemadam Kebakaran (Damkar Batang Hari)',
      name: 'Pos Wilayah Sektor Pemayung',
      phone: '0743-21113',
      badge: 'Kebakaran & Penyelamatan',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: <Flame className="w-5 h-5 text-orange-600" />,
      desc: 'Kebakaran pemukiman/lahan, evakuasi hewan liar berbahaya.'
    }
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sanitizePhone = (phone: string) => phone.replace(/[^0-9]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/50 overflow-hidden text-slate-900 dark:text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon with Emergency Red Alert Vibe */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-800 p-5 sm:p-6 text-white relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner animate-pulse">
                <ShieldAlert className="w-7 h-7 text-amber-300" />
              </div>
              <div>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/60 text-rose-200 text-[10px] font-extrabold uppercase tracking-widest border border-rose-400/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Siaga Darurat 24 Jam</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                  Kontak Cepat Tanggap Darurat
                </h3>
                <p className="text-xs text-rose-100/90 mt-0.5">
                  Layanan terpadu Pemerintah {villageProfile.villageName || 'Desa'} & Instansi Terkait
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Location & Quick Info */}
        <div className="bg-rose-50/80 dark:bg-rose-950/30 px-5 py-2.5 border-b border-rose-100 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-center space-x-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Wilayah: {villageProfile.villageName || 'Desa'}, {villageProfile.district || 'Pemayung'}</span>
          </div>
          <div className="flex items-center space-x-1.5 font-bold text-rose-700 dark:text-rose-300">
            <Clock className="w-3.5 h-3.5" />
            <span>Aktifitas Posko: Standby</span>
          </div>
        </div>

        {/* Contact List */}
        <div className="p-5 sm:p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {contacts.map((c) => {
            const rawPhone = sanitizePhone(c.phone);
            const waNumber = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone;

            return (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 shrink-0 mt-0.5">
                      {c.icon}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {c.role}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${c.badgeColor}`}>
                          {c.badge}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                        {c.name}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {c.desc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 tracking-wider">
                    {c.phone}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleCopy(c.id, c.phone)}
                      className="p-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center space-x-1"
                      title="Salin Nomor"
                    >
                      {copiedId === c.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] font-bold text-emerald-600">Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold">Salin</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`tel:${rawPhone}`}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Telepon</span>
                    </a>

                    {c.phone.startsWith('08') && (
                      <a
                        href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo, saya warga Desa Pulau Betung membutuhkan bantuan darurat segera.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-[11px]">Bila darurat kriminalitas segera hubungi Call Center Polri: <strong>110</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
