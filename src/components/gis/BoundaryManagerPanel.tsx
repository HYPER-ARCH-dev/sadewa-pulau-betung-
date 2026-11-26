import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  BoundaryRole,
  BoundarySourceType,
  BoundaryVerificationStatus,
  DusunSpatialBoundary,
  GeoJsonPolygonGeometry,
  GisVillageBoundary
} from '../../types/webgis';
import { MapFacility } from '../../types';
import {
  geoJsonGeometryToLeafletPolygons,
  isValidCoordinatePair,
  leafletCoordsToGeoJsonPolygon
} from '../../utils/gisAdapter';
import { calculatePolygonAreaShoelace } from '../../utils/geometryEngine';
import { BoundaryEditorMap } from './BoundaryEditorMap';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode,
  Layers,
  MapPin,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload
} from 'lucide-react';

interface BoundaryManagerPanelProps {
  dusunBoundaries?: DusunSpatialBoundary[];
  facilities?: MapFacility[];
  onSwitchToConfig?: () => void;
}

interface ParsedBoundaryFeatureItem {
  tempId: string;
  villageName: string;
  regionCode: string;
  boundaryRole: BoundaryRole;
  fillColor: string;
  sourceName: string;
  points: [number, number][];
  geometryGeoJson: GeoJsonPolygonGeometry;
  areaSqM: number;
  selected: boolean;
}

const REFERENCE_MAPS_PIN_URL = 'https://maps.app.goo.gl/JWwhvNZPj22Z9g4r5?g_st=ac';
const MAIN_DEFAULT_COLOR = '#ec4899';
const NEIGHBOR_PALETTE = [
  '#0284c7',
  '#f59e0b',
  '#8b5cf6',
  '#0d9488',
  '#ea580c',
  '#6366f1',
  '#14b8a6',
  '#d97706'
];

const SOURCE_TYPE_OPTIONS: { value: BoundarySourceType; label: string }[] = [
  { value: 'ADMIN_DIGITIZED', label: 'Digitasi Admin pada Peta (ADMIN_DIGITIZED)' },
  { value: 'IMPORTED_GEOJSON', label: 'Impor GeoJSON Lokal (IMPORTED_GEOJSON)' },
  { value: 'SURVEY_LAPANGAN', label: 'Survei Lapangan / GPS (SURVEY_LAPANGAN)' },
  { value: 'PEMDA', label: 'Peta Resmi Pemda / Bappeda (PEMDA)' },
  { value: 'OFFICIAL_BIG', label: 'Peta Resmi BIG / KemenATR (OFFICIAL_BIG)' },
  { value: 'UNKNOWN', label: 'Sumber Lainnya (UNKNOWN)' }
];

function getStatusBadge(status: BoundaryVerificationStatus) {
  if (status === 'TERVERIFIKASI') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold inline-flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" />
        TERVERIFIKASI
      </span>
    );
  }
  if (status === 'PERLU_VERIFIKASI') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold inline-flex items-center gap-1">
        <ShieldAlert className="w-3 h-3" />
        PERLU VERIFIKASI
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold inline-flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      BELUM TERVERIFIKASI
    </span>
  );
}

function getBoundaryRoleBadge(role?: BoundaryRole) {
  if (role === 'NEIGHBOR_VILLAGE') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-extrabold">
        Desa Sebelah
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
      Desa Utama
    </span>
  );
}

function extractPropString(props: Record<string, any> | undefined, keys: string[]): string {
  if (!props || typeof props !== 'object') return '';
  for (const key of keys) {
    const val = props[key];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(val);
    }
  }
  return '';
}

function cleanFileNameToLabel(fileName?: string): string {
  if (!fileName) return '';
  return fileName
    .replace(/\.(geo)?json$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function inferBoundaryRole(
  villageName: string,
  regionCode: string,
  props: Record<string, any> | undefined,
  defaultMainCode: string,
  defaultMainName: string
): BoundaryRole {
  const rawRole = extractPropString(props, ['boundaryRole', 'BOUNDARY_ROLE', 'role']);
  if (rawRole === 'MAIN_VILLAGE' || rawRole === 'NEIGHBOR_VILLAGE') {
    return rawRole;
  }

  const lowerName = villageName.toLowerCase();
  const lowerMain = (defaultMainName || 'Pulau Betung').toLowerCase().replace(/^desa\s+/i, '').trim();
  if (
    (regionCode && defaultMainCode && regionCode === defaultMainCode) ||
    lowerName.includes('pulau betung') ||
    (lowerMain && lowerName.includes(lowerMain))
  ) {
    return 'MAIN_VILLAGE';
  }
  return 'NEIGHBOR_VILLAGE';
}

function parseGeoJsonBoundaryFeatures(
  rawText: string,
  options?: { fileName?: string; defaultMainCode?: string; defaultMainName?: string }
): {
  items: ParsedBoundaryFeatureItem[];
  multiPolygonCount: number;
  error?: string;
} {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      items: [],
      multiPolygonCount: 0,
      error: 'Teks bukan format JSON / GeoJSON yang valid.'
    };
  }

  const rawFeatures: { geometry: any; properties: Record<string, any> }[] = [];
  if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    for (const f of parsed.features) {
      if (f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon') {
        rawFeatures.push({ geometry: f.geometry, properties: f.properties || {} });
      }
    }
  } else if (parsed?.type === 'Feature') {
    if (parsed.geometry?.type === 'Polygon' || parsed.geometry?.type === 'MultiPolygon') {
      rawFeatures.push({ geometry: parsed.geometry, properties: parsed.properties || {} });
    }
  } else if (parsed?.type === 'Polygon' || parsed?.type === 'MultiPolygon') {
    rawFeatures.push({ geometry: parsed, properties: {} });
  }

  if (rawFeatures.length === 0) {
    return {
      items: [],
      multiPolygonCount: 0,
      error: 'Tidak ditemukan geometri Polygon atau MultiPolygon di dalam file GeoJSON.'
    };
  }

  const items: ParsedBoundaryFeatureItem[] = [];
  let maxMultiCount = 1;
  let neighborIdx = 0;

  rawFeatures.forEach((feat, idx) => {
    const polygons = geoJsonGeometryToLeafletPolygons(feat.geometry);
    if (polygons.length === 0 || polygons[0].length === 0) return;
    if (polygons.length > maxMultiCount) maxMultiCount = polygons.length;

    const outerRing = [...polygons[0][0]];
    if (outerRing.length > 3) {
      const first = outerRing[0];
      const last = outerRing[outerRing.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
        outerRing.pop();
      }
    }
    if (outerRing.length < 3) return;

    const normalizedPoints: [number, number][] = outerRing.map(([lat, lng]) => [
      Number(lat.toFixed(6)),
      Number(lng.toFixed(6))
    ]);

    const detectedName =
      extractPropString(feat.properties, [
        'villageName',
        'VILLAGE_NAME',
        'NAMA_DESA',
        'NAMOBJ',
        'WADMKD',
        'DESA',
        'NAME_4',
        'NAME',
        'name',
        'label',
        'desa',
        'wilayah'
      ]) ||
      (rawFeatures.length === 1 ? cleanFileNameToLabel(options?.fileName) : '') ||
      `Wilayah Desa #${idx + 1}`;

    const detectedRegionCode = extractPropString(feat.properties, [
      'regionCode',
      'REGION_CODE',
      'KODE_DESA',
      'KD_DESA',
      'WADMKD_CODE',
      'kode'
    ]);

    const detectedRole = inferBoundaryRole(
      detectedName,
      detectedRegionCode,
      feat.properties,
      options?.defaultMainCode || '15.04.05.2009',
      options?.defaultMainName || 'Desa Pulau Betung'
    );

    const detectedColor = extractPropString(feat.properties, ['fillColor', 'color', 'FILL_COLOR']);
    const assignedColor =
      detectedColor && /^#[0-9a-f]{3,8}$/i.test(detectedColor)
        ? detectedColor
        : detectedRole === 'MAIN_VILLAGE'
        ? MAIN_DEFAULT_COLOR
        : NEIGHBOR_PALETTE[neighborIdx++ % NEIGHBOR_PALETTE.length];

    const detectedSourceName =
      extractPropString(feat.properties, ['sourceName', 'SOURCE_NAME', 'sumber']) ||
      options?.fileName ||
      `Impor GeoJSON (${detectedName})`;

    const calc = calculatePolygonAreaShoelace(normalizedPoints);

    const geometryGeoJson: GeoJsonPolygonGeometry =
      feat.geometry.type === 'MultiPolygon'
        ? { type: 'MultiPolygon', coordinates: feat.geometry.coordinates }
        : leafletCoordsToGeoJsonPolygon(normalizedPoints);

    items.push({
      tempId: `imp-${Date.now()}-${idx}`,
      villageName: detectedName,
      regionCode: detectedRegionCode,
      boundaryRole: detectedRole,
      fillColor: assignedColor,
      sourceName: detectedSourceName,
      points: normalizedPoints,
      geometryGeoJson,
      areaSqM: calc.areaSqM,
      selected: true
    });
  });

  if (items.length === 0) {
    return {
      items: [],
      multiPolygonCount: 0,
      error: 'Koordinat poligon kosong atau di luar rentang lat/lng valid (standar GeoJSON: [lng, lat]).'
    };
  }

  return { items, multiPolygonCount: maxMultiCount };
}

function arePointArraysEqual(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i][0] - b[i][0]) > 1e-7 || Math.abs(a[i][1] - b[i][1]) > 1e-7) {
      return false;
    }
  }
  return true;
}

export const BoundaryManagerPanel: React.FC<BoundaryManagerPanelProps> = ({
  dusunBoundaries = [],
  facilities = [],
  onSwitchToConfig
}) => {
  const { addToast, gisBootstrap, refreshGisBootstrap } = useApp();
  const geoJsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const [boundaries, setBoundaries] = useState<GisVillageBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor state + Undo history
  const [editingBoundaryId, setEditingBoundaryId] = useState<string | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [baselinePoints, setBaselinePoints] = useState<[number, number][]>([]);
  const [historyStack, setHistoryStack] = useState<[number, number][][]>([]);
  const [isEditingMap, setIsEditingMap] = useState(true);

  // Metadata form state
  const [villageName, setVillageName] = useState('Desa Pulau Betung');
  const [boundaryRole, setBoundaryRole] = useState<BoundaryRole>('MAIN_VILLAGE');
  const [fillColor, setFillColor] = useState(MAIN_DEFAULT_COLOR);
  const [showOnMap, setShowOnMap] = useState(true);
  const [regionCode, setRegionCode] = useState('15.04.05.2009');
  const [sourceType, setSourceType] = useState<BoundarySourceType>('ADMIN_DIGITIZED');
  const [sourceName, setSourceName] = useState('');
  const [sourceYear, setSourceYear] = useState<string>(String(new Date().getFullYear()));
  const [licenseNote, setLicenseNote] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Multi-village GeoJSON batch import preview
  const [batchImportItems, setBatchImportItems] = useState<ParsedBoundaryFeatureItem[] | null>(null);
  const [savingBatch, setSavingBatch] = useState(false);

  // Paste GeoJSON drawer & Manual point add
  const [showPasteGeoJson, setShowPasteGeoJson] = useState(false);
  const [pasteGeoJsonText, setPasteGeoJsonText] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Inline verification form & delete state
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyTargetStatus, setVerifyTargetStatus] =
    useState<BoundaryVerificationStatus>('TERVERIFIKASI');
  const [verifyNotesInput, setVerifyNotesInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadBoundariesIntoState = useCallback(async (selectFirstIfEmpty = true) => {
    setLoading(true);
    const res = await api.getAdminGisBoundaries();
    setLoading(false);

    if (!res.success || !res.data) {
      addToast('error', 'Gagal Memuat Batas Wilayah', res.error || 'Terjadi kesalahan server.');
      return;
    }

    setBoundaries(res.data);

    if (selectFirstIfEmpty && res.data.length > 0) {
      const preferred =
        res.data.find((b) => b.isActive && b.boundaryRole !== 'NEIGHBOR_VILLAGE') ||
        res.data.find((b) => b.isActive) ||
        res.data[0];
      const polys = geoJsonGeometryToLeafletPolygons(preferred.geometryGeoJson);
      const outer = polys[0]?.[0] ? [...polys[0][0]] : [];
      if (outer.length > 3) {
        const f = outer[0];
        const l = outer[outer.length - 1];
        if (Math.abs(f[0] - l[0]) < 1e-7 && Math.abs(f[1] - l[1]) < 1e-7) {
          outer.pop();
        }
      }
      setEditingBoundaryId(preferred.id);
      setPoints(outer);
      setBaselinePoints(outer);
      setHistoryStack([]);
      setVillageName(preferred.villageName || gisBootstrap?.villageName || 'Desa Pulau Betung');
      setBoundaryRole(preferred.boundaryRole || 'MAIN_VILLAGE');
      setFillColor(
        preferred.fillColor ||
          (preferred.boundaryRole === 'NEIGHBOR_VILLAGE' ? '#0284c7' : MAIN_DEFAULT_COLOR)
      );
      setShowOnMap(preferred.showOnMap !== false);
      setRegionCode(preferred.regionCode || '15.04.05.2009');
      setSourceType(preferred.sourceType || 'ADMIN_DIGITIZED');
      setSourceName(preferred.sourceName || '');
      setSourceYear(preferred.sourceYear ? String(preferred.sourceYear) : '');
      setLicenseNote(preferred.licenseNote || '');
      setIsActive(Boolean(preferred.isActive));
      setVerificationNotes(preferred.verificationNotes || '');
    }
  }, [addToast, gisBootstrap?.villageName]);

  useEffect(() => {
    loadBoundariesIntoState(true);
  }, [loadBoundariesIntoState]);

  const updatePointsWithHistory = useCallback((nextPoints: [number, number][]) => {
    setPoints((prev) => {
      if (arePointArraysEqual(prev, nextPoints)) return prev;
      setHistoryStack((hist) => [...hist.slice(-24), prev]);
      return nextPoints;
    });
  }, []);

  const handleUndo = () => {
    setHistoryStack((hist) => {
      if (hist.length === 0) return hist;
      const previous = hist[hist.length - 1];
      setPoints(previous);
      return hist.slice(0, -1);
    });
  };

  const handleDiscardChanges = () => {
    setPoints(baselinePoints);
    setHistoryStack([]);
    addToast('info', 'Perubahan Dibatalkan', 'Titik koordinat dikembalikan ke kondisi awal sebelum diedit.');
  };

  const handleLoadBoundaryToEditor = (b: GisVillageBoundary) => {
    const polys = geoJsonGeometryToLeafletPolygons(b.geometryGeoJson);
    const outer = polys[0]?.[0] ? [...polys[0][0]] : [];
    if (outer.length > 3) {
      const f = outer[0];
      const l = outer[outer.length - 1];
      if (Math.abs(f[0] - l[0]) < 1e-7 && Math.abs(f[1] - l[1]) < 1e-7) {
        outer.pop();
      }
    }
    setEditingBoundaryId(b.id);
    setPoints(outer);
    setBaselinePoints(outer);
    setHistoryStack([]);
    setVillageName(b.villageName || gisBootstrap?.villageName || 'Desa Pulau Betung');
    setBoundaryRole(b.boundaryRole || 'MAIN_VILLAGE');
    setFillColor(b.fillColor || (b.boundaryRole === 'NEIGHBOR_VILLAGE' ? '#0284c7' : MAIN_DEFAULT_COLOR));
    setShowOnMap(b.showOnMap !== false);
    setRegionCode(b.regionCode || gisBootstrap?.regionCode || '15.04.05.2009');
    setSourceType(b.sourceType || 'ADMIN_DIGITIZED');
    setSourceName(b.sourceName || '');
    setSourceYear(b.sourceYear ? String(b.sourceYear) : '');
    setLicenseNote(b.licenseNote || '');
    setIsActive(Boolean(b.isActive));
    setVerificationNotes(b.verificationNotes || '');
    addToast(
      'info',
      'Batas Dimuat ke Editor',
      `Memuat batas ${b.villageName || b.sourceName || b.sourceType}.`
    );
  };

  const handleStartNewDraft = (role: BoundaryRole = 'MAIN_VILLAGE') => {
    const neighborCount = boundaries.filter((b) => b.boundaryRole === 'NEIGHBOR_VILLAGE').length;
    setEditingBoundaryId(null);
    setPoints([]);
    setBaselinePoints([]);
    setHistoryStack([]);
    setBatchImportItems(null);
    setBoundaryRole(role);
    if (role === 'NEIGHBOR_VILLAGE') {
      setVillageName('');
      setFillColor(NEIGHBOR_PALETTE[neighborCount % NEIGHBOR_PALETTE.length]);
      setRegionCode('');
      setSourceName('Batas Desa Tetangga');
      setIsActive(false);
    } else {
      setVillageName(gisBootstrap?.villageName || 'Desa Pulau Betung');
      setFillColor(gisBootstrap?.config?.boundaryColor || MAIN_DEFAULT_COLOR);
      setRegionCode(gisBootstrap?.regionCode || '15.04.05.2009');
      setSourceName('Digitasi Manual Admin Desa Pulau Betung');
      setIsActive(true);
    }
    setShowOnMap(true);
    setSourceType('ADMIN_DIGITIZED');
    setSourceYear(String(new Date().getFullYear()));
    setLicenseNote('');
    setVerificationNotes('');
    setIsEditingMap(true);
  };

  const applyParsedImport = (
    parsed: ReturnType<typeof parseGeoJsonBoundaryFeatures>,
    fileName?: string
  ) => {
    if (parsed.error || parsed.items.length === 0) {
      addToast('error', 'Gagal Impor GeoJSON', parsed.error || 'Format GeoJSON tidak terbaca.');
      return;
    }

    if (parsed.items.length > 1) {
      setBatchImportItems(parsed.items);
      addToast(
        'info',
        `${parsed.items.length} Wilayah Ditemukan`,
        'Beri nama masing-masing desa pada Pratinjau Impor Multi-Desa lalu klik Simpan ke Peta (tanpa menimpa data lama).'
      );
      return;
    }

    const item = parsed.items[0];
    // Selalu masuk ke mode draf baru agar impor desa sebelah tidak menimpa batas desa sebelumnya!
    setEditingBoundaryId(null);
    setBaselinePoints([]);
    setHistoryStack([]);
    setBatchImportItems(null);
    setPoints(item.points);
    setVillageName(item.villageName);
    setBoundaryRole(item.boundaryRole);
    setFillColor(item.fillColor);
    setShowOnMap(true);
    setRegionCode(item.regionCode || (item.boundaryRole === 'MAIN_VILLAGE' ? '15.04.05.2009' : ''));
    setSourceType('IMPORTED_GEOJSON');
    setSourceName(fileName || item.sourceName);
    setIsActive(item.boundaryRole === 'MAIN_VILLAGE');

    addToast(
      'success',
      'GeoJSON Dimuat ke Draf Baru',
      `${item.points.length} titik koordinat "${item.villageName}" siap disimpan${
        parsed.multiPolygonCount > 1
          ? ` (diambil poligon utama dari ${parsed.multiPolygonCount} poligon)`
          : ''
      }. Periksa nama desa & peran wilayah lalu klik Simpan Permanen.`
    );
  };

  const handleGeoJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      const parsed = parseGeoJsonBoundaryFeatures(content, {
        fileName: file.name,
        defaultMainCode: gisBootstrap?.regionCode || '15.04.05.2009',
        defaultMainName: gisBootstrap?.villageName || 'Desa Pulau Betung'
      });
      applyParsedImport(parsed, file.name);
    };
    reader.readAsText(file);
  };

  const handleApplyPastedGeoJson = () => {
    const parsed = parseGeoJsonBoundaryFeatures(pasteGeoJsonText, {
      defaultMainCode: gisBootstrap?.regionCode || '15.04.05.2009',
      defaultMainName: gisBootstrap?.villageName || 'Desa Pulau Betung'
    });
    if (parsed.error) {
      addToast('error', 'GeoJSON Tidak Valid', parsed.error);
      return;
    }
    setShowPasteGeoJson(false);
    setPasteGeoJsonText('');
    applyParsedImport(parsed);
  };

  const handleConfirmBatchImport = async () => {
    if (!batchImportItems) return;
    const chosen = batchImportItems.filter((item) => item.selected);
    if (chosen.length === 0) {
      addToast('warning', 'Belum Ada Pilihan', 'Centang minimal 1 wilayah desa yang akan disimpan.');
      return;
    }

    const unnamed = chosen.find((item) => !item.villageName.trim());
    if (unnamed) {
      addToast('warning', 'Nama Desa Wajib Diisi', 'Pastikan seluruh wilayah yang dicentang memiliki nama desa.');
      return;
    }

    setSavingBatch(true);
    const payload = chosen.map((item) => ({
      villageName: item.villageName.trim(),
      boundaryRole: item.boundaryRole,
      showOnMap: true,
      fillColor: item.fillColor,
      regionCode: item.regionCode.trim() || null,
      sourceType: 'IMPORTED_GEOJSON' as BoundarySourceType,
      sourceName: item.sourceName.trim() || `Impor GeoJSON (${item.villageName.trim()})`,
      sourceYear: new Date().getFullYear(),
      geometryGeoJson: item.geometryGeoJson,
      isActive: item.boundaryRole === 'MAIN_VILLAGE'
    }));

    const res = await api.createAdminGisBoundariesBatch(payload);
    setSavingBatch(false);

    if (!res.success) {
      addToast('error', 'Gagal Menyimpan Batch GeoJSON', res.error || 'Terjadi kesalahan server.');
      return;
    }

    setBatchImportItems(null);
    addToast(
      'success',
      'Impor Multi-Desa Berhasil',
      `${chosen.length} poligon batas wilayah desa berhasil ditambahkan tanpa menghapus batas yang sudah tersimpan.`
    );
    await Promise.all([loadBoundariesIntoState(false), refreshGisBootstrap()]);
  };

  const handleExportCurrentGeoJson = () => {
    if (points.length < 3) {
      addToast('warning', 'Poligon Belum Lengkap', 'Diperlukan minimal 3 titik untuk mengekspor GeoJSON.');
      return;
    }
    const labelName = (villageName || gisBootstrap?.villageName || 'Desa_Pulau_Betung').trim();
    const safeSlug = labelName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
    const geometryGeoJson = leafletCoordsToGeoJsonPolygon(points);
    const featureCollection = {
      type: 'FeatureCollection',
      name: `Batas_Wilayah_${safeSlug || 'Desa'}`,
      features: [
        {
          type: 'Feature',
          properties: {
            villageName: labelName,
            boundaryRole,
            fillColor,
            showOnMap,
            regionCode: regionCode || undefined,
            sourceType,
            sourceName: sourceName || undefined,
            sourceYear: sourceYear ? Number(sourceYear) : undefined
          },
          geometry: geometryGeoJson
        }
      ]
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Batas_${safeSlug || 'Desa'}_${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Ekspor GeoJSON Berhasil', `File GeoJSON "${labelName}" telah diunduh.`);
  };

  const handleExportAllBoundariesGeoJson = () => {
    if (boundaries.length === 0) {
      addToast('warning', 'Belum Ada Data', 'Belum ada poligon batas wilayah tersimpan untuk diekspor.');
      return;
    }

    const featureCollection = {
      type: 'FeatureCollection',
      name: 'Peta_Gabungan_Batas_Desa_SADEWA',
      features: boundaries.map((b) => ({
        type: 'Feature',
        properties: {
          id: b.id,
          villageName: b.villageName || b.sourceName || 'Desa Pulau Betung',
          boundaryRole: b.boundaryRole || 'MAIN_VILLAGE',
          fillColor: b.fillColor || (b.boundaryRole === 'NEIGHBOR_VILLAGE' ? '#0284c7' : MAIN_DEFAULT_COLOR),
          showOnMap: b.showOnMap !== false,
          regionCode: b.regionCode || undefined,
          status: b.status,
          sourceType: b.sourceType,
          sourceName: b.sourceName || undefined,
          sourceYear: b.sourceYear || undefined,
          areaSqM: b.areaSqM || undefined
        },
        geometry: {
          type: b.geometryGeoJson.type,
          coordinates: b.geometryGeoJson.coordinates
        }
      }))
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Peta_Gabungan_Semua_Desa_${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(
      'success',
      'Ekspor Semua Desa Berhasil',
      `${boundaries.length} poligon batas desa digabungkan dalam 1 file GeoJSON.`
    );
  };

  const handleAddManualPoint = () => {
    const lat = Number(manualLat.trim());
    const lng = Number(manualLng.trim());
    if (!isValidCoordinatePair(lat, lng)) {
      addToast(
        'warning',
        'Koordinat Tidak Valid',
        'Masukkan nilai Latitude & Longitude desimal yang valid (contoh: -1.5562, 103.4475).'
      );
      return;
    }
    updatePointsWithHistory([...points, [Number(lat.toFixed(6)), Number(lng.toFixed(6))]]);
    setManualLat('');
    setManualLng('');
  };

  const handleUpdateCoordinateCell = (index: number, axis: 0 | 1, rawValue: string) => {
    const val = Number(rawValue);
    if (!Number.isFinite(val)) return;
    const next = points.map((pt, idx) => {
      if (idx !== index) return pt;
      return axis === 0 ? ([val, pt[1]] as [number, number]) : ([pt[0], val] as [number, number]);
    });
    updatePointsWithHistory(next);
  };

  const handleSaveBoundary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!villageName.trim()) {
      addToast('warning', 'Nama Desa Wajib Diisi', 'Masukkan nama desa atau wilayah pada form metadata.');
      return;
    }
    if (points.length < 3) {
      addToast(
        'warning',
        'Poligon Belum Memadai',
        'Minimal 3 titik koordinat diperlukan untuk menyimpan poligon batas wilayah.'
      );
      return;
    }

    const geometryGeoJson = leafletCoordsToGeoJsonPolygon(points);
    if (!geometryGeoJson.coordinates || geometryGeoJson.coordinates.length === 0) {
      addToast('error', 'Geometri Tidak Valid', 'Pastikan seluruh titik koordinat berada dalam rentang GPS yang sah.');
      return;
    }

    setSaving(true);
    let savedResult: GisVillageBoundary | undefined;

    if (editingBoundaryId) {
      const res = await api.updateAdminGisBoundary(editingBoundaryId, {
        villageName: villageName.trim(),
        boundaryRole,
        showOnMap,
        fillColor,
        regionCode: regionCode.trim() || null,
        sourceType,
        sourceName: sourceName.trim() || null,
        sourceYear: sourceYear ? Number(sourceYear) : null,
        licenseNote: licenseNote.trim() || null,
        geometryGeoJson,
        isActive: boundaryRole === 'NEIGHBOR_VILLAGE' ? false : isActive,
        verificationNotes: verificationNotes.trim() || null
      });
      setSaving(false);
      if (!res.success || !res.data) {
        addToast('error', 'Gagal Memperbarui Batas', res.error || 'Terjadi kesalahan saat menyimpan.');
        return;
      }
      savedResult = res.data;
      addToast(
        'success',
        'Batas Wilayah Diperbarui',
        `Poligon batas "${savedResult.villageName || villageName}" berhasil diperbarui.`
      );
    } else {
      const res = await api.createAdminGisBoundary({
        villageName: villageName.trim(),
        boundaryRole,
        showOnMap,
        fillColor,
        regionCode: regionCode.trim() || null,
        sourceType,
        sourceName: sourceName.trim() || null,
        sourceYear: sourceYear ? Number(sourceYear) : null,
        licenseNote: licenseNote.trim() || null,
        geometryGeoJson,
        isActive: boundaryRole === 'NEIGHBOR_VILLAGE' ? false : isActive,
        verificationNotes: verificationNotes.trim() || null
      });
      setSaving(false);
      if (!res.success || !res.data) {
        addToast('error', 'Gagal Menyimpan Batas', res.error || 'Terjadi kesalahan saat menyimpan.');
        return;
      }
      savedResult = res.data;
      addToast(
        'success',
        'Batas Wilayah Tersimpan',
        `Poligon "${savedResult.villageName || villageName}" tersimpan permanen tanpa menggantikan wilayah lainnya.`
      );
    }

    setBaselinePoints(points);
    setHistoryStack([]);
    if (savedResult) {
      setEditingBoundaryId(savedResult.id);
    }
    await Promise.all([loadBoundariesIntoState(false), refreshGisBootstrap()]);
  };

  const handleSetActiveBoundary = async (id: string) => {
    const res = await api.setActiveAdminGisBoundary(id);
    if (!res.success) {
      addToast('error', 'Gagal Mengaktifkan Batas', res.error || 'Gagal memperbarui batas aktif.');
      return;
    }
    addToast('success', 'Batas Aktif Diperbarui', 'Poligon tersebut kini digunakan sebagai batas utama desa.');
    await Promise.all([loadBoundariesIntoState(false), refreshGisBootstrap()]);
  };

  const handleToggleShowOnMap = async (b: GisVillageBoundary) => {
    const nextVisible = b.showOnMap === false;
    const res = await api.updateAdminGisBoundary(b.id, { showOnMap: nextVisible });
    if (!res.success) {
      addToast('error', 'Gagal Mengubah Visibilitas', res.error || 'Tidak dapat memperbarui tampilan batas di peta.');
      return;
    }
    addToast(
      'success',
      nextVisible ? 'Batas Ditampilkan di Peta' : 'Batas Disembunyikan dari Peta',
      `${b.villageName || b.sourceName || 'Wilayah'} kini ${nextVisible ? 'tampil' : 'disembunyikan'} pada peta publik dan admin.`
    );
    await Promise.all([loadBoundariesIntoState(false), refreshGisBootstrap()]);
  };

  const handleSubmitVerification = async (id: string) => {
    const res = await api.verifyAdminGisBoundary(
      id,
      verifyTargetStatus,
      verifyNotesInput.trim() || null
    );
    if (!res.success) {
      addToast('error', 'Gagal Memverifikasi', res.error || 'Tidak dapat mengubah status verifikasi.');
      return;
    }
    setVerifyingId(null);
    setVerifyNotesInput('');
    addToast('success', 'Status Verifikasi Diperbarui', `Status batas diubah menjadi ${verifyTargetStatus}.`);
    await Promise.all([loadBoundariesIntoState(false), refreshGisBootstrap()]);
  };

  const handleDeleteBoundary = async (id: string) => {
    const res = await api.deleteAdminGisBoundary(id);
    if (!res.success) {
      addToast('error', 'Gagal Menghapus', res.error || 'Tidak dapat menghapus poligon batas.');
      return;
    }
    setConfirmDeleteId(null);
    if (editingBoundaryId === id) {
      setEditingBoundaryId(null);
      setPoints([]);
      setBaselinePoints([]);
      setHistoryStack([]);
    }
    addToast('success', 'Batas Wilayah Dihapus', 'Versi batas wilayah berhasil dihapus dari basis data.');
    await Promise.all([loadBoundariesIntoState(false), refreshGisBootstrap()]);
  };

  const hasUnsavedChanges = useMemo(
    () => !arePointArraysEqual(points, baselinePoints),
    [points, baselinePoints]
  );

  const liveMetrics = useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonAreaShoelace(points);
  }, [points]);

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={geoJsonFileInputRef}
        accept=".geojson,.json,application/json"
        onChange={handleGeoJsonFileChange}
        className="hidden"
      />

      {/* Disclaimer Identitas Wilayah & Non-Claim Link Google Maps */}
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-amber-950">
              Identitas Resmi Wilayah: {gisBootstrap?.villageName || 'Desa Pulau Betung'} (Kode Kemendagri: {gisBootstrap?.regionCode || '15.04.05.2009'})
            </h3>
            <p className="text-xs text-amber-900 leading-relaxed">
              Anda dapat menyimpan batas utama <strong>Desa Pulau Betung</strong> sekaligus mengimpor dan memberi nama batas{' '}
              <strong>desa-desa sebelah/sekitar</strong> tanpa saling menimpa. Semua wilayah yang berstatus tampil akan muncul lengkap dengan label namanya di peta.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={REFERENCE_MAPS_PIN_URL}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl bg-white hover:bg-amber-100/70 text-amber-900 border border-amber-300 text-xs font-bold inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Pin Referensi Maps</span>
          </a>
          {onSwitchToConfig && (
            <button
              type="button"
              onClick={onSwitchToConfig}
              className="px-3 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <span>Atur Viewport &amp; Provider</span>
            </button>
          )}
        </div>
      </div>

      {/* Pratinjau Impor Multi-Desa (Jika file GeoJSON berisi >= 2 poligon wilayah) */}
      {batchImportItems && batchImportItems.length > 0 && (
        <div className="bg-sky-50/90 border-2 border-sky-300 rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-200 pb-3">
            <div>
              <span className="text-[10px] font-extrabold text-sky-800 uppercase tracking-wider block">
                PRATINJAU IMPOR MULTI-DESA GEOJSON
              </span>
              <h4 className="text-sm font-extrabold text-slate-900">
                Ditemukan {batchImportItems.length} Poligon Wilayah — Beri Nama Sebelum Disimpan
              </h4>
              <p className="text-[11px] text-slate-600">
                Semua fitur yang dicentang akan ditambahkan permanen sebagai layer terpisah tanpa menghapus batas desa sebelumnya.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBatchImportItems(null)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingBatch}
                onClick={handleConfirmBatchImport}
                className="px-4 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-400 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {savingBatch
                    ? 'Menyimpan...'
                    : `Simpan ${batchImportItems.filter((i) => i.selected).length} Wilayah ke Peta`}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-sky-200 bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-sky-100/70 text-sky-950 font-bold border-b border-sky-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">Pilih</th>
                  <th className="p-2.5">Nama Desa / Wilayah*</th>
                  <th className="p-2.5">Peran Wilayah</th>
                  <th className="p-2.5">Kode Wilayah</th>
                  <th className="p-2.5 w-20 text-center">Warna</th>
                  <th className="p-2.5 text-right">Estimasi Luas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchImportItems.map((item, idx) => (
                  <tr key={item.tempId} className={item.selected ? 'bg-white' : 'bg-slate-50/70 opacity-60'}>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) =>
                          setBatchImportItems((prev) =>
                            prev
                              ? prev.map((it, i) => (i === idx ? { ...it, selected: e.target.checked } : it))
                              : null
                          )
                        }
                        className="rounded border-slate-300 text-sky-600 w-4 h-4"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.villageName}
                        onChange={(e) =>
                          setBatchImportItems((prev) =>
                            prev
                              ? prev.map((it, i) => (i === idx ? { ...it, villageName: e.target.value } : it))
                              : null
                          )
                        }
                        placeholder="Nama Desa..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={item.boundaryRole}
                        onChange={(e) => {
                          const nextRole = e.target.value as BoundaryRole;
                          setBatchImportItems((prev) =>
                            prev
                              ? prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        boundaryRole: nextRole,
                                        fillColor:
                                          nextRole === 'MAIN_VILLAGE'
                                            ? MAIN_DEFAULT_COLOR
                                            : NEIGHBOR_PALETTE[idx % NEIGHBOR_PALETTE.length]
                                      }
                                    : it
                                )
                              : null
                          );
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                      >
                        <option value="MAIN_VILLAGE">Desa Utama</option>
                        <option value="NEIGHBOR_VILLAGE">Desa Sebelah / Sekitar</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.regionCode}
                        onChange={(e) =>
                          setBatchImportItems((prev) =>
                            prev
                              ? prev.map((it, i) => (i === idx ? { ...it, regionCode: e.target.value } : it))
                              : null
                          )
                        }
                        placeholder="Opsional"
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px]"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="color"
                        value={item.fillColor}
                        onChange={(e) =>
                          setBatchImportItems((prev) =>
                            prev
                              ? prev.map((it, i) => (i === idx ? { ...it, fillColor: e.target.value } : it))
                              : null
                          )
                        }
                        className="w-8 h-7 rounded cursor-pointer border border-slate-200"
                      />
                    </td>
                    <td className="p-2.5 text-right font-mono text-[11px] font-bold text-slate-700">
                      {(item.areaSqM / 10000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ha
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid Utama: Editor Peta (Kiri) + Metadata & Koordinat (Kanan) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>
                    {editingBoundaryId
                      ? `Editor Batas: ${villageName || 'Wilayah Tersimpan'}`
                      : 'Digitasi / Impor Poligon Batas Baru'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Klik peta untuk menambah titik sudut, seret penanda bernomor untuk memindahkan titik, atau impor GeoJSON desa sebelah.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStartNewDraft('MAIN_VILLAGE')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Draf Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartNewDraft('NEIGHBOR_VILLAGE')}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Desa Sebelah</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (geoJsonFileInputRef.current) {
                      geoJsonFileInputRef.current.value = '';
                      geoJsonFileInputRef.current.click();
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import GeoJSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteGeoJson(!showPasteGeoJson)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tempel JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCurrentGeoJson}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Export Desa Ini</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAllBoundariesGeoJson}
                  disabled={boundaries.length === 0}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Semua Desa</span>
                </button>
              </div>
            </div>

            {showPasteGeoJson && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Tempel GeoJSON (Mendukung 1 Desa maupun Banyak Desa dalam FeatureCollection)
                </label>
                <textarea
                  rows={4}
                  value={pasteGeoJsonText}
                  onChange={(e) => setPasteGeoJsonText(e.target.value)}
                  placeholder='{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"villageName":"Desa Teluk Ketapang"},"geometry":{"type":"Polygon","coordinates":[[[103.42,-1.55],[103.46,-1.55],[103.46,-1.59],[103.42,-1.59],[103.42,-1.55]]]}}]}'
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-[11px] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasteGeoJson(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPastedGeoJson}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Muat GeoJSON
                  </button>
                </div>
              </div>
            )}

            <BoundaryEditorMap
              points={points}
              onChangePoints={updatePointsWithHistory}
              isEditing={isEditingMap}
              onToggleEditing={setIsEditingMap}
              canUndo={historyStack.length > 0}
              onUndo={handleUndo}
              hasUnsavedChanges={hasUnsavedChanges}
              onDiscardChanges={handleDiscardChanges}
              boundaryColor={fillColor || gisBootstrap?.config?.boundaryColor || MAIN_DEFAULT_COLOR}
              savedBoundaries={boundaries}
              editingBoundaryId={editingBoundaryId}
              dusunBoundaries={dusunBoundaries}
              facilities={facilities}
              height="470px"
            />
          </div>

          {/* Daftar Titik Koordinat Poligon (Editable Table) */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                  Editor Titik Koordinat Poligon ({points.length} Titik)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Edit koordinat presisi [Latitude, Longitude] secara langsung atau tambahkan titik GPS lapangan.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="Lat (-1.5562)"
                  className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                />
                <input
                  type="text"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  placeholder="Lng (103.4475)"
                  className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleAddManualPoint}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Titik</span>
                </button>
              </div>
            </div>

            {points.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                Belum ada titik poligon di editor. Klik peta, tambah koordinat manual, atau impor GeoJSON.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-16">Titik</th>
                      <th className="p-2.5">Latitude (LS/LU)</th>
                      <th className="p-2.5">Longitude (BT)</th>
                      <th className="p-2.5 text-right w-16">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {points.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="p-2 font-sans font-bold text-slate-700">P{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.000001"
                            value={pt[0]}
                            onChange={(e) => handleUpdateCoordinateCell(idx, 0, e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.000001"
                            value={pt[1]}
                            onChange={(e) => handleUpdateCoordinateCell(idx, 1, e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              updatePointsWithHistory(points.filter((_, i) => i !== idx))
                            }
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title={`Hapus Titik P${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Form Metadata Penyimpanan & Daftar Versi Batas */}
        <div className="xl:col-span-5 space-y-5">
          <form
            onSubmit={handleSaveBoundary}
            className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
                  PENYIMPANAN PERMANEN
                </span>
                <h3 className="font-extrabold text-sm text-slate-900">
                  {editingBoundaryId ? 'Perbarui Poligon Batas Wilayah' : 'Simpan Batas Wilayah Baru'}
                </h3>
              </div>
              {hasUnsavedChanges && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  Belum Disimpan
                </span>
              )}
            </div>

            {liveMetrics && (
              <div className="grid grid-cols-2 gap-2.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-xs">
                <div>
                  <span className="text-[10px] text-emerald-800 block font-semibold">
                    Estimasi Luas Poligon
                  </span>
                  <strong className="text-emerald-950 font-black">
                    {liveMetrics.formattedAreaHectares}
                  </strong>
                  <span className="text-[10px] text-emerald-700 block">
                    {liveMetrics.formattedAreaSqM}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-800 block font-semibold">
                    Keliling Batas (Haversine)
                  </span>
                  <strong className="text-emerald-950 font-black">
                    {liveMetrics.perimeterMeters.toLocaleString('id-ID')} meter
                  </strong>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700">Nama Desa / Wilayah*</label>
                <input
                  type="text"
                  required
                  value={villageName}
                  onChange={(e) => setVillageName(e.target.value)}
                  placeholder="Misal: Desa Pulau Betung / Desa Teluk Ketapang"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Peran Wilayah pada Peta*</label>
                <select
                  value={boundaryRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as BoundaryRole;
                    setBoundaryRole(nextRole);
                    if (nextRole === 'NEIGHBOR_VILLAGE') {
                      setIsActive(false);
                      if (fillColor === MAIN_DEFAULT_COLOR) {
                        setFillColor('#0284c7');
                      }
                    } else if (fillColor === '#0284c7') {
                      setFillColor(MAIN_DEFAULT_COLOR);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="MAIN_VILLAGE">Desa Utama (Pulau Betung)</option>
                  <option value="NEIGHBOR_VILLAGE">Desa Sebelah / Sekitar</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Warna Garis Batas</label>
                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-xs font-bold text-slate-700 uppercase">
                    {fillColor}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Kode Wilayah Kemendagri</label>
                <input
                  type="text"
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  placeholder="15.04.05.2009"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tahun Sumber</label>
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  value={sourceYear}
                  onChange={(e) => setSourceYear(e.target.value)}
                  placeholder="2026"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Jenis Sumber Data Batas*</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as BoundarySourceType)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Nama / Keterangan Sumber</label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Misal: Peta Batas BIG / GeoJSON Desa Tetangga"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Catatan Lisensi / Legalitas</label>
              <input
                type="text"
                value={licenseNote}
                onChange={(e) => setLicenseNote(e.target.value)}
                placeholder="Misal: Arsip Pemerintah Desa / SK Bupati"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Catatan Verifikasi</label>
              <textarea
                rows={2}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Catatan sumber titik ukur, batas sungai, atau berita acara..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnMap}
                  onChange={(e) => setShowOnMap(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 w-4 h-4"
                />
                <span>Tampilkan wilayah &amp; label namanya pada peta publik dan admin</span>
              </label>

              {boundaryRole === 'MAIN_VILLAGE' && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 w-4 h-4"
                  />
                  <span>Jadikan poligon ini sebagai batas aktif Desa Utama</span>
                </label>
              )}
            </div>

            {sourceType !== 'OFFICIAL_BIG' && sourceType !== 'PEMDA' && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                Poligon hasil digitasi admin atau impor GeoJSON lokal tercatat dengan status{' '}
                <strong>PERLU VERIFIKASI / BELUM TERVERIFIKASI</strong> hingga disahkan melalui panel verifikasi.
              </div>
            )}

            <button
              type="submit"
              disabled={saving || points.length < 3}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? 'Menyimpan ke Server...'
                  : editingBoundaryId
                  ? 'Simpan Pembaruan Batas Wilayah'
                  : 'Simpan Batas Wilayah Permanen'}
              </span>
            </button>
          </form>

          {/* Riwayat & Daftar Versi Batas Wilayah */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">
                Daftar Wilayah &amp; Batas Tersimpan ({boundaries.length})
              </h4>
              <button
                type="button"
                onClick={() => loadBoundariesIntoState(false)}
                className="text-[11px] font-bold text-emerald-700 hover:underline"
              >
                Muat Ulang
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Memuat daftar batas wilayah desa...
              </div>
            ) : boundaries.length === 0 ? (
              <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1.5">
                <p className="text-xs font-bold text-slate-700">
                  Belum ada poligon batas wilayah tersimpan.
                </p>
                <p className="text-[11px] text-slate-500">
                  Silakan digitasi langsung pada peta atau impor file GeoJSON batas Desa Pulau Betung &amp; desa sekitarnya.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                {boundaries.map((b) => {
                  const isLoaded = editingBoundaryId === b.id;
                  const isVerifying = verifyingId === b.id;
                  const isConfirmingDelete = confirmDeleteId === b.id;
                  const isVisible = b.showOnMap !== false;
                  const swatch =
                    b.fillColor ||
                    (b.boundaryRole === 'NEIGHBOR_VILLAGE' ? '#0284c7' : MAIN_DEFAULT_COLOR);

                  return (
                    <div
                      key={b.id}
                      className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                        isLoaded
                          ? 'border-emerald-500 bg-emerald-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-white shadow-xs shrink-0"
                            style={{ backgroundColor: swatch }}
                            title={`Warna: ${swatch}`}
                          />
                          {getBoundaryRoleBadge(b.boundaryRole)}
                          {getStatusBadge(b.status)}
                          {b.isActive && b.boundaryRole !== 'NEIGHBOR_VILLAGE' && (
                            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-800 border border-pink-200 text-[10px] font-extrabold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Aktif Utama
                            </span>
                          )}
                          {!isVisible && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                              Disembunyikan
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {b.sourceType}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="text-xs font-extrabold text-slate-900">
                          {b.villageName || b.sourceName || 'Poligon Batas Wilayah Desa'}
                          {b.sourceYear ? ` (${b.sourceYear})` : ''}
                        </div>
                        {b.sourceName && b.villageName && b.sourceName !== b.villageName && (
                          <div className="text-[11px] text-slate-500">{b.sourceName}</div>
                        )}
                        <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Kode: {b.regionCode || '-'}</span>
                          <span>
                            Luas:{' '}
                            <strong>
                              {b.areaSqM
                                ? `${(b.areaSqM / 10000).toLocaleString('id-ID', {
                                    maximumFractionDigits: 2
                                  })} Ha`
                                : '-'}
                            </strong>
                          </span>
                          <span>
                            Keliling:{' '}
                            {b.perimeterMeters
                              ? `${Math.round(b.perimeterMeters).toLocaleString('id-ID')} m`
                              : '-'}
                          </span>
                        </div>
                        {b.verifiedBy && (
                          <div className="text-[10px] text-emerald-700 font-medium">
                            Diverifikasi oleh {b.verifiedBy}
                            {b.verifiedAt
                              ? ` • ${new Date(b.verifiedAt).toLocaleDateString('id-ID')}`
                              : ''}
                          </div>
                        )}
                        {b.verificationNotes && (
                          <p className="text-[11px] text-slate-500 italic">
                            &ldquo;{b.verificationNotes}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Aksi */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleLoadBoundaryToEditor(b)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleShowOnMap(b)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 ${
                            isVisible
                              ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                              : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{isVisible ? 'Tampil' : 'Sembunyi'}</span>
                        </button>

                        {!b.isActive && b.boundaryRole !== 'NEIGHBOR_VILLAGE' && (
                          <button
                            type="button"
                            onClick={() => handleSetActiveBoundary(b.id)}
                            className="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold"
                          >
                            Jadikan Aktif
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setVerifyingId(isVerifying ? null : b.id);
                            setVerifyTargetStatus(b.status);
                            setVerifyNotesInput(b.verificationNotes || '');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verifikasi</span>
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleDeleteBoundary(b.id)}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(b.id)}
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 ml-auto"
                            title="Hapus Versi Batas Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {isVerifying && (
                        <div className="mt-2 p-3 rounded-xl bg-white border border-emerald-200 space-y-2 text-xs">
                          <label className="font-bold text-slate-800 block">
                            Ubah Status Verifikasi Batas
                          </label>
                          <select
                            value={verifyTargetStatus}
                            onChange={(e) =>
                              setVerifyTargetStatus(e.target.value as BoundaryVerificationStatus)
                            }
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                          >
                            <option value="TERVERIFIKASI">TERVERIFIKASI</option>
                            <option value="PERLU_VERIFIKASI">PERLU VERIFIKASI</option>
                            <option value="BELUM_TERVERIFIKASI">BELUM TERVERIFIKASI</option>
                          </select>
                          <input
                            type="text"
                            value={verifyNotesInput}
                            onChange={(e) => setVerifyNotesInput(e.target.value)}
                            placeholder="Catatan verifikator (misal: Cocok dengan Peta BIG / Musdes)"
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setVerifyingId(null)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold"
                            >
                              Tutup
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitVerification(b.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Simpan Status</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
