/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  getPrimaryEntitlementId,
  getRevenueCatEvent,
  getRevenueCatEventId,
  mapEventToBillingState,
  normalizeRevenueCatAppUserId,
  parseRevenueCatTimestamp,
  requireWebhookAuthorization,
  type RevenueCatWebhookEnvelope,
} from "../_shared/billing.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

function logWebhook(stage: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      scope: "revenuecat-webhook",
      stage,
      ...payload,
    }),
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return error;
  }

  return { message: String(error) };
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  try {
    if (!requireWebhookAuthorization(req)) {
      logWebhook("auth_failed", {
        hasAuthorizationHeader: Boolean(req.headers.get("Authorization")),
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const payload = (await req.json()) as RevenueCatWebhookEnvelope;
    const event = getRevenueCatEvent(payload);
    const eventId = getRevenueCatEventId(event);
    const appUserId = normalizeRevenueCatAppUserId(event.app_user_id);

    logWebhook("received", {
      eventId,
      eventType: event.type ?? null,
      appUserId,
      originalAppUserId: event.original_app_user_id ?? null,
      entitlementIds: Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [],
      productId: event.product_id ?? null,
      store: event.store ?? null,
    });

    if (!appUserId) {
      return new Response(JSON.stringify({ error: "Missing app_user_id" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase service role configuration");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: existingEvent } = await supabase
      .from("billing_webhook_events")
      .select("event_id, status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      logWebhook("duplicate", {
        eventId,
        existingStatus: existingEvent.status,
      });
      return new Response(
        JSON.stringify({ ok: true, duplicate: true, event_id: eventId }),
        {
          status: 200,
          headers: JSON_HEADERS,
        },
      );
    }

    const { error: insertEventError } = await supabase
      .from("billing_webhook_events")
      .insert({
        event_id: eventId,
        event_type: event.type ?? "UNKNOWN",
        app_user_id: appUserId,
        payload,
      });

    if (insertEventError) {
      logWebhook("insert_event_failed", {
        eventId,
        error: insertEventError,
      });
      throw insertEventError;
    }

    const { data: customer } = await supabase
      .from("billing_customers")
      .select("user_id")
      .eq("revenuecat_app_user_id", appUserId)
      .maybeSingle();

    const userId = customer?.user_id ?? appUserId;
    const entitlementId = getPrimaryEntitlementId(event);
    const billingState = mapEventToBillingState(event, entitlementId);

    logWebhook("resolved_identity", {
      eventId,
      appUserId,
      resolvedUserId: userId,
      customerRowFound: Boolean(customer),
      entitlementId,
      billingState,
    });

    const { error: applyError } = await supabase.rpc("apply_billing_entitlement", {
      p_user_id: userId,
      p_provider: "revenuecat",
      p_app_user_id: appUserId,
      p_original_app_user_id: event.original_app_user_id ?? null,
      p_platform: event.store ?? null,
      p_product_id: event.product_id ?? null,
      p_entitlement_id: entitlementId,
      p_status: billingState.status,
      p_is_active: billingState.isActive,
      p_will_renew: event.will_renew ?? null,
      p_period_type: event.period_type ?? null,
      p_expires_at: parseRevenueCatTimestamp(event.expiration_at_ms)?.toISOString() ?? null,
      p_grace_period_expires_at:
        parseRevenueCatTimestamp(event.grace_period_expiration_at_ms)?.toISOString() ?? null,
      p_trial_ends_at:
        event.period_type === "trial"
          ? parseRevenueCatTimestamp(event.expiration_at_ms)?.toISOString() ?? null
          : null,
      p_raw_payload: payload,
    });

    if (applyError) {
      logWebhook("apply_billing_entitlement_failed", {
        eventId,
        resolvedUserId: userId,
        appUserId,
        entitlementId,
        billingState,
        error: applyError,
      });
      await supabase
        .from("billing_webhook_events")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          error_message: applyError.message,
        })
        .eq("event_id", eventId);

      throw applyError;
    }

    const { error: processedError } = await supabase
      .from("billing_webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    if (processedError) {
      logWebhook("mark_processed_failed", {
        eventId,
        error: processedError,
      });
      throw processedError;
    }

    logWebhook("processed", {
      eventId,
      appUserId,
      resolvedUserId: userId,
      entitlementId,
      billingState,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        event_id: eventId,
        app_user_id: appUserId,
        entitlement_id: entitlementId,
        status: billingState.status,
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      },
    );
  } catch (error) {
    logWebhook("unhandled_error", {
      error: serializeError(error),
    });
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Webhook handling failed",
      }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    );
  }
});
