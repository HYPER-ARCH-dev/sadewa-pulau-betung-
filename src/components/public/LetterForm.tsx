import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { VillageService } from '../../types';
import { WhatsAppService } from '../../services/whatsappService';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Lock,
  Upload,
  Eye,
  Trash2,
  FileUp,
  Users,
  Plus,
  ArrowLeft,
  Navigation,
  Compass,
  Zap,
  MapPin,
  Crosshair,
  RefreshCw,
  Send,
  MessageCircle,
  UserCheck,
  BadgeCheck
} from 'lucide-react';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';
import { api } from '../../services/api';
import {
  calculateHaversineDistance,
  extractBoundaryCoordinate,
  parseSmartCoordinates,
  getBoundary8Direction,
  calculatePolygonAreaShoelace
} from '../../utils';
import { compressImage, formatFileSize } from '../../utils/imageCompressor';
import { getServiceIconMeta } from './DocumentList';

const NEIGHBOR_QUICK_PRESETS = [
  'Jalan Desa',
  'Jalan Usaha Tani',
  'Parit / Saluran Air',
  'Tanah Kas Desa',
  'Kebun Sawit / Karet',
  'Lorong Warga',
  'Batas Hutan / Sempadan'
];

interface LetterFormProps {
  onBackToCatalog: () => void;
  onTrackCode: (code: string) => void;
}

export const LetterForm: React.FC<LetterFormProps> = ({ onBackToCatalog, onTrackCode }) => {
  const {
    services,
    submitServiceRequest,
    selectedServiceId,
    setSelectedServiceId,
    territories,
    villageProfile,
    addToast
  } = useApp();

  const [activeService, setActiveService] = useState<VillageService | null>(null);

  // Form states
  const [citizenName, setCitizenName] = useState('');
  const [citizenNik, setCitizenNik] = useState('');
  const [citizenGender, setCitizenGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [citizenBirthPlace, setCitizenBirthPlace] = useState('');
  const [citizenBirthDate, setCitizenBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [addressDusun, setAddressDusun] = useState('RT 01 Dusun Betung Indah');
  const [selectedDusunId, setSelectedDusunId] = useState<string>('');
  const [selectedRwId, setSelectedRwId] = useState<string>('');
  const [selectedRtId, setSelectedRtId] = useState<string>('');
  const [notes, setNotes] = useState('Perizinan Usaha Mikro & Kecil (IUMK) / Izin Usaha Tempat');
  const [purposeChoice, setPurposeChoice] = useState<string>('Perizinan Usaha Mikro & Kecil (IUMK) / Izin Usaha Tempat');
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [isAgreed, setIsAgreed] = useState(false);
  const [newTrackingCode, setNewTrackingCode] = useState<string | null>(null);
  const [submittedRequestMeta, setSubmittedRequestMeta] = useState<{
    serviceName: string;
    citizenName: string;
    citizenNik: string;
    maskedNik: string;
    phone: string;
    notes: string;
  } | null>(null);

  // KTP and Attachment upload state
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpPreviewUrl, setKtpPreviewUrl] = useState<string | null>(null);
  const [ktpAttachmentUrl, setKtpAttachmentUrl] = useState<string>('');
  const [isUploadingKtp, setIsUploadingKtp] = useState<boolean>(false);
  const [ktpUploadError, setKtpUploadError] = useState<string | null>(null);
  const [ktpStats, setKtpStats] = useState<{ originalSize: number; compressedSize: number; savedPercentage: number } | null>(null);
  const [isAnalyzingKtp, setIsAnalyzingKtp] = useState<boolean>(false);

  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [supportPreviewUrl, setSupportPreviewUrl] = useState<string | null>(null);
  const [fileAttachmentUrl, setFileAttachmentUrl] = useState<string>('');
  const [isUploadingSupport, setIsUploadingSupport] = useState<boolean>(false);
  const [supportUploadError, setSupportUploadError] = useState<string | null>(null);
  const [supportStats, setSupportStats] = useState<{ originalSize: number; compressedSize: number; savedPercentage: number } | null>(null);

  // Preview modal for citizen
  const [fullPreviewImage, setFullPreviewImage] = useState<string | null>(null);

  // Dynamic Heirs list state for srv-ahli-waris
  const [heirs, setHeirs] = useState<Array<{
    name: string;
    nik: string;
    birthPlaceDate: string;
    relationship: string;
    status: 'Hidup' | 'Meninggal';
  }>>([
    { name: '', nik: '', birthPlaceDate: '', relationship: '', status: 'Hidup' }
  ]);

  // Ahli Waris specific attachments
  const [heirsKtpKkFile, setHeirsKtpKkFile] = useState<File | null>(null);
  const [heirsKtpKkUrl, setHeirsKtpKkUrl] = useState<string>('');
  const [isUploadingHeirsKtpKk, setIsUploadingHeirsKtpKk] = useState<boolean>(false);
  const [heirsKtpKkError, setHeirsKtpKkError] = useState<string | null>(null);

  const [deathCertFile, setDeathCertFile] = useState<File | null>(null);
  const [deathCertUrl, setDeathCertUrl] = useState<string>('');
  const [isUploadingDeathCert, setIsUploadingDeathCert] = useState<boolean>(false);
  const [deathCertError, setDeathCertError] = useState<string | null>(null);

  const [marriageBookFile, setMarriageBookFile] = useState<File | null>(null);
  const [marriageBookUrl, setMarriageBookUrl] = useState<string>('');
  const [isUploadingMarriageBook, setIsUploadingMarriageBook] = useState<boolean>(false);
  const [marriageBookError, setMarriageBookError] = useState<string | null>(null);

  // Sporadik GPS Point Mapping State
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [locatingIndex, setLocatingIndex] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (selectedServiceId) {
      const s = services.find((item) => item.id === selectedServiceId);
      if (s) {
        setActiveService(s);
      }
    } else if (!activeService && services && services.length > 0) {
      setActiveService(services[0]);
    }
  }, [selectedServiceId, services, activeService]);

  // Sync initial territory from master data
  useEffect(() => {
    if (territories && territories.length > 0 && !selectedDusunId) {
      const firstDusun = territories[0];
      setSelectedDusunId(firstDusun.id);
      const firstRw = firstDusun.rws?.[0];
      if (firstRw) {
        setSelectedRwId(firstRw.id);
        const firstRt = firstRw.rts?.[0];
        if (firstRt) {
          setSelectedRtId(firstRt.id);
          setAddressDusun(`${firstRt.name}, ${firstRw.name}, ${firstDusun.name}`);
        }
      }
    }
  }, [territories, selectedDusunId]);

  const handleDusunChange = (dusunId: string) => {
    setSelectedDusunId(dusunId);
    const d = territories.find((t) => t.id === dusunId);
    const firstRw = d?.rws?.[0];
    const firstRt = firstRw?.rts?.[0];
    setSelectedRwId(firstRw?.id || '');
    setSelectedRtId(firstRt?.id || '');
    if (d && firstRw && firstRt) {
      setAddressDusun(`${firstRt.name}, ${firstRw.name}, ${d.name}`);
    } else if (d) {
      setAddressDusun(d.name);
    }
  };

  const handleRwChange = (rwId: string) => {
    setSelectedRwId(rwId);
    const d = territories.find((t) => t.id === selectedDusunId) || territories[0];
    const rw = d?.rws?.find((r) => r.id === rwId);
    const firstRt = rw?.rts?.[0];
    setSelectedRtId(firstRt?.id || '');
    if (d && rw && firstRt) {
      setAddressDusun(`${firstRt.name}, ${rw.name}, ${d.name}`);
    } else if (d && rw) {
      setAddressDusun(`${rw.name}, ${d.name}`);
    }
  };

  const handleRtChange = (rtId: string) => {
    setSelectedRtId(rtId);
    const d = territories.find((t) => t.id === selectedDusunId) || territories[0];
    const rw = d?.rws?.find((r) => r.id === selectedRwId) || d?.rws?.[0];
    const rt = rw?.rts?.find((t) => t.id === rtId);
    if (d && rw && rt) {
      setAddressDusun(`${rt.name}, ${rw.name}, ${d.name}`);
    }
  };

  const handleKtpSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setKtpUploadError(null);

    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setKtpUploadError('Format tidak didukung. Harap unggah foto JPG, PNG, WEBP, atau dokumen PDF.');
      e.target.value = '';
      return;
    }

    if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) {
      setKtpUploadError('Ukuran berkas PDF KTP melebihi batas maksimal 5MB.');
      e.target.value = '';
      return;
    }

    if (file.type.startsWith('image/') && file.size > 15 * 1024 * 1024) {
      setKtpUploadError('Ukuran gambar melebihi 15MB. Harap pilih foto yang lebih ringkas.');
      e.target.value = '';
      return;
    }

    setIsUploadingKtp(true);
    let activeFileToUpload: File = file;

    try {
      if (file.type.startsWith('image/')) {
        const compResult = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.78,
          preservePngTransparency: true
        });

        activeFileToUpload = compResult.file;
        setKtpFile(compResult.file);
        setKtpPreviewUrl(compResult.dataUrl);
        setKtpStats({
          originalSize: compResult.originalSize,
          compressedSize: compResult.compressedSize,
          savedPercentage: compResult.savedPercentage
        });
      } else {
        setKtpFile(file);
        setKtpPreviewUrl(null);
        setKtpStats(null);
      }

      const res = await api.uploadFileMultipart(activeFileToUpload);
      if (res.success && res.url) {
        setKtpAttachmentUrl(res.url);
      } else if (res.url) {
        setKtpAttachmentUrl(res.url);
      } else {
        if (activeFileToUpload.type.startsWith('image/')) {
          setKtpAttachmentUrl(ktpPreviewUrl || '');
        } else {
          setKtpUploadError(res.error || 'Gagal mengunggah berkas KTP ke server.');
        }
      }
    } catch (err: unknown) {
      console.warn('KTP upload notice:', err);
      if (ktpPreviewUrl) {
        setKtpAttachmentUrl(ktpPreviewUrl);
      } else {
        setKtpUploadError(err instanceof Error ? err.message : String(err) || 'Koneksi gagal saat mengunggah berkas KTP.');
      }
    } finally {
      setIsUploadingKtp(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleAnalyzeKtp = async () => {
    if (!ktpPreviewUrl || isAnalyzingKtp) return;
    
    setIsAnalyzingKtp(true);
    addToast('info', 'Menganalisis KTP...', 'Panjul sedang membaca data dari foto KTP dunsanak. Mohon tunggu...');
    
    try {
      const res = await api.analyzeDocument(ktpPreviewUrl, 'image/jpeg', 'ktp');
      if (res.success && res.data) {
        const data = res.data;
        if (data.nama) setCitizenName(data.nama);
        if (data.nik) setCitizenNik(data.nik);
        if (data.tempat_lahir) setCitizenBirthPlace(data.tempat_lahir);
        if (data.tanggal_lahir) {
          // Attempt to format date YYYY-MM-DD
          const rawDate = data.tanggal_lahir;
          if (rawDate.includes('-')) {
             setCitizenBirthDate(rawDate);
          } else {
             // Basic parsing for formats like "01-01-1990" or "01/01/1990"
             const parts = rawDate.split(/[-/]/);
             if (parts.length === 3) {
               const formatted = parts[2].length === 4 ? `${parts[2]}-${parts[1]}-${parts[0]}` : rawDate;
               setCitizenBirthDate(formatted);
             }
          }
        }
        if (data.jenis_kelamin) {
          const gender = data.jenis_kelamin.toLowerCase();
          if (gender.includes('laki') || gender === 'l') setCitizenGender('Laki-laki');
          else if (gender.includes('perempuan') || gender === 'p') setCitizenGender('Perempuan');
        }
        
        addToast('success', 'Data Berhasil Diisi!', 'Nama, NIK, dan data lainnya telah terisi otomatis. Mohon periksa kembali ya dunsanak!');
      } else {
        addToast('warning', 'Analisis Gagal', res.error || 'Panjul kurang jelas baca fotonya. Coba unggah foto yang lebih terang ya!');
      }
    } catch (err) {
      addToast('error', 'Gangguan Sistem', 'Gagal menghubungkan ke asisten AI untuk analisis dokumen.');
    } finally {
      setIsAnalyzingKtp(false);
    }
  };

  const handleRemoveKtp = () => {
    if (ktpPreviewUrl && !ktpPreviewUrl.startsWith('data:')) {
      URL.revokeObjectURL(ktpPreviewUrl);
    }
    setKtpFile(null);
    setKtpPreviewUrl(null);
    setKtpAttachmentUrl('');
    setKtpUploadError(null);
    setKtpStats(null);
  };

  const handleSupportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSupportUploadError(null);

    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setSupportUploadError('Format tidak didukung. Harap unggah berkas JPG, PNG, WEBP, atau PDF.');
      e.target.value = '';
      return;
    }

    if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) {
      setSupportUploadError('Ukuran berkas PDF lampiran melebihi batas maksimal 5MB.');
      e.target.value = '';
      return;
    }

    if (file.type.startsWith('image/') && file.size > 15 * 1024 * 1024) {
      setSupportUploadError('Ukuran gambar melebihi 15MB. Harap pilih foto yang lebih ringkas.');
      e.target.value = '';
      return;
    }

    setIsUploadingSupport(true);
    let activeFileToUpload: File = file;

    try {
      if (file.type.startsWith('image/')) {
        const compResult = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.78,
          preservePngTransparency: true
        });

        activeFileToUpload = compResult.file;
        setSupportFile(compResult.file);
        setSupportPreviewUrl(compResult.dataUrl);
        setSupportStats({
          originalSize: compResult.originalSize,
          compressedSize: compResult.compressedSize,
          savedPercentage: compResult.savedPercentage
        });
      } else {
        setSupportFile(file);
        setSupportPreviewUrl(null);
        setSupportStats(null);
      }

      const res = await api.uploadFileMultipart(activeFileToUpload);
      if (res.success && res.url) {
        setFileAttachmentUrl(res.url);
      } else if (res.url) {
        setFileAttachmentUrl(res.url);
      } else {
        if (activeFileToUpload.type.startsWith('image/')) {
          setFileAttachmentUrl(supportPreviewUrl || '');
        } else {
          setSupportUploadError(res.error || 'Gagal mengunggah lampiran ke server.');
        }
      }
    } catch (err: unknown) {
      console.warn('Support upload notice:', err);
      if (supportPreviewUrl) {
        setFileAttachmentUrl(supportPreviewUrl);
      } else {
        setSupportUploadError(err instanceof Error ? err.message : String(err) || 'Koneksi gagal saat mengunggah lampiran.');
      }
    } finally {
      setIsUploadingSupport(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleRemoveSupport = () => {
    if (supportPreviewUrl && !supportPreviewUrl.startsWith('data:')) {
      URL.revokeObjectURL(supportPreviewUrl);
    }
    setSupportFile(null);
    setSupportPreviewUrl(null);
    setFileAttachmentUrl('');
    setSupportUploadError(null);
    setSupportStats(null);
  };

  const handleHeirsKtpKkSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeirsKtpKkError(null);
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setHeirsKtpKkError('Format tidak didukung. Harap unggah foto JPG, PNG, WEBP, atau PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setHeirsKtpKkError('Ukuran berkas terlalu besar. Maksimal 10MB.');
      return;
    }
    setIsUploadingHeirsKtpKk(true);
    let activeFile = file;
    try {
      if (file.type.startsWith('image/')) {
        const comp = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
        activeFile = comp.file;
      }
      const res = await api.uploadFileMultipart(activeFile);
      if (res.url) {
        setHeirsKtpKkUrl(res.url);
      } else {
        setHeirsKtpKkError('Gagal mengunggah berkas.');
      }
    } catch (err: any) {
      setHeirsKtpKkError(err.message || 'Gagal mengunggah berkas.');
    } finally {
      setIsUploadingHeirsKtpKk(false);
    }
  };

  const handleDeathCertSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeathCertError(null);
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setDeathCertError('Format tidak didukung. Harap unggah foto JPG, PNG, WEBP, atau PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setDeathCertError('Ukuran berkas terlalu besar. Maksimal 10MB.');
      return;
    }
    setIsUploadingDeathCert(true);
    let activeFile = file;
    try {
      if (file.type.startsWith('image/')) {
        const comp = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
        activeFile = comp.file;
      }
      const res = await api.uploadFileMultipart(activeFile);
      if (res.url) {
        setDeathCertUrl(res.url);
      } else {
        setDeathCertError('Gagal mengunggah berkas.');
      }
    } catch (err: any) {
      setDeathCertError(err.message || 'Gagal mengunggah berkas.');
    } finally {
      setIsUploadingDeathCert(false);
    }
  };

  const handleMarriageBookSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMarriageBookError(null);
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setMarriageBookError('Format tidak didukung. Harap unggah foto JPG, PNG, WEBP, atau PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMarriageBookError('Ukuran berkas terlalu besar. Maksimal 10MB.');
      return;
    }
    setIsUploadingMarriageBook(true);
    let activeFile = file;
    try {
      if (file.type.startsWith('image/')) {
        const comp = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
        activeFile = comp.file;
      }
      const res = await api.uploadFileMultipart(activeFile);
      if (res.url) {
        setMarriageBookUrl(res.url);
      } else {
        setMarriageBookError('Gagal mengunggah berkas.');
      }
    } catch (err: any) {
      setMarriageBookError(err.message || 'Gagal mengunggah berkas.');
    } finally {
      setIsUploadingMarriageBook(false);
    }
  };

  const getBoundaries = (): any[] => {
    try {
      return JSON.parse(extraFields.sporadik_boundaries || '[]');
    } catch (e) {
      return [];
    }
  };

  const syncGpsBoundaries = (list: any[]) => {
    const updated = list.map((item) => ({ ...item }));
    const n = updated.length;
    if (n >= 2) {
      for (let i = 0; i < n; i++) {
        const curCoord = extractBoundaryCoordinate(updated[i]);
        const nextIdx = (i + 1) % n;
        const nextCoord = extractBoundaryCoordinate(updated[nextIdx]);

        if (curCoord && nextCoord) {
          const dist = calculateHaversineDistance(
            curCoord.lat,
            curCoord.lng,
            nextCoord.lat,
            nextCoord.lng
          );
          updated[i].length = dist.toString();
          updated[i].panjang = dist.toString();
          updated[i].autoDistance = dist;
          updated[i].isManualOverride = false;

          const dir = getBoundary8Direction(
            curCoord.lat,
            curCoord.lng,
            nextCoord.lat,
            nextCoord.lng
          );
          if (!updated[i].direction || updated[i].isAutoDirection !== false) {
            updated[i].direction = dir;
            updated[i].isAutoDirection = true;
          }
        }
      }
    }
    return updated;
  };

  const handleRecordGpsPoint = (targetIndex?: number) => {
    if (!navigator.geolocation) {
      addToast('error', 'GPS Tidak Didukung', 'Perangkat atau browser ini tidak mendukung akses geolokasi.');
      return;
    }

    setIsLocatingGps(true);
    if (typeof targetIndex === 'number') {
      setLocatingIndex(targetIndex);
    } else {
      setLocatingIndex(null);
    }

    let bestPosition: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let timeoutId: any = null;

    const commitPosition = (position: GeolocationPosition) => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timeoutId) clearTimeout(timeoutId);

      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));
      const accuracy = Math.round(position.coords.accuracy);
      setGpsAccuracy(accuracy);

      const list = getBoundaries();
      let targetIdx = targetIndex;

      let accuracyQuality = 'Cukup Akurat';
      if (accuracy <= 3) {
        accuracyQuality = 'Sangat Akurat (Tinggi)';
      } else if (accuracy <= 7) {
        accuracyQuality = 'Cukup Akurat (Standar)';
      } else {
        accuracyQuality = 'Kurang Akurat (Deviasi)';
      }

      if (typeof targetIdx !== 'number') {
        const emptyIdx = list.findIndex((b) => !b.lat && !b.latitude && !b.coordinateText);
        if (emptyIdx !== -1) {
          targetIdx = emptyIdx;
        } else {
          list.push({
            direction: '',
            neighbor: '',
            length: '',
            panjang: '',
            coordinateText: `${lat}, ${lng}`,
            lat,
            lng,
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
            accuracyQuality: accuracyQuality
          });
          targetIdx = list.length - 1;
        }
      }

      if (list[targetIdx]) {
        list[targetIdx].lat = lat;
        list[targetIdx].lng = lng;
        list[targetIdx].latitude = lat;
        list[targetIdx].longitude = lng;
        list[targetIdx].coordinateText = `${lat}, ${lng}`;
        list[targetIdx].accuracy = accuracy;
        list[targetIdx].accuracyQuality = accuracyQuality;
      }

      const synced = syncGpsBoundaries(list);
      setExtraFields((prev) => ({
        ...prev,
        sporadik_mode: 'gps',
        gps_accuracy: String(accuracy),
        gps_quality: accuracyQuality,
        sporadik_method: prev.sporadik_method || 'hybrid_wgs84',
        sporadik_boundaries: JSON.stringify(synced)
      }));

      setIsLocatingGps(false);
      setLocatingIndex(null);

      if (accuracy <= 3) {
        addToast(
          'success',
          `Titik Patok T${targetIdx + 1} Terkunci: Sangat Akurat! (±${accuracy}m)`,
          `Sinyal Satelit Optimal (WGS84: ${lat}, ${lng}). Kualitas penguncian sangat tinggi.`
        );
      } else if (accuracy <= 7) {
        addToast(
          'info',
          `Titik Patok T${targetIdx + 1} Terkunci: Cukup Akurat (±${accuracy}m)`,
          `Koordinat: ${lat}, ${lng}. Anda dapat menyempurnakan angka panjang sisi dengan pita ukur fisik.`
        );
      } else {
        addToast(
          'warning',
          `Titik Patok T${targetIdx + 1} Terkunci: Kurang Akurat (±${accuracy}m)`,
          `Sinyal satelit terhalang kanopi/bangunan. Disarankan verifikasi panjang batas dengan pita ukur meteran.`
        );
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = pos;
        }
        if (pos.coords.accuracy <= 4) {
          commitPosition(pos);
        }
      },
      (err) => {
        console.warn('Watch GPS error, fallback to single:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );

    timeoutId = setTimeout(() => {
      if (bestPosition) {
        commitPosition(bestPosition);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => commitPosition(pos),
          (err) => {
            setIsLocatingGps(false);
            setLocatingIndex(null);
            console.error('Error GPS:', err);
            addToast('error', 'Gagal Mengambil Lokasi GPS', 'Pastikan GPS HP aktif dan izin lokasi telah disetujui.');
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      }
    }, 2800);
  };

  const handleQuickSelectNeighbor = (index: number, preset: string) => {
    const list = getBoundaries();
    if (!list[index]) return;
    list[index].neighbor = preset;
    setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(list) }));
  };

  const calculateCurrentPolygonArea = () => {
    const list = getBoundaries();
    const coords: [number, number][] = [];
    list.forEach((b) => {
      const c = extractBoundaryCoordinate(b);
      if (c && !isNaN(c.lat) && !isNaN(c.lng) && (c.lat !== 0 || c.lng !== 0)) {
        coords.push([c.lat, c.lng]);
      }
    });
    if (coords.length >= 3) {
      return calculatePolygonAreaShoelace(coords);
    }
    return null;
  };

  const handleApplyCalculatedArea = () => {
    const areaResult = calculateCurrentPolygonArea();
    if (areaResult && areaResult.areaSqM > 0) {
      setExtraFields((prev) => ({
        ...prev,
        luas_tanah: `${areaResult.areaSqM.toLocaleString('id-ID')} m²`
      }));
      addToast(
        'success',
        'Luas Tanah Diperbarui',
        `Luas ${areaResult.formattedAreaSqM} (${areaResult.formattedAreaHectares}) telah disalin ke formulir.`
      );
    }
  };

  const handleUpdateBoundary = (index: number, field: string, value: any) => {
    const list = getBoundaries();
    if (!list[index]) return;
    list[index][field] = value;
    if (field === 'length') {
      list[index].panjang = value;
      list[index].isManualOverride = true;
    }
    if (field === 'direction') {
      list[index].isAutoDirection = false;
    }
    setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(list) }));
  };

  const handleRemoveBoundary = (index: number) => {
    const list = getBoundaries();
    list.splice(index, 1);
    if (extraFields.sporadik_mode === 'gps' && list.length >= 2) {
      const updated = syncGpsBoundaries(list);
      setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(updated) }));
    } else {
      setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(list) }));
    }
  };

  const handleAddBoundary = () => {
    const list = getBoundaries();
    list.push({
      direction: '',
      neighbor: '',
      length: '',
      panjang: '',
      coordinateText: '',
      lat: '',
      lng: '',
      latitude: '',
      longitude: ''
    });
    setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(list) }));
  };

  const handleCreateDefaultFourCorners = () => {
    const defaultCorners = [
      { direction: 'Utara', neighbor: '', length: '', panjang: '', coordinateText: '', lat: '', lng: '', latitude: '', longitude: '' },
      { direction: 'Timur', neighbor: '', length: '', panjang: '', coordinateText: '', lat: '', lng: '', latitude: '', longitude: '' },
      { direction: 'Selatan', neighbor: '', length: '', panjang: '', coordinateText: '', lat: '', lng: '', latitude: '', longitude: '' },
      { direction: 'Barat', neighbor: '', length: '', panjang: '', coordinateText: '', lat: '', lng: '', latitude: '', longitude: '' },
    ];
    setExtraFields((prev) => ({
      ...prev,
      sporadik_boundaries: JSON.stringify(defaultCorners)
    }));
    addToast('info', 'Template 4 Sudut Dibuat', 'Silakan kunci GPS atau isi data pada 4 sisi batas tanah (T1 s/d T4).');
  };

  const applyHaversineLoopCalculation = (list: any[], changedIndex: number) => {
    const n = list.length;
    if (n < 2) return;

    const currentCoord = extractBoundaryCoordinate(list[changedIndex]);
    const nextIdx = changedIndex === n - 1 ? 0 : changedIndex + 1;
    const nextCoord = extractBoundaryCoordinate(list[nextIdx]);

    if (currentCoord && nextCoord) {
      const dist = calculateHaversineDistance(
        currentCoord.lat,
        currentCoord.lng,
        nextCoord.lat,
        nextCoord.lng
      );
      list[changedIndex].length = dist.toString();
      list[changedIndex].panjang = dist.toString();
      list[changedIndex].autoDistance = dist;
      list[changedIndex].isManualOverride = false;

      const dir = getBoundary8Direction(
        currentCoord.lat,
        currentCoord.lng,
        nextCoord.lat,
        nextCoord.lng
      );
      if (!list[changedIndex].direction || list[changedIndex].isAutoDirection !== false) {
        list[changedIndex].direction = dir;
        list[changedIndex].isAutoDirection = true;
      }
    }

    const prevIdx = (changedIndex - 1 + n) % n;
    const prevCoord = extractBoundaryCoordinate(list[prevIdx]);
    if (prevCoord && currentCoord && !list[prevIdx].isManualOverride) {
      const prevDist = calculateHaversineDistance(
        prevCoord.lat,
        prevCoord.lng,
        currentCoord.lat,
        currentCoord.lng
      );
      list[prevIdx].length = prevDist.toString();
      list[prevIdx].panjang = prevDist.toString();
      list[prevIdx].autoDistance = prevDist;

      const prevDir = getBoundary8Direction(
        prevCoord.lat,
        prevCoord.lng,
        currentCoord.lat,
        currentCoord.lng
      );
      if (!list[prevIdx].direction || list[prevIdx].isAutoDirection !== false) {
        list[prevIdx].direction = prevDir;
        list[prevIdx].isAutoDirection = true;
      }
    }
  };

  const handleCoordinateChange = (index: number, text: string) => {
    const list = getBoundaries();
    if (!list[index]) return;

    list[index].coordinateText = text;

    const parsed = parseSmartCoordinates(text);
    if (parsed && parsed.isValid) {
      list[index].lat = parsed.lat;
      list[index].lng = parsed.lng;
      list[index].latitude = parsed.lat;
      list[index].longitude = parsed.lng;
      list[index].isDms = parsed.isDmsOrConverted;

      applyHaversineLoopCalculation(list, index);
    }

    setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(list) }));
  };

  const handleCoordinateBlur = (index: number, text: string) => {
    const list = getBoundaries();
    if (!list[index]) return;

    const trimmed = text.trim();
    if (trimmed) {
      const parsed = parseSmartCoordinates(trimmed);
      if (parsed && parsed.isValid) {
        list[index].lat = parsed.lat;
        list[index].lng = parsed.lng;
        list[index].latitude = parsed.lat;
        list[index].longitude = parsed.lng;
        list[index].isDms = parsed.isDmsOrConverted;
        list[index].coordinateText = trimmed;

        applyHaversineLoopCalculation(list, index);
      }
    } else {
      delete list[index].lat;
      delete list[index].lng;
      delete list[index].latitude;
      delete list[index].longitude;
      delete list[index].autoDistance;
      delete list[index].isDms;
      list[index].coordinateText = '';
    }

    setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(list) }));
  };

  const handleRecalculateAllDistances = () => {
    const list = getBoundaries();
    const updated = syncGpsBoundaries(list);
    setExtraFields((prev) => ({ ...prev, sporadik_boundaries: JSON.stringify(updated) }));
    addToast('success', 'Kalkulasi Ulang Selesai', 'Jarak antar patok dan arah mata angin telah dihitung ulang.');
  };

  const getCoordinateDisplayValue = (boundary: any): string => {
    if (boundary.coordinateText !== undefined) {
      return boundary.coordinateText;
    }
    const lat = boundary.lat !== undefined && boundary.lat !== '' ? boundary.lat : boundary.latitude;
    const lng = boundary.lng !== undefined && boundary.lng !== '' ? boundary.lng : boundary.longitude;
    if (lat !== undefined && lat !== '' && lng !== undefined && lng !== '') {
      return `${lat}, ${lng}`;
    }
    return '';
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeService) return;

    let maskedNik = citizenNik.trim();
    if (maskedNik.length >= 10) {
      maskedNik = maskedNik.substring(0, 6) + '******' + maskedNik.substring(maskedNik.length - 4);
    } else {
      maskedNik = '150401******0001';
    }

    const cleanCitizenNotes = notes.trim() || (extraFields.purpose ? String(extraFields.purpose).trim() : '');

    let finalExtraFields = { ...extraFields };
    if (activeService.id === 'srv-ahli-waris') {
      const validHeirs = heirs.filter(h => h.name.trim() !== '');
      if (validHeirs.length === 0) {
        addToast('error', 'Validasi Gagal', 'Daftar ahli waris wajib diisi minimal 1 orang.');
        return;
      }
      finalExtraFields.heirs_list_json = JSON.stringify(validHeirs);
      finalExtraFields.heirs_list = validHeirs.map((h, idx) => `${idx + 1}. ${h.name} (${h.relationship}) - ${h.status}`).join('\n');
      finalExtraFields.ktp_kk_heirs_url = heirsKtpKkUrl;
      finalExtraFields.death_certificate_url = deathCertUrl;
      finalExtraFields.marriage_book_url = marriageBookUrl;
    }

    if (finalExtraFields.sporadik_boundaries) {
      try {
        const parsedBoundaries = JSON.parse(finalExtraFields.sporadik_boundaries);
        if (Array.isArray(parsedBoundaries)) {
          const sanitized = parsedBoundaries.map((b: any) => {
            if (b.coordinateText) {
              const parsed = parseSmartCoordinates(b.coordinateText);
              if (parsed && parsed.isValid) {
                b.lat = parsed.lat;
                b.lng = parsed.lng;
                b.latitude = parsed.lat;
                b.longitude = parsed.lng;
                b.isDms = parsed.isDmsOrConverted;
              }
            }
            const finalLen = b.length || b.panjang || '';
            b.length = finalLen;
            b.panjang = finalLen;
            return b;
          });
          finalExtraFields.sporadik_boundaries = JSON.stringify(sanitized);
        }
      } catch (err) {
        console.warn('Error parsing final sporadik_boundaries:', err);
      }
    }

    const code = submitServiceRequest({
      serviceId: activeService.id,
      serviceName: activeService.name,
      citizenName: citizenName.trim(),
      citizenNik: citizenNik.trim(),
      citizenNikMasked: maskedNik,
      phone: phone.trim(),
      addressDusun,
      citizenGender,
      citizenBirthPlace: citizenBirthPlace.trim(),
      citizenBirthDate,
      dusunId: selectedDusunId || undefined,
      rwId: selectedRwId || undefined,
      rtId: selectedRtId || undefined,
      notes: cleanCitizenNotes,
      ktpAttachmentUrl: ktpAttachmentUrl || undefined,
      fileAttachmentUrl: fileAttachmentUrl || undefined,
      formData: {
        ...finalExtraFields,
        gender: citizenGender,
        birth_place: citizenBirthPlace.trim(),
        birth_date: citizenBirthDate
      }
    });

    setNewTrackingCode(code);
    setSubmittedRequestMeta({
      serviceName: activeService.name,
      citizenName: citizenName.trim(),
      citizenNik: citizenNik.trim(),
      maskedNik,
      phone: phone.trim(),
      notes: cleanCitizenNotes
    });
    addToast('success', 'Permohonan Terkirim', `Permohonan surat berhasil diajukan dengan Nomor Resi: ${code}`);

    // Reset inputs
    setCitizenName('');
    setCitizenNik('');
    setCitizenBirthPlace('');
    setCitizenBirthDate('');
    setPhone('');
    setNotes('');
    setExtraFields({});
    setIsAgreed(false);
    handleRemoveKtp();
    handleRemoveSupport();
    setHeirs([{ name: '', nik: '', birthPlaceDate: '', relationship: '', status: 'Hidup' }]);
    setHeirsKtpKkFile(null);
    setHeirsKtpKkUrl('');
    setDeathCertFile(null);
    setDeathCertUrl('');
    setMarriageBookFile(null);
    setMarriageBookUrl('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 relative">
      {/* Subtle Watermark Branding */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none -z-10 overflow-hidden">
        <SadewaHouseLogo className="w-[500px] h-[500px] rotate-12" />
      </div>

      {newTrackingCode ? (
        <div className="bg-white rounded-3xl p-8 border border-emerald-300 shadow-xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Permohonan Berhasil Diajukan!</h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Permohonan Anda telah tersimpan di sistem pelayanan {villageProfile.villageName || 'Desa'}. Simpan kode resi berikut untuk memantau status secara berkala.
          </p>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 inline-block font-mono text-xl sm:text-2xl font-black text-emerald-900 tracking-wider">
            {newTrackingCode}
          </div>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
            <button
              onClick={() => {
                onTrackCode(newTrackingCode);
                setNewTrackingCode(null);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 cursor-pointer"
            >
              Pantau Status Sekarang
            </button>
            <a
              href={WhatsAppService.buildShareUrl(
                villageProfile.whatsappCenter || '0822-8199-0112',
                `${WhatsAppService.NUSANTARA_GREETING}\n\n` +
                `🔔 *PERMOHONAN SURAT BARU SADEWA*\n\n` +
                `Halo Admin / Perangkat Desa, mohon verifikasi pengajuan surat baru dari warga melalui Portal Mandiri:\n\n` +
                `• *Jenis Layanan* : ${submittedRequestMeta?.serviceName || 'Surat Desa'}\n` +
                `• *Nomor Resi* : ${newTrackingCode}\n` +
                `• *Nama Pemohon* : ${submittedRequestMeta?.citizenName || '-'}\n` +
                `• *NIK (Masked)* : ${submittedRequestMeta?.maskedNik || '-'}\n` +
                `• *No. HP Pemohon* : ${submittedRequestMeta?.phone || '-'}\n` +
                `• *Keperluan* : ${submittedRequestMeta?.notes || '-'}\n\n` +
                `Silakan buka *Dashboard Admin SADEWA* untuk memeriksa berkas dan memproses penerbitan dokumen. Terima kasih.\n\n` +
                `_Portal Resmi Pemerintah ${villageProfile.villageName || 'Desa Pulau Betung'}_`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Kirim Notifikasi ke WA Admin Desa</span>
            </a>
            <button
              onClick={() => setNewTrackingCode(null)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
            >
              Ajukan Permohonan Lain
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Formulir Permohonan Layanan Online</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Silakan lengkapi data permohonan dengan data yang valid.
              </p>
            </div>
            <button
              onClick={onBackToCatalog}
              className="text-xs text-emerald-700 font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Katalog</span>
            </button>
          </div>

          {/* Service Selector Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Pilih Jenis Surat ({services.length} Pilihan Tersedia):
              </label>
              <span className="text-[11px] text-emerald-700 font-semibold hidden sm:inline">
                Pilih langsung di bawah ini
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2">
              {services.map((s) => {
                const isSelected = activeService?.id === s.id;
                const isNew = ['srv-6', 'srv-7', 'srv-8', 'srv-9', 'srv-nikah-bundle'].includes(s.id);
                const { Icon: IconComponent, color: iconColor } = getServiceIconMeta(s.name, s.id);

                return (
                  <button
                    key={s.id}
                    type="button"
                    id={`btn-service-card-${s.id}`}
                    onClick={() => {
                      setActiveService(s);
                      setSelectedServiceId(s.id);
                      setExtraFields({});
                    }}
                    className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[64px] cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/70'
                    }`}
                  >
                    {isNew && (
                      <span className="absolute top-1 right-1 px-1 py-0.5 rounded text-[8px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 leading-none">
                        Baru
                      </span>
                    )}
                    <div>
                      <div className="flex items-start space-x-1.5 mb-1 pr-3">
                        <IconComponent className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isSelected ? 'text-emerald-700' : iconColor}`} />
                        <span className={`text-[11px] font-bold leading-snug line-clamp-2 ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                          {s.name.replace('Surat Keterangan ', 'SK ').replace('Surat Pengantar ', 'SP ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 pt-1 border-t border-slate-100/80">
                      <span>{s.estimatedDays}</span>
                      <span className="font-semibold text-emerald-700">{s.cost === 'Gratis' || s.cost === 'Gratis (Rp 0)' ? 'Gratis' : s.cost}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Service Info Banner */}
          {activeService && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 space-y-2">
              <div className="font-bold flex items-center justify-between">
                <span>Persyaratan {activeService.name}:</span>
                <span className="text-emerald-700 font-normal">Waktu pengerjaan: {activeService.estimatedDays}</span>
              </div>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                {activeService.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Pemohon (Sesuai KTP) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hendri Saputra"
                  value={citizenName}
                  onChange={(e) => setCitizenName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Induk Kependudukan (NIK) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="16 digit NIK Anda"
                  value={citizenNik}
                  onChange={(e) => setCitizenNik(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>Data NIK dilindungi dan disamarkan di halaman publik.</span>
                </span>
              </div>
            </div>

            {/* Demographic Fields */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Biodata Warga Pemohon
                </span>
                <span className="text-[10px] text-slate-500">Sesuai KTP / KK Asli</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Kelamin *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCitizenGender('Laki-laki')}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center cursor-pointer ${
                        citizenGender === 'Laki-laki'
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Laki-laki
                    </button>
                    <button
                      type="button"
                      onClick={() => setCitizenGender('Perempuan')}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center cursor-pointer ${
                        citizenGender === 'Perempuan'
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Perempuan
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tempat Lahir *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pulau Betung"
                    value={citizenBirthPlace}
                    onChange={(e) => setCitizenBirthPlace(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Lahir *
                  </label>
                  <input
                    type="date"
                    required
                    value={citizenBirthDate}
                    onChange={(e) => setCitizenBirthDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp / HP Aktif *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="08xxxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wilayah Domisili (Dusun / RW / RT) *
                </label>
                {territories && territories.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <select
                        value={selectedDusunId}
                        onChange={(e) => handleDusunChange(e.target.value)}
                        className="w-full text-xs px-2 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white truncate"
                        title="Pilih Dusun"
                      >
                        {territories.filter((d) => d.isActive !== false).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={selectedRwId}
                        onChange={(e) => handleRwChange(e.target.value)}
                        className="w-full text-xs px-2 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white truncate"
                        title="Pilih RW"
                      >
                        {(territories.find((t) => t.id === selectedDusunId)?.rws || [])
                          .filter((rw) => rw.isActive !== false)
                          .map((rw) => (
                            <option key={rw.id} value={rw.id}>
                              {rw.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={selectedRtId}
                        onChange={(e) => handleRtChange(e.target.value)}
                        className="w-full text-xs px-2 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white truncate"
                        title="Pilih RT"
                      >
                        {(territories.find((t) => t.id === selectedDusunId)?.rws?.find((r) => r.id === selectedRwId)?.rts || [])
                          .filter((rt) => rt.isActive !== false)
                          .map((rt) => (
                            <option key={rt.id} value={rt.id}>
                              {rt.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <select
                    value={addressDusun}
                    onChange={(e) => setAddressDusun(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    <option value="RT 01 Dusun 1">RT 01 Dusun 1</option>
                    <option value="RT 02 Dusun 1">RT 02 Dusun 1</option>
                    <option value="RT 03 Dusun 1">RT 03 Dusun 1</option>
                    <option value="RT 04 Dusun 2">RT 04 Dusun 2</option>
                    <option value="RT 05 Dusun 2">RT 05 Dusun 2</option>
                    <option value="RT 06 Dusun 2">RT 06 Dusun 2</option>
                  </select>
                )}
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Tercatat: <strong className="text-slate-700">{addressDusun}</strong>
                </span>
              </div>
            </div>

            {/* SPORADIK SPECIFIC DYNAMIC FIELDS: Batas Tanah */}
            {activeService?.id === 'srv-sporadik' ? (
              <>
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Lokasi & Objek Tanah
                  </label>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Alamat / Lokasi Spesifik Keberadaan Tanah *
                    </label>
                    <textarea
                      placeholder="Contoh: Jl. Poros Tani RT 04 Dusun II, Dekat Jembatan Kayu (atau lokasi bebas lainnya)"
                      value={extraFields.lokasi_tanah || ''}
                      onChange={(e) => setExtraFields({ ...extraFields, lokasi_tanah: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[80px]"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Konfigurasi Batas Tanah & Patok
                        </label>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {extraFields.sporadik_mode === 'gps' ? 'Mode GPS Patok' : 'Mode Manual'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {extraFields.sporadik_mode === 'gps'
                          ? 'Otomatis mendeteksi 8 arah mata angin (Azimuth) & menghitung panjang batas (Haversine Formula) dari GPS HP.'
                          : 'Mode Manual deskriptif: tentukan arah mata angin, nama tetangga, dan panjang batas secara mandiri.'}
                      </p>
                    </div>
                    
                    {/* Toggle Manual / GPS */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto shadow-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setExtraFields((prev) => ({
                            ...prev,
                            sporadik_mode: 'manual'
                          }));
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          extraFields.sporadik_mode === 'manual'
                            ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>Input Manual</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const list = getBoundaries();
                          const updated = syncGpsBoundaries(list);
                          setExtraFields((prev) => ({
                            ...prev,
                            sporadik_mode: 'gps',
                            sporadik_boundaries: JSON.stringify(updated)
                          }));
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          extraFields.sporadik_mode !== 'manual'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-300" />
                        <span>GPS Patok Lapangan</span>
                      </button>
                    </div>
                  </div>

                  {/* GPS MODE CONTROLS & RADAR LOCK */}
                  {extraFields.sporadik_mode !== 'manual' && (
                    <div className="p-3.5 bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-2xl space-y-3 shadow-xs">
                      <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 block">Metode Pengukuran Bidang:</span>
                            <span className="text-[10px] text-slate-500">
                              {extraFields.sporadik_method === 'full_wgs84'
                                ? 'Perhitungan murni jarak & sudut koordinat satelit WGS84.'
                                : 'Kombinasi koordinat WGS84 untuk letak/arah + Pita Ukur Fisik untuk presisi panjang batas.'}
                            </span>
                          </div>
                        </div>
                        <select
                          value={extraFields.sporadik_method || 'hybrid_wgs84'}
                          onChange={(e) => setExtraFields((prev) => ({ ...prev, sporadik_method: e.target.value }))}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 focus:outline-none focus:ring-1.5 focus:ring-emerald-600 cursor-pointer"
                        >
                          <option value="hybrid_wgs84">Metode Hybrid (GPS WGS84 + Pita Ukur Fisik)</option>
                          <option value="full_wgs84">Full GNSS SADEWA Engine (Murni WGS84)</option>
                        </select>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Crosshair className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-emerald-950 flex flex-wrap items-center gap-1.5">
                              <span>Perekam Patok Lapangan (T1, T2, dst)</span>
                              {gpsAccuracy !== null && (
                                <span
                                  className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 ${
                                    gpsAccuracy <= 3
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : gpsAccuracy <= 7
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    gpsAccuracy <= 3 ? 'bg-emerald-600' : gpsAccuracy <= 7 ? 'bg-amber-500' : 'bg-rose-600'
                                  }`}></span>
                                  <span>Akurasi GPS: ±{gpsAccuracy}m</span>
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-emerald-800/80">
                              Berdirilah tepat di patok sudut tanah Anda lalu tekan tombol kunci lokasi.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRecordGpsPoint()}
                            disabled={isLocatingGps}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-xl transition-all shadow-sm cursor-pointer"
                          >
                            {isLocatingGps && locatingIndex === null ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                            )}
                            <span>
                              {isLocatingGps && locatingIndex === null
                                ? 'Mengunci Koordinat...'
                                : `📍 Kunci GPS Patok T${getBoundaries().length + 1}`}
                            </span>
                          </button>

                          {getBoundaries().length >= 2 && (
                            <button
                              type="button"
                              onClick={handleRecalculateAllDistances}
                              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-100/60 border border-emerald-300 rounded-xl transition-colors cursor-pointer"
                              title="Hitung ulang otomatis jarak Haversine & arah mata angin 8 penjuru"
                            >
                              <RefreshCw className="w-3 h-3 text-emerald-700" />
                              <span>Hitung Ulang</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cara Kerja Info Box */}
                      <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-200/90 text-[11px] text-slate-700 space-y-1 shadow-2xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Cara Kerja Pengukuran Lapangan:</span>
                        </div>
                        <p className="text-[10.5px] leading-relaxed text-slate-600">
                          Saat Anda berjalan dari <strong>Patok T1 ➔ T2 ➔ T3</strong> (searah jarum jam), garis langkah yang Anda lewati adalah <strong>Pagar Sisi Batas</strong>. Tanah Anda berada di sebelah <strong>KANAN (dalam)</strong>, sedangkan <strong>Nama Tetangga / Jalan / Parit</strong> yang Anda input adalah yang berada di sebelah <strong>KIRI (luar seberang garis langkah)</strong>.
                        </p>
                      </div>

                      {/* Real-time SVG cadastra sketch */}
                      {(() => {
                        const list = getBoundaries();
                        const validPoints = list
                          .map((b, idx) => {
                            const c = extractBoundaryCoordinate(b);
                            return {
                              idx,
                              label: `T${idx + 1}`,
                              lat: c ? c.lat : 0,
                              lng: c ? c.lng : 0,
                              neighbor: b.neighbor || `Batas #${idx + 1}`,
                              direction: b.direction || '',
                              length: b.length || b.panjang || '0'
                            };
                          })
                          .filter((p) => p.lat !== 0 && p.lng !== 0);

                        if (validPoints.length < 2) return null;

                        const minLat = Math.min(...validPoints.map((p) => p.lat));
                        const maxLat = Math.max(...validPoints.map((p) => p.lat));
                        const minLng = Math.min(...validPoints.map((p) => p.lng));
                        const maxLng = Math.max(...validPoints.map((p) => p.lng));

                        const latRange = Math.max(maxLat - minLat, 0.00001);
                        const lngRange = Math.max(maxLng - minLng, 0.00001);

                        const pad = 36;
                        const w = 480;
                        const h = 230;
                        const innerW = w - pad * 2;
                        const innerH = h - pad * 2;

                        const svgPoints = validPoints.map((p) => {
                          const x = pad + ((p.lng - minLng) / lngRange) * innerW;
                          const y = pad + ((maxLat - p.lat) / latRange) * innerH;
                          return { ...p, x, y };
                        });

                        const areaInfo = calculateCurrentPolygonArea();
                        const totalPerimeter = validPoints.reduce((sum, p) => sum + (parseFloat(p.length) || 0), 0);

                        return (
                          <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2.5 shadow-md">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Compass className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-slate-100">
                                  Sketsa Cadastral Lapangan Real-Time ({validPoints.length} Titik Patok)
                                </span>
                              </div>

                              {areaInfo && areaInfo.areaSqM > 0 && (
                                <button
                                  type="button"
                                  onClick={handleApplyCalculatedArea}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-all shadow-xs cursor-pointer"
                                >
                                  <Zap className="w-3.5 h-3.5 text-emerald-950" />
                                  <span>Salin Luas ({areaInfo.formattedAreaSqM})</span>
                                </button>
                              )}
                            </div>

                            <div className="relative w-full h-[200px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
                              <div
                                className="absolute inset-0 opacity-15 pointer-events-none"
                                style={{
                                  backgroundImage: 'linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)',
                                  backgroundSize: '20px 20px'
                                }}
                              />

                              <div className="absolute top-2 right-2 bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded flex flex-col items-center z-10 shadow-xs">
                                <span className="text-[8px] font-bold text-emerald-400 font-mono">U</span>
                                <Navigation className="w-3 h-3 text-emerald-400 -rotate-45" />
                              </div>

                              <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
                                {svgPoints.length >= 3 && (
                                  <polygon
                                    points={svgPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                                    fill="rgba(16, 185, 129, 0.25)"
                                    stroke="#10b981"
                                    strokeWidth="2.5"
                                    strokeDasharray="4 2"
                                  />
                                )}

                                {svgPoints.length === 2 && (
                                  <line
                                    x1={svgPoints[0].x}
                                    y1={svgPoints[0].y}
                                    x2={svgPoints[1].x}
                                    y2={svgPoints[1].y}
                                    stroke="#10b981"
                                    strokeWidth="2.5"
                                    strokeDasharray="4 2"
                                  />
                                )}

                                {svgPoints.map((p1, idx) => {
                                  const p2 = svgPoints[(idx + 1) % svgPoints.length];
                                  if (svgPoints.length === 2 && idx === 1) return null;
                                  const midX = (p1.x + p2.x) / 2;
                                  const midY = (p1.y + p2.y) / 2;
                                  return (
                                    <g key={`edge-label-${idx}`}>
                                      <rect
                                        x={midX - 32}
                                        y={midY - 8}
                                        width="64"
                                        height="16"
                                        rx="4"
                                        fill="#0f172a"
                                        stroke="#334155"
                                        strokeWidth="1"
                                      />
                                      <text
                                        x={midX}
                                        y={midY + 3.5}
                                        textAnchor="middle"
                                        className="text-[8.5px] fill-emerald-300 font-mono font-bold select-none"
                                      >
                                        {p1.direction ? `${p1.direction.slice(0, 2)} • ` : ''}±{p1.length}m
                                      </text>
                                    </g>
                                  );
                                })}

                                {svgPoints.map((p) => (
                                  <g key={`point-${p.idx}`}>
                                    <circle cx={p.x} cy={p.y} r="8" fill="rgba(16, 185, 129, 0.3)" />
                                    <circle cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                                    <rect
                                      x={p.x - 11}
                                      y={p.y - 22}
                                      width="22"
                                      height="14"
                                      rx="3"
                                      fill="#059669"
                                      stroke="#ffffff"
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={p.x}
                                      y={p.y - 12}
                                      textAnchor="middle"
                                      className="text-[9px] fill-white font-black select-none"
                                    >
                                      {p.label}
                                    </text>
                                  </g>
                                ))}
                              </svg>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                              <div className="p-1.5 bg-slate-800/90 rounded-lg border border-slate-700/60">
                                <span className="text-[9px] text-slate-400 block">Titik Patok</span>
                                <strong className="text-emerald-400 font-mono text-xs">
                                  {validPoints.length} Titik (T1-T{validPoints.length})
                                </strong>
                              </div>
                              <div className="p-1.5 bg-slate-800/90 rounded-lg border border-slate-700/60">
                                <span className="text-[9px] text-slate-400 block">Keliling Sempadan</span>
                                <strong className="text-slate-100 font-mono text-xs">± {totalPerimeter.toFixed(1)} Meter</strong>
                              </div>
                              <div className="p-1.5 bg-slate-800/90 rounded-lg border border-slate-700/60">
                                <span className="text-[9px] text-slate-400 block">Estimasi Luas</span>
                                <strong className="text-amber-300 font-mono text-xs">
                                  {areaInfo ? `${areaInfo.formattedAreaSqM}` : 'Min. 3 Patok'}
                                </strong>
                              </div>
                              <div className="p-1.5 bg-slate-800/90 rounded-lg border border-slate-700/60">
                                <span className="text-[9px] text-slate-400 block">Skala Presisi GPS</span>
                                <strong className="text-teal-300 font-mono text-[11px]">
                                  6 Desimal (~0.1m)
                                </strong>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Boundary Fields Repeaters */}
                  <div className="space-y-3">
                    {getBoundaries().map((boundary: any, index: number) => {
                      const isGps = extraFields.sporadik_mode !== 'manual';
                      const totalBoundaries = getBoundaries().length;
                      const nextPointLabel = `T${index === totalBoundaries - 1 ? 1 : index + 2}`;

                      return (
                        <div
                          key={index}
                          className="relative p-3.5 sm:p-4 bg-slate-50 hover:bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3 transition-all shadow-xs"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                                {isGps ? `T${index + 1}` : index + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-800">
                                    {isGps ? `Titik Patok T${index + 1}` : `Batas #${index + 1}`}
                                  </span>
                                  {isGps && (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      (Menuju Patok {nextPointLabel})
                                    </span>
                                  )}
                                </div>
                                {isGps && (boundary.lat !== undefined && boundary.lat !== '') && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[9.5px] font-mono text-emerald-700 font-semibold flex items-center gap-1">
                                      <span>Lat: {boundary.lat}, Lng: {boundary.lng}</span>
                                    </span>
                                    {boundary.accuracy !== undefined && (
                                      <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded border font-semibold bg-emerald-50 text-emerald-700 border-emerald-300">
                                        GPS ±{boundary.accuracy}m
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isGps && (
                                <button
                                  type="button"
                                  onClick={() => handleRecordGpsPoint(index)}
                                  disabled={isLocatingGps}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 border border-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isLocatingGps && locatingIndex === index ? (
                                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-700" />
                                  ) : (
                                    <MapPin className="w-3 h-3 text-emerald-700" />
                                  )}
                                  <span>{isLocatingGps && locatingIndex === index ? 'Mengunci...' : 'Ambil GPS Titik Ini'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveBoundary(index)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Hapus</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-semibold text-slate-600">
                                  Arah Sisi Batas
                                </label>
                              </div>
                              <input
                                placeholder="Contoh: Utara / Barat Laut"
                                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1.5 focus:ring-emerald-600 bg-white font-medium text-slate-800"
                                value={boundary.direction || ''}
                                onChange={(e) => handleUpdateBoundary(index, 'direction', e.target.value)}
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-semibold text-slate-600">
                                  Panjang Sisi (Meter)
                                </label>
                              </div>
                              <input
                                type="text"
                                placeholder="Panjang (Meter)"
                                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1.5 focus:ring-emerald-600 bg-white font-mono text-slate-800"
                                value={boundary.length ?? boundary.panjang ?? ''}
                                onChange={(e) => handleUpdateBoundary(index, 'length', e.target.value)}
                              />
                            </div>

                            {isGps ? (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[10px] font-semibold text-slate-600">
                                    Koordinat Patok T{index + 1}
                                  </label>
                                </div>
                                <input
                                  placeholder="-1.642100, 103.385100"
                                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1.5 focus:ring-emerald-600 bg-white font-mono text-slate-800"
                                  value={getCoordinateDisplayValue(boundary)}
                                  onChange={(e) => handleCoordinateChange(index, e.target.value)}
                                  onBlur={(e) => handleCoordinateBlur(index, e.target.value)}
                                />
                              </div>
                            ) : (
                              <div className="hidden sm:block" />
                            )}
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <label className="block text-[10.5px] font-bold text-slate-700">
                              Nama Tetangga / Perbatasan Sisi Ini *
                            </label>
                            <input
                              placeholder="Nama Pemilik Tanah Tetangga (Contoh: Bapak Ruslan)"
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1.5 focus:ring-emerald-600 bg-white font-medium text-slate-800"
                              value={boundary.neighbor || ''}
                              onChange={(e) => handleUpdateBoundary(index, 'neighbor', e.target.value)}
                            />

                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] text-slate-500 font-medium mr-0.5">Pilihan Cepat:</span>
                              {NEIGHBOR_QUICK_PRESETS.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => handleQuickSelectNeighbor(index, preset)}
                                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer ${
                                    boundary.neighbor === preset
                                      ? 'bg-emerald-600 text-white border-emerald-700'
                                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  + {preset}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {getBoundaries().length === 0 && (
                      <div className="p-6 border-2 border-dashed border-emerald-300 rounded-2xl text-center bg-gradient-to-b from-emerald-50/70 to-slate-50 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
                          <MapPin className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">
                          {extraFields.sporadik_mode !== 'manual' ? 'Siap Merekam Titik Patok GPS Lapangan' : 'Belum Ada Batas Tanah'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          {extraFields.sporadik_mode !== 'manual' && (
                            <button
                              type="button"
                              onClick={() => handleRecordGpsPoint()}
                              disabled={isLocatingGps}
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                            >
                              <Crosshair className="w-4 h-4" />
                              <span>📍 Mulai Kunci GPS Patok T1</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleCreateDefaultFourCorners}
                            className="px-3.5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>⚡ Buat Template 4 Sudut</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      {extraFields.sporadik_mode !== 'manual' && (
                        <button
                          type="button"
                          onClick={() => handleRecordGpsPoint()}
                          disabled={isLocatingGps}
                          className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>📍 Rekam GPS Patok T{getBoundaries().length + 1} Baru</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleAddBoundary}
                        className="w-full sm:w-auto py-2.5 px-4 border-2 border-dashed border-emerald-300 hover:border-emerald-400 rounded-xl text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>+ Tambah Batas Sisi Baru</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : activeService?.id === 'srv-ahli-waris' ? (
              <>
                {/* Pewaris Info */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck className="w-4 h-4 text-rose-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Identitas Pewaris / Almarhum
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Nama Lengkap Pewaris *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Almarhum Sudirman Bin Sanusi"
                        value={extraFields.deceased_name || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, deceased_name: e.target.value })}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        NIK Pewaris (16 Digit) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={16}
                        placeholder="Contoh: 1504011212800001"
                        value={extraFields.nik_pewaris || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, nik_pewaris: e.target.value.replace(/[^0-9]/g, '') })}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Tanggal Meninggal Dunia *
                      </label>
                      <input
                        type="date"
                        required
                        value={extraFields.tanggal_meninggal_pewaris || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, tanggal_meninggal_pewaris: e.target.value })}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Tempat Meninggal Dunia *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: RSUD Jambi"
                        value={extraFields.tempat_meninggal_pewaris || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, tempat_meninggal_pewaris: e.target.value })}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Heirs Repeater */}
                <div className="space-y-4 pt-5 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Daftar Ahli Waris Terdaftar
                    </h4>
                  </div>

                  <div className="space-y-4">
                    {heirs.map((heir, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-xs font-black text-emerald-700 font-mono">
                            # {idx + 1} AHLI WARIS
                          </span>
                          {heirs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setHeirs(heirs.filter((_, itemIdx) => itemIdx !== idx))}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase">
                              Nama Lengkap *
                            </label>
                            <input
                              type="text"
                              required
                              value={heir.name}
                              onChange={(e) => {
                                const updated = [...heirs];
                                updated[idx].name = e.target.value;
                                setHeirs(updated);
                              }}
                              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase">
                              NIK *
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={16}
                              value={heir.nik}
                              onChange={(e) => {
                                const updated = [...heirs];
                                updated[idx].nik = e.target.value.replace(/[^0-9]/g, '');
                                setHeirs(updated);
                              }}
                              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase">
                              Tempat & Tanggal Lahir *
                            </label>
                            <input
                              type="text"
                              required
                              value={heir.birthPlaceDate}
                              onChange={(e) => {
                                const updated = [...heirs];
                                updated[idx].birthPlaceDate = e.target.value;
                                setHeirs(updated);
                              }}
                              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase">
                              Hubungan Keluarga *
                            </label>
                            <input
                              type="text"
                              required
                              value={heir.relationship}
                              onChange={(e) => {
                                const updated = [...heirs];
                                updated[idx].relationship = e.target.value;
                                setHeirs(updated);
                              }}
                              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setHeirs([...heirs, { name: '', nik: '', birthPlaceDate: '', relationship: '', status: 'Hidup' }])}
                      className="w-full py-3 px-4 border-2 border-dashed border-emerald-300 hover:border-emerald-400 rounded-2xl text-emerald-700 text-xs font-bold hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Ahli Waris</span>
                    </button>
                  </div>
                </div>

                {/* Upload Heirs Attachments */}
                <div className="space-y-4 pt-5 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileUp className="w-4 h-4 text-sky-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Unggah Berkas Persyaratan (Supabase Storage)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. KTP & KK Ahli Waris */}
                    <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-3xs flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Persyaratan 1</span>
                        <h5 className="text-xs font-bold text-slate-800 mt-1">KTP & KK Ahli Waris</h5>
                      </div>
                      
                      <div className="relative mt-2">
                        {heirsKtpKkUrl ? (
                          <div className="p-2 border border-emerald-200 rounded-xl bg-emerald-50/50 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-emerald-800 truncate">Selesai Diunggah</span>
                            <button type="button" onClick={() => setHeirsKtpKkUrl('')} className="text-[10px] text-red-600 font-bold hover:underline shrink-0">Ganti</button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl bg-slate-50/30 cursor-pointer text-center">
                            <FileUp className="w-5 h-5 text-slate-400 mb-1" />
                            <span className="text-[10px] font-bold text-slate-700">Pilih Berkas</span>
                            <input type="file" accept="image/*,application/pdf" onChange={handleHeirsKtpKkSelect} className="hidden" />
                          </label>
                        )}
                        {isUploadingHeirsKtpKk && <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center text-[10px] font-bold">Mengunggah...</div>}
                      </div>
                    </div>

                    {/* 2. Surat Kematian */}
                    <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-3xs flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Persyaratan 2</span>
                        <h5 className="text-xs font-bold text-slate-800 mt-1">Surat Kematian Pewaris</h5>
                      </div>
                      
                      <div className="relative mt-2">
                        {deathCertUrl ? (
                          <div className="p-2 border border-emerald-200 rounded-xl bg-emerald-50/50 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-emerald-800 truncate">Selesai Diunggah</span>
                            <button type="button" onClick={() => setDeathCertUrl('')} className="text-[10px] text-red-600 font-bold hover:underline shrink-0">Ganti</button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl bg-slate-50/30 cursor-pointer text-center">
                            <FileUp className="w-5 h-5 text-slate-400 mb-1" />
                            <span className="text-[10px] font-bold text-slate-700">Pilih Berkas</span>
                            <input type="file" accept="image/*,application/pdf" onChange={handleDeathCertSelect} className="hidden" />
                          </label>
                        )}
                        {isUploadingDeathCert && <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center text-[10px] font-bold">Mengunggah...</div>}
                      </div>
                    </div>

                    {/* 3. Buku Nikah */}
                    <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-3xs flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Persyaratan 3</span>
                        <h5 className="text-xs font-bold text-slate-800 mt-1">Buku Nikah Pewaris</h5>
                      </div>
                      
                      <div className="relative mt-2">
                        {marriageBookUrl ? (
                          <div className="p-2 border border-emerald-200 rounded-xl bg-emerald-50/50 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-emerald-800 truncate">Selesai Diunggah</span>
                            <button type="button" onClick={() => setMarriageBookUrl('')} className="text-[10px] text-red-600 font-bold hover:underline shrink-0">Ganti</button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl bg-slate-50/30 cursor-pointer text-center">
                            <FileUp className="w-5 h-5 text-slate-400 mb-1" />
                            <span className="text-[10px] font-bold text-slate-700">Pilih Berkas</span>
                            <input type="file" accept="image/*,application/pdf" onChange={handleMarriageBookSelect} className="hidden" />
                          </label>
                        )}
                        {isUploadingMarriageBook && <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center text-[10px] font-bold">Mengunggah...</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-5 pt-4 border-t border-slate-100">
                {activeService?.requiredFields?.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={extraFields[field.id] || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, [field.id]: e.target.value })}
                        placeholder={field.helper || `Masukkan ${field.label}...`}
                        required={field.required}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[100px] bg-slate-50/30"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={extraFields[field.id] || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, [field.id]: e.target.value })}
                        required={field.required}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      >
                        <option value="">-- Pilih {field.label} --</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={extraFields[field.id] || ''}
                        onChange={(e) => setExtraFields({ ...extraFields, [field.id]: e.target.value })}
                        placeholder={field.helper || `Masukkan ${field.label}...`}
                        required={field.required}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Standard KTP and Document Attachments */}
            {activeService?.id !== 'srv-ahli-waris' && (
              <div className="pt-2 border-t border-slate-200 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileUp className="w-4 h-4 text-emerald-600" />
                    <span>Unggah Dokumen KTP & Persyaratan</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Foto dokumen KTP & KK otomatis dioptimalkan di peramban agar ringan tanpa mengurangi keterbacaan teks NIK dan alamat.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Foto / Scan KTP Pemohon (Wajib) <span className="text-rose-500">*</span>
                  </label>

                  {!ktpFile && !ktpAttachmentUrl ? (
                    <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf"
                        onChange={handleKtpSelect}
                        className="hidden"
                        required={!ktpAttachmentUrl}
                      />
                      <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-500 group-hover:text-emerald-700 flex items-center justify-center transition-colors mb-2">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">Pilih atau Tarik Berkas KTP</span>
                    </label>
                  ) : (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 truncate">
                        {ktpPreviewUrl ? (
                          <div className="relative group w-16 h-12 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 shrink-0">
                            <img src={ktpPreviewUrl} alt="Pratinjau KTP" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        <div className="truncate">
                          <strong className="text-xs font-bold text-slate-800 line-clamp-1">{ktpFile?.name || 'KTP Terlampir'}</strong>
                          {isUploadingKtp ? (
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">Mengompresi...</span>
                          ) : (
                            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">Siap Kirim</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAnalyzeKtp}
                          disabled={isAnalyzingKtp || !ktpPreviewUrl}
                          className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-50 text-xs font-bold transition-all border border-emerald-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="Gunakan AI Panjul untuk membaca data KTP"
                        >
                          {isAnalyzingKtp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Isi via AI</span>
                        </button>
                        <button type="button" onClick={handleRemoveKtp} className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer">Ganti File</button>
                      </div>
                    </div>
                  )}
                  {ktpUploadError && <p className="text-[11px] text-rose-600 font-medium">{ktpUploadError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Lampiran Dokumen Pendukung (KK / Pengantar) - Opsional
                  </label>

                  {!supportFile && !fileAttachmentUrl ? (
                    <label className="border border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/20 rounded-xl p-3 flex items-center justify-between cursor-pointer">
                      <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf" onChange={handleSupportSelect} className="hidden" />
                      <div className="flex items-center gap-2"><Upload className="w-4 h-4 text-slate-400" /><span className="text-xs text-slate-600">Pilih berkas pendukung</span></div>
                    </label>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{supportFile?.name || 'Dokumen Pendukung'}</span>
                      <button type="button" onClick={handleRemoveSupport} className="text-xs font-semibold text-rose-600 cursor-pointer">Hapus</button>
                    </div>
                  )}
                  {supportUploadError && <p className="text-[11px] text-rose-600 font-medium">{supportUploadError}</p>}
                </div>
              </div>
            )}

            {/* Purpose Choice */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tujuan / Kegunaan Permohonan Surat *
              </label>
              <div className="space-y-2">
                <select
                  value={purposeChoice}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPurposeChoice(val);
                    if (val !== 'custom') {
                      setNotes(val);
                    } else {
                      setNotes(customPurpose);
                    }
                  }}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Perizinan Usaha Mikro & Kecil (IUMK) / Izin Usaha Tempat">1. Perizinan Usaha Mikro & Kecil (IUMK) / Izin Usaha Tempat</option>
                  <option value="Permohonan Izin Mendirikan Bangunan (IMB / PBG) & Penggunaan Lahan">2. Permohonan Izin Mendirikan Bangunan (IMB / PBG) & Penggunaan Lahan</option>
                  <option value="Dispensasi Nikah & Administrasi KUA Kecamatan">3. Dispensasi Nikah & Administrasi KUA Kecamatan</option>
                  <option value="Izin Keramaian & Acara Kemasyarakatan Skala Besar">4. Izin Keramaian & Acara Kemasyarakatan Skala Besar</option>
                  <option value="Rekomendasi Bantuan Bencana, Hibah, & Bantuan Sosial Kecamatan">5. Rekomendasi Bantuan Bencana, Hibah, & Bantuan Sosial Kecamatan</option>
                  <option value="custom">✏️ Lainnya (Ketik sendiri keperluan surat...)</option>
                </select>

                {purposeChoice === 'custom' && (
                  <textarea
                    rows={3}
                    required
                    placeholder="Ketik keperluan atau tujuan surat secara spesifik..."
                    value={customPurpose}
                    onChange={(e) => {
                      setCustomPurpose(e.target.value);
                      setNotes(e.target.value);
                    }}
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                )}
              </div>
            </div>

            {/* Consent Agreement */}
            <div className="pt-2">
              <label className="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(e) => setIsAgreed(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  required
                />
                <span>
                  Saya menyatakan bahwa data yang saya masukkan adalah benar sesuai dokumen identitas asli saya dan bersedia membawa dokumen fisik asli saat pengambilan surat di Kantor {villageProfile.villageName || 'Desa'}.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={!isAgreed}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Permohonan Surat</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
