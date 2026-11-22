/**
 * ============================================================================
 * HOST-SCOPED TENANT STORAGE HELPER (FRONTEND ISOLATION)
 * ============================================================================
 * Mengisolasi penyimpanan sesi autentikasi & preferensi lokal per domain/host
 * (`sadewa:<host>:<key>`) sehingga sesi admin dari satu desa tidak pernah
 * terbawa atau membocorkan konteks ke domain desa lain.
 *
 * Kompatibilitas Upgrade:
 * Kunci legacy `pulau_betung_*` tetap didukung secara transparan HANYA pada
 * host default Pulau Betung / lingkungan preview lokal agar sesi eksisting
 * tidak terputus saat transisi.
 * ============================================================================
 */

const LEGACY_PREFIX = 'pulau_betung_';

export function getTenantStorageHost(): string {
  if (typeof window === 'undefined' || !window.location?.host) {
    return 'default';
  }
  return window.location.host.trim().toLowerCase();
}

export function isLegacyPulauBetungHost(): boolean {
  const host = getTenantStorageHost().split(':')[0];
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app') ||
    host.endsWith('.vercel.app') ||
    host.startsWith('pulau-betung.') ||
    host.includes('pulaubetung')
  );
}

export function getTenantStoragePrefix(): string {
  return `sadewa:${getTenantStorageHost()}:`;
}

export function getTenantStorageKey(key: string): string {
  return `${getTenantStoragePrefix()}${key}`;
}

export function getTenantAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const scoped = localStorage.getItem(getTenantStorageKey('auth_token'));
  if (scoped) return scoped;

  if (isLegacyPulauBetungHost()) {
    const legacy = localStorage.getItem(`${LEGACY_PREFIX}auth_token`);
    if (legacy) {
      localStorage.setItem(getTenantStorageKey('auth_token'), legacy);
      return legacy;
    }
  }
  return null;
}

export function setTenantAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getTenantStorageKey('auth_token'), token);
  if (isLegacyPulauBetungHost()) {
    localStorage.setItem(`${LEGACY_PREFIX}auth_token`, token);
  }
}

export function clearTenantAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getTenantStorageKey('auth_token'));
  localStorage.removeItem(getTenantStorageKey('current_user'));
  if (isLegacyPulauBetungHost()) {
    localStorage.removeItem(`${LEGACY_PREFIX}auth_token`);
    localStorage.removeItem(`${LEGACY_PREFIX}current_user`);
  }
}

export function loadTenantStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const scopedRaw = localStorage.getItem(getTenantStorageKey(key));
    if (scopedRaw !== null) {
      return JSON.parse(scopedRaw) as T;
    }
    if (isLegacyPulauBetungHost()) {
      const legacyRaw = localStorage.getItem(`${LEGACY_PREFIX}${key}`);
      if (legacyRaw !== null) {
        localStorage.setItem(getTenantStorageKey(key), legacyRaw);
        return JSON.parse(legacyRaw) as T;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveTenantStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(getTenantStorageKey(key), serialized);
    if (isLegacyPulauBetungHost()) {
      localStorage.setItem(`${LEGACY_PREFIX}${key}`, serialized);
    }
  } catch {
    // Abaikan kuota browser penuh
  }
}

export function removeTenantStored(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getTenantStorageKey(key));
  if (isLegacyPulauBetungHost()) {
    localStorage.removeItem(`${LEGACY_PREFIX}${key}`);
  }
}

export function collectTenantLocalBackup(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const backup: Record<string, unknown> = {};
  const prefix = getTenantStoragePrefix();
  const allowLegacy = isLegacyPulauBetungHost();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(prefix) || (allowLegacy && key.startsWith(LEGACY_PREFIX))) {
      try {
        backup[key] = JSON.parse(localStorage.getItem(key) || '');
      } catch {
        backup[key] = localStorage.getItem(key);
      }
    }
  }
  return backup;
}

export function clearTenantLocalStoredAll(): void {
  if (typeof window === 'undefined') return;
  const prefix = getTenantStoragePrefix();
  const allowLegacy = isLegacyPulauBetungHost();
  const toDelete: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(prefix) || (allowLegacy && key.startsWith(LEGACY_PREFIX))) {
      toDelete.push(key);
    }
  }
  toDelete.forEach((k) => localStorage.removeItem(k));
}
