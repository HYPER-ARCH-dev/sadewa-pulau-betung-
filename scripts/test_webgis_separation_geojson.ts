import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBoundaryGeoJsonExport,
  buildParcelGeoJsonExport,
  validateFeatureCollectionStrict,
  validateGeoJsonGeometryStrict,
  validateLinearRingStrict,
  validateLngLatPositionStrict
} from '../src/utils/webGisGeoJson';
import { INITIAL_DUSUN_BOUNDARIES, INITIAL_LAND_PARCELS } from '../src/data/initialWebGisData';
import { GisVillageBoundary, LandParcel } from '../src/types/webgis';

const SAMPLE_MAIN_BOUNDARY: GisVillageBoundary = {
  id: 'bnd-main-001',
  villageId: 'desa-pulau-betung',
  villageName: 'Desa Pulau Betung',
  boundaryRole: 'MAIN_VILLAGE',
  showOnMap: true,
  fillColor: '#ec4899',
  regionCode: '15.04.05.2009',
  status: 'TERVERIFIKASI',
  sourceType: 'OFFICIAL_BIG',
  sourceName: 'Peta Batas Administrasi BIG',
  sourceYear: 2025,
  geometryGeoJson: {
    type: 'Polygon',
    coordinates: [
      [
        [103.34, -1.598],
        [103.36, -1.598],
        [103.36, -1.618],
        [103.34, -1.618],
        [103.34, -1.598]
      ]
    ]
  },
  isActive: true,
  updatedAt: '2026-10-01T00:00:00.000Z'
};

const SAMPLE_NEIGHBOR_MULTIPOLYGON: GisVillageBoundary = {
  id: 'bnd-nbr-002',
  villageId: 'desa-pulau-betung',
  villageName: 'Desa Tebing Tinggi',
  boundaryRole: 'NEIGHBOR_VILLAGE',
  showOnMap: true,
  fillColor: '#0284c7',
  regionCode: '15.04.05.2010',
  status: 'PERLU_VERIFIKASI',
  sourceType: 'IMPORTED_GEOJSON',
  sourceName: 'GeoJSON Desa Sebelah',
  geometryGeoJson: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [103.36, -1.598],
          [103.375, -1.598],
          [103.375, -1.612],
          [103.36, -1.612],
          [103.36, -1.598]
        ]
      ]
    ]
  },
  isActive: false
};

test('Test 1 — Isolasi Data Batas Wilayah vs Bidang Tanah (zero cross-fallback)', () => {
  // Ketika batas wilayah kosong tetapi bidang tanah terisi, export batas wilayah tetap kosong (0 fitur)
  const emptyBoundaryRes = buildBoundaryGeoJsonExport([], []);
  assert.equal(emptyBoundaryRes.validCount, 0);
  assert.equal(emptyBoundaryRes.featureCollection.features.length, 0);

  // Ketika bidang tanah kosong tetapi batas wilayah terisi, export bidang tanah tetap kosong (0 fitur)
  const emptyParcelRes = buildParcelGeoJsonExport([]);
  assert.equal(emptyParcelRes.validCount, 0);
  assert.equal(emptyParcelRes.featureCollection.features.length, 0);

  // Menghapus satu item dari array batas tidak memengaruhi array bidang tanah
  const boundariesList: GisVillageBoundary[] = [SAMPLE_MAIN_BOUNDARY, SAMPLE_NEIGHBOR_MULTIPOLYGON];
  const parcelsSnapshot: LandParcel[] = structuredClone(INITIAL_LAND_PARCELS);

  const afterDeleteBoundaries = boundariesList.filter((b) => b.id !== 'bnd-nbr-002');
  const boundaryExport = buildBoundaryGeoJsonExport(afterDeleteBoundaries, INITIAL_DUSUN_BOUNDARIES);
  const parcelExport = buildParcelGeoJsonExport(parcelsSnapshot);

  assert.equal(boundaryExport.validCount, 1 + INITIAL_DUSUN_BOUNDARIES.length);
  assert.equal(parcelExport.validCount, INITIAL_LAND_PARCELS.length);
});

test('Test 2 — Export GeoJSON Batas Wilayah (.geojson) bersih dari atribut persil & lengkap metadata', () => {
  const result = buildBoundaryGeoJsonExport(
    [SAMPLE_MAIN_BOUNDARY, SAMPLE_NEIGHBOR_MULTIPOLYGON],
    INITIAL_DUSUN_BOUNDARIES,
    { villageName: 'Desa Pulau Betung' }
  );

  assert.equal(result.rejectedCount, 0);
  assert.equal(result.validCount, 2 + INITIAL_DUSUN_BOUNDARIES.length);
  assert.equal(result.featureCollection.type, 'FeatureCollection');
  assert.equal(result.featureCollection.name, 'Batas_Wilayah');
  assert.equal(result.featureCollection.metadata.dataset, 'administrative_boundary');

  const strictReport = validateFeatureCollectionStrict(result.featureCollection);
  assert.equal(strictReport.isValidCollection, true);
  assert.equal(strictReport.invalidCount, 0);

  const serialized = JSON.stringify(result.featureCollection);
  // Pastikan zero atribut persil/NOP/PBB/SPORADIK/NIK
  for (const feat of result.featureCollection.features) {
    const keys = Object.keys(feat.properties);
    assert.ok(keys.includes('nama_wilayah'));
    assert.ok(keys.includes('kode_wilayah'));
    assert.ok(keys.includes('status_batas'));
    assert.ok(keys.includes('keterangan'));
    assert.ok(!('nop' in feat.properties));
    assert.ok(!('pemilik' in feat.properties));
    assert.ok(!('status_pbb' in feat.properties));
    assert.ok(!('status_sporadik' in feat.properties));
    assert.ok(!('ownerNik' in feat.properties));
  }
  assert.equal(serialized.includes('15.04.010.001'), false);

  // Verifikasi status Definitif vs Indikatif
  assert.equal(result.featureCollection.features[0].properties.status_batas, 'Definitif');
  assert.equal(result.featureCollection.features[1].properties.status_batas, 'Indikatif');
  assert.match(result.featureCollection.features[1].properties.keterangan, /bukan penetapan batas hukum definitif/i);
});

test('Test 3 — Export GeoJSON Bidang Tanah (.geojson) terpisah & bebas data sensitif/batas indikatif', () => {
  const result = buildParcelGeoJsonExport(INITIAL_LAND_PARCELS);

  assert.equal(result.rejectedCount, 0);
  assert.equal(result.validCount, INITIAL_LAND_PARCELS.length);
  assert.equal(result.featureCollection.type, 'FeatureCollection');
  assert.equal(result.featureCollection.name, 'Bidang_Tanah_Persil');
  assert.equal(result.featureCollection.metadata.dataset, 'land_parcel');

  const strictReport = validateFeatureCollectionStrict(result.featureCollection);
  assert.equal(strictReport.isValidCollection, true);
  assert.equal(strictReport.invalidCount, 0);

  for (const feat of result.featureCollection.features) {
    assert.equal(feat.geometry.type, 'Polygon');
    const props = feat.properties;
    assert.ok(props.id_bidang);
    assert.ok(props.nop);
    assert.ok(props.pemilik);
    assert.ok(props.dusun);
    assert.equal(typeof props.luas_m2, 'number');
    assert.ok(props.status_pbb);
    assert.ok(props.status_sporadik);
    // Pastikan NIK & nomor telepon pribadi tidak ikut terekspos, dan zero metadata batas administratif
    assert.ok(!('ownerNik' in props));
    assert.ok(!('nik' in props));
    assert.ok(!('phone' in props));
    assert.ok(!('status_batas' in props));
    assert.ok(!('nama_wilayah' in props));
  }

  // Pastikan parsing RT dari addressDusun berjalan akurat (misal "Dusun 1 RT 02" -> dusun "Dusun 1", rt "02")
  assert.equal(result.featureCollection.features[0].properties.dusun, 'Dusun 1');
  assert.equal(result.featureCollection.features[0].properties.rt, '02');
});

test('Test 4 — Validasi Geometri GeoJSON Strict tanpa perbaikan/auto-swap diam-diam', () => {
  // 4a. Posisi valid [lng, lat]
  assert.equal(validateLngLatPositionStrict([103.343, -1.6022]).valid, true);

  // 4b. Posisi terbalik [lat, lng] di Indonesia (-1.6, 103.34) wajib DITOLAK (latitude > 90)
  const swapped = validateLngLatPositionStrict([-1.6022, 103.343]);
  assert.equal(swapped.valid, false);
  assert.match(swapped.reason || '', /di luar rentang valid/i);

  // 4c. NaN, Infinity, null, [0,0] wajib DITOLAK
  assert.equal(validateLngLatPositionStrict([NaN, -1.6]).valid, false);
  assert.equal(validateLngLatPositionStrict([103.3, Infinity]).valid, false);
  assert.equal(validateLngLatPositionStrict([null, -1.6]).valid, false);
  assert.equal(validateLngLatPositionStrict([0, 0]).valid, false);

  // 4d. Ring tidak tertutup wajib DITOLAK tanpa auto-close pada validator strict
  const unclosedRing = validateLinearRingStrict([
    [103.34, -1.60],
    [103.35, -1.60],
    [103.35, -1.61],
    [103.34, -1.61]
  ]);
  assert.equal(unclosedRing.valid, false);
  assert.match(unclosedRing.reason || '', /tidak tertutup/i);

  // 4e. Ring < 4 titik wajib DITOLAK
  assert.equal(
    validateLinearRingStrict([
      [103.34, -1.6],
      [103.35, -1.6],
      [103.34, -1.6]
    ]).valid,
    false
  );

  // 4f. Geometri null / Point / koordinat kosong wajib DITOLAK
  assert.equal(validateGeoJsonGeometryStrict(null).valid, false);
  assert.equal(validateGeoJsonGeometryStrict({ type: 'Point', coordinates: [103.34, -1.6] }).valid, false);
  assert.equal(validateGeoJsonGeometryStrict({ type: 'Polygon', coordinates: [] }).valid, false);

  // 4g. Feature rusak dikecualikan pada export tanpa memutasi fitur valid
  const brokenParcel: LandParcel = {
    ...INITIAL_LAND_PARCELS[0],
    id: 'PARCEL-BROKEN-01',
    coordinates: [
      [103.343, -1.6022], // Terbalik [lng, lat] pada slot [lat, lng] -> lat=103.343 invalid!
      [-1.6022, 103.3455],
      [-1.6045, 103.3455]
    ]
  };
  const mixedExport = buildParcelGeoJsonExport([INITIAL_LAND_PARCELS[0], brokenParcel]);
  assert.equal(mixedExport.validCount, 1);
  assert.equal(mixedExport.rejectedCount, 1);
  assert.equal(mixedExport.rejectedFeatures[0].id, 'PARCEL-BROKEN-01');
  assert.equal(mixedExport.featureCollection.features[0].properties.id_bidang, INITIAL_LAND_PARCELS[0].id);

  // 4h. Boundary dengan ring tidak tertutup ditolak bersih saat buildBoundaryGeoJsonExport
  const unclosedBoundary: GisVillageBoundary = {
    ...SAMPLE_MAIN_BOUNDARY,
    id: 'bnd-unclosed',
    geometryGeoJson: {
      type: 'Polygon',
      coordinates: [
        [
          [103.34, -1.598],
          [103.36, -1.598],
          [103.36, -1.618],
          [103.34, -1.618] // sengaja tidak ditutup
        ]
      ]
    }
  };
  const mixedBoundaryExport = buildBoundaryGeoJsonExport([SAMPLE_MAIN_BOUNDARY, unclosedBoundary], []);
  assert.equal(mixedBoundaryExport.validCount, 1);
  assert.equal(mixedBoundaryExport.rejectedCount, 1);
  assert.equal(mixedBoundaryExport.rejectedFeatures[0].id, 'bnd-unclosed');
});
