import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LandParcel, DusunSpatialBoundary, GisVillageBoundary, WebGisSummary } from '../../types/webgis';
import { INITIAL_LAND_PARCELS, INITIAL_DUSUN_BOUNDARIES } from '../../data/initialWebGisData';
import { WebGisMap } from '../gis/WebGisMap';
import { PbbTaxReceiptModal } from '../gis/PbbTaxReceiptModal';
import { BoundaryManagerPanel } from '../gis/BoundaryManagerPanel';
import { GisConfigPanel } from '../gis/GisConfigPanel';
import { api } from '../../services/api';
import { calculatePolygonAreaShoelace, calculatePbbTax, getBoundaryDirection } from '../../utils/geometryEngine';
import { calculateHaversineDistance } from '../../utils/haversine';
import {
  BoundaryLayerState,
  ParcelLayerState,
  buildBoundaryGeoJsonExport,
  buildParcelGeoJsonExport,
  downloadGeoJsonBlob,
  validateGeoJsonGeometryStrict
} from '../../utils/webGisGeoJson';
import { useApp } from '../../context/AppContext';
import { Map, Compass, Layers, Search, Filter, Plus, FileText, CheckCircle, Clock, Printer, Download, Upload, RotateCcw, ExternalLink, ShieldCheck, Building2, Trash2, Edit, Info, ChevronRight, Send, Eye, FileCode, FileSpreadsheet, Settings, History, Ruler, Link2, MapPin } from "lucide-react";

type WebGisSubmenuId =
  | 'peta_layer'
  | 'batas_wilayah'
  | 'import_export'
  | 'analisis_spasial'
  | 'konfigurasi_gis'
  | 'riwayat_audit'
  | 'integrasi_layanan';

interface GisChangeLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
}

const WEBGIS_SUBMENUS: {
  id: WebGisSubmenuId;
  label: string;
  badge?: string;
}[] = [
  { id: 'peta_layer', label: '1. Peta & Layer GIS' },
  { id: 'batas_wilayah', label: '2. Batas Wilayah & Verifikasi' },
  { id: 'import_export', label: '3. Import & Export Spasial' },
  { id: 'analisis_spasial', label: '4. Analisis Spasial' },
  { id: 'konfigurasi_gis', label: '5. Konfigurasi Desa & Peta' },
  { id: 'riwayat_audit', label: '6. Riwayat & Audit Spasial' },
  { id: 'integrasi_layanan', label: '7. Integrasi Layanan & Pajak' }
];

const LOCAL_STORAGE_PARCELS_KEY = 'sadewa_webgis_parcels_v1';

/**
 * Helper Parser GeoJSON / Data Spasial BPN untuk Desa Pulau Betung
 * Memetakan atribut BPN (NOP, Pemilik, NIK, Dusun, Kategori, NJOP) & konversi koordinat [lng, lat] -> [lat, lng]
 */
export function parseGeoJsonToParcels(geoJsonData: Record<string, unknown>): { parcels: LandParcel[]; errors: string[] } {
  const parcels: LandParcel[] = [];
  const errors: string[] = [];

  if (!geoJsonData || typeof geoJsonData !== 'object') {
    return { parcels: [], errors: ['Format data GeoJSON tidak valid (bukan JSON Object).'] };
  }

  let rawFeatures: any[] = [];
  if ((geoJsonData as Record<string, unknown>).type === 'FeatureCollection' && Array.isArray((geoJsonData as Record<string, unknown>).features)) {
    rawFeatures = (geoJsonData as Record<string, unknown>).features as any[];
  } else if ((geoJsonData as Record<string, unknown>).type === 'Feature') {
    rawFeatures = [geoJsonData];
  } else if (Array.isArray(geoJsonData)) {
    rawFeatures = geoJsonData;
  } else if (Array.isArray((geoJsonData as Record<string, unknown>).parcels)) {
    rawFeatures = (geoJsonData as Record<string, unknown>).parcels as any[];
  } else {
    return { parcels: [], errors: ['Tidak ditemukan struktur FeatureCollection atau Feature pada file GeoJSON.'] };
  }

  rawFeatures.forEach((feat: any, idx: number) => {
    try {
      const props = feat.properties || feat.props || {};
      const geometry = feat.geometry || feat;

      if (!geometry || typeof geometry !== 'object') {
        errors.push(`Fitur #${idx + 1}: Geometri tidak ditemukan.`);
        return;
      }

      // Validasi Geometri GeoJSON strict [longitude, latitude] tanpa auto-swap / perbaikan diam-diam
      const geomCheck = validateGeoJsonGeometryStrict(geometry);
      if (!geomCheck.valid) {
        errors.push(`Fitur #${idx + 1}: ${geomCheck.reason || 'Geometri tidak valid.'}`);
        return;
      }

      const rawCoords: unknown[] =
        geometry.type === 'Polygon'
          ? geometry.coordinates[0]
          : geometry.coordinates[0][0];

      // Convert GeoJSON [longitude, latitude] tervalidasi ke format internal Leaflet [latitude, longitude]
      const convertedCoords: [number, number][] = rawCoords.map((pt: any) => [
        Number(pt[1]),
        Number(pt[0])
      ]);

      // Hapus titik penutup duplikat untuk representasi vertex internal Leaflet (tanpa mengubah posisi sudut)
      if (convertedCoords.length > 3) {
        const first = convertedCoords[0];
        const last = convertedCoords[convertedCoords.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
          convertedCoords.pop();
        }
      }

      if (convertedCoords.length < 3) {
        errors.push(`Fitur #${idx + 1}: Titik sudut unik poligon tidak mencukupi (minimal 3).`);
        return;
      }

      // Attribute Mapping
      const nop = (
        props.NOP ||
        props.nop ||
        props.NOMOR_NOP ||
        props.NIB ||
        props.nib ||
        `15.04.010.001.002-00${(idx + 10).toString().padStart(3, '0')}`
      ).toString().trim();

      const ownerName = (
        props.PEMILIK ||
        props.pemilik ||
        props.NAMA ||
        props.nama ||
        props.OWNER ||
        props.ownerName ||
        props.WAJIB_PAJAK ||
        `Warga Desa Pulau Betung #${idx + 1}`
      ).toString().trim();

      const ownerNik = (
        props.NIK ||
        props.nik ||
        props.ownerNik ||
        `15040301018500${(idx + 1).toString().padStart(2, '0')}`
      ).toString().trim();

      const addressDusun = (
        props.DUSUN ||
        props.dusun ||
        props.ALAMAT ||
        props.addressDusun ||
        'Dusun Betung Indah RT 01'
      ).toString().trim();

      // Land Category Mapping
      let landUseCategory: LandParcel['landUseCategory'] = 'PERKEBUNAN_SAWIT';
      const rawCategory = (props.KATEGORI || props.kategori || props.PENGGUNAAN || props.use || '').toString().toUpperCase();

      if (rawCategory.includes('MUKIM') || rawCategory.includes('RUMAH') || rawCategory.includes('BANGUNAN')) {
        landUseCategory = 'PEMUKIMAN';
      } else if (rawCategory.includes('SAWAH') || rawCategory.includes('PADI') || rawCategory.includes('TANI')) {
        landUseCategory = 'SAWAH_PERTANIAN';
      } else if (rawCategory.includes('FAS') || rawCategory.includes('UMUM') || rawCategory.includes('KANTOR')) {
        landUseCategory = 'FASILITAS_UMUM';
      } else if (rawCategory.includes('KARET')) {
        landUseCategory = 'PERKEBUNAN_KARET';
      } else if (rawCategory.includes('DAGANG') || rawCategory.includes('TOKO') || rawCategory.includes('JASA')) {
        landUseCategory = 'PERDAGANGAN_JASA';
      }

      // Financials & Geometry Math
      const njopLandPerSqM = Number(props.NJOP_BUMI || props.njopLandPerSqM || 120000);
      const buildingAreaSqM = Number(props.LUAS_BANGUNAN || props.buildingAreaSqM || 0);
      const njopBuildingPerSqM = Number(props.NJOP_BANGUNAN || props.njopBuildingPerSqM || 500000);

      const areaResult = calculatePolygonAreaShoelace(convertedCoords);
      const landAreaSqM = Math.round(areaResult.areaSqM);
      const landAreaHectares = areaResult.areaHectares;

      const p0 = convertedCoords[0];
      const p1 = convertedCoords[1] || p0;
      const p2 = convertedCoords[2] || p1;
      const p3 = convertedCoords[3] || p0;

      const boundaries = [
        {
          direction: 'UTARA' as const,
          neighborName: String(props.UTARA || props.BATAS_UTARA || 'Jalan Desa / Lorong'),
          distanceMeters: Math.round(calculateHaversineDistance(p0[0], p0[1], p1[0], p1[1]))
        },
        {
          direction: 'TIMUR' as const,
          neighborName: String(props.TIMUR || props.BATAS_TIMUR || 'Parit / Batas Tanah Warga'),
          distanceMeters: Math.round(calculateHaversineDistance(p1[0], p1[1], p2[0], p2[1]))
        },
        {
          direction: 'SELATAN' as const,
          neighborName: String(props.SELATAN || props.BATAS_SELATAN || 'Kebun Sawit Warga'),
          distanceMeters: Math.round(calculateHaversineDistance(p2[0], p2[1], p3[0], p3[1]))
        },
        {
          direction: 'BARAT' as const,
          neighborName: String(props.BARAT || props.BATAS_BARAT || 'Bidang Tanah Tetangga'),
          distanceMeters: Math.round(calculateHaversineDistance(p3[0], p3[1], p0[0], p0[1]))
        }
      ];

      const taxCalc = calculatePbbTax(landAreaSqM, njopLandPerSqM, buildingAreaSqM, njopBuildingPerSqM);

      // Status Mapping
      let pbbStatus: LandParcel['pbbStatus'] = 'BELUM_LUNAS';
      const rawPbb = (props.STATUS_PBB || props.pbbStatus || '').toString().toUpperCase();
      if (rawPbb.includes('LUNAS') || rawPbb === 'PAID') {
        pbbStatus = 'LUNAS';
      } else if (rawPbb.includes('BEBAS') || landUseCategory === 'FASILITAS_UMUM') {
        pbbStatus = 'BEBAS_PAJAK';
      }

      let sporadikStatus: LandParcel['sporadikStatus'] = 'DRAF_SURVEI';
      const rawSporadik = (props.STATUS_SPORADIK || props.sporadikStatus || '').toString().toUpperCase();
      if (rawSporadik.includes('TERBIT') || rawSporadik.includes('VALID')) {
        sporadikStatus = 'SPORADIK_TERBIT';
      } else if (rawSporadik.includes('VERIFIKASI')) {
        sporadikStatus = 'TERVERIFIKASI';
      }

      const nowIso = new Date().toISOString();
      const parcel: LandParcel = {
        id: `PARCEL-BPN-${Date.now()}-${idx + 1}`,
        nop,
        ownerName,
        ownerNik,
        phone: props.TELP || props.phone || '082180009000',
        addressDusun,
        landUseCategory,
        landAreaSqM,
        landAreaHectares,
        buildingAreaSqM,
        njopLandPerSqM,
        njopBuildingPerSqM,
        pbbTaxAmount: taxCalc.taxAmount,
        pbbStatus,
        sporadikStatus,
        sporadikRequestCode: props.sporadikRequestCode || undefined,
        surveyorName: props.SURVEYOR || props.surveyorName || 'Petugas Ukur BPN / Desa',
        boundaries,
        coordinates: convertedCoords,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      parcels.push(parcel);
    } catch (err: unknown) {
      errors.push(`Fitur #${idx + 1}: Gagal memproses data (${err instanceof Error ? err.message : String(err) || 'Error'}).`);
    }
  });

  return { parcels, errors };
}

export const WebGisManager: React.FC = () => {
  const {
    addToast,
    navigateTo,
    villageProfile,
    facilities,
    gisBootstrap,
    auditLogs,
    serviceRequests,
    setServiceRequests,
    webGisData: parcels,
    setWebGisData: setParcels,
    addLandParcel,
    updateLandParcel,
    deleteLandParcel
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSubmenu, setActiveSubmenu] = useState<WebGisSubmenuId>('peta_layer');
  const [gisChangeLogs, setGisChangeLogs] = useState<GisChangeLogItem[]>([]);
  const [loadingChangeLogs, setLoadingChangeLogs] = useState(false);

  // =========================================================================
  // STATE LAYER TERISOLASI #1: BATAS WILAYAH ADMINISTRATIF (DESA & DUSUN)
  // Terpisah sepenuhnya dari state & data bidang tanah / persil warga.
  // =========================================================================
  const [boundaryFeatures, setBoundaryFeatures] = useState<GisVillageBoundary[]>(() => {
    if (gisBootstrap?.visibleBoundaries && gisBootstrap.visibleBoundaries.length > 0) {
      return gisBootstrap.visibleBoundaries;
    }
    return gisBootstrap?.activeBoundary ? [gisBootstrap.activeBoundary] : [];
  });
  const [boundaryLoading, setBoundaryLoading] = useState<boolean>(false);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [dusunBoundaries] = useState<DusunSpatialBoundary[]>(INITIAL_DUSUN_BOUNDARIES);

  // =========================================================================
  // STATE LAYER TERISOLASI #2: BIDANG TANAH / PERSIL BPN & PBB-P2
  // =========================================================================
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(() => parcels[0]?.id || 'PARCEL-PB-001');
  const [confirmResetParcels, setConfirmResetParcels] = useState(false);
  const [confirmDeleteParcelId, setConfirmDeleteParcelId] = useState<string | null>(null);

  const loadIsolatedBoundaries = useCallback(async () => {
    setBoundaryLoading(true);
    setBoundaryError(null);
    try {
      const res = await api.getAdminGisBoundaries();
      if (res.success && Array.isArray(res.data)) {
        setBoundaryFeatures(res.data);
      } else {
        setBoundaryError(res.error || 'Gagal memuat batas wilayah administratif.');
      }
    } catch {
      setBoundaryError('Tidak dapat terhubung ke server GIS untuk batas wilayah.');
    } finally {
      setBoundaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubmenu === 'peta_layer' || activeSubmenu === 'import_export') {
      void loadIsolatedBoundaries();
    }
  }, [activeSubmenu, loadIsolatedBoundaries]);

  const boundaryExportBuild = useMemo(
    () => buildBoundaryGeoJsonExport(boundaryFeatures, dusunBoundaries, villageProfile),
    [boundaryFeatures, dusunBoundaries, villageProfile]
  );

  const boundaryLayerState: BoundaryLayerState = useMemo(
    () => ({
      boundaryFeatures,
      dusunBoundaries,
      boundaryGeoJson: boundaryExportBuild.featureCollection,
      boundaryLoading,
      boundaryError,
      boundaryMetadata: {
        datasetType: 'administrative_boundary',
        sourceLabel: `${boundaryFeatures.length} Batas Desa + ${dusunBoundaries.length} Batas Dusun`,
        lastUpdatedAt: boundaryExportBuild.featureCollection.metadata.exported_at,
        totalCount: boundaryFeatures.length + dusunBoundaries.length,
        validCount: boundaryExportBuild.validCount,
        invalidCount: boundaryExportBuild.rejectedCount
      }
    }),
    [boundaryFeatures, dusunBoundaries, boundaryExportBuild, boundaryLoading, boundaryError]
  );

  const parcelExportBuild = useMemo(() => buildParcelGeoJsonExport(parcels), [parcels]);

  const parcelLayerState: ParcelLayerState = useMemo(
    () => ({
      parcelFeatures: parcels,
      parcelGeoJson: parcelExportBuild.featureCollection,
      parcelLoading: false,
      parcelError: null,
      parcelMetadata: {
        datasetType: 'land_parcel',
        sourceLabel: `${parcels.length} Bidang Tanah / Persil`,
        lastUpdatedAt: parcelExportBuild.featureCollection.metadata.exported_at,
        totalCount: parcels.length,
        validCount: parcelExportBuild.validCount,
        invalidCount: parcelExportBuild.rejectedCount
      }
    }),
    [parcels, parcelExportBuild]
  );

  useEffect(() => {
    if (activeSubmenu !== 'riwayat_audit') return;
    let mounted = true;
    setLoadingChangeLogs(true);
    api.getAdminGisChangeLogs().then((res) => {
      if (!mounted) return;
      setLoadingChangeLogs(false);
      if (res.success && Array.isArray(res.data)) {
        setGisChangeLogs(res.data);
      }
    });
    return () => {
      mounted = false;
    };
  }, [activeSubmenu]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDusun, setFilterDusun] = useState<string>('all');
  const [filterPbbStatus, setFilterPbbStatus] = useState<string>('all');
  const [filterSporadikStatus, setFilterSporadikStatus] = useState<string>('all');

  // Modal State
  const [receiptParcel, setReceiptParcel] = useState<LandParcel | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State untuk Tambah Bidang Spasial Baru
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  const [formNop, setFormNop] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formOwnerNik, setFormOwnerNik] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddressDusun, setFormAddressDusun] = useState('Dusun Betung Indah RT 01');
  const [formCategory, setFormCategory] = useState<LandParcel['landUseCategory']>('PERKEBUNAN_SAWIT');
  const [formBuildingSqM, setFormBuildingSqM] = useState<number>(0);
  const [formNjopLand, setFormNjopLand] = useState<number>(120000);
  const [formNjopBuilding, setFormNjopBuilding] = useState<number>(500000);
  const [formPbbStatus, setFormPbbStatus] = useState<LandParcel['pbbStatus']>('BELUM_LUNAS');
  const [formManualCoordsText, setFormManualCoordsText] = useState('');

  // Objek Bidang Tanah yang sedang dipilih/diklik oleh user
  const selectedParcel = parcels.find((p) => p.id === selectedParcelId) || parcels[0] || null;

  // --- LOGIKA FILTER PETA (DYNAMIC FILTER) ---
  const filteredParcels = parcels.filter((parcel) => {
    const matchesSearch =
      parcel.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.nop.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parcel.ownerNik.includes(searchTerm);

    const matchesDusun = filterDusun === 'all' || parcel.addressDusun.includes(filterDusun);
    const matchesPbb = filterPbbStatus === 'all' || parcel.pbbStatus === filterPbbStatus;
    const matchesSporadik = filterSporadikStatus === 'all' || parcel.sporadikStatus === filterSporadikStatus;

    return matchesSearch && matchesDusun && matchesPbb && matchesSporadik;
  });

  // --- RINGKASAN DATA SPASIAL & KEUANGAN PBB ---
  // Menghitung statistik wilayah berdasarkan seluruh poligon yang ada di peta.
  const summary: WebGisSummary = {
    totalParcels: parcels.length,
    // Kalkulasi total luas area (Shoelace Formula)
    totalAreaSqM: parcels.reduce((sum, p) => sum + p.landAreaSqM, 0),
    totalAreaHectares: Math.round((parcels.reduce((sum, p) => sum + p.landAreaSqM, 0) / 10000) * 100) / 100,
    // Potensi Pendapatan Asli Desa (PAD) dari Pajak Bumi & Bangunan
    totalPbbPotential: parcels.reduce((sum, p) => sum + p.pbbTaxAmount, 0),
    totalPbbPaid: parcels.filter((p) => p.pbbStatus === 'LUNAS').reduce((sum, p) => sum + p.pbbTaxAmount, 0),
    complianceRatePercent: parcels.length > 0
      ? Math.round((parcels.filter((p) => p.pbbStatus === 'LUNAS').length / parcels.length) * 100)
      : 0,
    totalSporadikVerified: parcels.filter((p) => p.sporadikStatus === 'SPORADIK_TERBIT' || p.sporadikStatus === 'TERVERIFIKASI').length,
    totalSporadikDraft: parcels.filter((p) => p.sporadikStatus === 'DRAF_SURVEI').length
  };

  // Live Area Calculation for Form
  const currentFormPoints: [number, number][] = drawingPoints.length >= 3
    ? drawingPoints
    : parseManualCoords(formManualCoordsText);

  const liveFormAreaCalc = currentFormPoints.length >= 3
    ? calculatePolygonAreaShoelace(currentFormPoints)
    : null;

  function parseManualCoords(text: string): [number, number][] {
    if (!text.trim()) return [];
    try {
      const lines = text.trim().split('\n');
      const pts: [number, number][] = [];
      for (const line of lines) {
        const parts = line.split(',').map((s) => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          pts.push([parts[0], parts[1]]);
        }
      }
      return pts;
    } catch {
      return [];
    }
  }

  // Handle Submit Form Bidang Baru
  const handleSaveParcel = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formOwnerName.trim() || !formOwnerNik.trim() || !formNop.trim()) {
      addToast('warning', 'Data Belum Lengkap', 'Mohon isi NOP, Nama Pemilik, dan NIK Wajib Pajak.');
      return;
    }

    if (currentFormPoints.length < 3) {
      addToast('warning', 'Koordinat Tidak Valid', 'Poligon bidang tanah wajib memiliki minimal 3 titik GPS.');
      return;
    }

    const areaCalc = calculatePolygonAreaShoelace(currentFormPoints);
    const taxCalc = calculatePbbTax(areaCalc.areaSqM, formNjopLand, formBuildingSqM, formNjopBuilding);

    // Otomatis susun batas saksi
    const boundaries: LandParcel['boundaries'] = [];
    const n = currentFormPoints.length;
    for (let i = 0; i < n; i++) {
      const curr = currentFormPoints[i];
      const next = currentFormPoints[(i + 1) % n];
      const dir = getBoundaryDirection(curr[0], curr[1], next[0], next[1]);
      boundaries.push({
        direction: dir,
        neighborName: `Batas Segmen P${i + 1}-P${(i + 1) % n + 1}`,
        distanceMeters: areaCalc.stepByStepDetails[i]?.segmentLength || 100
      });
    }

    const newParcel: any = {
      nop: formNop,
      ownerName: formOwnerName,
      ownerNik: formOwnerNik,
      phone: formPhone,
      addressDusun: formAddressDusun,
      landUseCategory: formCategory,
      landAreaSqM: areaCalc.areaSqM,
      landAreaHectares: areaCalc.areaHectares,
      buildingAreaSqM: formBuildingSqM,
      coordinates: currentFormPoints,
      boundaries,
      njopLandPerSqM: formNjopLand,
      njopBuildingPerSqM: formNjopBuilding,
      pbbTaxAmount: taxCalc.taxAmount,
      pbbStatus: formPbbStatus,
      pbbPaymentDate: formPbbStatus === 'LUNAS' ? new Date().toISOString() : undefined,
      sporadikStatus: 'DRAF_SURVEI'
    };

    addLandParcel(newParcel).then(() => {
      setIsAddModalOpen(false);
      setIsDrawingMode(false);
      setDrawingPoints([]);
      addToast('success', 'Bidang Tanah Terdaftar', `Bidang tanah NOP ${newParcel.nop} berhasil dipetakan secara spasial.`);
    });
  };

  // Triger Pembuatan Surat SPORADIK (Kelas A) Langsung dari Data WebGIS
  const handleTriggerSporadikLetter = (parcel: LandParcel) => {
    const trackingCode = `REQ-PB-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newRequest = {
      id: `req-spat-${Date.now()}`,
      trackingCode,
      serviceId: 'srv-4',
      serviceName: 'Surat Keterangan Penguasaan Fisik Bidang Tanah (SPORADIK)',
      citizenName: parcel.ownerName,
      citizenNikMasked: `${parcel.ownerNik.slice(0, 6)}******${parcel.ownerNik.slice(-4)}`,
      phone: parcel.phone || '0812-7489-0000',
      addressDusun: parcel.addressDusun,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'diverifikasi' as const,
      notes: `Registrasi SPORADIK otomatis dari WebGIS Desa. NOP: ${parcel.nop}. Luas Tanah (Shoelace): ${parcel.landAreaSqM} m².`,
      formData: {
        nop: parcel.nop,
        landLocation: parcel.addressDusun,
        landAreaSqM: parcel.landAreaSqM.toString(),
        landAreaHectares: parcel.landAreaHectares.toString(),
        boundaries: parcel.boundaries,
        coordinates: parcel.coordinates
      }
    };

    if (setServiceRequests) {
      setServiceRequests([newRequest , ...serviceRequests]);
    }

    // Update status sporadik di parcel
    setParcels(
      parcels.map((p) =>
        p.id === parcel.id
          ? { ...p, sporadikStatus: 'TERVERIFIKASI', sporadikRequestCode: trackingCode }
          : p
      )
    );

    addToast(
      'success',
      'SPORADIK Berhasil Diisikan',
      `Permohonan SPORADIK untuk ${parcel.ownerName} terbuat dengan Nomor Resi ${trackingCode}.`
    );

    navigateTo('admin_services', { trackingCode });
  };

  // Export GeoJSON #1: KHUSUS Batas Wilayah Administratif (Desa Utama, Desa Sebelah & Dusun)
  const handleExportBoundaryGeoJson = () => {
    const result = buildBoundaryGeoJsonExport(
      boundaryLayerState.boundaryFeatures,
      boundaryLayerState.dusunBoundaries,
      villageProfile
    );

    if (result.validCount === 0) {
      const reason =
        result.rejectedFeatures[0]?.reason ||
        'Belum ada poligon batas wilayah administratif yang tersedia untuk diekspor.';
      addToast('warning', 'Ekspor Batas Wilayah Dibatalkan', reason);
      return;
    }

    downloadGeoJsonBlob(result.featureCollection, 'batas_wilayah.geojson');

    if (result.rejectedCount > 0) {
      addToast(
        'warning',
        'Ekspor Batas Wilayah Selesai (Sebagian Ditolak)',
        `${result.validCount} fitur batas wilayah diekspor ke batas_wilayah.geojson. ${result.rejectedCount} fitur tidak valid dikecualikan (${result.rejectedFeatures[0]?.reason}).`
      );
    } else {
      addToast(
        'success',
        'Export Batas Wilayah Berhasil',
        `${result.validCount} poligon batas administratif berhasil diekspor ke batas_wilayah.geojson.`
      );
    }
  };

  // Export GeoJSON #2: KHUSUS Bidang Tanah / Persil Warga
  const handleExportParcelGeoJson = () => {
    const result = buildParcelGeoJsonExport(parcelLayerState.parcelFeatures);

    if (result.validCount === 0) {
      const reason =
        result.rejectedFeatures[0]?.reason ||
        'Belum ada poligon bidang tanah yang valid untuk diekspor.';
      addToast('warning', 'Ekspor Bidang Tanah Dibatalkan', reason);
      return;
    }

    downloadGeoJsonBlob(result.featureCollection, 'bidang_tanah_persil.geojson');

    if (result.rejectedCount > 0) {
      addToast(
        'warning',
        'Ekspor Bidang Tanah Selesai (Sebagian Ditolak)',
        `${result.validCount} bidang tanah diekspor ke bidang_tanah_persil.geojson. ${result.rejectedCount} bidang tidak valid dikecualikan (${result.rejectedFeatures[0]?.reason}).`
      );
    } else {
      addToast(
        'success',
        'Export Bidang Tanah Berhasil',
        `${result.validCount} poligon bidang tanah berhasil diekspor ke bidang_tanah_persil.geojson.`
      );
    }
  };

  // Handle Import GeoJSON Click
  const handleImportGeoJsonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle File Upload Change
  const handleGeoJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const json = JSON.parse(content);
        const { parcels: importedParcels, errors } = parseGeoJsonToParcels(json);

        if (importedParcels.length === 0) {
          addToast(
            'error',
            'Gagal Impor GeoJSON BPN',
            errors[0] || 'Tidak ditemukan poligon spasial bidang tanah valid pada file GeoJSON.'
          );
          return;
        }

        // Merge imported parcels with current parcel dataset (tidak menyentuh batas wilayah)
        const updatedList = [...importedParcels, ...parcels.filter((p) => !importedParcels.some((imp) => imp.nop === p.nop))];

        setParcels(updatedList);
        if (updatedList.length > 0) {
          setSelectedParcelId(updatedList[0].id);
        }

        const totalSqM = importedParcels.reduce((sum, p) => sum + p.landAreaSqM, 0);
        const totalHa = Math.round((totalSqM / 10000) * 100) / 100;

        if (errors.length > 0) {
          addToast(
            'warning',
            'Impor Bidang Tanah Selesai (Sebagian Ditolak)',
            `Berhasil mengimpor ${importedParcels.length} bidang (${totalHa} Ha). ${errors.length} fitur ditolak: ${errors[0]}`
          );
        } else {
          addToast(
            'success',
            'Impor Data Spasial BPN Selesai',
            `Berhasil mengimpor ${importedParcels.length} bidang tanah BPN Desa Pulau Betung (${totalHa} Ha / ${totalSqM.toLocaleString('id-ID')} m²).`
          );
        }
      } catch (err: unknown) {
        addToast(
          'error',
          'Format File Tidak Valid',
          'Gagal membaca file JSON/GeoJSON. Pastikan format file sesuai standar GIS/BPN.'
        );
      }
    };
    reader.readAsText(file);
  };

  // Handle Reset Default Data
  const handleConfirmResetDefaultParcels = () => {
    setParcels(INITIAL_LAND_PARCELS);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_PARCELS_KEY);
    }
    setSelectedParcelId(INITIAL_LAND_PARCELS[0]?.id || null);
    setConfirmResetParcels(false);
    addToast('info', 'Reset Data Spasial', 'Data peta bidang tanah dikembalikan ke setelan awal.');
  };

  // Handle Download Sample GeoJSON
  const handleDownloadSampleGeoJson = () => {
    const sampleGeoJson = {
      type: 'FeatureCollection',
      name: 'Peta_BPN_Desa_Pulau_Betung',
      features: [
        {
          type: 'Feature',
          properties: {
            NOP: '15.04.010.001.002-0088.0',
            PEMILIK: 'H. Abdullah Sani',
            NIK: '1504031205700001',
            TELP: '082188992200',
            DUSUN: 'Dusun Betung Indah RT 02',
            KATEGORI: 'PERKEBUNAN_SAWIT',
            STATUS_PBB: 'LUNAS',
            STATUS_SPORADIK: 'SPORADIK_TERBIT',
            NJOP_BUMI: 135000,
            LUAS_BANGUNAN: 0
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [103.3430, -1.6022],
                [103.3455, -1.6022],
                [103.3455, -1.6045],
                [103.3430, -1.6045],
                [103.3430, -1.6022]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: {
            NOP: '15.04.010.001.002-0089.0',
            PEMILIK: 'Siti Fatimah Binti Ismail',
            NIK: '1504035508820002',
            TELP: '081277334411',
            DUSUN: 'Dusun Muara Betung RT 01',
            KATEGORI: 'PEMUKIMAN',
            STATUS_PBB: 'LUNAS',
            STATUS_SPORADIK: 'TERVERIFIKASI',
            NJOP_BUMI: 250000,
            LUAS_BANGUNAN: 120
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [103.3500, -1.6025],
                [103.3515, -1.6025],
                [103.3515, -1.6038],
                [103.3500, -1.6038],
                [103.3500, -1.6025]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: {
            NOP: '15.04.010.001.003-0090.0',
            PEMILIK: 'Bambang Wijaya',
            NIK: '1504031504800002',
            TELP: '082199887766',
            DUSUN: 'Dusun Tanjung Pasir RT 04',
            KATEGORI: 'SAWAH_PERTANIAN',
            STATUS_PBB: 'BELUM_LUNAS',
            STATUS_SPORADIK: 'DRAF_SURVEI',
            NJOP_BUMI: 85000,
            LUAS_BANGUNAN: 0
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [103.3450, -1.6100],
                [103.3480, -1.6100],
                [103.3480, -1.6125],
                [103.3450, -1.6125],
                [103.3450, -1.6100]
              ]
            ]
          }
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sampleGeoJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Contoh_Template_Peta_BPN_Pulau_Betung.geojson';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast('info', 'Unduh Contoh GeoJSON', 'Template GeoJSON BPN Desa Pulau Betung berhasil diunduh.');
  };

  // Handle Delete Parcel
  const handleConfirmDeleteParcel = (parcelId: string, ownerName: string) => {
    deleteLandParcel(parcelId);
    if (selectedParcelId === parcelId) {
      setSelectedParcelId(null);
    }
    setConfirmDeleteParcelId(null);
    addToast('success', 'Bidang Tanah Dihapus', `Data bidang tanah ${ownerName} telah dihapus dari peta.`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Hidden File Input for GeoJSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".geojson,.json,application/json"
        onChange={handleGeoJsonFileUpload}
        className="hidden"
      />

      {/* --- HEADER MODUL WEBGIS & PEMETAAN SPASIAL --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-emerald-900/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider">
              {/* Teknologi kalkulasi luas tanah otomatis (Shoelace Formula) */}
              ENTERPRISE SPATIAL ENGINE
            </span>
            <span className="text-xs text-slate-400 font-mono">Ver 2.5 • Batang Hari</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Compass className="w-7 h-7 text-emerald-400" />
            WebGIS & Pemetaan Spasial Desa (PBB-P2 & SPORADIK)
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Integrasi peta bidang tanah interaktif, kalkulator geometri Shoelace ($m^2$ & $Ha$), Haversine perimeter, pengelolaan Pajak Bumi dan Bangunan (PBB-P2), serta penerbitan SPORADIK (Kelas A).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Import GeoJSON: Kompatibel dengan file koordinat dari BPN atau alat ukur GPS desa */}
          <button
            type="button"
            onClick={handleImportGeoJsonClick}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
            title="Unggah file poligon bidang tanah GeoJSON BPN / hasil ukur desa"
          >
            <Upload className="w-4 h-4 text-emerald-200" />
            <span>Import Peta BPN / GeoJSON</span>
          </button>

          {/* Tombol Ekspor GeoJSON Terpisah: Batas Wilayah vs Bidang Tanah */}
          <button
            type="button"
            onClick={handleExportBoundaryGeoJson}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            title="Ekspor poligon batas administratif desa & dusun ke batas_wilayah.geojson"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export Batas Wilayah (.geojson)</span>
          </button>

          <button
            type="button"
            onClick={handleExportParcelGeoJson}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            title="Ekspor data poligon bidang tanah/persil warga ke bidang_tanah_persil.geojson"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Bidang Tanah (.geojson)</span>
          </button>

          {/* Tombol Reset Data Spasial Default */}
          {confirmResetParcels ? (
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-rose-500/50 rounded-xl px-2 py-1">
              <button
                type="button"
                onClick={handleConfirmResetDefaultParcels}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold"
              >
                Ya, Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetParcels(false)}
                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] font-bold"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetParcels(true)}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              title="Reset peta ke data spasial awal Desa Pulau Betung"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* Tombol Tambah Bidang Manual */}
          <button
            type="button"
            onClick={() => {
              setActiveSubmenu('peta_layer');
              setIsAddModalOpen(true);
              setIsDrawingMode(true);
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md hover:shadow-emerald-900/50"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bidang Spasial</span>
          </button>
        </div>
      </div>

      {/* --- NAVIGASI 7 SUBMENU INTERNAL WEBGISMANAGER --- */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {WEBGIS_SUBMENUS.map((tab) => {
            const isActiveTab = activeSubmenu === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubmenu(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActiveTab
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.id === 'peta_layer' && <Layers className="w-3.5 h-3.5" />}
                {tab.id === 'batas_wilayah' && <Map className="w-3.5 h-3.5" />}
                {tab.id === 'import_export' && <FileCode className="w-3.5 h-3.5" />}
                {tab.id === 'analisis_spasial' && <Ruler className="w-3.5 h-3.5" />}
                {tab.id === 'konfigurasi_gis' && <Settings className="w-3.5 h-3.5" />}
                {tab.id === 'riwayat_audit' && <History className="w-3.5 h-3.5" />}
                {tab.id === 'integrasi_layanan' && <Link2 className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeSubmenu === 'batas_wilayah' && (
        <BoundaryManagerPanel
          dusunBoundaries={dusunBoundaries}
          facilities={facilities}
          onSwitchToConfig={() => setActiveSubmenu('konfigurasi_gis')}
        />
      )}

      {activeSubmenu === 'konfigurasi_gis' && <GisConfigPanel />}

      {activeSubmenu === 'import_export' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
              IMPORT &amp; EXPORT DATA SPASIAL
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              Pusat Pertukaran Data GeoJSON Bidang Tanah &amp; Batas Wilayah
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Kelola ekspor/impor poligon persil PBB-P2/BPN atau muat poligon GeoJSON batas administratif desa.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <strong className="text-sm text-slate-900 block">1. Bidang Tanah PBB-P2 / BPN ({parcels.length} Persil)</strong>
              <p className="text-slate-600 leading-relaxed">
                Impor bidang tanah dari QGIS/BPN dengan atribut NOP, NIK, Pemilik, dan Dusun atau ekspor persil aktif.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleImportGeoJsonClick}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah GeoJSON Persil</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportParcelGeoJson}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Bidang Tanah (.geojson)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSampleGeoJson}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold inline-flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Template BPN</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Status Validasi Layer Persil: <strong className="text-slate-700">{parcelLayerState.parcelMetadata.validCount} valid</strong> dari {parcelLayerState.parcelMetadata.totalCount} bidang.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <strong className="text-sm text-slate-900 block">
                2. Poligon Batas Administratif Desa &amp; Dusun ({boundaryLayerState.boundaryMetadata.validCount} Fitur)
              </strong>
              <p className="text-slate-600 leading-relaxed">
                Impor berkas GeoJSON batas desa resmi (BIG/Pemda/hasil survei) atau ekspor khusus batas administratif tanpa atribut NOP/PBB.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportBoundaryGeoJson}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  <span>Export Batas Wilayah (.geojson)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubmenu('batas_wilayah')}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5"
                >
                  <Map className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Buka Impor Batas Wilayah</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Sumber Batas Terisolasi: <strong className="text-slate-700">{boundaryLayerState.boundaryMetadata.sourceLabel}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubmenu === 'analisis_spasial' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
              ANALISIS &amp; PENGUKURAN SPASIAL
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              Metrik Geometri Shoelace &amp; Keliling Haversine ({gisBootstrap?.villageName || 'Desa Pulau Betung'})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
              <span className="text-emerald-800 font-bold block">Total Luas Bidang Terpeta</span>
              <strong className="text-2xl font-black text-emerald-950 block">{summary.totalAreaHectares} Ha</strong>
              <span className="text-emerald-700">{summary.totalAreaSqM.toLocaleString('id-ID')} m² dari {summary.totalParcels} persil</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-600 font-bold block">Luas Poligon Batas Desa Aktif</span>
              <strong className="text-2xl font-black text-slate-900 block">
                {gisBootstrap?.activeBoundary?.areaSqM
                  ? `${(gisBootstrap.activeBoundary.areaSqM / 10000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ha`
                  : 'Belum Terdefinisi'}
              </strong>
              <span className="text-slate-500">
                {gisBootstrap?.activeBoundary?.perimeterMeters
                  ? `Keliling: ${Math.round(gisBootstrap.activeBoundary.perimeterMeters).toLocaleString('id-ID')} m`
                  : 'Tambahkan batas di submenu Batas Wilayah'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-600 font-bold block">Titik Fasilitas Terpetakan</span>
              <strong className="text-2xl font-black text-slate-900 block">
                {
                  facilities.filter(
                    (f) => f.isActive !== false && Array.isArray(f.coordinates) && f.coordinates.length === 2
                  ).length
                }{' '}
                / {facilities.filter((f) => f.isActive !== false).length}
              </strong>
              <span className="text-slate-500">Fasilitas aktif dengan koordinat valid</span>
            </div>
          </div>
        </div>
      )}

      {activeSubmenu === 'riwayat_audit' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
                RIWAYAT &amp; AUDIT SPASIAL
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                Log Perubahan Konfigurasi GIS, Batas Wilayah &amp; WebGIS
              </h3>
            </div>
          </div>

          {loadingChangeLogs ? (
            <p className="text-xs text-slate-500 py-4">Memuat log perubahan GIS dari server...</p>
          ) : gisChangeLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Belum ada riwayat perubahan pada konfigurasi GIS maupun batas wilayah desa.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Entitas</th>
                    <th className="p-3">Aksi</th>
                    <th className="p-3">Aktor</th>
                    <th className="p-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gisChangeLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{log.entityType}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">{log.actorName || '-'}</td>
                      <td className="p-3 text-slate-600">{log.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {auditLogs.filter((l) => l.module.toLowerCase().includes('gis') || l.module.toLowerCase().includes('spasial')).length > 0 && (
            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-bold text-slate-700">Aktivitas Audit WebGIS Terbaru</h4>
              <div className="space-y-1.5">
                {auditLogs
                  .filter((l) => l.module.toLowerCase().includes('gis') || l.module.toLowerCase().includes('spasial'))
                  .slice(0, 8)
                  .map((log) => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-800">{log.action}</strong>
                        <span className="text-slate-500 block text-[11px]">{log.details}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{log.timestamp}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubmenu === 'integrasi_layanan' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
              INTEGRASI LAYANAN &amp; PAJAK
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              Sinkronisasi WebGIS dengan SPORADIK, PBB-P2 &amp; Modul Data Desa
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <strong className="text-sm text-slate-900 block">Layanan Pertanahan (SPORADIK)</strong>
              <p className="text-slate-600">
                {summary.totalSporadikVerified} berkas terbit/terverifikasi dan {summary.totalSporadikDraft} draf survei terhubung dengan Layanan Surat.
              </p>
              <button
                type="button"
                onClick={() => navigateTo('admin_services')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Manajemen Layanan</span>
              </button>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <strong className="text-sm text-slate-900 block">Layer Fasilitas Desa</strong>
              <p className="text-slate-600">
                {facilities.length} fasilitas publik tersinkron otomatis ke lapisan peta. Pengelolaan CRUD tetap berada di modul Fasilitas Desa.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubmenu('peta_layer')}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Lihat di Peta Utama</span>
              </button>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <strong className="text-sm text-slate-900 block">Potensi PBB-P2 Terkalkulasi</strong>
              <p className="text-slate-600">
                Total ketetapan Rp {summary.totalPbbPotential.toLocaleString('id-ID')} ({summary.complianceRatePercent}% lunas).
              </p>
              <button
                type="button"
                onClick={() => setActiveSubmenu('peta_layer')}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cetak SPPT di Peta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubmenu === 'peta_layer' && (
        <>

      {/* Banner GeoJSON Spatial Persistence */}
      <div className="bg-gradient-to-r from-emerald-900/10 via-emerald-800/10 to-slate-900/10 p-4.5 rounded-3xl border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
              <span>Data Spasial BPN Desa Pulau Betung Persisten</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                {parcels.length} Poligon Aktif
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              Seluruh data spasial hasil impor GeoJSON / ukur BPN tersimpan persisten secara lokal. Unggah file BPN baru atau unduh template contoh.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadSampleGeoJson}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Contoh GeoJSON BPN</span>
          </button>
          <button
            type="button"
            onClick={handleImportGeoJsonClick}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah Peta BPN</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Statistik Spasial & Potensi PBB-P2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600">Total Bidang Tanah</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Map className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-slate-900">{summary.totalParcels}</strong>
            <span className="text-xs font-semibold text-emerald-700">Bidang Terpeta</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Total Luas: <strong className="text-slate-800">{summary.totalAreaHectares} Ha</strong> ({summary.totalAreaSqM.toLocaleString('id-ID')} m²)
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600">Potensi PBB-P2 Desa</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-blue-900">Rp {summary.totalPbbPotential.toLocaleString('id-ID')}</strong>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Telah Lunas: <strong className="text-emerald-700">Rp {summary.totalPbbPaid.toLocaleString('id-ID')}</strong>
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600">Rasio Kepatuhan Pajak</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-amber-900">{summary.complianceRatePercent}%</strong>
            <span className="text-xs font-bold text-amber-700">Lunas</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${summary.complianceRatePercent}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold text-slate-600">Status SPORADIK (Kelas A)</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-black text-purple-900">{summary.totalSporadikVerified}</strong>
            <span className="text-xs font-bold text-purple-700">Terbit/Sah</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Draf Survei Lapangan: <strong className="text-slate-800">{summary.totalSporadikDraft} Berkas</strong>
          </p>
        </div>
      </div>

      {/* Main Grid: WebGIS Interactive Map & Side Drawer Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Container Peta Interaktif (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Peta Digital Bidang Tanah & Batas Dusun
                </h3>
                <p className="text-[11px] text-slate-500">Klik pada poligon bidang tanah untuk melihat metadata & cetak SPPT PBB-P2.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDrawingMode(!isDrawingMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${isDrawingMode ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{isDrawingMode ? 'Selesai Digitasi' : 'Mode Digitasi GPS'}</span>
                </button>
              </div>
            </div>

            {/* Component Peta Leaflet */}
            <WebGisMap
              parcels={filteredParcels}
              dusunBoundaries={boundaryLayerState.dusunBoundaries}
              villageBoundaries={boundaryLayerState.boundaryFeatures.filter((b) => b.showOnMap !== false)}
              facilities={facilities}
              selectedParcelId={selectedParcelId}
              onSelectParcel={(parcel) => parcel && setSelectedParcelId(parcel.id)}
              isDrawingMode={isDrawingMode}
              onToggleDrawingMode={() => setIsDrawingMode((prev) => !prev)}
              drawingPoints={drawingPoints}
              onDrawingPointsChange={setDrawingPoints}
              onPrintReceipt={(parcel) => setReceiptParcel(parcel)}
              onTriggerSporadik={handleTriggerSporadikLetter}
              onNavigateSporadik={(trackingCode) => navigateTo('admin_services', { trackingCode })}
              height="520px"
            />
          </div>

          {/* Baris Filter & Tabel Daftar Bidang */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-slate-900">Daftar Bidang Tanah Terdaftar ({filteredParcels.length})</h3>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari NOP / Nama Pemilik..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none w-48"
                  />
                </div>

                <select
                  value={filterDusun}
                  onChange={(e) => setFilterDusun(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="all">Semua Dusun</option>
                  <option value="Dusun Betung Indah">Dusun Betung Indah</option>
                  <option value="Dusun Muara Betung">Dusun Muara Betung</option>
                  <option value="Dusun Tanjung Pasir">Dusun Tanjung Pasir</option>
                </select>

                <select
                  value={filterPbbStatus}
                  onChange={(e) => setFilterPbbStatus(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="all">Status PBB: Semua</option>
                  <option value="LUNAS">LUNAS</option>
                  <option value="BELUM_LUNAS">BELUM LUNAS</option>
                </select>
              </div>
            </div>

            {/* Tabel Bidang Tanah */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">NOP / ID Bidang</th>
                    <th className="p-3">Wajib Pajak (Pemilik)</th>
                    <th className="p-3">Dusun / Lokasi</th>
                    <th className="p-3 text-right">Luas Shoelace (m²)</th>
                    <th className="p-3 text-right">Tagihan PBB-P2</th>
                    <th className="p-3 text-center">Status PBB</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                  {filteredParcels.map((p) => {
                    const isSelected = selectedParcelId === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedParcelId(p.id)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-slate-50'}`}
                      >
                        <td className="p-3 font-mono font-bold text-slate-900">{p.nop}</td>
                        <td className="p-3">
                          <strong className="text-slate-900 block">{p.ownerName}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">NIK: {p.ownerNik}</span>
                        </td>
                        <td className="p-3 text-slate-600">{p.addressDusun}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{p.landAreaSqM.toLocaleString('id-ID')} m²</td>
                        <td className="p-3 text-right font-bold text-emerald-800">Rp {p.pbbTaxAmount.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${p.pbbStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {p.pbbStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptParcel(p);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-2xs"
                              title="Cetak SPPT PBB-P2"
                            >
                              <Printer className="w-3 h-3 text-emerald-600" />
                              <span>SPPT</span>
                            </button>

                            {confirmDeleteParcelId === p.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteParcel(p.id, p.ownerName)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteParcelId(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteParcelId(p.id);
                                }}
                                className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg transition-colors"
                                title="Hapus Bidang Spasial Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Panel Detail Bidang Terpilih & SPORADIK Trigger (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {selectedParcel ? (
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 sticky top-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">DETAIL METADATA SPASIAL</span>
                  <h3 className="font-extrabold text-base text-slate-900 leading-snug">{selectedParcel.ownerName}</h3>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${selectedParcel.pbbStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {selectedParcel.pbbStatus}
                </span>
              </div>

              {/* Rincian Luas Shoelace & Haversine */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Nomor Objek Pajak (NOP):</span>
                  <strong className="font-mono font-bold text-slate-900">{selectedParcel.nop}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Luas Hasil Ukur (Shoelace):</span>
                  <strong className="text-emerald-700 font-extrabold text-sm">{selectedParcel.landAreaSqM.toLocaleString('id-ID')} m² ({selectedParcel.landAreaHectares} Ha)</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Kategori Penggunaan:</span>
                  <strong className="text-slate-800 uppercase">{selectedParcel.landUseCategory.replace('_', ' ')}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">NJOP Bumi / Bangunan:</span>
                  <span className="text-slate-800 font-semibold">Rp {selectedParcel.njopLandPerSqM.toLocaleString('id-ID')} /m²</span>
                </div>
              </div>

              {/* Rincian Batas Tanah Saksi (Utara, Selatan, Timur, Barat) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>Validasi Batas Saksi Tanah (Haversine)</span>
                  <span className="text-[10px] text-slate-400 font-normal">{selectedParcel.boundaries.length} Sisi</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  {selectedParcel.boundaries.map((b, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <strong className="text-slate-800 text-[11px] uppercase block">BATAS {b.direction}</strong>
                        <span className="text-slate-500 text-[11px]">{b.neighborName}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        {b.distanceMeters} m
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tombol Aksi Integrasi SPORADIK & PBB */}
              <div className="pt-2 space-y-2">
                {selectedParcel.sporadikRequestCode ? (
                  <button
                    type="button"
                    onClick={() => navigateTo('admin_services', { trackingCode: selectedParcel.sporadikRequestCode })}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Lihat Berkas Surat SPORADIK</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTriggerSporadikLetter(selectedParcel)}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Isikan ke Form SPORADIK (Kelas A)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setReceiptParcel(selectedParcel)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200"
                >
                  <Printer className="w-4 h-4 text-emerald-700" />
                  <span>Cetak SPPT PBB-P2 & Bukti Setor</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-8 rounded-3xl border border-dashed border-slate-300 text-center space-y-2 text-slate-500">
              <Compass className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold">Pilih salah satu poligon bidang tanah di peta untuk melihat metadata lengkap.</p>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Modal Form Tambah Bidang Tanah Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto animate-fadeIn font-sans">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-emerald-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-800/80 flex items-center justify-center text-emerald-300">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Registrasi Spasial Bidang Tanah Baru</h3>
                  <p className="text-xs text-emerald-200/80">Input Koordinat GPS & Hitung Shoelace Otomatis</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveParcel} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nomor Objek Pajak (NOP PBB-P2)*</label>
                  <input
                    type="text"
                    required
                    value={formNop}
                    onChange={(e) => setFormNop(e.target.value)}
                    placeholder="15.04.010.001.002-..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nama Wajib Pajak / Pemilik*</label>
                  <input
                    type="text"
                    required
                    value={formOwnerName}
                    onChange={(e) => setFormOwnerName(e.target.value)}
                    placeholder="Nama Lengkap Pemilik"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">NIK Wajib Pajak*</label>
                  <input
                    type="text"
                    required
                    value={formOwnerNik}
                    onChange={(e) => setFormOwnerNik(e.target.value)}
                    placeholder="150401..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Lokasi Dusun & RT*</label>
                  <select
                    value={formAddressDusun}
                    onChange={(e) => setFormAddressDusun(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Dusun Betung Indah RT 01">Dusun Betung Indah RT 01</option>
                    <option value="Dusun Betung Indah RT 02">Dusun Betung Indah RT 02</option>
                    <option value="Dusun Muara Betung RT 01">Dusun Muara Betung RT 01</option>
                    <option value="Dusun Muara Betung RT 02">Dusun Muara Betung RT 02</option>
                    <option value="Dusun Tanjung Pasir RT 03">Dusun Tanjung Pasir RT 03</option>
                  </select>
                </div>
              </div>

              {/* Pilihan Input Koordinat: Digitasi Klik Peta ATAU Manual Lat/Lng */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <span className="font-bold text-emerald-950 block">Koordinat Poligon GPS ({currentFormPoints.length} Titik)</span>
                <p className="text-[11px] text-emerald-800">
                  Gunakan tombol Digitasi pada peta atau masukkan daftar koordinat GPS manual (format per baris: `lat, lng`).
                </p>

                <textarea
                  rows={3}
                  value={formManualCoordsText}
                  onChange={(e) => setFormManualCoordsText(e.target.value)}
                  placeholder={`-1.5822, 103.2220\n-1.5822, 103.2245\n-1.5845, 103.2245\n-1.5845, 103.2220`}
                  className="w-full p-2 bg-white border border-emerald-200 rounded-xl font-mono text-[11px] text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />

                {liveFormAreaCalc && (
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-xs font-bold text-emerald-900 flex justify-between">
                    <span>Hasil Hitung Shoelace:</span>
                    <span className="text-emerald-700 font-black">{liveFormAreaCalc.formattedAreaSqM} ({liveFormAreaCalc.formattedAreaHectares})</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-xs"
                >
                  Simpan Bidang Spasial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak SPPT PBB-P2 */}
      <PbbTaxReceiptModal
        parcel={receiptParcel}
        villageName={villageProfile?.villageName || 'Desa Pulau Betung'}
        district={villageProfile?.district || 'Kecamatan Pemayung'}
        regency={villageProfile?.regency || 'Kabupaten Batang Hari'}
        onClose={() => setReceiptParcel(null)}
      />
    </div>
  );
};
