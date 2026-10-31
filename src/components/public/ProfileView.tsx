import React from 'react';
import { useApp } from '../../context/AppContext';
import { useResidents } from '../../hooks/useResidents';
import {
  Building2,
  Users,
  Compass,
  MapPin,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  FileCheck,
  Award,
  Database
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { villageProfile, navigateTo } = useApp();
  const { residents } = useResidents();

  const defaultMissions = [
    'Reformasi Pelayanan Digital: Menghadirkan pelayanan administrasi persuratan yang cepat, bebas pungutan liar, dan dapat diakses dari rumah melalui ponsel pintar.',
    'Peningkatan Infrastruktur Tani: Membangun jalan rabat beton perkebunan karet dan sawit untuk memperlancar mobilitas hasil panen masyarakat.',
    'Transparansi Tata Kelola Dana Desa: Menjamin setiap rupiah APBDes dapat diawasi bersama oleh warga melalui keterbukaan informasi.',
    'Pemberdayaan UMKM & Pemuda: Mengembangkan potensi produk olahan lokal seperti ikan salai Batang Hari dan kerajinan anyaman purun.'
  ];

  const missionList = Array.isArray(villageProfile.mission) && villageProfile.mission.length > 0
    ? villageProfile.mission
    : defaultMissions;

  // Jalur data dinamis dari Master Kependudukan SADEWA 360
  const activeResidents = residents.filter(r => r.status === 'Hidup');
  const hasMasterData = activeResidents.length > 0;

  const totalPop = hasMasterData 
    ? activeResidents.length 
    : (villageProfile.totalPopulation || 0);

  const totalFam = hasMasterData 
    ? new Set(activeResidents.map(r => r.kk)).size 
    : (villageProfile.totalFamilies || 0);

  const malePop = hasMasterData 
    ? activeResidents.filter(r => r.gender === 'Laki-laki').length 
    : (villageProfile.malePopulation ?? (totalPop > 0 ? Math.round(totalPop * 0.508) : 0));

  const femalePop = hasMasterData 
    ? activeResidents.filter(r => r.gender === 'Perempuan').length 
    : (villageProfile.femalePopulation ?? Math.max(0, totalPop - malePop));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 space-y-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
          Mengenal Desa
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
          Profil & Sejarah {villageProfile.villageName || 'Desa'}
        </h1>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
          {villageProfile.villageName || 'Desa'} merupakan salah satu desa di wilayah administrasi {villageProfile.district || 'Kecamatan'}, {villageProfile.regency || 'Kabupaten'}, {villageProfile.province || 'Provinsi'}.
        </p>
      </div>

      {/* Visi & Misi */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-emerald-900 to-slate-900 text-white shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700/60 border border-emerald-500/40 flex items-center justify-center text-amber-300">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
              Arah & Cita-Cita Desa
            </span>
            {villageProfile.motto && (
              <p className="text-xs text-emerald-200/90 font-medium italic mt-0.5">
                Motto: "{villageProfile.motto}"
              </p>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Visi Pembangunan Desa</h2>
          <blockquote className="text-emerald-100 text-base italic leading-relaxed pl-4 border-l-2 border-emerald-400">
            "{villageProfile.vision || `Terwujudnya ${villageProfile.villageName || 'Desa'} yang Maju, Beriman, Berkeadilan Sosial, Mandiri Secara Ekonomi, serta Terdepan dalam Pelayanan Publik Berbasis Digital dan Transparansi.`}"
          </blockquote>
        </div>

        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-emerald-700" />
            <h2 className="text-xl font-bold text-slate-900">Misi Utama Pemerintah Desa</h2>
          </div>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-600">
            {missionList.map((m, idx) => (
              <li key={idx} className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{m}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sejarah Desa */}
      <section className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3">
          Sejarah Singkat {villageProfile.villageName || 'Desa'}
        </h2>
        <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-600 leading-relaxed space-y-4">
          {villageProfile.history ? (
            <p className="whitespace-pre-line leading-relaxed">
              {villageProfile.history}
            </p>
          ) : (
            <>
              <p>
                Nama <strong>Pulau Betung</strong> berakar dari kondisi geografis masa lampau di tepi Sungai Batang Hari. Di kawasan ini dahulunya terdapat sebuah daratan menjorok berbentuk tanjung atau pulau kecil di kelokan sungai yang banyak ditumbuhi rumpun bambu betung (<em>Dendrocalamus asper</em>), yaitu jenis bambu berukuran besar dan kokoh yang biasa digunakan oleh tetua desa untuk rakit penyeberangan serta tiang rumah panggung Melayu Jambi.
              </p>
              <p>
                Masyarakat awal Desa Pulau Betung sebagian besar menggantungkan hidup sebagai nelayan penangkap ikan air tawar di perairan Batang Hari dan petani padi sawah lebak. Seiring waktu dan masuknya peradaban perkebunan rakyat, masyarakat mulai mengembangkan perkebunan karet alam (para rubber) yang hingga kini menjadi salah satu mata pencaharian pokok keluarga.
              </p>
              <p>
                Kini, di era transformasi modern, Desa Pulau Betung terus berbenah menjadi desa yang mandiri, menghubungkan tradisi kearifan lokal di tepian sungai dengan kemudahan teknologi informasi guna melayani warga secara adil dan terpercaya.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Kondisi Geografis & Demografi */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-emerald-800 font-bold text-base">
            <Compass className="w-5 h-5 text-emerald-600" />
            <h3>Batas Wilayah & Letak Geografis</h3>
          </div>
          <div className="space-y-3 text-xs sm:text-sm text-slate-600">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Sebelah Utara:</span>
              <span>{villageProfile.borders?.north || 'Sungai Batang Hari / Desa Seberang'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Sebelah Selatan:</span>
              <span>{villageProfile.borders?.south || 'Areal Perkebunan Rakyat / Hutan Desa'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Sebelah Timur:</span>
              <span>{villageProfile.borders?.east || 'Desa Lubuk Ruso / Batas Pemayung'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800">Sebelah Barat:</span>
              <span>{villageProfile.borders?.west || 'Desa Selat, Kec. Pemayung'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-semibold text-slate-800">Luas Wilayah Total:</span>
              <span className="font-bold text-emerald-700">
                ± {villageProfile.areaSqKm ? `${villageProfile.areaSqKm} Km²` : '1.420 Hektar'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-base">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3>Data Demografi Kependudukan (Semester Berjalan)</h3>
            </div>
            {hasMasterData ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                <Database className="w-3 h-3 text-emerald-600" />
                <span>Live Master Data</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                <span>Rekapitulasi Profil</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-xl font-extrabold text-slate-900">{totalPop.toLocaleString('id-ID')}</div>
              <div className="text-[11px] text-slate-500 font-medium">Total Jiwa Penduduk</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-xl font-extrabold text-slate-900">{totalFam.toLocaleString('id-ID')}</div>
              <div className="text-[11px] text-slate-500 font-medium">Kepala Keluarga (KK)</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-xl font-extrabold text-emerald-700">{malePop.toLocaleString('id-ID')}</div>
              <div className="text-[11px] text-slate-500 font-medium">Laki-Laki</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-xl font-extrabold text-emerald-700">{femalePop.toLocaleString('id-ID')}</div>
              <div className="text-[11px] text-slate-500 font-medium">Perempuan</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 italic text-center">
            {hasMasterData
              ? `*Sumber: Sinkronisasi Pangkalan Data Master Kependudukan SADEWA 360 (${activeResidents.length.toLocaleString('id-ID')} jiwa terdaftar).`
              : `*Sumber: Rekapitulasi Data Buku Administrasi Penduduk Kantor ${villageProfile.villageName || 'Desa'}.`}
          </p>
        </div>
      </section>

      {/* Lembaga Kemasyarakatan Desa */}
      <section className="bg-slate-50 rounded-3xl p-6 sm:p-10 border border-slate-200 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lembaga Kemasyarakatan Desa (LKD)</h2>
          <p className="text-xs text-slate-500">Mitra kerja pemerintah desa dalam pemberdayaan dan pelayanan warga</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs font-bold text-emerald-700">BPD</span>
            <h4 className="font-bold text-sm text-slate-800">Badan Permusyawaratan Desa</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Lembaga permusyawaratan yang menampung dan menyalurkan aspirasi masyarakat serta mengawasi kinerja Pemdes.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs font-bold text-emerald-700">LPM</span>
            <h4 className="font-bold text-sm text-slate-800">Lembaga Pemberdayaan Masyarakat</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Menggerakkan partisipasi dan swadaya gotong royong masyarakat dalam pembangunan lingkungan.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs font-bold text-emerald-700">TP PKK</span>
            <h4 className="font-bold text-sm text-slate-800">Pemberdayaan Kesejahteraan Keluarga</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Membina kesehatan keluarga, ketahanan pangan pekarangan, posyandu, dan pencegahan stunting.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <span className="text-xs font-bold text-emerald-700">Karang Taruna</span>
            <h4 className="font-bold text-sm text-slate-800">Pemuda Generasi Harapan</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Wadah kreativitas, olahraga, kesenian, dan kepemimpinan generasi muda {villageProfile.villageName || 'Desa'}.
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => navigateTo('pemerintahan')}
            className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow transition-colors cursor-pointer"
          >
            Lihat Struktur Aparatur & Pemerintahan Desa →
          </button>
        </div>
      </section>
    </div>
  );
};
