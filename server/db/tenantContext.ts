import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * ============================================================================
 * SADEWA TENANT EXECUTION CONTEXT (AsyncLocalStorage)
 * ============================================================================
 * Menyimpan identitas tenant aktif & active PrismaClient di sepanjang siklus
 * hidup request server tanpa membocorkannya ke variabel global.
 * ============================================================================
 */

export type TenancyModeType = 'SHARED' | 'DEDICATED';

export interface TenantContext {
  tenantId: string | null;
  slug: string | null;
  tenantName?: string | null;
  letterCodePrefix?: string | null;
  tenancyMode: TenancyModeType;
  isPlatformScope: boolean;
  credentialVersion: number;
  requestId?: string;
  /** Resolved PrismaClient (Shared $extends atau Dedicated LRU) untuk request ini */
  activeClient?: unknown;
}

export class TenantScopeViolationError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'TENANT_SCOPE_REQUIRED';

  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeViolationError';
  }
}

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function isMultiTenantRoutingEnabled(): boolean {
  return String(process.env.MULTI_TENANT_ROUTING || 'false').trim().toLowerCase() === 'true';
}

export function isPreviewOrLocalHost(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase();
  return (
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean.endsWith('.run.app') ||
    clean.endsWith('.vercel.app') ||
    clean.endsWith('.local')
  );
}

export function runWithTenantContext<T>(context: TenantContext, callback: () => T): T {
  return tenantContextStorage.run(context, callback);
}

export function getCurrentTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function requireActiveTenantId(operationName: string = 'operasi tenant'): string {
  const ctx = getCurrentTenantContext();
  if (!ctx?.tenantId) {
    throw new TenantScopeViolationError(
      `Operasi "${operationName}" ditolak: konteks villageId/tenant aktif tidak ditemukan.`
    );
  }
  return ctx.tenantId;
}

export function assertSafeUnscopedMutation(operationName: string): {
  tenantId: string | null;
  scoped: boolean;
} {
  const ctx = getCurrentTenantContext();
  if (ctx?.tenantId) {
    return { tenantId: ctx.tenantId, scoped: true };
  }

  if (isMultiTenantRoutingEnabled() || ctx?.isPlatformScope) {
    throw new TenantScopeViolationError(
      `DIBLOKIR OLEH SAFEGUARD MULTI-TENANT: "${operationName}" tidak boleh dijalankan secara global tanpa cakupan tenant/villageId aktif.`
    );
  }

  return { tenantId: null, scoped: false };
}

export function getScopedDeleteWhere<T extends Record<string, unknown>>(
  baseWhere?: T,
  operationName: string = 'deleteMany'
): Record<string, unknown> {
  const { tenantId } = assertSafeUnscopedMutation(operationName);
  if (tenantId) {
    return {
      ...(baseWhere || {}),
      villageId: tenantId
    };
  }
  return {
    ...(baseWhere || {})
  };
}
