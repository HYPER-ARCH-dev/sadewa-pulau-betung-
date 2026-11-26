/**
 * Helper normalisasi data MapFacility antara JSON Store & PostgreSQL Prisma
 * tanpa mengubah skema database yang sudah ada (non-destructive).
 */

export function normalizeFacilityCoordinatePair(coords: unknown): [number, number] | null {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  return [lat, lng];
}

export function parseIncomingFacilityCoordinates(rawCoords: unknown): {
  valid: boolean;
  value: [number, number] | null;
} {
  if (rawCoords === null || rawCoords === undefined || rawCoords === '') {
    return { valid: true, value: null };
  }
  if (Array.isArray(rawCoords) && rawCoords.length === 0) {
    return { valid: true, value: null };
  }
  const pair = normalizeFacilityCoordinatePair(rawCoords);
  if (!pair) {
    return { valid: false, value: null };
  }
  return { valid: true, value: pair };
}

export interface FacilityMetadataPayload {
  plusCode?: string;
  verificationStatus?: string;
  coordinateSource?: string;
  locationNotes?: string;
  boundaryMembershipNote?: string;
  isActive?: boolean;
}

export function extractFacilityMetadata(rawGeoJson: unknown): FacilityMetadataPayload {
  if (!rawGeoJson || typeof rawGeoJson !== 'object') return {};
  const obj = rawGeoJson as Record<string, unknown>;
  if (obj.kind !== 'facility_metadata') return {};
  return {
    plusCode: typeof obj.plusCode === 'string' && obj.plusCode.trim() ? obj.plusCode.trim() : undefined,
    verificationStatus:
      typeof obj.verificationStatus === 'string' && obj.verificationStatus.trim()
        ? obj.verificationStatus.trim()
        : undefined,
    coordinateSource:
      typeof obj.coordinateSource === 'string' && obj.coordinateSource.trim()
        ? obj.coordinateSource.trim()
        : undefined,
    locationNotes:
      typeof obj.locationNotes === 'string' && obj.locationNotes.trim()
        ? obj.locationNotes.trim()
        : undefined,
    boundaryMembershipNote:
      typeof obj.boundaryMembershipNote === 'string' && obj.boundaryMembershipNote.trim()
        ? obj.boundaryMembershipNote.trim()
        : undefined,
    isActive: typeof obj.isActive === 'boolean' ? obj.isActive : undefined
  };
}

export function buildFacilityMetadataGeoJson(fac: Record<string, any>): Record<string, any> | undefined {
  const meta: Record<string, any> = { kind: 'facility_metadata' };
  let hasAny = false;
  for (const key of [
    'plusCode',
    'verificationStatus',
    'coordinateSource',
    'locationNotes',
    'boundaryMembershipNote'
  ] as const) {
    if (typeof fac[key] === 'string' && fac[key].trim() !== '') {
      meta[key] = fac[key].trim();
      hasAny = true;
    }
  }
  if (typeof fac.isActive === 'boolean') {
    meta.isActive = fac.isActive;
    hasAny = true;
  }
  return hasAny ? meta : undefined;
}

export function normalizeMapFacilityRecord(fac: any) {
  const meta = extractFacilityMetadata(fac?.geometryGeoJson);
  const normalizedCoords = normalizeFacilityCoordinatePair(fac?.coordinates);
  const plusCode =
    typeof fac?.plusCode === 'string' && fac.plusCode.trim()
      ? fac.plusCode.trim()
      : meta.plusCode;
  const verificationStatus =
    typeof fac?.verificationStatus === 'string' && fac.verificationStatus.trim()
      ? fac.verificationStatus.trim()
      : meta.verificationStatus;
  const coordinateSource =
    typeof fac?.coordinateSource === 'string' && fac.coordinateSource.trim()
      ? fac.coordinateSource.trim()
      : meta.coordinateSource || (normalizedCoords ? 'KOORDINAT_EKSPLISIT' : 'BELUM_TERKONFIRMASI');
  const locationNotes =
    typeof fac?.locationNotes === 'string' && fac.locationNotes.trim()
      ? fac.locationNotes.trim()
      : meta.locationNotes;
  const boundaryMembershipNote =
    typeof fac?.boundaryMembershipNote === 'string' && fac.boundaryMembershipNote.trim()
      ? fac.boundaryMembershipNote.trim()
      : meta.boundaryMembershipNote;
  const isActive =
    typeof fac?.isActive === 'boolean'
      ? fac.isActive
      : typeof meta.isActive === 'boolean'
      ? meta.isActive
      : Boolean(normalizedCoords);

  const coordinatesLabel =
    typeof fac?.coordinatesLabel === 'string' && fac.coordinatesLabel.trim()
      ? fac.coordinatesLabel.trim()
      : normalizedCoords
      ? `${normalizedCoords[0].toFixed(4)}°, ${normalizedCoords[1].toFixed(4)}°`
      : 'Koordinat belum terkonfirmasi';

  return {
    id: fac.id,
    villageId: fac.villageId || undefined,
    name: fac.name,
    category: fac.category,
    address: fac.address,
    dusun: fac.dusun,
    coordinatesLabel,
    description: fac.description || '',
    coordinates: normalizedCoords,
    imageUrl: typeof fac?.imageUrl === 'string' ? fac.imageUrl.trim() : '',
    contact: typeof fac?.contact === 'string' && fac.contact.trim() ? fac.contact.trim() : undefined,
    isActive,
    ...(plusCode ? { plusCode } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(coordinateSource ? { coordinateSource } : {}),
    ...(locationNotes ? { locationNotes } : {}),
    ...(boundaryMembershipNote ? { boundaryMembershipNote } : {})
  };
}
