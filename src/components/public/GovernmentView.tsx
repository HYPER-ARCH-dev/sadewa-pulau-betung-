import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Users, Award, ShieldCheck, Mail, Phone, Building2, User } from 'lucide-react';

export const GovernmentView: React.FC = () => {
  const { officials, villageProfile } = useApp();
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Only active officials are shown publicly
  const activeOfficials = officials
    .filter((o) => o.isActive !== false)
    .sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  const filteredOfficials =
    selectedSection === 'all'
      ? activeOfficials
      : activeOfficials.filter((o) => {
          if (selectedSection === 'pemerintah_desa') {
            return ['kepala_desa', 'sekretariat', 'kasi', 'kaur'].includes(o.section);
          }
          if (selectedSection === 'wilayah') {
            return ['kadus', 'rt_rw'].includes(o.section);
          }
          if (selectedSection === 'karang_taruna') {
            return o.section === 'karang_taruna';
          }
          if (selectedSection === 'lembaga') {
            return ['bpd', 'pkk', 'lpm', 'posyandu'].includes(o.section);
          }
          return true;
        });

  const kepalaDesa = activeOfficials.find((o) => o.section === 'kepala_desa');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
          Aparatur & Kelembagaan Desa
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          Struktur Pemerintahan {villageProfile.villageName || 'Desa'}
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
          Penyelenggara pemerintahan {villageProfile.district || 'Kecamatan'}, kewilayahan RT/RW, Karang Taruna, dan lembaga desa yang melayani masyarakat dengan integritas, musyawarah, dan dedikasi penuh.
        </p>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 mt-6">
          <button
            onClick={() => setSelectedSection('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedSection === 'all'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Struktur ({activeOfficials.length})
          </button>
          <button
            onClick={() => setSelectedSection('pemerintah_desa')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedSection === 'pemerintah_desa'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Pemerintah Desa (Kades, Sekdes, Kasi/Kaur)
          </button>
          <button
            onClick={() => setSelectedSection('wilayah')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedSection === 'wilayah'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Kewilayahan (Kadus & RT/RW)
          </button>
          <button
            onClick={() => setSelectedSection('karang_taruna')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedSection === 'karang_taruna'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Karang Taruna
          </button>
          <button
            onClick={() => setSelectedSection('lembaga')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedSection === 'lembaga'
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Lembaga Desa (BPD, PKK, Posyandu)
          </button>
        </div>
      </div>

      {/* Kepala Desa Spotlight */}
      {kepalaDesa && (
        <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl overflow-hidden relative">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shrink-0 border-4 border-emerald-500/40 shadow-2xl bg-slate-800 flex items-center justify-center">
              {kepalaDesa.imageUrl && kepalaDesa.imageUrl.trim() !== '' ? (
                <img
                  src={kepalaDesa.imageUrl.trim()}
                  alt={kepalaDesa.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <User className="w-16 h-16 mb-1 text-slate-300" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Foto Profil</span>
                  <span className="text-[9px] text-slate-400">Belum Diunggah</span>
                </div>
              )}
            </div>
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-block px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[11px] uppercase tracking-wider">
                Kepala {villageProfile.villageName || 'Desa Pulau Betung'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {kepalaDesa.name}
              </h2>
              <div className="text-xs sm:text-sm text-emerald-300 font-medium">
                {kepalaDesa.tenure} {kepalaDesa.nip ? `• NIP/NIAP: ${kepalaDesa.nip}` : ''}
              </div>
              <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
                {kepalaDesa.bio}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Other Officials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOfficials
          .filter((o) => o.section !== 'kepala_desa')
          .map((official) => (
            <div
              key={official.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center">
                    {official.imageUrl && official.imageUrl.trim() !== '' ? (
                      <img
                        src={official.imageUrl.trim()}
                        alt={official.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">{official.name}</h3>
                    <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                      {official.position}
                    </div>
                    {official.nip && (
                      <div className="text-[11px] text-slate-400 mt-0.5">{official.nip}</div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{official.bio}</p>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>{official.tenure}</span>
                <span className="text-emerald-700 font-bold uppercase tracking-wider text-[10px]">
                  {official.section.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
      </div>

      {/* Government Commitment Banner */}
      <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Maklumat Pelayanan Pemerintah {villageProfile.villageName || 'Desa Pulau Betung'}:</span>
          <p className="text-slate-700 leading-relaxed">
            "Dengan ini kami menyatakan sanggup menyelenggarakan pelayanan administrasi desa sesuai standar pelayanan yang telah ditetapkan, transparan, adil, serta tidak memungut biaya apapun (gratis) untuk seluruh layanan persuratan pokok warga."
          </p>
        </div>
      </div>
    </div>
  );
};
