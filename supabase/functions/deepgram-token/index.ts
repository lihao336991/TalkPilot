import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const { data: usage, error: usageError } = await supabase.rpc(
    "check_daily_usage",
    { p_user_id: user.id },
  );

  if (usageError) {
    return new Response(JSON.stringify({ error: "Usage check failed" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  const usageSummary = usage?.[0] ?? {
    minutes_used: 0,
    minutes_remaining: 0,
    is_limit_reached: false,
  };
  const dailyMinutesLimit =
    Number(usageSummary.minutes_used ?? 0) +
    Number(usageSummary.minutes_remaining ?? 0);

  if (usageSummary.is_limit_reached) {
    return new Response(
      JSON.stringify({
        error: "Daily usage limit reached",
        code: "DAILY_USAGE_LIMIT_REACHED",
        tier: dailyMinutesLimit > 10 ? "pro" : "free",
        minutes_used: usageSummary.minutes_used ?? 0,
        minutes_remaining: usageSummary.minutes_remaining ?? 0,
        daily_minutes_limit: dailyMinutesLimit,
        upgrade_required: true,
      }),
      {
        status: 429,
        headers: JSON_HEADERS,
      },
    );
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
        tier: dailyMinutesLimit > 10 ? "pro" : "free",
        minutes_used: usageSummary.minutes_used ?? 0,
        minutes_remaining: usageSummary.minutes_remaining ?? 0,
        daily_minutes_limit: dailyMinutesLimit,
      },
    }),
    {
      status: 200,
      headers: JSON_HEADERS,
    },
  );
});
