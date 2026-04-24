/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createAuthRequiredResponse,
  createFeatureAccessDeniedResponse,
  JSON_HEADERS,
  mapFeatureAccessRow,
} from "../_shared/access.ts";

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const deepgramApiKey = Deno.env.get("DEEPGRAM_API_KEY")!;

  const authorization = req.headers.get("Authorization") ?? "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createAuthRequiredResponse("live_minutes");
  }

  const { data: usage, error: usageError } = await supabase.rpc(
    "get_live_minutes_access",
    { p_user_id: user.id },
  );

  if (usageError) {
    return new Response(JSON.stringify({ error: "Usage check failed" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  const access = mapFeatureAccessRow("live_minutes", usage?.[0]);

  if (!access.allowed) {
    return createFeatureAccessDeniedResponse({
      access,
      error: "Live minutes exhausted",
      extra: {
        tier: access.tier,
        minutes_used: access.used,
        minutes_remaining: access.remaining,
        daily_minutes_limit: access.limit,
        upgrade_required: true,
      },
    });
  }

  // Use Deepgram Token-Based Authentication to mint a short-lived JWT for client WS auth.
  // Docs: https://developers.deepgram.com/reference/auth/tokens/grant
  const ttlSeconds = 600; // 10 minutes; must be valid at connection time only.
  const dgResponse = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${deepgramApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
  });

  if (!dgResponse.ok) {
    const text = await dgResponse.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: "Failed to create Deepgram token",
        code: "DEEPGRAM_TOKEN_GRANT_FAILED",
        status: dgResponse.status,
        body: text,
      }),
      {
        status: 502,
        headers: JSON_HEADERS,
      },
    );
  }

  const dgData = await dgResponse.json();

  return new Response(
    JSON.stringify({
      deepgram_token: dgData.access_token,
      expires_in: dgData.expires_in ?? ttlSeconds,
      usage: {
        tier: access.tier,
        minutes_used: access.used,
        minutes_remaining: access.remaining,
        daily_minutes_limit: access.limit,
      },
      access,
    }),
    {
      status: 200,
      headers: JSON_HEADERS,
    },
  );
});
