/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import { JSON_HEADERS } from "../_shared/access.ts";

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function refFromUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    return new URL(value).host.split(".")[0] || null;
  } catch {
    return null;
  }
}

function refFromJwt(token: string) {
  const payload = decodeJwtPayload(token);
  return refFromUrl(payload?.iss);
}

function safeJwtSummary(token: string) {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { present: Boolean(token), validPayload: false };
  }

  return {
    present: true,
    validPayload: true,
    iss: typeof payload.iss === "string" ? payload.iss : null,
    ref: refFromUrl(payload.iss),
    role: typeof payload.role === "string" ? payload.role : null,
    aud: typeof payload.aud === "string" ? payload.aud : null,
    exp: typeof payload.exp === "number" ? payload.exp : null,
  };
}

serve(async (req: Request) => {
  const supabaseUrl = getSupabaseUrl() ?? "";
  const supabaseAnonKey = getSupabaseAnonKey() ?? "";
  const serviceRoleKey = getSupabaseServiceRoleKey() ?? "";
  const talkPilotSupabaseUrl = Deno.env.get("TALKPILOT_SUPABASE_URL") ?? "";
  const reservedSupabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();

  let authUserId: string | null = null;
  let authError: string | null = null;

  if (supabaseUrl && supabaseAnonKey && authorization) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data, error } = await supabase.auth.getUser();
    authUserId = data.user?.id ?? null;
    authError = error?.message ?? null;
  }

  return new Response(
    JSON.stringify({
      request: {
        urlHost: new URL(req.url).host,
        hasAuthorization: Boolean(authorization),
      },
      functionEnv: {
        appEnv: Deno.env.get("APP_ENV") ?? null,
        expoPublicAppEnv: Deno.env.get("EXPO_PUBLIC_APP_ENV") ?? null,
        talkPilotSupabaseUrlRef: refFromUrl(talkPilotSupabaseUrl),
        reservedSupabaseUrlRef: refFromUrl(reservedSupabaseUrl),
        hasTalkPilotAnonKey: Boolean(Deno.env.get("TALKPILOT_SUPABASE_ANON_KEY")),
        hasTalkPilotServiceRoleKey: Boolean(
          Deno.env.get("TALKPILOT_SUPABASE_SERVICE_ROLE_KEY"),
        ),
        supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).host : null,
        supabaseUrlRef: refFromUrl(supabaseUrl),
        supabaseAnonKey: safeJwtSummary(supabaseAnonKey),
        serviceRoleKey: safeJwtSummary(serviceRoleKey),
      },
      requestToken: safeJwtSummary(bearer),
      auth: {
        userId: authUserId,
        error: authError,
      },
      expected: {
        productionRef: "joweqhgtueqfeasweigh",
        developmentRef: "ufaphufpewxpeizoewpn",
      },
      derived: {
        functionDbRef: refFromUrl(supabaseUrl),
        anonKeyRef: refFromJwt(supabaseAnonKey),
        serviceRoleKeyRef: refFromJwt(serviceRoleKey),
        requestTokenRef: refFromJwt(bearer),
      },
    }),
    {
      status: 200,
      headers: {
        ...JSON_HEADERS,
        "Cache-Control": "no-store",
      },
    },
  );
});
