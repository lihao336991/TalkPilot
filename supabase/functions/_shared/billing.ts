/// <reference path="./editor-shims.d.ts" />

export type RevenueCatWebhookEnvelope = {
  api_version?: string;
  event?: RevenueCatWebhookEvent;
};

export type RevenueCatWebhookEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string | null;
  product_id?: string | null;
  entitlement_ids?: string[] | null;
  store?: string | null;
  period_type?: string | null;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  will_renew?: boolean | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  [key: string]: unknown;
};

export type BillingState = {
  status: string;
  isActive: boolean;
};

export type RevenueCatSubscriberResponse = {
  request_date?: string;
  request_date_ms?: number;
  subscriber?: RevenueCatSubscriber;
};

export type RevenueCatSubscriber = {
  original_app_user_id?: string | null;
  management_url?: string | null;
  entitlements?: Record<string, RevenueCatSubscriberEntitlement>;
  subscriptions?: Record<string, RevenueCatSubscriberSubscription>;
  [key: string]: unknown;
};

export type RevenueCatSubscriberEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string | null;
  purchase_date?: string | null;
  [key: string]: unknown;
};

export type RevenueCatSubscriberSubscription = {
  store?: string | null;
  purchase_date?: string | null;
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  refunded_at?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  period_type?: string | null;
  [key: string]: unknown;
};

export type RevenueCatSubscriberBillingSnapshot = {
  appUserId: string;
  originalAppUserId: string | null;
  entitlementId: string;
  productId: string | null;
  platform: string | null;
  status: string;
  isActive: boolean;
  willRenew: boolean | null;
  periodType: string | null;
  expiresAt: string | null;
  gracePeriodExpiresAt: string | null;
  trialEndsAt: string | null;
  rawSubscriber: RevenueCatSubscriber;
};

export const CANONICAL_PRO_ENTITLEMENT_ID = "pro";

const ACTIVE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "SUBSCRIPTION_EXTENDED",
]);

const INACTIVE_EVENT_TYPES = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "REFUND",
]);

export function normalizeRevenueCatAppUserId(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function requireWebhookAuthorization(req: Request) {
  const configuredSecret = Deno.env.get("REVENUECAT_WEBHOOK_AUTH")?.trim();
  if (!configuredSecret) {
    throw new Error("Missing REVENUECAT_WEBHOOK_AUTH secret");
  }

  const actual = req.headers.get("Authorization")?.trim() ?? "";
  const expected = `Bearer ${configuredSecret}`;
  return actual === expected;
}

export function getRevenueCatEvent(
  payload: RevenueCatWebhookEnvelope,
): RevenueCatWebhookEvent {
  if (!payload?.event || typeof payload.event !== "object") {
    throw new Error("Missing RevenueCat event payload");
  }

  return payload.event;
}

export function getRevenueCatEventId(event: RevenueCatWebhookEvent) {
  const id = typeof event.id === "string" ? event.id.trim() : "";
  if (!id) {
    throw new Error("Missing RevenueCat event id");
  }

  return id;
}

export function getPrimaryEntitlementId(event: RevenueCatWebhookEvent) {
  const ids = Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [];
  const firstNonEmptyId = ids.find(
    (id) => typeof id === "string" && id.trim().length > 0,
  );
  return normalizeBillingEntitlementId(firstNonEmptyId);
}

export function mapEventToBillingState(
  event: RevenueCatWebhookEvent,
  entitlementId: string,
): BillingState {
  const type = typeof event.type === "string" ? event.type : "UNKNOWN";
  const isProEntitlement =
    normalizeBillingEntitlementId(entitlementId) === CANONICAL_PRO_ENTITLEMENT_ID;

  if (!isProEntitlement) {
    return { status: "inactive", isActive: false };
  }

  if (ACTIVE_EVENT_TYPES.has(type)) {
    if (event.period_type === "trial") {
      return { status: "trialing", isActive: true };
    }

    return { status: "active", isActive: true };
  }

  if (INACTIVE_EVENT_TYPES.has(type)) {
    if (type === "BILLING_ISSUE") {
      return { status: "billing_issue", isActive: false };
    }

    if (type === "CANCELLATION") {
      const expiresAt = parseRevenueCatTimestamp(event.expiration_at_ms);
      if (expiresAt && expiresAt.getTime() > Date.now()) {
        return { status: "canceled", isActive: true };
      }
      return { status: "canceled", isActive: false };
    }

    if (type === "EXPIRATION") {
      return { status: "expired", isActive: false };
    }

    return { status: "inactive", isActive: false };
  }

  if (type === "TRANSFER") {
    return {
      status:
        Array.isArray(event.entitlement_ids) &&
        event.entitlement_ids.some(
          (id) =>
            normalizeBillingEntitlementId(id) === CANONICAL_PRO_ENTITLEMENT_ID,
        )
        ? "active"
        : "transferred",
      isActive:
        Array.isArray(event.entitlement_ids) &&
        event.entitlement_ids.some(
          (id) =>
            normalizeBillingEntitlementId(id) === CANONICAL_PRO_ENTITLEMENT_ID,
        ),
    };
  }

  return { status: "inactive", isActive: false };
}

export function parseRevenueCatTimestamp(
  value: number | null | undefined,
): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value);
}

export function parseRevenueCatIsoTimestamp(
  value: string | null | undefined,
): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeBillingEntitlementId(
  entitlementId: string | null | undefined,
) {
  if (typeof entitlementId !== "string" || entitlementId.trim().length === 0) {
    return CANONICAL_PRO_ENTITLEMENT_ID;
  }

  // TalkPilot currently ships a single paid entitlement tier only.
  // Normalize any non-empty RevenueCat entitlement id back to the canonical
  // internal `pro` tier so dashboard naming does not break cache sync.
  return CANONICAL_PRO_ENTITLEMENT_ID;
}

function getPreferredEntitlementEntry(
  entitlements: Record<string, RevenueCatSubscriberEntitlement>,
) {
  const entries = Object.entries(entitlements);
  if (entries.length === 0) {
    return null;
  }

  const exactPro = entries.find(
    ([key]) => normalizeBillingEntitlementId(key) === CANONICAL_PRO_ENTITLEMENT_ID,
  );
  if (exactPro) {
    return exactPro;
  }

  const now = Date.now();
  const activeEntry = entries.find(([, entitlement]) => {
    const expiresAt = parseRevenueCatIsoTimestamp(entitlement.expires_date);
    const graceExpiresAt = parseRevenueCatIsoTimestamp(
      entitlement.grace_period_expires_date,
    );

    if (!expiresAt) {
      return true;
    }

    return (
      expiresAt.getTime() > now ||
      (graceExpiresAt ? graceExpiresAt.getTime() > now : false)
    );
  });

  return activeEntry ?? entries[0];
}

function getFallbackSubscriptionEntry(
  subscriptions: Record<string, RevenueCatSubscriberSubscription>,
) {
  const entries = Object.entries(subscriptions);
  if (entries.length === 0) {
    return null;
  }

  const now = Date.now();
  const activeEntry = entries.find(([, subscription]) => {
    if (subscription.refunded_at) {
      return false;
    }

    const expiresAt = parseRevenueCatIsoTimestamp(subscription.expires_date);
    const graceExpiresAt = parseRevenueCatIsoTimestamp(
      subscription.grace_period_expires_date,
    );

    return Boolean(
      (!expiresAt && !graceExpiresAt) ||
        (expiresAt && expiresAt.getTime() > now) ||
        (graceExpiresAt && graceExpiresAt.getTime() > now),
    );
  });

  if (activeEntry) {
    return activeEntry;
  }

  return [...entries].sort((left, right) => {
    const leftTime =
      parseRevenueCatIsoTimestamp(left[1].expires_date)?.getTime() ?? 0;
    const rightTime =
      parseRevenueCatIsoTimestamp(right[1].expires_date)?.getTime() ?? 0;
    return rightTime - leftTime;
  })[0];
}

export function getRevenueCatSubscriberSnapshot(
  appUserId: string,
  subscriber: RevenueCatSubscriber,
): RevenueCatSubscriberBillingSnapshot {
  const entitlements = subscriber.entitlements ?? {};
  const subscriptions = subscriber.subscriptions ?? {};
  const entitlementEntry = getPreferredEntitlementEntry(entitlements);
  const entitlementKey = entitlementEntry?.[0] ?? null;
  const entitlement = entitlementEntry?.[1] ?? null;
  const productIdFromEntitlement = entitlement?.product_identifier ?? null;
  const subscriptionEntry = productIdFromEntitlement
    ? [productIdFromEntitlement, subscriptions[productIdFromEntitlement]] as const
    : getFallbackSubscriptionEntry(subscriptions);
  const subscriptionProductId = subscriptionEntry?.[0] ?? null;
  const subscription = subscriptionEntry?.[1] ?? null;
  const expiresAt =
    entitlement?.expires_date ??
    subscription?.expires_date ??
    null;
  const gracePeriodExpiresAt =
    entitlement?.grace_period_expires_date ??
    subscription?.grace_period_expires_date ??
    null;
  const expiresAtDate = parseRevenueCatIsoTimestamp(expiresAt);
  const gracePeriodExpiresAtDate = parseRevenueCatIsoTimestamp(gracePeriodExpiresAt);
  const now = Date.now();
  const isActive =
    entitlement !== null
      ? !expiresAtDate ||
        expiresAtDate.getTime() > now ||
        (gracePeriodExpiresAtDate
          ? gracePeriodExpiresAtDate.getTime() > now
          : false)
      : Boolean(
          subscription &&
            !subscription.refunded_at &&
            ((!expiresAtDate && !gracePeriodExpiresAtDate) ||
              (expiresAtDate && expiresAtDate.getTime() > now) ||
              (gracePeriodExpiresAtDate &&
                gracePeriodExpiresAtDate.getTime() > now)),
        );

  let status = "inactive";
  if (subscription?.refunded_at) {
    status = "inactive";
  } else if (subscription?.billing_issues_detected_at) {
    status = "billing_issue";
  } else if (subscription?.unsubscribe_detected_at) {
    status = isActive ? "canceled" : "expired";
  } else if (isActive && subscription?.period_type === "trial") {
    status = "trialing";
  } else if (isActive) {
    status = "active";
  } else if (entitlement || subscription) {
    status = "expired";
  }

  return {
    appUserId,
    originalAppUserId: subscriber.original_app_user_id ?? null,
    entitlementId: normalizeBillingEntitlementId(entitlementKey),
    productId: productIdFromEntitlement ?? subscriptionProductId,
    platform: subscription?.store ?? null,
    status,
    isActive,
    willRenew:
      subscription?.unsubscribe_detected_at || !isActive ? false : null,
    periodType: subscription?.period_type ?? null,
    expiresAt,
    gracePeriodExpiresAt,
    trialEndsAt:
      subscription?.period_type === "trial" && isActive ? expiresAt : null,
    rawSubscriber: subscriber,
  };
}
