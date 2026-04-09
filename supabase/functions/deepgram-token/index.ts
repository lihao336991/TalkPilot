import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const deepgramApiKey = Deno.env.get("DEEPGRAM_API_KEY")!;
  const dgProjectId = Deno.env.get("DG_PROJECT_ID")!;

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
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: usage, error: usageError } = await supabase.rpc(
    "check_daily_usage",
    { p_user_id: user.id },
  );

  if (usageError) {
    return new Response(JSON.stringify({ error: "Usage check failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (usage?.[0]?.is_limit_reached) {
    return new Response(
      JSON.stringify({ error: "Daily usage limit reached" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const dgResponse = await fetch(
    `https://api.deepgram.com/v1/keys/${dgProjectId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scopes: ["usage:write"],
        time_to_live_in_seconds: 600,
      }),
    },
  );

  if (!dgResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to create Deepgram token" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const dgData = await dgResponse.json();

  return new Response(
    JSON.stringify({
      deepgram_token: dgData.key,
      expires_in: 600,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
