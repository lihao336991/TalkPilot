import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLlmRuntime, extractJsonObject, withLlmDefaults } from "../_shared/llm.ts";

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const body = await req.json();
  const sessionId = body.session_id ?? body.sessionId;
  const userUtterance = body.user_utterance ?? body.userUtterance;
  const scene = body.scene;

  if (typeof sessionId !== "string" || typeof userUtterance !== "string") {
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const words = userUtterance.trim().split(/\s+/);
  if (words.length < 4) {
    return new Response(
      JSON.stringify({
        overall_score: "green",
        issues: [],
        skipped: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { data: turns } = await supabase
    .from("turns")
    .select("speaker, text")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(6);

  const conversationContext = (turns ?? [])
    .reverse()
    .map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
    .join("\n");

  const systemPrompt = `You are an English language reviewer. The user is practicing English in a "${scene || "general"}" scenario.

Review the user's utterance for grammar, vocabulary, and naturalness issues. Focus on at most 2 most important issues.

Output strictly in JSON format:
{"overall_score":"green|yellow|red","issues":[{"type":"grammar|vocabulary|naturalness","original":"...","corrected":"...","explanation":"..."}],"better_expression":"...","praise":"..."}

- overall_score: "green" = good, "yellow" = minor issues, "red" = significant issues
- issues: max 2 items
- better_expression: a more natural way to say the same thing
- praise: brief positive feedback on what the user did well

Recent conversation context:
${conversationContext}

User's utterance to review: "${userUtterance}"`;

  const llm = createLlmRuntime();

  const startTime = Date.now();

  const completion = await llm.client.chat.completions.create(withLlmDefaults(llm, {
    messages: [{ role: "system", content: systemPrompt }],
    max_tokens: 200,
    temperature: 0.3,
  }));

  const latencyMs = Date.now() - startTime;
  const reviewContent = extractJsonObject(completion.choices[0]?.message?.content ?? "{}");
  const reviewJson = JSON.parse(reviewContent);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  adminClient
    .from("reviews")
    .insert({
      session_id: sessionId,
      user_utterance: userUtterance,
      overall_score: reviewJson.overall_score,
      issues: reviewJson.issues,
      better_expression: reviewJson.better_expression,
      praise: reviewJson.praise,
      latency_ms: latencyMs,
    })
    .then();

  return new Response(JSON.stringify(reviewJson), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
