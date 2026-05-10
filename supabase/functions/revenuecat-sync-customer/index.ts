/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  getRevenueCatSubscriberSnapshot,
  normalizeRevenueCatAppUserId,
  type RevenueCatSubscriberResponse,
} from "../_shared/billing.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

function logSync(stage: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      scope: "revenuecat-sync-customer",
      stage,
      ...payload,
    }),
  );
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const revenueCatApiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase function configuration" }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    );
  }

  if (!revenueCatApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing REVENUECAT_SECRET_API_KEY" }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    );
  }

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const appUserId = normalizeRevenueCatAppUserId(user.id);
    logSync("received", { userId: user.id, appUserId });

    const revenueCatResponse = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${revenueCatApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!revenueCatResponse.ok) {
      const body = await revenueCatResponse.text().catch(() => "");
      logSync("revenuecat_fetch_failed", {
        userId: user.id,
        status: revenueCatResponse.status,
        body,
      });
      return new Response(
        JSON.stringify({
          error: "Failed to fetch RevenueCat customer",
          status: revenueCatResponse.status,
          body,
        }),
        {
          status: 502,
          headers: JSON_HEADERS,
        },
      );
    }

    const subscriberPayload =
      (await revenueCatResponse.json()) as RevenueCatSubscriberResponse;
    const subscriber = subscriberPayload.subscriber;

    if (!subscriber || typeof subscriber !== "object") {
      throw new Error("Missing RevenueCat subscriber payload");
    }

    const snapshot = getRevenueCatSubscriberSnapshot(appUserId, subscriber);
    logSync("snapshot_resolved", {
      userId: user.id,
      entitlementId: snapshot.entitlementId,
      productId: snapshot.productId,
      status: snapshot.status,
      isActive: snapshot.isActive,
      platform: snapshot.platform,
      expiresAt: snapshot.expiresAt,
    });

    const { error: applyError } = await adminSupabase.rpc(
      "apply_billing_entitlement",
      {
        p_user_id: user.id,
        p_provider: "revenuecat",
        p_app_user_id: snapshot.appUserId,
        p_original_app_user_id: snapshot.originalAppUserId,
        p_platform: snapshot.platform,
        p_product_id: snapshot.productId,
        p_entitlement_id: snapshot.entitlementId,
        p_status: snapshot.status,
        p_is_active: snapshot.isActive,
        p_will_renew: snapshot.willRenew,
        p_period_type: snapshot.periodType,
        p_expires_at: snapshot.expiresAt,
        p_grace_period_expires_at: snapshot.gracePeriodExpiresAt,
        p_trial_ends_at: snapshot.trialEndsAt,
        p_raw_payload: subscriberPayload,
      },
    );

    if (applyError) {
      logSync("apply_failed", {
        userId: user.id,
        snapshot,
        error: applyError,
      });
      throw applyError;
    }

    logSync("processed", {
      userId: user.id,
      entitlementId: snapshot.entitlementId,
      status: snapshot.status,
      isActive: snapshot.isActive,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        status: snapshot.status,
        is_active: snapshot.isActive,
        entitlement_id: snapshot.entitlementId,
        product_id: snapshot.productId,
        expires_at: snapshot.expiresAt,
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      },
    );
  } catch (error) {
    logSync("unhandled_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "RevenueCat sync failed",
      }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    );
  }
});
