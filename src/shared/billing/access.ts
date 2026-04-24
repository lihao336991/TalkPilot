import { ApiRequestError } from '@/shared/api/request';
import type {
  FeatureAccessCode,
  FeatureAccessEnvelope,
  FeatureAccessRpcRow,
  FeatureAccessReason,
  FeatureAccessSummary,
  FeatureKey,
} from '@/shared/billing/accessTypes';

const KNOWN_FEATURES: FeatureKey[] = ['live_minutes', 'review', 'suggestion'];
const KNOWN_CODES: FeatureAccessCode[] = [
  'feature_access_denied',
  'auth_required',
  'unknown',
];
const KNOWN_REASONS: FeatureAccessReason[] = [
  'ok',
  'limit_reached',
  'pro_required',
  'auth_required',
  'unknown',
];

function normalizeFeature(feature: string | undefined, fallback: FeatureKey): FeatureKey {
  return KNOWN_FEATURES.includes(feature as FeatureKey)
    ? (feature as FeatureKey)
    : fallback;
}

function normalizeReason(reason: string | undefined): FeatureAccessReason {
  return KNOWN_REASONS.includes(reason as FeatureAccessReason)
    ? (reason as FeatureAccessReason)
    : 'unknown';
}

function normalizeCode(code: string | undefined): FeatureAccessCode {
  return KNOWN_CODES.includes(code as FeatureAccessCode)
    ? (code as FeatureAccessCode)
    : 'unknown';
}

export function normalizeFeatureAccess(
  envelope: FeatureAccessEnvelope | null | undefined,
  fallbackFeature: FeatureKey,
): FeatureAccessSummary | null {
  if (!envelope?.access) {
    return null;
  }

  const access = envelope.access;

  return {
    feature: normalizeFeature(access.feature, fallbackFeature),
    allowed: Boolean(access.allowed),
    reason: normalizeReason(access.reason),
    tier:
      access.tier === 'free' || access.tier === 'pro' || access.tier === 'unlimited'
        ? access.tier
        : 'unknown',
    used: typeof access.used === 'number' ? access.used : null,
    remaining: typeof access.remaining === 'number' ? access.remaining : null,
    limit: typeof access.limit === 'number' ? access.limit : null,
    resetAt: typeof access.resetAt === 'string' ? access.resetAt : null,
  };
}

export function mapFeatureAccessRpcRow(
  row: FeatureAccessRpcRow | null | undefined,
  fallbackFeature: FeatureKey,
): FeatureAccessSummary | null {
  if (!row) {
    return null;
  }

  return {
    feature: normalizeFeature(row.feature_key ?? undefined, fallbackFeature),
    allowed: Boolean(row.allowed),
    reason: normalizeReason(row.reason ?? undefined),
    tier:
      row.tier === 'free' || row.tier === 'pro' || row.tier === 'unlimited'
        ? row.tier
        : 'unknown',
    used: typeof row.used_count === 'number' ? row.used_count : null,
    remaining:
      typeof row.remaining_count === 'number' ? row.remaining_count : null,
    limit: typeof row.limit_count === 'number' ? row.limit_count : null,
    resetAt: typeof row.reset_at === 'string' ? row.reset_at : null,
  };
}

export class FeatureAccessError extends Error {
  access: FeatureAccessSummary;
  code: FeatureAccessCode;

  constructor(message: string, access: FeatureAccessSummary, code: FeatureAccessCode) {
    super(message);
    this.name = 'FeatureAccessError';
    this.access = access;
    this.code = code;
  }
}

export function toFeatureAccessError(
  error: unknown,
  fallbackFeature: FeatureKey,
): FeatureAccessError | null {
  if (!(error instanceof ApiRequestError)) {
    return null;
  }

  const access = normalizeFeatureAccess(
    error.body as FeatureAccessEnvelope | null | undefined,
    fallbackFeature,
  );

  if (!access) {
    return null;
  }

  const body =
    error.body && typeof error.body === 'object'
      ? (error.body as Record<string, unknown>)
      : null;

  return new FeatureAccessError(
    error.message,
    access,
    normalizeCode(typeof body?.code === 'string' ? body.code : undefined),
  );
}

export function isFeatureAccessError(error: unknown): error is FeatureAccessError {
  return error instanceof FeatureAccessError;
}

export function shouldRedirectToPaywall(access: FeatureAccessSummary) {
  return access.reason === 'limit_reached' || access.reason === 'pro_required';
}

export function shouldRedirectToLogin(access: FeatureAccessSummary) {
  return access.reason === 'auth_required';
}
