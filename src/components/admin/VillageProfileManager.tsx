import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { exportBannerImageToPDF } from '../../utils/pdfEngine';
import { VillageProfile } from '../../types';
import { uploadImageService } from '../../services/uploadService';
import {
  Building2,
  Save,
  RotateCcw,
  Upload,
  CheckCircle2,
  Eye,
  FileText,
  MapPin,
  Mail,
  Phone,
  Globe,
  Award,
  Check,
  PenTool,
  Trash2,
  Plus,
  Compass,
  Users,
  MessageSquare,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Zap,
  HelpCircle,
  AlertTriangle,
  Home
} from 'lucide-react';

const normalizeProfile = (p?: Partial<VillageProfile> | null): VillageProfile => ({
  id: p?.id || 'default',
  villageName: p?.villageName || 'Desa Pulau Betung',
  district: p?.district || 'Kecamatan Pemayung',
  regency: p?.regency || 'Kabupaten Batang Hari',
  province: p?.province || 'Provinsi Jambi',
  postalCode: p?.postalCode || '36657',
  addressStreet: p?.addressStreet || 'Jalan Lintas Muara Bulian - Jambi, KM 32',
  email: p?.email || 'pemdes@pulaubetung.sadewa.id',
  phone: p?.phone || '0822-8199-0112',
  website: p?.website || 'pulaubetung.sadewa.id',
  villageLogoUrl: p?.villageLogoUrl || '',
  regencyLogoUrl: p?.regencyLogoUrl || '',
  sadewaLogoUrl: p?.sadewaLogoUrl || '',
  sadewaIconUrl: p?.sadewaIconUrl || '',
  officialSignatureUrl: p?.officialSignatureUrl || '',
  letterCodePrefix: p?.letterCodePrefix || '470',
  motto: p?.motto || 'Serentak Bak Regam - Maju Bersama Petani',
  vision: p?.vision || 'Terwujudnya Desa Pulau Betung yang Maju, Beriman, Berkeadilan Sosial, Mandiri Secara Ekonomi, serta Terdepan dalam Pelayanan Publik Berbasis Digital dan Transparansi.',
  mission: Array.isArray(p?.mission) && p.mission.length > 0
    ? p.mission
    : [
        'Reformasi Pelayanan Digital: Menghadirkan pelayanan administrasi persuratan yang cepat, bebas pungutan liar, dan dapat diakses dari rumah melalui ponsel.',
        'Peningkatan Infrastruktur Tani: Membangun jalan rabat beton perkebunan karet dan sawit untuk memperlancar mobilitas hasil panen masyarakat.',
        'Transparansi Tata Kelola Dana Desa: Menjamin setiap rupiah APBDes dapat diawasi bersama oleh warga melalui keterbukaan informasi publik.',
        'Pemberdayaan UMKM & Pemuda: Mengembangkan potensi produk olahan lokal seperti ikan salai Batang Hari dan kerajinan anyaman purun.'
      ],
  history: p?.history || 'Desa Pulau Betung merupakan salah satu desa bersejarah di sepanjang aliran Sungai Batang Hari, Kecamatan Pemayung.',
  totalPopulation: p?.totalPopulation ?? 1842,
  totalFamilies: p?.totalFamilies ?? 524,
  areaSqKm: p?.areaSqKm ?? 14.2,
  borders: p?.borders || {
    north: 'Sungai Batang Hari / Desa Seberang',
    south: 'Areal Perkebunan Rakyat / Hutan Desa',
    east: 'Desa Lubuk Ruso / Batas Pemayung',
    west: 'Desa Selat, Kec. Pemayung'
  },
  officeLocation: p?.officeLocation || { lat: -1.5562, lng: 103.4475, radius: 100 },
  kadesName: p?.kadesName || 'H. Sudirman',
  kadesNip: p?.kadesNip || 'NIAP. 19780412 201201 1 004',
  bpdName: p?.bpdName || 'Drs. H. Syamsudin',
  kadesPhotoUrl: p?.kadesPhotoUrl || '',
  kadesGreetingTitle: p?.kadesGreetingTitle || 'Membangun Desa Pulau Betung dengan Kebersamaan dan Pelayanan Digital',
  kadesGreeting: p?.kadesGreeting || 'Assalamu’alaikum Warahmatullahi Wabarakatuh. Puji syukur ke hadirat Allah SWT, berkat rahmat-Nya portal digital resmi Pemerintah Desa Pulau Betung dapat hadir di tengah masyarakat. Melalui portal ini, kami berikhtiar memangkas birokrasi, memberikan pelayanan surat secara transparan, serta membuka akses seluas-luasnya bagi warga untuk mengawal pembangunan desa.',
  heroTitle: p?.heroTitle || 'Selamat Datang di Portal Desa Pulau Betung',
  heroSubtitle: p?.heroSubtitle || 'Kecamatan Pemayung, Kabupaten Batang Hari, Provinsi Jambi — Akses pelayanan publik, transparansi anggaran, dan aspirasi warga.',
  heroBackgroundUrl: p?.heroBackgroundUrl || '',
  heroBadgeText: p?.heroBadgeText || 'Portal Pelayanan Publik Desa Mandiri',
  heroIsActive: p?.heroIsActive !== false,
  whatsappCenter: p?.whatsappCenter || '0822-8199-0112',
  operatingHours: p?.operatingHours || {
    weekdays: 'Senin - Kamis: 08.00 - 15.00 WIB',
    friday: 'Jumat: 08.00 - 11.30 WIB',
    weekend: 'Sabtu - Minggu: Libur Pelayanan Tatap Muka'
  },
  emergencyContacts: Array.isArray(p?.emergencyContacts) && p.emergencyContacts.length > 0
    ? p.emergencyContacts
    : [
        { title: 'Bidan Desa Siaga', phone: '0812-7400-8891', desc: 'Layanan kebidanan & persalinan darurat 24 jam' },
        { title: 'Babinsa / Kamtibmas', phone: '0813-6622-4410', desc: 'Keamanan dan ketertiban desa' },
        { title: 'Puskesmas Pemayung', phone: '(0743) 21119', desc: 'Layanan medis & ambulans gawat darurat' }
      ],
  lastUpdated: p?.lastUpdated || new Date().toISOString()
});

export const VillageProfileManager: React.FC = () => {
  const { currentUser, resetAllDataToDefault, villageProfile, updateVillageProfile, officials, addToast } = useApp();

  // Local form state
  const [formData, setFormData] = useState<VillageProfile>(() => normalizeProfile(villageProfile));

  // SINKRONISASI REAKSIF: Reset formData HANYA ketika data DB beneran berubah (lastUpdated berubah)
  useEffect(() => {
    if (villageProfile) {
      setFormData(normalizeProfile(villageProfile));
    }
  }, [villageProfile?.lastUpdated]);

  const [activeSubTab, setActiveSubTab] = useState<'identitas' | 'kontak' | 'logo' | 'visi_misi' | 'sambutan'>('identitas');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<'village' | 'regency' | 'signature' | 'kades' | 'sadewa' | 'sadewaIcon' | null>(null);

  // New item inputs
  const [newMissionItem, setNewMissionItem] = useState('');
  const [newEmergencyTitle, setNewEmergencyTitle] = useState('');
  const [newEmergencyPhone, setNewEmergencyPhone] = useState('');
  const [newEmergencyDesc, setNewEmergencyDesc] = useState('');

  const villageLogoInputRef = useRef<HTMLInputElement>(null);
  const regencyLogoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const kadesPhotoInputRef = useRef<HTMLInputElement>(null);
  const sadewaLogoInputRef = useRef<HTMLInputElement>(null);
  const sadewaIconInputRef = useRef<HTMLInputElement>(null);

  // Active Kades for preview
  const activeKades = (officials || []).find(
    (o) => (o.section === 'kepala_desa' || (o.position && o.position.toLowerCase().includes('kepala desa'))) && o.isActive !== false
  ) || (officials || []).find((o) => o.section === 'kepala_desa');

  const handleChange = <K extends keyof VillageProfile>(key: K, value: VillageProfile[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'village' | 'regency' | 'signature' | 'kades' | 'sadewa' | 'sadewaIcon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast('error', 'Ukuran Terlalu Besar', 'Maksimal ukuran berkas adalah 10MB.');
      return;
    }

    setUploadingTarget(target);
    try {
      // Menggunakan utilitas uploadImageService (Future-Proof: Backend Server atau Fallback Base64 Lokal)
      const result = await uploadImageService(file);

      if (result.success && result.url) {
        const resolvedUrl = result.url;
        if (target === 'village') {
          handleChange('villageLogoUrl', resolvedUrl);
          await updateVillageProfile({ villageLogoUrl: resolvedUrl });
        } else if (target === 'regency') {
          handleChange('regencyLogoUrl', resolvedUrl);
          await updateVillageProfile({ regencyLogoUrl: resolvedUrl });
        } else if (target === 'signature') {
          handleChange('officialSignatureUrl', resolvedUrl);
          await updateVillageProfile({ officialSignatureUrl: resolvedUrl });
        } else if (target === 'kades') {
          handleChange('kadesPhotoUrl', resolvedUrl);
          await updateVillageProfile({ kadesPhotoUrl: resolvedUrl });
        } else if (target === 'sadewa') {
          handleChange('sadewaLogoUrl', resolvedUrl);
          await updateVillageProfile({ sadewaLogoUrl: resolvedUrl });
        } else if (target === 'sadewaIcon') {
          handleChange('sadewaIconUrl', resolvedUrl);
          await updateVillageProfile({ sadewaIconUrl: resolvedUrl });
        }
        const targetLabelMap: Record<string, string> = {
          kades: 'Foto Kepala Desa',
          village: 'Logo Desa',
          regency: 'Lambang Daerah',
          signature: 'Tanda Tangan Kades',
          sadewa: 'Logo Branding Njul',
          sadewaIcon: 'Ikon Branding Njul'
        };
        const targetLabel = targetLabelMap[target] || 'Berkas';
        const statsInfo = result.stats
          ? ` (${result.stats.formattedOriginal} ➔ ${result.stats.formattedCompressed}, Hemat ${result.stats.savedPercentage}%)`
          : '';
        addToast('success', `${targetLabel} Berhasil Disimpan`, `Gambar berhasil diunggah dan disimpan otomatis ke sistem${statsInfo}.`);
      } else {
        addToast('error', 'Gagal Memproses Foto', result.error || 'Terjadi kesalahan saat memproses gambar.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast('error', 'Unggah Gagal', errMsg || 'Gagal memproses berkas gambar.');
    } finally {
      setUploadingTarget(null);
      // Reset input file value so user can re-upload same file if desired
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await updateVillageProfile(formData);
      addToast('success', 'Profil Desa Diperbarui', 'Seluruh data profil desa telah berhasil disimpan secara permanen ke database.');
    } catch (err: unknown) {
      console.error('Submit profile error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const cleanErr = errMsg.includes('JSON') || errMsg.includes('Unexpected token')
        ? 'Gagal menyinkronkan ke server. Data Anda tetap tersimpan di peramban.'
        : (errMsg || 'Terjadi kesalahan saat menyimpan profil desa.');
      addToast('error', 'Gagal Menyimpan', cleanErr);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: Mission list actions
  const handleAddMission = () => {
    if (!newMissionItem.trim()) return;
    setFormData((prev) => ({
      ...prev,
      mission: [...(prev.mission || []), newMissionItem.trim()]
    }));
    setNewMissionItem('');
  };

  const handleRemoveMission = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      mission: (prev.mission || []).filter((_, i) => i !== index)
    }));
  };

  // Helper: Emergency contacts actions
  const handleAddEmergency = () => {
    if (!newEmergencyTitle.trim() || !newEmergencyPhone.trim()) {
      addToast('warning', 'Lengkapi Data', 'Nama instansi/kontak dan nomor telepon darurat wajib diisi.');
      return;
    }
    const newContact = {
      title: newEmergencyTitle.trim(),
      phone: newEmergencyPhone.trim(),
      desc: newEmergencyDesc.trim() || 'Layanan siaga tanggap darurat'
    };
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: [...(prev.emergencyContacts || []), newContact]
    }));
    setNewEmergencyTitle('');
    setNewEmergencyPhone('');
    setNewEmergencyDesc('');
  };

  const handleRemoveEmergency = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: (prev.emergencyContacts || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Master Pengaturan Desa Terpadu</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Identitas, Narasi, Kontak & Kop Surat Resmi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola profil wilayah, visi misi, kontak darurat, hero banner, dan kop surat legalitas dokumen desa.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
          </button>
        </div>
      </div>

      {/* Live Official Letterhead Preview Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pratinjau Langsung Standar Kop Surat Resmi (Naskah Dinas)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            Otomatis sinkron dengan lembar surat warga
          </span>
        </div>

        {/* The Kop Box Preview */}
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl border border-slate-300 shadow-sm">
            {/* Header / Kop Content */}
            <div className="border-b-2 border-slate-900 pb-3">
              <div className="flex items-center justify-between gap-4">
                {/* Left Logo: Regency Logo */}
                <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                  {formData.regencyLogoUrl && formData.regencyLogoUrl.length > 10 ? (
                    <img
                      src={formData.regencyLogoUrl.trim()}
                      alt="Logo Kabupaten"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-slate-200 bg-emerald-50 flex items-center justify-center text-emerald-700">
                      <ShieldCheck className="w-10 h-10" />
                    </div>
                  )}
                </div>

                {/* Center: Legal Text */}
                <div className="flex-1 text-center font-serif leading-tight">
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider text-slate-900 uppercase">
                    Pemerintah {formData.regency || 'KABUPATEN BATANG HARI'}
                  </h4>
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider text-slate-900 uppercase">
                    Kecamatan {formData.district || 'PEMAYUNG'}
                  </h4>
                  <h3 className="text-sm sm:text-base font-extrabold tracking-widest text-slate-900 uppercase mt-0.5">
                    Kantor Kepala {formData.villageName || 'DESA PULAU BETUNG'}
                  </h3>
                  <p className="text-[10px] text-slate-600 font-sans mt-1 leading-snug">
                    {formData.addressStreet || 'Jalan Lintas Muara Bulian - Jambi, KM 32'}, Kode Pos {formData.postalCode || '36657'}
                    <br />
                    Email: {formData.email || 'pemdes@pulaubetung.sadewa.id'} • Laman Resmi: {formData.website || 'pulaubetung.sadewa.id'}
                  </p>
                </div>

                {/* Right Logo: Village Logo */}
                <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                  {formData.villageLogoUrl && formData.villageLogoUrl.length > 10 ? (
                    <img
                      src={formData.villageLogoUrl.trim()}
                      alt="Logo Desa"
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-slate-200 bg-emerald-50 flex items-center justify-center text-emerald-700">
                      <ShieldCheck className="w-10 h-10" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Letter Number and Title Preview */}
            <div className="text-center mt-4 mb-3">
              <p className="text-xs font-bold underline uppercase tracking-wide">
                SURAT KETERANGAN RESMI DESA
              </p>
              <p className="text-[10px] font-sans mt-0.5 font-medium text-slate-600">
                Nomor : {formData.letterCodePrefix || '470'}/045/DS-PB/X/{new Date().getFullYear()}
              </p>
            </div>

            {/* Signature Block Preview */}
            <div className="pt-3 mt-4 border-t border-dashed border-slate-200 flex justify-end">
              <div className="text-center text-[10px] space-y-0.5">
                <p className="text-slate-600">Dikeluarkan di : {(formData.villageName || 'Pulau Betung').replace(/^(desa|kelurahan)\s+/i, '')}</p>
                <p className="font-bold text-slate-900">Kepala {formData.villageName || 'Desa Pulau Betung'}</p>
                <div className="h-10 flex items-center justify-center my-0.5">
                  {formData.officialSignatureUrl && formData.officialSignatureUrl.trim() !== '' ? (
                    <img
                      src={formData.officialSignatureUrl.trim()}
                      alt="Tanda Tangan Kades"
                      className="max-h-10 max-w-28 object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 italic text-[9px]">[ Tanda Tangan Resmi ]</span>
                  )}
                </div>
                <p className="font-bold underline text-slate-900">{formData.kadesName || activeKades?.name || 'H. Sudirman'}</p>
                <p className="text-slate-500">{formData.kadesNip || activeKades?.nip || 'NIAP. 19780412 201201 1 004'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Tabs & Inputs */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
        {/* Sub-tab navigation */}
        <div className="flex border-b border-slate-200 space-x-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('identitas')}
            className={`pb-3 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'identitas'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Identitas & Kop Surat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('kontak')}
            className={`pb-3 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'kontak'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Kontak & Jam Kerja</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('logo')}
            className={`pb-3 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'logo'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Kop & Tanda Tangan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('visi_misi')}
            className={`pb-3 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'visi_misi'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Visi, Misi, Sejarah & Batas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('sambutan')}
            className={`pb-3 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'sambutan'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Sambutan Kepala Desa</span>
          </button>
        </div>

        {/* TAB 1: IDENTITAS ADMINISTRASI & KOP SURAT */}
        {activeSubTab === 'identitas' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Desa: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Desa Pulau Betung"
                  value={formData.villageName || ''}
                  onChange={(e) => handleChange('villageName', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kecamatan: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kecamatan Pemayung"
                  value={formData.district || ''}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kabupaten: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kabupaten Batang Hari"
                  value={formData.regency || ''}
                  onChange={(e) => handleChange('regency', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Provinsi: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Provinsi Jambi"
                  value={formData.province || ''}
                  onChange={(e) => handleChange('province', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode Pos: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 36657"
                  value={formData.postalCode || ''}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Prefix Kode Klasifikasi Surat (Default):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 470"
                  value={formData.letterCodePrefix || ''}
                  onChange={(e) => handleChange('letterCodePrefix', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Kode baku penomoran naskah dinas kependudukan umum.</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap Kantor Desa: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Jalan Lintas Muara Bulian - Jambi, KM 32, Dusun Betung Indah"
                  value={formData.addressStreet || ''}
                  onChange={(e) => handleChange('addressStreet', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>
            </div>

            {/* GPS Office Location - Super Admin Only */}
            {currentUser?.role === 'super_admin' && (
              <div className="mt-6 p-5 rounded-2xl border border-amber-200 bg-amber-50/30 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Titik Koordinat Kantor Desa (Absensi GPS)</h4>
                    <p className="text-[11px] text-slate-600">Atur lokasi kantor desa untuk verifikasi absensi perangkat desa.</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase">Super Admin</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Latitude:</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-1.5562"
                      value={formData.officeLocation?.lat || ''}
                      onChange={(e) => handleChange('officeLocation', { ...formData.officeLocation, lat: parseFloat(e.target.value) })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Longitude:</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="103.4475"
                      value={formData.officeLocation?.lng || ''}
                      onChange={(e) => handleChange('officeLocation', { ...formData.officeLocation, lng: parseFloat(e.target.value) })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Radius Aman (Meter):</label>
                    <input
                      type="number"
                      placeholder="100"
                      value={formData.officeLocation?.radius || ''}
                      onChange={(e) => handleChange('officeLocation', { ...formData.officeLocation, radius: parseInt(e.target.value) })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-amber-700 italic">
                  *Tip: Buka Google Maps, klik kanan di lokasi kantor desa, lalu salin koordinatnya (Latitude, Longitude) ke sini.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KONTAK & JAM KERJA */}
        {activeSubTab === 'kontak' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Resmi Kantor Desa: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="pemdes@pulaubetung.sadewa.id"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Telepon Kantor: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="0822-8199-0112"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Center / Hotline Warga:
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="0822-8199-0112"
                    value={formData.whatsappCenter || ''}
                    onChange={(e) => handleChange('whatsappCenter', e.target.value)}
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Laman Resmi / Domain Website: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="pulaubetung.sadewa.id"
                    value={formData.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Jam Operasional */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-slate-900">Jam Operasional Pelayanan Kantor</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Senin - Kamis:</label>
                  <input
                    type="text"
                    value={formData.operatingHours?.weekdays || ''}
                    onChange={(e) => handleChange('operatingHours', { ...formData.operatingHours, weekdays: e.target.value })}
                    placeholder="Senin - Kamis: 08.00 - 15.00 WIB"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jumat:</label>
                  <input
                    type="text"
                    value={formData.operatingHours?.friday || ''}
                    onChange={(e) => handleChange('operatingHours', { ...formData.operatingHours, friday: e.target.value })}
                    placeholder="Jumat: 08.00 - 11.30 WIB"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sabtu - Minggu / Libur:</label>
                  <input
                    type="text"
                    value={formData.operatingHours?.weekend || ''}
                    onChange={(e) => handleChange('operatingHours', { ...formData.operatingHours, weekend: e.target.value })}
                    placeholder="Sabtu - Minggu: Libur Pelayanan Tatap Muka"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contacts List */}
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-slate-900">Kontak Darurat & Siaga 24 Jam</h4>
                </div>
                <span className="text-[10px] text-rose-700 font-semibold bg-rose-100 px-2 py-0.5 rounded-full">
                  Tampil pada banner publik & footer
                </span>
              </div>

              <div className="space-y-2">
                {(formData.emergencyContacts || []).map((ec, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-rose-200/80 gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs text-slate-900">{ec.title}</strong>
                        <span className="font-mono text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                          {ec.phone}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{ec.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmergency(idx)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus kontak darurat ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-200">
                <input
                  type="text"
                  placeholder="Nama Instansi/Petugas (Contoh: Babinsa)"
                  value={newEmergencyTitle}
                  onChange={(e) => setNewEmergencyTitle(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  placeholder="Nomor Telepon/HP Siaga"
                  value={newEmergencyPhone}
                  onChange={(e) => setNewEmergencyPhone(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                />
                <input
                  type="text"
                  placeholder="Keterangan singkat (Contoh: Keamanan 24 jam)"
                  value={newEmergencyDesc}
                  onChange={(e) => setNewEmergencyDesc(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddEmergency}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kontak</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LOGO KOP & TANDA TANGAN */}
        {activeSubTab === 'logo' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Logo Kabupaten */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Logo Kabupaten (Kiri Kop)</h4>
                  <span className="text-[10px] text-slate-500">PNG, JPG, SVG (Maks. 5MB)</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-1 shrink-0">
                    {formData.regencyLogoUrl && formData.regencyLogoUrl.length > 10 ? (
                      <img
                        src={formData.regencyLogoUrl.trim()}
                        alt="Logo Kabupaten"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-emerald-700 bg-emerald-50 w-full h-full rounded-lg flex items-center justify-center border border-emerald-100">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={regencyLogoInputRef}
                      onChange={(e) => handleFileUpload(e, 'regency')}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => regencyLogoInputRef.current?.click()}
                      disabled={uploadingTarget === 'regency'}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingTarget === 'regency' ? 'Mengunggah...' : 'Pilih Berkas Logo'}</span>
                    </button>
                    <input
                      type="url"
                      placeholder="Atau tautan URL: https://..."
                      value={formData.regencyLogoUrl || ''}
                      onChange={(e) => handleChange('regencyLogoUrl', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Logo Desa */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Logo Lambang Desa (Kanan Kop)</h4>
                  <span className="text-[10px] text-slate-500">PNG Transparan / JPG (Maks. 5MB)</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-1 shrink-0">
                    {formData.villageLogoUrl && formData.villageLogoUrl.length > 10 ? (
                      <img
                        src={formData.villageLogoUrl.trim()}
                        alt="Logo Desa"
                        className="max-w-full max-h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-emerald-700 bg-emerald-50 w-full h-full rounded-lg flex items-center justify-center border border-emerald-100">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={villageLogoInputRef}
                      onChange={(e) => handleFileUpload(e, 'village')}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => villageLogoInputRef.current?.click()}
                      disabled={uploadingTarget === 'village'}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingTarget === 'village' ? 'Mengunggah...' : 'Pilih Berkas Logo'}</span>
                    </button>
                    <input
                      type="url"
                      placeholder="Atau tautan URL: https://..."
                      value={formData.villageLogoUrl || ''}
                      onChange={(e) => handleChange('villageLogoUrl', e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Tanda Tangan Resmi Kepala Desa */}
              <div className="sm:col-span-2 p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <PenTool className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Scan Tanda Tangan Resmi Kepala Desa
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Tanda tangan ini akan otomatis dicetak pada lembar surat keterangan resmi warga.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200 w-fit">
                    Format: PNG Transparan / JPG
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-emerald-200/70">
                  <div className="w-40 h-20 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 flex items-center justify-center p-2 shrink-0">
                    {formData.officialSignatureUrl && formData.officialSignatureUrl.trim() !== '' ? (
                      <img
                        src={formData.officialSignatureUrl.trim()}
                        alt="Pratinjau Tanda Tangan"
                        className="max-w-full max-h-full object-contain mix-blend-multiply"
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <PenTool className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <span className="text-[9px] block">Belum ada tanda tangan</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <input
                      type="file"
                      ref={signatureInputRef}
                      onChange={(e) => handleFileUpload(e, 'signature')}
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => signatureInputRef.current?.click()}
                        disabled={uploadingTarget === 'signature'}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingTarget === 'signature' ? 'Mengunggah...' : 'Unggah Scan Tanda Tangan (PNG/JPG)'}</span>
                      </button>

                      {formData.officialSignatureUrl && formData.officialSignatureUrl.trim() !== '' && (
                        <button
                          type="button"
                          onClick={() => handleChange('officialSignatureUrl', '')}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors border border-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>

                    <input
                      type="url"
                      placeholder="Atau tautan URL tanda tangan: https://..."
                      value={formData.officialSignatureUrl || ''}
                      onChange={(e) => handleChange('officialSignatureUrl', e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VISI, MISI, SEJARAH, BATAS & STATISTIK */}
        {activeSubTab === 'visi_misi' && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Semboyan / Motto Desa:
              </label>
              <input
                type="text"
                placeholder="Contoh: Serentak Bak Regam - Maju Bersama Petani"
                value={formData.motto || ''}
                onChange={(e) => handleChange('motto', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Visi Pembangunan Desa:
              </label>
              <textarea
                rows={2}
                placeholder="Rumuskan visi utama masa jabatan kepala desa..."
                value={formData.vision || ''}
                onChange={(e) => handleChange('vision', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Misi List with Add / Remove */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Misi Utama Pemerintah Desa ({formData.mission?.length || 0} Poin):
              </label>
              <div className="space-y-2">
                {(formData.mission || []).map((m, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={m}
                      onChange={(e) => {
                        const updated = [...(formData.mission || [])];
                        updated[idx] = e.target.value;
                        handleChange('mission', updated);
                      }}
                      className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMission(idx)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tambahkan poin misi baru..."
                  value={newMissionItem}
                  onChange={(e) => setNewMissionItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMission();
                    }
                  }}
                  className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddMission}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Poin Misi</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sejarah Singkat Desa:
              </label>
              <textarea
                rows={3}
                placeholder="Uraikan asal usul dan sejarah ringkas terbentuknya desa..."
                value={formData.history || ''}
                onChange={(e) => handleChange('history', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Batas Wilayah & Statistik */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-xs font-bold text-slate-900">Batas Wilayah Desa</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Sebelah Utara:</label>
                    <input
                      type="text"
                      value={formData.borders?.north || ''}
                      onChange={(e) => handleChange('borders', { ...formData.borders, north: e.target.value })}
                      placeholder="Sungai Batang Hari / Desa Seberang"
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Sebelah Selatan:</label>
                    <input
                      type="text"
                      value={formData.borders?.south || ''}
                      onChange={(e) => handleChange('borders', { ...formData.borders, south: e.target.value })}
                      placeholder="Areal Perkebunan Rakyat / Hutan Desa"
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Sebelah Timur:</label>
                    <input
                      type="text"
                      value={formData.borders?.east || ''}
                      onChange={(e) => handleChange('borders', { ...formData.borders, east: e.target.value })}
                      placeholder="Desa Lubuk Ruso / Batas Pemayung"
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Sebelah Barat:</label>
                    <input
                      type="text"
                      value={formData.borders?.west || ''}
                      onChange={(e) => handleChange('borders', { ...formData.borders, west: e.target.value })}
                      placeholder="Desa Selat, Kec. Pemayung"
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-xs font-bold text-slate-900">Statistik Kependudukan & Wilayah</h4>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Total Penduduk (Jiwa):</label>
                    <input
                      type="number"
                      value={formData.totalPopulation || ''}
                      onChange={(e) => handleChange('totalPopulation', parseInt(e.target.value) || 0)}
                      placeholder="1842"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Total Kepala Keluarga (KK):</label>
                    <input
                      type="number"
                      value={formData.totalFamilies || ''}
                      onChange={(e) => handleChange('totalFamilies', parseInt(e.target.value) || 0)}
                      placeholder="524"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Luas Wilayah Total (Km² / Hektar):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.areaSqKm || ''}
                      onChange={(e) => handleChange('areaSqKm', parseFloat(e.target.value) || 0)}
                      placeholder="14.2"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SAMBUTAN KEPALA DESA */}
        {activeSubTab === 'sambutan' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-slate-900">Profil Kepala Desa Aktif</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap Kepala Desa: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: H. Sudirman"
                    value={formData.kadesName || ''}
                    onChange={(e) => handleChange('kadesName', e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIP / NIAP Kepala Desa:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: NIAP. 19780412 201201 1 004"
                    value={formData.kadesNip || ''}
                    onChange={(e) => handleChange('kadesNip', e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Ketua BPD (Badan Permusyawaratan Desa):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Drs. H. Syamsudin"
                    value={formData.bpdName || ''}
                    onChange={(e) => handleChange('bpdName', e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Nama Ketua BPD ini akan otomatis terikat pada lembar Baliho APBDes & Dokumen Laporan Resmian.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Foto Resmi Kepala Desa:
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-slate-300 overflow-hidden bg-white shrink-0">
                      {formData.kadesPhotoUrl && formData.kadesPhotoUrl.trim() !== '' ? (
                        <img
                          src={formData.kadesPhotoUrl.trim()}
                          alt="Foto Kades"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                          Tidak Ada
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        ref={kadesPhotoInputRef}
                        onChange={(e) => handleFileUpload(e, 'kades')}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => kadesPhotoInputRef.current?.click()}
                        disabled={uploadingTarget === 'kades'}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingTarget === 'kades' ? 'Mengunggah...' : 'Pilih Foto Kades'}</span>
                      </button>
                      <input
                        type="url"
                        placeholder="Atau tautan URL foto: https://..."
                        value={formData.kadesPhotoUrl || ''}
                        onChange={(e) => handleChange('kadesPhotoUrl', e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Judul Sambutan Kepala Desa:
              </label>
              <input
                type="text"
                placeholder="Contoh: Membangun Desa Pulau Betung dengan Kebersamaan dan Pelayanan Digital"
                value={formData.kadesGreetingTitle || ''}
                onChange={(e) => handleChange('kadesGreetingTitle', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Isi Lengkap Sambutan Kepala Desa:
              </label>
              <textarea
                rows={5}
                placeholder="Tuliskan kata sambutan resmi kepala desa untuk masyarakat dan pengunjung portal..."
                value={formData.kadesGreeting || ''}
                onChange={(e) => handleChange('kadesGreeting', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        )}


        {/* Bottom Save Bar */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Terakhir disimpan: {new Date(formData.lastUpdated || Date.now()).toLocaleString('id-ID')}
          </span>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
          </button>
        </div>
      </div>

      {/* DANGER ZONE: Wipe all dummy data (Super Admin Only) */}
      {currentUser?.role === 'super_admin' && (
        <div className="mt-8 border border-rose-200 bg-rose-50 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <AlertTriangle className="w-48 h-48 text-rose-900" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center space-x-3 text-rose-700">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-sm font-bold">Zona Bahaya (Danger Zone)</h3>
            </div>
            <p className="text-xs text-rose-800/80 max-w-2xl leading-relaxed font-medium">
              Tindakan di bawah ini akan <strong>menghapus seluruh data pengujian/dummy</strong> yang ada di sistem SADEWA (Termasuk data permohonan surat, berita, aparatur dummy, keluhan, dll). Hanya jalankan ini jika Anda bersiap untuk <strong>Go-Live / Peluncuran Resmi</strong> ke server produksi dengan domain asli.
            </p>
            <button
              type="button"
              onClick={() => {
                const confirmed = window.confirm('⚠️ PERINGATAN KRITIS: Anda yakin ingin menghapus SELURUH data dummy sistem? Tindakan ini TIDAK BISA dibatalkan.');
                if (confirmed) {
                  const finalConfirm = window.prompt('Ketik "RESET" untuk melanjutkan:');
                  if (finalConfirm === 'RESET') {
                    resetAllDataToDefault();
                    addToast('success', 'Sistem Di-reset', 'Seluruh data demo telah dihapus. Sistem siap untuk Go-Live.');
                    setTimeout(() => {
                       window.location.reload();
                    }, 1500);
                  } else {
                    addToast('info', 'Dibatalkan', 'Kode salah. Reset data dibatalkan demi keamanan.');
                  }
                }
              }}
              className="mt-4 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Format & Bersihkan Sistem (Persiapan Go-Live)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
