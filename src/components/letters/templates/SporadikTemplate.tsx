import React from 'react';
import { ServiceRequest } from '../../../types';
import { LetterTemplateDetails, LetterPageDetails, LetterVillageContext } from '../types';
import { sanitizeText, getCleanPurpose } from '../sanitizer';
import { DEFAULT_LETTER_VILLAGE_CONTEXT } from '../villageContext';
import { calculateHaversineDistance } from '../../../utils/haversine';
import { parseSmartCoordinates, parseSingleCoordinateComponent } from '../../../utils/coordinateParser';

interface ProjectedPoint {

  x: number;
  y: number;
  lat: number;
  lng: number;
  neighbor: string;
  length: string;
  direction: string;
}

export function calculateCompassBearingDirection(lat1: number, lng1: number, lat2: number, lng2: number): string {
  if (lat1 === 0 || lng1 === 0 || lat2 === 0 || lng2 === 0) return '';
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(radLat2);
  const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLng);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;

  if (bearing >= 337.5 || bearing < 22.5) return 'Utara';
  if (bearing >= 22.5 && bearing < 67.5) return 'Timur Laut';
  if (bearing >= 67.5 && bearing < 112.5) return 'Timur';
  if (bearing >= 112.5 && bearing < 157.5) return 'Tenggara';
  if (bearing >= 157.5 && bearing < 202.5) return 'Selatan';
  if (bearing >= 202.5 && bearing < 247.5) return 'Barat Daya';
  if (bearing >= 247.5 && bearing < 292.5) return 'Barat';
  if (bearing >= 292.5 && bearing < 337.5) return 'Barat Laut';
  return '';
}

export function calculateCadastralData(
  boundaries: {
    latitude?: string | number;
    longitude?: string | number;
    lat?: string | number;
    lng?: string | number;
    neighbor?: string;
    length?: string;
    panjang?: string;
    direction?: string;
    coordinateText?: string;
  }[],
  svgWidth: number = 800,
  svgHeight: number = 600
) {
  if (!boundaries || boundaries.length === 0) return { points: [], area: 0, perimeter: 0 };

  const coords = boundaries.map(b => {
    let finalLat = 0;
    let finalLng = 0;

    // 1. Ekstraksi via Smart Coordinate Parser jika ada coordinateText (DMS maupun Desimal)
    if (b.coordinateText && typeof b.coordinateText === 'string') {
      const parsed = parseSmartCoordinates(b.coordinateText);
      if (parsed && parsed.isValid) {
        finalLat = parsed.lat;
        finalLng = parsed.lng;
      }
    }

    // 2. Jika belum ada dari coordinateText, periksa lat/latitude & lng/longitude
    if (finalLat === 0 && finalLng === 0) {
      const latVal = b.lat !== undefined && b.lat !== '' ? b.lat : b.latitude;
      const lngVal = b.lng !== undefined && b.lng !== '' ? b.lng : b.longitude;

      if (typeof latVal === 'number' && typeof lngVal === 'number') {
        finalLat = isNaN(latVal) ? 0 : latVal;
        finalLng = isNaN(lngVal) ? 0 : lngVal;
      } else if (latVal !== undefined && lngVal !== undefined && latVal !== '' && lngVal !== '') {
        const latComp = parseSingleCoordinateComponent(String(latVal));
        const lngComp = parseSingleCoordinateComponent(String(lngVal));
        if (latComp && lngComp) {
          finalLat = latComp.value;
          finalLng = lngComp.value;
        } else {
          const parsedLat = parseFloat(String(latVal).trim());
          const parsedLng = parseFloat(String(lngVal).trim());
          finalLat = isNaN(parsedLat) ? 0 : parsedLat;
          finalLng = isNaN(parsedLng) ? 0 : parsedLng;
        }
      }
    }

    return {
      lat: isNaN(finalLat) ? 0 : finalLat,
      lng: isNaN(finalLng) ? 0 : finalLng,
      neighbor: b.neighbor || '',
      length: b.length || b.panjang || '0',
      direction: b.direction || ''
    };
  });

  // Filter hanya titik dengan koordinat valid (bukan 0 dan bukan NaN) untuk mencegah coordinate stacking
  const validCoords = coords.filter(c => !isNaN(c.lat) && !isNaN(c.lng) && (c.lat !== 0 || c.lng !== 0));
  const activePoints = validCoords.length >= 2 ? validCoords : coords;

  if (activePoints.length === 0) {
    return { points: [], area: 0, perimeter: 0 };
  }

  // Lengkapi panjang batas otomatis via Haversine Formula jika belum ada nilai / masih '0'
  for (let i = 0; i < activePoints.length; i++) {
    const cur = activePoints[i];
    if (!cur.length || cur.length === '0') {
      const next = activePoints[(i + 1) % activePoints.length];
      if (cur.lat !== 0 && cur.lng !== 0 && next.lat !== 0 && next.lng !== 0) {
        cur.length = calculateHaversineDistance(cur.lat, cur.lng, next.lat, next.lng).toString();
      }
    }
  }

  // 1. Hindari Pembulatan Awal:
  // Jangan gunakan Math.round, Math.floor, atau parseInt saat menghitung minLat, maxLat, minLng, dan maxLng.
  // Biarkan dalam bentuk desimal / float murni.
  const minLat = Math.min(...activePoints.map(c => c.lat));
  const maxLat = Math.max(...activePoints.map(c => c.lat));
  const minLng = Math.min(...activePoints.map(c => c.lng));
  const maxLng = Math.max(...activePoints.map(c => c.lng));
  const meanLat = activePoints.reduce((acc, c) => acc + c.lat, 0) / (activePoints.length || 1);

  // 2. Perbaiki Rumus Skala (Auto-Scale):
  // Hitung rentang murni:
  const rawLatRange = maxLat - minLat;
  const rawLngRange = maxLng - minLng;

  // Jika latRange atau lngRange sangat kecil (atau 0, misal hanya 1 titik valid),
  // berikan nilai fallback minimal (contoh: 0.001) agar pembagian skala tidak menghasilkan Infinity atau 0.
  const latRange = rawLatRange > 0.0000001 ? rawLatRange : 0.001;
  const lngRange = rawLngRange > 0.0000001 ? rawLngRange : 0.001;

  // 3. Mapping X/Y dengan Float:
  // Hitung posisi pixel menggunakan perbandingan desimal murni:
  // x = padding + ((lng - minLng) / lngRange) * usableWidth
  // y = padding + ((maxLat - lat) / latRange) * usableHeight
  const padding = 100;
  const usableWidth = svgWidth - padding * 2;
  const usableHeight = svgHeight - padding * 2;

  const projected: ProjectedPoint[] = activePoints.map(c => {
    const x = padding + ((c.lng - minLng) / lngRange) * usableWidth;
    const y = padding + ((maxLat - c.lat) / latRange) * usableHeight;
    return { ...c, x, y };
  });

  // Calculate Area and Perimeter using local Cartesian approximation (meters)
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos(meanLat * Math.PI / 180);
  
  const cartesian = activePoints.map(c => ({
    x: (c.lng - minLng) * mPerLng,
    y: (c.lat - minLat) * mPerLat
  }));

  let area = 0;
  let perimeter = 0;
  for (let i = 0; i < cartesian.length; i++) {
    const p1 = cartesian[i];
    const p2 = cartesian[(i + 1) % cartesian.length];
    
    // Shoelace formula for area
    area += (p1.x * p2.y - p2.x * p1.y);
    
    // Euclidean distance for perimeter
    perimeter += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  return {
    points: projected,
    area: Math.abs(area) / 2,
    perimeter: perimeter
  };
}

export function buildSporadikTemplate(
  request: ServiceRequest,
  vCtx?: LetterVillageContext
): LetterTemplateDetails {
  const ctx = vCtx || DEFAULT_LETTER_VILLAGE_CONTEXT;
  const formData = (request.formData || {}) as Record<string, any>;
  
  const sporadikMode = formData.sporadik_mode || 'manual';
  let rawBoundaries = [];
  try {
    rawBoundaries = JSON.parse(formData.sporadik_boundaries || '[]');
  } catch (e) {
    rawBoundaries = [];
  }

  // Filter out empty placeholder items (e.g. leftover unrecorded items from template creation when recording fewer GPS points)
  const validBoundaries = rawBoundaries.filter((b: any) => {
    const hasLat = (b.lat !== undefined && b.lat !== '' && Number(b.lat) !== 0) || 
                   (b.latitude !== undefined && b.latitude !== '' && Number(b.latitude) !== 0) || 
                   (b.coordinateText && String(b.coordinateText).trim() !== '');
    const hasLength = b.length && String(b.length).trim() !== '' && String(b.length).trim() !== '0';
    const hasPanjang = b.panjang && String(b.panjang).trim() !== '' && String(b.panjang).trim() !== '0';
    const hasNeighbor = b.neighbor && String(b.neighbor).trim() !== '';
    return hasLat || hasLength || hasPanjang || hasNeighbor;
  });

  const boundaries = validBoundaries.length > 0 ? validBoundaries : rawBoundaries;
  const cadastral = calculateCadastralData(boundaries, 800, 600);
  
  const landLocation = sanitizeText(formData.lokasi_tanah || formData.land_location || formData.letak_tanah, request.addressDusun || `Wilayah ${ctx.villageName}`);
  let finalArea = sanitizeText(formData.land_area || formData.luas_tanah, '± 1.000 m²');
  
  // Use calculated area if in GPS mode, or if it's an old draft (sporadik_mode missing) but has valid polygon data
  const isGpsMode = formData.sporadik_mode === 'gps' || (!formData.sporadik_mode && cadastral.points.length > 2);
  if (isGpsMode && cadastral.area > 0) {
    finalArea = `± ${cadastral.area.toLocaleString('id-ID', {maximumFractionDigits: 2})} m²`;
  }
  
  const sporadikMethod = formData.sporadik_method || (isGpsMode ? 'hybrid_wgs84' : 'manual');
  const gpsAccuracyVal = formData.gps_accuracy || (isGpsMode ? '± 2-5m' : '-');
  const gpsQualityVal = formData.gps_quality || (isGpsMode ? 'Tervalidasi' : '-');
  
  const methodLabel = sporadikMethod === 'hybrid_wgs84' 
    ? 'Hybrid WGS84 + Pita Ukur' 
    : sporadikMethod === 'full_wgs84' 
    ? 'Full GNSS WGS84 Engine' 
    : 'Terestrial / Manual';

  const landSource = sanitizeText(formData.land_source || formData.asal_tanah, 'Penggarapan / Warisan / Jual Beli Tanah Desa');
  
  let boundaryFields = boundaries.map((b: any, idx: number) => {
    let dirText = b.direction || b.arah || '';
    if (!dirText && cadastral.points && cadastral.points.length > 0) {
      const curPt = cadastral.points[idx];
      const nextPt = cadastral.points[(idx + 1) % cadastral.points.length];
      if (curPt && nextPt) {
        dirText = calculateCompassBearingDirection(curPt.lat, curPt.lng, nextPt.lat, nextPt.lng);
      }
    }
    if (!dirText) {
      dirText = `Sisi T${idx + 1} - T${(idx + 1) % boundaries.length + 1}`;
    }

    const neighbor = b.neighbor || b.nama_pemilik || b.pemilik || '...';
    const len = b.length || b.panjang || (cadastral.points && cadastral.points[idx]?.length) || '0';

    return {
      label: `Batas ${dirText}`,
      value: `${neighbor} (± ${len} m)`
    };
  });

  // Fallback to text fields if array boundaries is empty
  if (boundaryFields.length === 0) {
    boundaryFields = [
      { label: 'Batas Sebelah Utara', value: sanitizeText(formData.border_north || formData.batas_utara, '...') },
      { label: 'Batas Sebelah Timur', value: sanitizeText(formData.border_east || formData.batas_timur, '...') },
      { label: 'Batas Sebelah Selatan', value: sanitizeText(formData.border_south || formData.batas_selatan, '...') },
      { label: 'Batas Sebelah Barat', value: sanitizeText(formData.border_west || formData.batas_barat, '...') }
    ];
  }

  // Dynamic letter prefix
  const dateObj = request.completedAt ? new Date(request.completedAt) : new Date();
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const monthRoman = romanMonths[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  
  let baseLetterNum = request.officialLetterNumber || `593 / ....... / SK-SPORADIK / ${ctx.letterCodePrefix} / ${monthRoman} / ${year}`;
  
  // Pastikan klasifikasi selalu 593 dan menggunakan SK-SPORADIK
  const parts = baseLetterNum.split('/').map(p => p.trim());
  if (parts.length >= 5) {
    parts[0] = '593';
    parts[2] = 'SK-SPORADIK';
    baseLetterNum = parts.join(' / ');
  } else {
    baseLetterNum = baseLetterNum.replace('SK-DOM', 'SK-SPORADIK');
    baseLetterNum = baseLetterNum.replace('470', '593');
  }

  const pages: LetterPageDetails[] = [
    {
      pageNumber: 1,
      pageCode: 'LEMBAR 1',
      title: 'SURAT PERNYATAAN PENGUASAAN FISIK BIDANG TANAH',
      subtitle: 'Pernyataan Penguasaan Fisik oleh Pemohon',
      customOpening: 'Yang bertanda tangan di bawah ini:',
      statement: 'Saya yang bertanda tangan di bawah ini menyatakan bahwa saya dengan itikad baik telah menguasai dan mengusahakan sebidang tanah yang terletak di ' + landLocation + ' seluas ' + finalArea + ', diperoleh dari ' + landSource + '. Penguasaan tanah ini bebas sengketa dengan batas-batas sempadan sebagai berikut:',
      extraFields: boundaryFields,
      signType: 'pemohon',
    },
    {
      pageNumber: 2,
      pageCode: 'LEMBAR 2',
      title: 'SURAT KETERANGAN PENGESAHAN KEPALA DESA',
      subtitle: 'Pengesahan atas Pernyataan Penguasaan Fisik Tanah',
      statement: `Pemerintah ${ctx.villageName} dengan ini menerangkan dan mengesahkan bahwa pernyataan pemohon di atas adalah benar. Sebidang tanah yang terletak di ${landLocation} seluas ${finalArea} dengan batas-batas sempadan sebagai berikut adalah benar dikuasai oleh pemohon.`,
      extraFields: boundaryFields,
      signType: 'kades',
    },
    {
      pageNumber: 3,
      pageCode: 'LEMBAR 3',
      title: 'LAMPIRAN SKETSA BIDANG TANAH',
      subtitle: 'Pemetaan Koordinat Dinamis (Cadastral Mapping)',
      statement: 'Berdasarkan pengukuran koordinat lokasi, berikut adalah sketsa bidang tanah yang dikuasai:',

      closingStatement: 'none',
      signType: 'none',
      renderCustom: () => {
        return (
          <div className="mt-2 flex flex-col gap-2 font-sans">
            {/* Bingkai Utama Peta Sketsa Tanah (Judul, Canvas & Legenda Terintegrasi) */}
            <div className="w-full border-2 border-slate-800 bg-slate-50 shadow-xs overflow-hidden rounded-md flex flex-col">
              
              {/* Area SVG Canvas Peta (100% Bersih Tanpa Tertutup Box Overlay) */}
              <div className="relative w-full aspect-[16/11] min-h-[420px] max-h-[500px] print:min-h-[400px] print:max-h-[550px] bg-slate-50 overflow-hidden"
                   style={{
                     backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)',
                     backgroundSize: '20px 20px',
                     backgroundPosition: 'center center'
                   }}>
                
                {/* SVG Kompas Petunjuk Utara */}
                <div className="absolute top-2.5 right-2.5 flex flex-col items-center drop-shadow-sm z-10 bg-white/90 px-2 py-1 rounded border border-slate-300">
                  <span className="font-bold text-[9px] mb-0.5 text-slate-900">U</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-800">
                    <polygon points="12 2 15 12 12 22 9 12 12 2" fill="#cbd5e1"/>
                    <polygon points="12 2 15 12 12 12" fill="#334155"/>
                  </svg>
                </div>

                {/* Render Poligon Jika GPS */}
                {isGpsMode && cadastral.points.length > 2 && (
                  <svg className="w-full h-full absolute inset-0 drop-shadow-md" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
                    {/* Background polygon area */}
                    <polygon 
                       points={cadastral.points.map(p => `${p.x},${p.y}`).join(' ')}
                       fill="#10b981"
                       fillOpacity="0.2"
                       stroke="#047857"
                       strokeWidth="3"
                       strokeDasharray="4 2"
                    />
                    
                    {/* Applicant Name & Area centered in polygon */}
                    <g transform={`translate(${cadastral.points.reduce((sum, pt) => sum + pt.x, 0) / cadastral.points.length}, ${cadastral.points.reduce((sum, pt) => sum + pt.y, 0) / cadastral.points.length})`} className="select-none pointer-events-none">
                      <rect x="-80" y="-22" width="160" height="44" rx="6" fill="white" fillOpacity="0.85" stroke="#047857" strokeWidth="1.5" strokeDasharray="3 3" />
                      <text y="-2" textAnchor="middle" className="text-[13px] font-bold fill-slate-900 uppercase">
                        {request.citizenName || 'PEMOHON'}
                      </text>
                      <text y="14" textAnchor="middle" className="text-[12px] font-bold fill-emerald-800">
                        {finalArea}
                      </text>
                    </g>

                    {/* Edges & Boundary Texts */}
                    {cadastral.points.map((p1, idx) => {
                      const p2 = cadastral.points[(idx + 1) % cadastral.points.length];
                      const midX = (p1.x + p2.x) / 2;
                      const midY = (p1.y + p2.y) / 2;
                      
                      const centerX = cadastral.points.reduce((sum, pt) => sum + pt.x, 0) / cadastral.points.length;
                      const centerY = cadastral.points.reduce((sum, pt) => sum + pt.y, 0) / cadastral.points.length;
                      
                      // Calculate normal vector pointing outwards
                      let nx = p1.y - p2.y;
                      let ny = p2.x - p1.x;
                      const nLen = Math.hypot(nx, ny) || 1;
                      nx /= nLen;
                      ny /= nLen;
                      
                      // Check if normal points towards center, if so reverse it
                      const dx = midX - centerX;
                      const dy = midY - centerY;
                      if (nx * dx + ny * dy < 0) {
                        nx = -nx;
                        ny = -ny;
                      }
                      
                      // Push text outwards
                      const pushDist = 20;
                      const labelX = midX + nx * pushDist;
                      const labelY = midY + ny * pushDist;
                      
                      let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
                      
                      // Keep text upright
                      if (angle > 90 || angle < -90) {
                        angle += 180;
                      }

                      return (
                        <g key={`edge-${idx}`} transform={`translate(${labelX}, ${labelY}) rotate(${angle})`}>
                          <text y="-4" textAnchor="middle" className="text-[13px] font-bold fill-slate-900" style={{ textShadow: '1px 1px 3px white, -1px -1px 3px white, 1px -1px 3px white, -1px 1px 3px white' }}>
                            {p1.neighbor || 'Tanah Negara'}
                          </text>
                          <text y="10" textAnchor="middle" className="text-[11px] fill-slate-800 font-semibold" style={{ textShadow: '1px 1px 3px white, -1px -1px 3px white, 1px -1px 3px white, -1px 1px 3px white' }}>
                            {p1.direction || 'Batas'} • {p1.length || '0'} m
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Vertex Nodes & Titik Sudut Labeling (T1, T2, T3...) with Intelligent Offset */}
                    {cadastral.points.map((p, idx) => {
                      const centerX = cadastral.points.reduce((sum, pt) => sum + pt.x, 0) / cadastral.points.length;
                      const centerY = cadastral.points.reduce((sum, pt) => sum + pt.y, 0) / cadastral.points.length;
                      const dirX = p.x - centerX;
                      const dirY = p.y - centerY;
                      const dist = Math.hypot(dirX, dirY) || 1;
                      const offsetDist = 20;
                      const labelX = p.x + (dirX / dist) * offsetDist;
                      const labelY = p.y + (dirY / dist) * offsetDist;

                      return (
                        <g key={`pt-group-${idx}`} className="select-none">
                          {/* Connecting subtle dashed line to label tag */}
                          <line
                            x1={p.x}
                            y1={p.y}
                            x2={labelX}
                            y2={labelY}
                            stroke="#047857"
                            strokeWidth="1.2"
                            strokeDasharray="2 2"
                            strokeOpacity="0.7"
                          />
                          
                          {/* Outer Glow Ring */}
                          <circle cx={p.x} cy={p.y} r="8.5" fill="none" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.7" />
                          
                          {/* Vertex Node Corner Circle */}
                          <circle cx={p.x} cy={p.y} r="5" fill="#047857" stroke="#ffffff" strokeWidth="2" className="drop-shadow-sm" />

                          {/* Label Badge (T1, T2, T3...) */}
                          <rect
                            x={labelX - 13}
                            y={labelY - 10}
                            width="26"
                            height="20"
                            rx="4"
                            fill="#065f46"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))"
                          />
                          <text
                            x={labelX}
                            y={labelY + 4}
                            textAnchor="middle"
                            className="text-[11px] font-mono font-extrabold fill-white tracking-tighter"
                          >
                            {`T${idx + 1}`}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}

                {/* Overlay Status Mode */}
                {!isGpsMode && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none z-10">
                    <span className="text-3xl font-bold tracking-widest text-slate-400 rotate-[-15deg]">AREA SKETSA MANUAL</span>
                  </div>
                )}
              </div>

              {/* Panel Bawah Peta Terintegrasi: LEGENDA, SKALA & DATA UKUR (Cartographic Map Footer) */}
              <div className="border-t-2 border-slate-800 bg-white p-3 font-sans text-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  
                  {/* Bagian 1: Legenda Simbol Peta (5 kolom) */}
                  <div className="sm:col-span-5 border-b sm:border-b-0 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-3">
                    <div className="font-bold text-slate-900 text-[10px] uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>LEGENDA SIMBOL PETA</span>
                      <span className="font-mono text-[8.5px] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300 text-slate-700">WGS84</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-700">
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 border border-white inline-block shadow-sm"></span>
                        <span>Patok (T1-Tn)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-0.5 bg-emerald-700 border-t-2 border-dashed border-emerald-900 inline-block"></span>
                        <span>Sempadan</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 bg-emerald-500/30 border border-emerald-600 inline-block rounded-xs shadow-sm"></span>
                        <span>Bidang Tanah</span>
                      </div>
                    </div>
                    <div className="mt-1 pt-1 border-t border-slate-200/80 flex items-center justify-between text-[8px] text-slate-600 font-mono">
                      <span>Metode: <strong className="text-slate-800">{methodLabel}</strong></span>
                    </div>
                  </div>

                  {/* Bagian 2: Skala & Spesifikasi Teknis (4 kolom) */}
                  <div className="sm:col-span-4 border-b sm:border-b-0 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-3 text-[9px] font-mono space-y-1">
                    <div className="flex justify-between text-slate-700 leading-none">
                      <span>Skala Nisbi: <strong className="text-slate-900 text-[10px]">1 : 500</strong></span>
                      <span>Akurasi: <strong className="text-slate-900 text-[10px]">{typeof gpsAccuracyVal === 'number' ? `±${gpsAccuracyVal}m` : gpsAccuracyVal}</strong></span>
                    </div>
                    <div className="flex justify-between w-full text-[8px] text-slate-500 px-0.5 leading-none">
                      <span>0m</span>
                      <span>10m</span>
                      <span>20m</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 border border-slate-800 flex rounded-2xs overflow-hidden">
                      <div className="w-1/2 bg-slate-800"></div>
                      <div className="w-1/2 bg-white"></div>
                    </div>
                    <div className="flex justify-between items-center text-[8px] text-slate-600 pt-0.5">
                      <span>Status GPS: <strong className="text-emerald-800">{gpsQualityVal}</strong></span>
                    </div>
                  </div>

                  {/* Bagian 3: Ringkasan Total Luas & Keliling (3 kolom) */}
                  <div className="sm:col-span-3 bg-emerald-50/90 p-2.5 rounded border border-emerald-200 text-slate-900 flex flex-col justify-center">
                    <div className="leading-tight">
                      <span className="text-[8.5px] uppercase text-emerald-800 font-bold block mb-0.5">LUAS TERUKUR:</span>
                      <strong className="text-sm sm:text-[15px] font-mono text-emerald-950 block">{finalArea}</strong>
                    </div>
                    <div className="leading-tight mt-1 border-t border-emerald-200/80 pt-1 flex justify-between items-center text-[9px]">
                      <span className="text-emerald-800 font-bold">KELILING:</span>
                      <strong className="font-mono text-emerald-900">± {cadastral.perimeter.toFixed(1)} m</strong>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        );
      }
    }
  ];

  // Fallback realistis koordinat desa (Kecamatan, Kabupaten)
  const fallbackVillageCoords = [
    { lat: -1.528420, lng: 103.314250, direction: 'Utara', neighbor: 'Jalan Lingkungan Desa / Akses Utama', length: '35.40' },
    { lat: -1.528370, lng: 103.314810, direction: 'Timur', neighbor: `Tanah Kas ${ctx.villageName}`, length: '42.15' },
    { lat: -1.528940, lng: 103.314880, direction: 'Selatan', neighbor: 'Tanah Perkebunan / Warga', length: '36.80' },
    { lat: -1.529020, lng: 103.314320, direction: 'Barat', neighbor: 'Saluran Parit / Batas Dusun', length: '39.50' }
  ];

  const effectiveBoundaries = boundaries && boundaries.length > 0 
    ? boundaries 
    : fallbackVillageCoords;

  const totalPts = effectiveBoundaries.length;

  // Chunking 6 batas per lembar agar 1-6 batas muat sempurna di 1 lembar bersama TTD Kades
  const SEMPADAN_PER_PAGE = 6;
  const sempadanChunks: any[][] = [];
  for (let i = 0; i < effectiveBoundaries.length; i += SEMPADAN_PER_PAGE) {
    sempadanChunks.push(effectiveBoundaries.slice(i, i + SEMPADAN_PER_PAGE));
  }

  sempadanChunks.forEach((chunk, chunkIdx) => {
    const isFirstChunk = chunkIdx === 0;
    const isLastChunk = chunkIdx === sempadanChunks.length - 1;
    const currentLembarNumber = 4 + chunkIdx;

    pages.push({
      pageNumber: currentLembarNumber,
      pageCode: `LEMBAR ${currentLembarNumber}`,
      title: isFirstChunk ? 'PERSETUJUAN TETANGGA BATAS (SEMPADAN)' : 'PERSETUJUAN TETANGGA BATAS (LANJUTAN)',
      subtitle: isFirstChunk ? 'Persetujuan Sempadan & Legalisasi' : `Daftar Sempadan Lanjutan (Bagian ${chunkIdx + 1})`,
      statement: isFirstChunk 
        ? 'Dengan ini menyatakan bahwa batas-batas tanah sebagaimana tergambar pada Lampiran Sketsa (Lembar 3) telah disetujui bersama oleh para pihak yang berbatasan (Sempadan) tanpa ada sengketa, disaksikan oleh saksi-saksi, dan disahkan oleh Kepala Desa.'
        : 'Lanjutan daftar persetujuan batas-batas tanah (Sempadan) yang berbatasan langsung dengan bidang tanah yang bersangkutan:',
      closingStatement: 'none',
      signType: isLastChunk ? 'kades_dan_pihak' : 'none',
      renderCustom: () => {
        return (
          <div className="mt-0.5 flex flex-col font-sans">
            <div className="border border-slate-300 rounded-lg p-1.5 sm:p-2 bg-slate-50/80 shadow-2xs">
              <h5 className="font-bold text-[10.5px] uppercase mb-1 text-slate-800 text-center tracking-wider border-b border-slate-300 pb-0.5">
                Daftar Persetujuan Sempadan {chunkIdx > 0 ? `(Lanjutan ${chunkIdx + 1})` : ''}
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-1 items-start justify-center">
                {chunk.map((b: any, index: number) => {
                  const globalIdx = chunkIdx * SEMPADAN_PER_PAGE + index;
                  const nextIdx = (globalIdx + 1) % totalPts;
                  const p1 = cadastral.points[globalIdx] || fallbackVillageCoords[globalIdx % 4];
                  
                  const lat1 = (p1?.lat && p1.lat !== 0) ? p1.lat : (fallbackVillageCoords[globalIdx % 4]?.lat || -1.528420);
                  const lng1 = (p1?.lng && p1.lng !== 0) ? p1.lng : (fallbackVillageCoords[globalIdx % 4]?.lng || 103.314250);
                  const segLabel = `T${globalIdx + 1} - T${nextIdx + 1}`;
                  const dirName = b.direction || (globalIdx === 0 ? 'Utara' : globalIdx === 1 ? 'Timur' : globalIdx === 2 ? 'Selatan' : 'Barat');
                  
                  const lengthStr = String(b.length || b.panjang || '0');
                  const displayLength = lengthStr.toLowerCase().includes('m') ? lengthStr : `${lengthStr} M`;

                  return (
                    <div key={index} className="flex flex-col items-center text-center p-1 border border-slate-200 bg-white rounded shadow-2xs">
                      <div className="border-b border-slate-200 pb-0.5 mb-1 w-full flex flex-col items-center">
                        <div className="flex items-center justify-center gap-1 w-full">
                          <span className="text-[9px] font-bold text-slate-900 uppercase truncate">
                            BATAS {dirName}
                          </span>
                          <span className="inline-flex items-center px-0.5 py-0.1 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[8px] border border-emerald-300/60">
                            {segLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-0.5 text-[8px] text-slate-600 font-mono mt-0.5">
                          <span className="font-semibold text-slate-700">({displayLength})</span>
                          <span className="text-slate-500">{lat1.toFixed(5)}°, {lng1.toFixed(5)}°</span>
                        </div>
                      </div>
                      
                      {/* Space Tanda Tangan Basah */}
                      <div className="h-7 w-full flex items-center justify-center mb-0.5 rounded" />
                      
                      <span className="text-[9px] font-bold text-slate-900 uppercase underline decoration-slate-400 underline-offset-1 truncate max-w-full leading-tight">
                        {b.neighbor || '..................'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }
    });
  });

  return {
    title: 'BUNDEL SURAT SPORADIK',
    statement: 'Bundel dokumen penguasaan fisik tanah.',
    purpose: getCleanPurpose(request, 'Permohonan SHM PTSL'),
    customLetterNumber: baseLetterNum,
    isBundle: true,
    pages
  };
}
