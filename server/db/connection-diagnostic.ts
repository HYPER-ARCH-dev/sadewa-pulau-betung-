import dns from 'dns/promises';
import { PrismaClient } from '@prisma/client';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticIssue {
  code: string;
  severity: DiagnosticSeverity;
  target: 'DATABASE_URL' | 'DIRECT_URL' | 'SUPABASE_URL' | 'CROSS_CHECK';
  message: string;
}

export interface ConnectionUrlInspection {
  present: boolean;
  validUrl: boolean;
  protocol: string | null;
  hostLabel: string | null;
  port: string | null;
  databaseName: string | null;
  isPoolerHost: boolean;
  poolerRegion: string | null;
  projectRefMasked: string | null;
  projectRefLength: number;
  matchesExpectedRef: boolean | null;
  hasPgbouncerParam: boolean;
  schemaParam: string | null;
  hasSadewaSchema: boolean;
  dnsStatus: 'OK' | 'ENOTFOUND' | 'SKIPPED' | 'ERROR';
  liveConnection: 'CONNECTED' | 'FAILED' | 'SKIPPED';
  sadewaSchemaExists: boolean | null;
  sanitizedError: string | null;
}

export interface DatabaseDiagnosticReport {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'MISMATCH_DETECTED' | 'UNREACHABLE' | 'UNCONFIGURED';
  referenceSource: 'ARGUMENT' | 'SUPABASE_PROJECT_ID' | 'EXPECTED_SUPABASE_PROJECT_REF' | 'SUPABASE_URL' | 'NONE';
  expectedProjectRefMasked: string | null;
  supabaseUrlPresent: boolean;
  supabaseUrlProjectRefMasked: string | null;
  supabaseUrlDnsStatus: 'OK' | 'ENOTFOUND' | 'SKIPPED' | 'ERROR';
  databaseUrl: ConnectionUrlInspection;
  directUrl: ConnectionUrlInspection;
  databaseMatchesDirectRef: boolean | null;
  issues: DiagnosticIssue[];
}

export interface VerifyDatabaseDiagnosticOptions {
  /** Optional expected Supabase project ID (full 20-char ref or prefix ending with '...') */
  expectedProjectRef?: string;
  /** Suppress formatted console output when true (default: false) */
  silent?: boolean;
  /** Run live DNS & Prisma SELECT 1 checks (default: true) */
  checkLiveConnection?: boolean;
}

/**
 * Masks a Supabase Project Reference ID so logs remain identifiable without leaking full IDs.
 */
export function maskProjectRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('...')) return trimmed;
  if (trimmed.length <= 8) return `${trimmed.slice(0, 3)}***`;
  return `${trimmed.slice(0, 7)}***${trimmed.slice(-4)} (${trimmed.length} chars)`;
}

/**
 * Extracts Supabase Project Reference from HTTP SUPABASE_URL, PgBouncer DATABASE_URL, or Direct DIRECT_URL.
 */
export function extractSupabaseProjectRef(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    const hostname = (parsed.hostname || '').toLowerCase();

    // Case 1: PostgreSQL Pooler username format -> postgres.<project_ref>
    const username = decodeURIComponent(parsed.username || '');
    const dotIndex = username.indexOf('.');
    if (dotIndex > 0 && dotIndex < username.length - 1) {
      return username.slice(dotIndex + 1);
    }

    // Case 2: Direct PostgreSQL host -> db.<project_ref>.supabase.co
    if (hostname.startsWith('db.') && hostname.endsWith('.supabase.co')) {
      const parts = hostname.split('.');
      if (parts.length >= 4 && parts[1]) {
        return parts[1];
      }
    }

    // Case 3: Supabase HTTP URL -> https://<project_ref>.supabase.co
    if (hostname.endsWith('.supabase.co')) {
      const parts = hostname.split('.');
      if (parts.length >= 3 && parts[0] && parts[0] !== 'db') {
        return parts[0];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Strips any credentials, raw connection strings, or tenant usernames from error strings.
 */
export function sanitizeDiagnosticMessage(rawMessage: string, sensitiveTokens: Array<string | null | undefined> = []): string {
  let clean = String(rawMessage || 'Unknown database error')
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[REDACTED_POSTGRES_URL]')
    .replace(/https?:\/\/[a-z0-9-]+\.supabase\.co[^\s'"]*/gi, '[REDACTED_SUPABASE_URL]')
    .replace(/\bdb\.[a-z0-9-]+\.supabase\.co\b/gi, 'db.[REDACTED_REF].supabase.co')
    .replace(/\/\/[^@\s]+@/g, '//[REDACTED]@')
    .replace(/tenant\/user\s+[^\s]+/gi, 'tenant/user [REDACTED]')
    .replace(/password\s*(?:=|:)\s*[^\s,;]+/gi, 'password=[REDACTED]');

  for (const token of sensitiveTokens) {
    if (token && token.length >= 6) {
      clean = clean.split(token).join('[REDACTED]');
    }
  }

  return clean
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-2)
    .join(' ')
    .slice(0, 260);
}

function matchProjectRefs(actualRef: string | null, expectedRefOrPrefix: string | null): boolean | null {
  if (!actualRef || !expectedRefOrPrefix) return null;
  const normalizedActual = actualRef.trim().toLowerCase();
  const normalizedExpected = expectedRefOrPrefix.trim().toLowerCase();
  if (normalizedExpected.endsWith('...')) {
    const prefix = normalizedExpected.slice(0, -3);
    return prefix.length > 0 ? normalizedActual.startsWith(prefix) : null;
  }
  return normalizedActual === normalizedExpected;
}

function redactHostForDisplay(hostname: string, ref: string | null): string {
  if (!hostname) return 'unknown';
  if (ref && hostname.toLowerCase().includes(ref.toLowerCase())) {
    const masked = maskProjectRef(ref) || '[REDACTED_REF]';
    return hostname.replace(new RegExp(ref, 'ig'), masked.split(' ')[0]);
  }
  return hostname;
}

async function checkDnsReachability(hostname: string | null): Promise<'OK' | 'ENOTFOUND' | 'SKIPPED' | 'ERROR'> {
  if (!hostname) return 'SKIPPED';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return 'OK';
  try {
    await dns.resolve(hostname, 'A');
    return 'OK';
  } catch (errA: any) {
    if (errA?.code === 'ENODATA' || errA?.code === 'ENOTFOUND') {
      try {
        await dns.resolve(hostname, 'AAAA');
        return 'OK';
      } catch (errAAAA: any) {
        return errAAAA?.code === 'ENOTFOUND' || errA?.code === 'ENOTFOUND' ? 'ENOTFOUND' : 'ERROR';
      }
    }
    return errA?.code === 'ENOTFOUND' ? 'ENOTFOUND' : 'ERROR';
  }
}

async function testPrismaConnection(
  connectionUrl: string,
  sensitiveTokens: Array<string | null | undefined>
): Promise<{ connected: boolean; sadewaSchemaExists: boolean | null; error: string | null }> {
  const client = new (PrismaClient as unknown as new (opts: Record<string, unknown>) => PrismaClient)({
    datasources: { db: { url: connectionUrl } },
    log: [{ emit: 'event', level: 'error' }]
  });
  (client as any).$on?.('error', () => {
    // Handled via try/catch and sanitized in return payload
  });

  try {
    await client.$queryRawUnsafe('SELECT 1');
    let sadewaSchemaExists: boolean | null = null;
    try {
      const rows = (await client.$queryRawUnsafe(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'sadewa'`
      )) as Array<{ schema_name: string }>;
      sadewaSchemaExists = Array.isArray(rows) && rows.length > 0;
    } catch {
      sadewaSchemaExists = null;
    }
    return { connected: true, sadewaSchemaExists, error: null };
  } catch (err: any) {
    return {
      connected: false,
      sadewaSchemaExists: null,
      error: sanitizeDiagnosticMessage(err?.message || String(err), sensitiveTokens)
    };
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

async function inspectSingleConnectionEnv(
  target: 'DATABASE_URL' | 'DIRECT_URL',
  rawUrl: string | undefined,
  expectedRef: string | null,
  checkLive: boolean,
  sensitiveTokens: Array<string | null | undefined>,
  issues: DiagnosticIssue[]
): Promise<{ inspection: ConnectionUrlInspection; rawRef: string | null }> {
  if (!rawUrl || !rawUrl.trim()) {
    issues.push({
      code: `${target}_MISSING`,
      severity: 'error',
      target,
      message: `${target} is not set in process.env.`
    });
    return {
      rawRef: null,
      inspection: {
        present: false,
        validUrl: false,
        protocol: null,
        hostLabel: null,
        port: null,
        databaseName: null,
        isPoolerHost: false,
        poolerRegion: null,
        projectRefMasked: null,
        projectRefLength: 0,
        matchesExpectedRef: null,
        hasPgbouncerParam: false,
        schemaParam: null,
        hasSadewaSchema: false,
        dnsStatus: 'SKIPPED',
        liveConnection: 'SKIPPED',
        sadewaSchemaExists: null,
        sanitizedError: `${target} is not defined.`
      }
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    issues.push({
      code: `${target}_INVALID_URI`,
      severity: 'error',
      target,
      message: `${target} is present but could not be parsed as a valid PostgreSQL connection URI.`
    });
    return {
      rawRef: null,
      inspection: {
        present: true,
        validUrl: false,
        protocol: null,
        hostLabel: null,
        port: null,
        databaseName: null,
        isPoolerHost: false,
        poolerRegion: null,
        projectRefMasked: null,
        projectRefLength: 0,
        matchesExpectedRef: null,
        hasPgbouncerParam: false,
        schemaParam: null,
        hasSadewaSchema: false,
        dnsStatus: 'SKIPPED',
        liveConnection: 'SKIPPED',
        sadewaSchemaExists: null,
        sanitizedError: 'Invalid connection string URI syntax.'
      }
    };
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  const port = parsed.port || (parsed.protocol.startsWith('postgres') ? '5432' : null);
  const rawRef = extractSupabaseProjectRef(rawUrl);
  const isPoolerHost = hostname.includes('.pooler.supabase.com');
  const poolerRegionMatch = hostname.match(/^aws-\d+-([a-z0-9-]+)\.pooler\.supabase\.com$/);
  const poolerRegion = poolerRegionMatch ? poolerRegionMatch[1] : null;
  const hasPgbouncerParam = parsed.searchParams.get('pgbouncer') === 'true';
  const schemaParam = parsed.searchParams.get('schema');
  const hasSadewaSchema = schemaParam === 'sadewa';
  const matchesExpectedRef = matchProjectRefs(rawRef, expectedRef);

  const tokensWithRef = [
    ...sensitiveTokens,
    parsed.password ? decodeURIComponent(parsed.password) : null,
    parsed.username ? decodeURIComponent(parsed.username) : null
  ];

  if (expectedRef && matchesExpectedRef === false) {
    issues.push({
      code: 'PROJECT_REF_MISMATCH',
      severity: 'error',
      target,
      message: `${target} points to Supabase project ${maskProjectRef(rawRef) || '[unknown]'}, which does NOT match expected reference ${maskProjectRef(expectedRef)}.`
    });
  } else if (expectedRef && !rawRef) {
    issues.push({
      code: 'PROJECT_REF_UNIDENTIFIABLE',
      severity: 'warning',
      target,
      message: `Could not extract a Supabase Project ID from ${target} host/username.`
    });
  }

  if (target === 'DATABASE_URL' && (port === '6543' || isPoolerHost) && !hasPgbouncerParam) {
    issues.push({
      code: 'MISSING_PGBOUNCER_PARAM',
      severity: 'warning',
      target,
      message: `${target} uses Supabase Pooler (port ${port || '6543'}) without "?pgbouncer=true".`
    });
  }

  if (!hasSadewaSchema) {
    issues.push({
      code: 'MISSING_SCHEMA_SADEWA',
      severity: 'warning',
      target,
      message: `${target} does not specify "?schema=sadewa" (current schema param: ${schemaParam || 'none/default public'}).`
    });
  }

  let dnsStatus: ConnectionUrlInspection['dnsStatus'] = 'SKIPPED';
  let liveConnection: ConnectionUrlInspection['liveConnection'] = 'SKIPPED';
  let sadewaSchemaExists: boolean | null = null;
  let sanitizedError: string | null = null;

  if (checkLive) {
    dnsStatus = await checkDnsReachability(hostname);
    if (dnsStatus === 'ENOTFOUND') {
      liveConnection = 'FAILED';
      sanitizedError = `DNS resolution failed (ENOTFOUND) for host ${redactHostForDisplay(hostname, rawRef)}.`;
      issues.push({
        code: 'DNS_ENOTFOUND',
        severity: 'error',
        target,
        message: `${target} host ${redactHostForDisplay(hostname, rawRef)} does not exist in DNS (project deleted or invalid ID).`
      });
    } else {
      const probe = await testPrismaConnection(rawUrl.trim(), tokensWithRef);
      if (probe.connected) {
        liveConnection = 'CONNECTED';
        sadewaSchemaExists = probe.sadewaSchemaExists;
        if (probe.sadewaSchemaExists === false) {
          issues.push({
            code: 'SCHEMA_SADEWA_NOT_FOUND_IN_DB',
            severity: 'error',
            target,
            message: `Connected to PostgreSQL via ${target}, but PostgreSQL schema "sadewa" does not exist yet.`
          });
        }
      } else {
        liveConnection = 'FAILED';
        sanitizedError = probe.error;
        const lowerErr = (probe.error || '').toLowerCase();
        const issueCode = lowerErr.includes('tenant/user')
          ? 'POOLER_TENANT_NOT_FOUND'
          : lowerErr.includes('authentication failed')
          ? 'AUTH_FAILED'
          : 'CONNECTION_FAILED';

        issues.push({
          code: issueCode,
          severity: 'error',
          target,
          message: `${target} live connection failed: ${probe.error || 'Unknown error'}`
        });
      }
    }
  }

  return {
    rawRef,
    inspection: {
      present: true,
      validUrl: true,
      protocol: parsed.protocol,
      hostLabel: redactHostForDisplay(hostname, rawRef),
      port,
      databaseName: parsed.pathname || null,
      isPoolerHost,
      poolerRegion,
      projectRefMasked: maskProjectRef(rawRef),
      projectRefLength: rawRef ? rawRef.length : 0,
      matchesExpectedRef,
      hasPgbouncerParam,
      schemaParam,
      hasSadewaSchema,
      dnsStatus,
      liveConnection,
      sadewaSchemaExists,
      sanitizedError
    }
  };
}

/**
 * Verifies DATABASE_URL and DIRECT_URL against the reference Supabase Project ID in process.env
 * (and optional expectedProjectRef override), runs safe live connection checks, and prints a
 * sanitized console diagnostic report without exposing sensitive credentials.
 */
export async function verifyDatabaseConnectionDiagnostic(
  options: VerifyDatabaseDiagnosticOptions = {}
): Promise<DatabaseDiagnosticReport> {
  const checkLive = options.checkLiveConnection !== false;
  const issues: DiagnosticIssue[] = [];

  const supaUrl = process.env.SUPABASE_URL?.trim();
  const supaUrlRef = extractSupabaseProjectRef(supaUrl);
  const envProjectId = process.env.SUPABASE_PROJECT_ID?.trim();
  const envExpectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF?.trim();

  let referenceSource: DatabaseDiagnosticReport['referenceSource'] = 'NONE';
  let expectedRef: string | null = null;

  if (options.expectedProjectRef?.trim()) {
    referenceSource = 'ARGUMENT';
    expectedRef = options.expectedProjectRef.trim();
  } else if (envProjectId) {
    referenceSource = 'SUPABASE_PROJECT_ID';
    expectedRef = envProjectId;
  } else if (envExpectedRef) {
    referenceSource = 'EXPECTED_SUPABASE_PROJECT_REF';
    expectedRef = envExpectedRef;
  } else if (supaUrlRef) {
    referenceSource = 'SUPABASE_URL';
    expectedRef = supaUrlRef;
  }

  if (!supaUrl) {
    issues.push({
      code: 'SUPABASE_URL_MISSING',
      severity: 'warning',
      target: 'SUPABASE_URL',
      message: 'SUPABASE_URL is not set in process.env.'
    });
  } else if (expectedRef && supaUrlRef && matchProjectRefs(supaUrlRef, expectedRef) === false) {
    issues.push({
      code: 'SUPABASE_URL_REF_MISMATCH',
      severity: 'error',
      target: 'SUPABASE_URL',
      message: `SUPABASE_URL project (${maskProjectRef(supaUrlRef)}) does NOT match expected project (${maskProjectRef(expectedRef)}).`
    });
  }

  let supabaseUrlDnsStatus: DatabaseDiagnosticReport['supabaseUrlDnsStatus'] = 'SKIPPED';
  if (checkLive && supaUrl) {
    try {
      const supaHost = new URL(supaUrl).hostname;
      supabaseUrlDnsStatus = await checkDnsReachability(supaHost);
      if (supabaseUrlDnsStatus === 'ENOTFOUND') {
        issues.push({
          code: 'SUPABASE_URL_DNS_ENOTFOUND',
          severity: 'error',
          target: 'SUPABASE_URL',
          message: `SUPABASE_URL host (${redactHostForDisplay(supaHost, supaUrlRef)}) returned DNS ENOTFOUND.`
        });
      }
    } catch {
      supabaseUrlDnsStatus = 'ERROR';
    }
  }

  const sensitiveTokens = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.SESSION_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_JWKS_URL
  ];

  const [dbResult, directResult] = await Promise.all([
    inspectSingleConnectionEnv('DATABASE_URL', process.env.DATABASE_URL, expectedRef, checkLive, sensitiveTokens, issues),
    inspectSingleConnectionEnv('DIRECT_URL', process.env.DIRECT_URL, expectedRef, checkLive, sensitiveTokens, issues)
  ]);

  const databaseMatchesDirectRef =
    dbResult.rawRef && directResult.rawRef
      ? dbResult.rawRef.toLowerCase() === directResult.rawRef.toLowerCase()
      : null;

  if (databaseMatchesDirectRef === false) {
    issues.push({
      code: 'DATABASE_DIRECT_MISMATCH',
      severity: 'error',
      target: 'CROSS_CHECK',
      message: `DATABASE_URL (${maskProjectRef(dbResult.rawRef)}) and DIRECT_URL (${maskProjectRef(directResult.rawRef)}) point to DIFFERENT Supabase projects!`
    });
  }

  const hasMismatch =
    databaseMatchesDirectRef === false ||
    dbResult.inspection.matchesExpectedRef === false ||
    directResult.inspection.matchesExpectedRef === false ||
    issues.some((i) => i.code === 'SUPABASE_URL_REF_MISMATCH');

  const isUnconfigured = !dbResult.inspection.present && !directResult.inspection.present;
  const hasConnectionFailure =
    dbResult.inspection.liveConnection === 'FAILED' ||
    directResult.inspection.liveConnection === 'FAILED' ||
    supabaseUrlDnsStatus === 'ENOTFOUND';

  let overallStatus: DatabaseDiagnosticReport['overallStatus'] = 'HEALTHY';
  if (isUnconfigured) {
    overallStatus = 'UNCONFIGURED';
  } else if (hasMismatch) {
    overallStatus = 'MISMATCH_DETECTED';
  } else if (hasConnectionFailure || issues.some((i) => i.severity === 'error')) {
    overallStatus = 'UNREACHABLE';
  }

  const report: DatabaseDiagnosticReport = {
    timestamp: new Date().toISOString(),
    overallStatus,
    referenceSource,
    expectedProjectRefMasked: maskProjectRef(expectedRef),
    supabaseUrlPresent: Boolean(supaUrl),
    supabaseUrlProjectRefMasked: maskProjectRef(supaUrlRef),
    supabaseUrlDnsStatus,
    databaseUrl: dbResult.inspection,
    directUrl: directResult.inspection,
    databaseMatchesDirectRef,
    issues
  };

  if (!options.silent) {
    printDiagnosticReport(report);
  }

  return report;
}

function formatConnectionBlock(label: string, info: ConnectionUrlInspection): string[] {
  if (!info.present) {
    return [`  ${label}: ❌ NOT SET in process.env`];
  }
  if (!info.validUrl) {
    return [`  ${label}: ❌ INVALID URI SYNTAX (${info.sanitizedError || 'parse error'})`];
  }
  const matchLabel =
    info.matchesExpectedRef === true
      ? '✅ MATCHES'
      : info.matchesExpectedRef === false
      ? '❌ MISMATCH'
      : '⚠️ UNVERIFIED (no reference ID)';

  const lines = [
    `  ${label}:`,
    `    Host / Port      : ${info.hostLabel}:${info.port || '-'}`,
    `    Project Ref      : ${info.projectRefMasked || 'unknown'} (${matchLabel})`,
    `    Pooler / Schema  : pgbouncer=${info.hasPgbouncerParam ? 'true' : 'false'} | schema=${info.schemaParam || 'default (not sadewa)'}`,
    `    DNS / Live Query : DNS=${info.dnsStatus} | Prisma=${info.liveConnection}`
  ];

  if (info.sadewaSchemaExists !== null) {
    lines.push(`    Schema "sadewa"  : ${info.sadewaSchemaExists ? '✅ EXISTS' : '❌ MISSING'}`);
  }
  if (info.sanitizedError) {
    lines.push(`    Error (Sanitized): ${info.sanitizedError}`);
  }
  return lines;
}

function printDiagnosticReport(report: DatabaseDiagnosticReport): void {
  const statusBadge =
    report.overallStatus === 'HEALTHY'
      ? '✅ HEALTHY'
      : report.overallStatus === 'MISMATCH_DETECTED'
      ? '❌ MISMATCH_DETECTED'
      : report.overallStatus === 'UNCONFIGURED'
      ? '⚠️ UNCONFIGURED'
      : '❌ UNREACHABLE';

  const lines: string[] = [
    '',
    '====================================================================',
    '  SADEWA DATABASE IDENTITY & CONNECTION DIAGNOSTIC (CREDENTIAL-SAFE)',
    '====================================================================',
    `  Overall Status     : ${statusBadge}`,
    `  Reference Source   : ${report.referenceSource}`,
    `  Expected ProjectID : ${report.expectedProjectRefMasked || 'Not configured'}`,
    `  SUPABASE_URL       : ${report.supabaseUrlPresent ? `${report.supabaseUrlProjectRefMasked || 'non-standard host'} (DNS=${report.supabaseUrlDnsStatus})` : 'NOT SET'}`,
    `  DB <-> Direct Sync : ${report.databaseMatchesDirectRef === true ? '✅ SAME PROJECT' : report.databaseMatchesDirectRef === false ? '❌ DIFFERENT PROJECTS' : 'N/A'}`,
    '--------------------------------------------------------------------',
    ...formatConnectionBlock('DATABASE_URL', report.databaseUrl),
    ...formatConnectionBlock('DIRECT_URL', report.directUrl)
  ];

  if (report.issues.length > 0) {
    lines.push('--------------------------------------------------------------------');
    lines.push('  DIAGNOSTIC FINDINGS & ERRORS:');
    for (const issue of report.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} [${issue.code}] (${issue.target}) ${issue.message}`);
    }
  }

  lines.push('====================================================================');
  lines.push('');
  console.log(lines.join('\n'));
}
