export interface PlatformUserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'platform_super_admin' | 'platform_ops';
  lastLogin: string | null;
}

export interface PlatformDomainRecord {
  id: string;
  tenantId: string;
  domain: string;
  isCustom: boolean;
  isPrimary: boolean;
  verificationStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'FAILED';
  verificationToken: string | null;
  sslStatus: string;
  verifiedAt: string | null;
  createdAt: string;
}

export interface PlatformMaskedDbConfig {
  configured: boolean;
  maskedTarget: string | null;
  host: string | null;
  port: string | null;
  database: string | null;
  isPooler: boolean;
  sslMode: string | null;
  hasDirectUrl: boolean;
  hasSupabaseStorage: boolean;
  storageBucket: string | null;
  keyVersion: number;
  credentialVersion: number;
  lastProbeAt: string | null;
  lastProbeStatus: string | null;
  rotatedAt: string | null;
  decryptionError?: boolean;
}

export interface PlatformTenantRecord {
  id: string;
  slug: string;
  name: string;
  letterCodePrefix: string;
  tenancyMode: 'SHARED' | 'DEDICATED';
  status: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  primaryDomain: string | null;
  createdAt: string;
  updatedAt: string;
  domains: PlatformDomainRecord[];
  dbConfig: PlatformMaskedDbConfig | null;
}

export interface PlatformOverviewStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  sharedModeCount: number;
  dedicatedModeCount: number;
  totalDomains: number;
  verifiedCustomDomains: number;
  poolStats: {
    dedicatedActiveCount: number;
    maxDedicatedClients: number;
    sharedWrappersCount: number;
    activeTenantIds: string[];
  };
  config: {
    platformDomain: string;
    cnameTarget: string;
    multiTenantRouting: boolean;
    requiresBootstrapPasscode: boolean;
  };
}

export interface PlatformAuditLogItem {
  id: string;
  platformUserId: string;
  platformUserName: string;
  platformUserRole: string;
  targetTenantId: string | null;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  level: string;
  timestamp: string;
}

export interface PlatformApiResult<T = any> {
  success: boolean;
  error?: string;
  code?: string;
  data?: T;
}

// Token pengelola platform disimpan EKSKLUSIF di memori JS/React (tidak di localStorage/sessionStorage)
// sehingga terisolasi total dari sesi portal desa.
let platformAccessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setPlatformAccessToken(token: string | null): void {
  platformAccessToken = token;
}

export function getPlatformAccessToken(): string | null {
  return platformAccessToken;
}

export function clearPlatformAccessToken(): void {
  platformAccessToken = null;
}

export function onPlatformUnauthorized(cb: (() => void) | null): void {
  unauthorizedHandler = cb;
}

async function platformRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T & { success: boolean; error?: string; message?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {})
  };
  if (platformAccessToken) {
    headers['Authorization'] = `Bearer ${platformAccessToken}`;
  }

  const res = await fetch(`/api/platform${path}`, {
    ...options,
    headers
  });

  if (res.status === 401 && platformAccessToken && !path.startsWith('/auth/login')) {
    clearPlatformAccessToken();
    unauthorizedHandler?.();
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      success: false,
      error: `Server mengembalikan respons non-JSON (HTTP ${res.status}).`
    } as any;
  }

  return res.json();
}

export function fetchPlatformBootstrapStatus() {
  return platformRequest<{
    needsBootstrap: boolean;
    databaseOffline?: boolean;
    databaseError?: string | null;
    requiresPasscode: boolean;
    platformDomain: string;
    cnameTarget: string;
    multiTenantRouting: boolean;
  }>('/auth/bootstrap-status');
}

export async function claimPlatformBootstrapAdmin(payload: {
  name: string;
  username: string;
  email: string;
  password: string;
  bootstrapPasscode?: string;
}) {
  const res = await platformRequest<{ token?: string; user?: PlatformUserProfile }>('/auth/claim-bootstrap', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (res.success && res.token) {
    setPlatformAccessToken(res.token);
  }
  return res;
}

export async function loginPlatformAdmin(username: string, password: string) {
  const res = await platformRequest<{ token?: string; user?: PlatformUserProfile }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (res.success && res.token) {
    setPlatformAccessToken(res.token);
  }
  return res;
}

export async function logoutPlatformAdmin() {
  try {
    await platformRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearPlatformAccessToken();
  }
}

export function fetchPlatformOverview() {
  return platformRequest<{ stats: PlatformOverviewStats; recentLogs: PlatformAuditLogItem[] }>('/overview');
}

export function fetchPlatformTenants(filters: { search?: string; tenancyMode?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.tenancyMode && filters.tenancyMode !== 'ALL') params.set('tenancyMode', filters.tenancyMode);
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  const qs = params.toString();
  return platformRequest<{ tenants: PlatformTenantRecord[] }>(`/tenants${qs ? `?${qs}` : ''}`);
}

export function createPlatformTenant(payload: {
  slug: string;
  name: string;
  letterCodePrefix?: string;
  tenancyMode: 'SHARED' | 'DEDICATED';
  customDomain?: string;
  databaseUrl?: string;
  directUrl?: string;
  storageBucket?: string;
  district?: string;
  regency?: string;
  province?: string;
  initialAdmin?: {
    name: string;
    username: string;
    email: string;
    password: string;
  };
}) {
  return platformRequest<{ tenant: PlatformTenantRecord; seedingNotice?: string | null }>('/tenants', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updatePlatformTenantStatus(tenantId: string, status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED') {
  return platformRequest<{ tenant: PlatformTenantRecord }>(`/tenants/${encodeURIComponent(tenantId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export function addPlatformCustomDomain(tenantId: string, domain: string, isPrimary: boolean) {
  return platformRequest<{
    domain: PlatformDomainRecord;
    dnsInstructions: {
      txtHost: string;
      txtValue: string;
      cnameHost: string;
      cnameTarget: string;
    };
  }>(`/tenants/${encodeURIComponent(tenantId)}/domains`, {
    method: 'POST',
    body: JSON.stringify({ domain, isPrimary })
  });
}

export function verifyPlatformDomainDns(tenantId: string, domainId: string) {
  return platformRequest<{
    verified: boolean;
    txtVerified: boolean;
    cnameVerified: boolean;
    expectedTxtHost: string;
    expectedTxtValue: string;
    expectedCnameTarget: string;
    observedCnames: string[];
    domain: PlatformDomainRecord;
  }>(`/tenants/${encodeURIComponent(tenantId)}/domains/${encodeURIComponent(domainId)}/verify`, {
    method: 'POST'
  });
}

export function deletePlatformCustomDomain(tenantId: string, domainId: string) {
  return platformRequest<{ deletedDomain: string }>(
    `/tenants/${encodeURIComponent(tenantId)}/domains/${encodeURIComponent(domainId)}`,
    { method: 'DELETE' }
  );
}

export function testPlatformDedicatedDb(tenantId: string, databaseUrl: string) {
  return platformRequest<{
    reachable: boolean;
    maskedTarget: string;
    host: string;
    port: string;
    isPooler: boolean;
    errorCode: string | null;
    errorSummary: string | null;
  }>(`/tenants/${encodeURIComponent(tenantId)}/database/test`, {
    method: 'POST',
    body: JSON.stringify({ databaseUrl })
  });
}

export function savePlatformDedicatedDb(
  tenantId: string,
  payload: {
    databaseUrl: string;
    directUrl?: string;
    supabaseUrl?: string;
    serviceRoleKey?: string;
    storageBucket?: string;
  }
) {
  return platformRequest<{ tenant: PlatformTenantRecord }>(`/tenants/${encodeURIComponent(tenantId)}/database`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function rotatePlatformDedicatedDb(
  tenantId: string,
  payload: { newDatabaseUrl?: string; newDirectUrl?: string }
) {
  return platformRequest<{ tenant: PlatformTenantRecord }>(`/tenants/${encodeURIComponent(tenantId)}/database/rotate`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function revokePlatformDedicatedDb(tenantId: string, suspendTenant: boolean = false) {
  return platformRequest<{ tenant: PlatformTenantRecord }>(`/tenants/${encodeURIComponent(tenantId)}/database/revoke`, {
    method: 'POST',
    body: JSON.stringify({ suspendTenant })
  });
}

export function fetchPlatformAuditLogs(targetTenantId?: string, limit: number = 80) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (targetTenantId) params.set('tenantId', targetTenantId);
  return platformRequest<{ logs: PlatformAuditLogItem[] }>(`/audit-logs?${params.toString()}`);
}

export function triggerPlatformTenantBackup(tenantId: string) {
  return platformRequest<{
    backup: {
      fileName: string;
      sizeBytes: number;
      createdAt: string;
      mode: string;
      tenantId: string;
    };
  }>(`/tenants/${encodeURIComponent(tenantId)}/backup`, {
    method: 'POST'
  });
}
