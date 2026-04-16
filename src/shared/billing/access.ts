import { ApiRequestError } from '@/shared/api/request';
import type {
  FeatureAccessEnvelope,
  FeatureAccessReason,
  FeatureAccessSummary,
  FeatureKey,
} from '@/shared/billing/accessTypes';

const KNOWN_FEATURES: FeatureKey[] = ['live_minutes', 'review', 'suggestion'];
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

export class FeatureAccessError extends Error {
  access: FeatureAccessSummary;

  constructor(message: string, access: FeatureAccessSummary) {
    super(message);
    this.name = 'FeatureAccessError';
    this.access = access;
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

  return new FeatureAccessError(error.message, access);
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
