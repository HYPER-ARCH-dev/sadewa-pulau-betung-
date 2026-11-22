import crypto from 'crypto';

/**
 * ============================================================================
 * SADEWA SERVER-SIDE CREDENTIAL VAULT (AES-256-GCM)
 * ============================================================================
 * Mengenkripsi & mendekripsi kredensial database Dedicated tenant (DATABASE_URL,
 * DIRECT_URL, SUPABASE_URL, SERVICE_ROLE_KEY) secara eksklusif di sisi server.
 *
 * Properti keamanan:
 * - Algoritma: AES-256-GCM (authenticated encryption)
 * - IV acak 12 byte per enkripsi (tidak pernah dipakai ulang)
 * - AAD terikat ke `sadewa-tenant:<tenantId>:v<keyVersion>` untuk mencegah
 *   ciphertext transplantation antar-tenant
 * - Master key diambil dari `process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY`
 *   (mendukung key versioned `TENANT_CREDENTIAL_ENCRYPTION_KEY_V<n>` untuk rotasi)
 * ============================================================================
 */

const ENVELOPE_PREFIX = 'enc:v';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const AES_KEY_BYTES = 32;

let devFallbackVaultKey: Buffer | null = null;
let hasWarnedDevVaultKey = false;

export interface EncryptSecretOptions {
  tenantId: string;
  keyVersion?: number;
  keyMaterial?: string | Buffer;
}

export interface DecryptSecretOptions {
  tenantId: string;
  keyMaterial?: string | Buffer;
}

export interface RotateSecretOptions {
  tenantId: string;
  newKeyVersion: number;
  oldKeyMaterial?: string | Buffer;
  newKeyMaterial?: string | Buffer;
}

function deriveAes256Key(raw: string | Buffer): Buffer {
  if (Buffer.isBuffer(raw)) {
    if (raw.length === AES_KEY_BYTES) {
      return raw;
    }
    if (raw.length < AES_KEY_BYTES) {
      throw new Error('Credential vault key buffer must be at least 32 bytes.');
    }
    return crypto.createHash('sha256').update('sadewa-vault-kdf:').update(raw).digest();
  }

  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  try {
    const b64 = Buffer.from(trimmed, 'base64');
    // Pastikan string memang valid base64 yang mendekode tepat 32 byte
    if (b64.length === AES_KEY_BYTES && b64.toString('base64').replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
      return b64;
    }
  } catch {
    // Abaikan, fallback ke cek panjang string
  }

  if (trimmed.length < 32) {
    throw new Error('TENANT_CREDENTIAL_ENCRYPTION_KEY minimal harus 32 karakter atau 64 karakter hex.');
  }

  return crypto.createHash('sha256').update('sadewa-vault-kdf:').update(trimmed, 'utf8').digest();
}

export function getVaultMasterKey(keyVersion: number = 1, keyMaterialOverride?: string | Buffer): Buffer {
  if (keyMaterialOverride !== undefined) {
    return deriveAes256Key(keyMaterialOverride);
  }

  const versionedEnvName = `TENANT_CREDENTIAL_ENCRYPTION_KEY_V${keyVersion}`;
  const envVal =
    process.env[versionedEnvName]?.trim() ||
    (keyVersion === 1 ? process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY?.trim() : process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY?.trim());

  if (envVal) {
    return deriveAes256Key(envVal);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `FATAL SECURITY ERROR: "${versionedEnvName}" atau "TENANT_CREDENTIAL_ENCRYPTION_KEY" wajib dikonfigurasi di mode production.`
    );
  }

  if (!devFallbackVaultKey) {
    devFallbackVaultKey = crypto.randomBytes(AES_KEY_BYTES);
    if (!hasWarnedDevVaultKey) {
      hasWarnedDevVaultKey = true;
      console.warn(
        '⚠️ TENANT_CREDENTIAL_ENCRYPTION_KEY belum diatur di environment. Menggunakan ephemeral key dev lokal (bukan production).'
      );
    }
  }

  return devFallbackVaultKey;
}

function buildTenantAad(tenantId: string, keyVersion: number): Buffer {
  const cleanTenant = tenantId.trim();
  if (!cleanTenant) {
    throw new Error('tenantId wajib disediakan untuk mengikat AAD kredensial tenant.');
  }
  return Buffer.from(`sadewa-tenant:${cleanTenant}:v${keyVersion}`, 'utf8');
}

export function isEncryptedEnvelope(value: unknown): value is string {
  return typeof value === 'string' && /^enc:v\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(value.trim());
}

export function parseEnvelopeMetadata(envelope: string): { keyVersion: number } | null {
  if (!isEncryptedEnvelope(envelope)) return null;
  const parts = envelope.trim().split(':');
  const versionNum = Number.parseInt(parts[1].slice(1), 10);
  if (!Number.isFinite(versionNum) || versionNum < 1) return null;
  return { keyVersion: versionNum };
}

export function encryptTenantSecret(plaintext: string, options: EncryptSecretOptions): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext kredensial tidak boleh kosong.');
  }

  const keyVersion = options.keyVersion ?? 1;
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error('keyVersion harus bilangan bulat >= 1.');
  }

  const masterKey = getVaultMasterKey(keyVersion, options.keyMaterial);
  const iv = crypto.randomBytes(IV_BYTES);
  const aad = buildTenantAad(options.tenantId, keyVersion);

  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv, {
    authTagLength: AUTH_TAG_BYTES
  });
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENVELOPE_PREFIX}${keyVersion}:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptTenantSecret(envelope: string, options: DecryptSecretOptions): string {
  if (!isEncryptedEnvelope(envelope)) {
    throw new Error('Format envelope kredensial tenant terenkripsi tidak valid.');
  }

  const parts = envelope.trim().split(':');
  if (parts.length !== 5) {
    throw new Error('Struktur envelope kredensial tenant rusak.');
  }

  const keyVersion = Number.parseInt(parts[1].slice(1), 10);
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error('Versi kunci pada envelope tidak valid.');
  }

  const iv = Buffer.from(parts[2], 'base64');
  const authTag = Buffer.from(parts[3], 'base64');
  const ciphertext = Buffer.from(parts[4], 'base64');

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Panjang IV atau Authentication Tag tidak valid.');
  }

  const masterKey = getVaultMasterKey(keyVersion, options.keyMaterial);
  const aad = buildTenantAad(options.tenantId, keyVersion);

  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv, {
    authTagLength: AUTH_TAG_BYTES
  });
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function rotateTenantSecret(envelope: string, options: RotateSecretOptions): string {
  const plaintext = decryptTenantSecret(envelope, {
    tenantId: options.tenantId,
    keyMaterial: options.oldKeyMaterial
  });
  return encryptTenantSecret(plaintext, {
    tenantId: options.tenantId,
    keyVersion: options.newKeyVersion,
    keyMaterial: options.newKeyMaterial
  });
}
