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
  return ids.find((id) => typeof id === "string" && id.trim().length > 0) ?? "pro";
}

export function mapEventToBillingState(
  event: RevenueCatWebhookEvent,
  entitlementId: string,
): BillingState {
  const type = typeof event.type === "string" ? event.type : "UNKNOWN";
  const isProEntitlement = entitlementId === "pro";

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
      status: Array.isArray(event.entitlement_ids) && event.entitlement_ids.includes("pro")
        ? "active"
        : "transferred",
      isActive:
        Array.isArray(event.entitlement_ids) && event.entitlement_ids.includes("pro"),
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
