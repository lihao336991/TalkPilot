/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JSON_HEADERS } from "../_shared/access.ts";
import {
  buildLlmResponseHeaders,
  createLlmRuntime,
  extractJsonObject,
  withLlmDefaults,
} from "../_shared/llm.ts";

function languageDisplayName(tag: string): string {
  const primary = tag.split("-")[0].toLowerCase();
  const map: Record<string, string> = {
    zh: "Chinese (Simplified)",
    ja: "Japanese",
    ko: "Korean",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    en: "English",
  };
  return map[primary] ?? tag;
}

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
    return new Response(
      JSON.stringify({ error: "Unauthorized", code: "auth_required" }),
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const body = await req.json();
  const sessionId = body.session_id ?? body.sessionId;

  if (typeof sessionId !== "string") {
    return new Response(
      JSON.stringify({ error: "session_id is required" }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "id, user_id, status, title, recap, scene_preset, scene_description, native_language, learning_language",
    )
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ error: "Session not found" }),
      { status: 404, headers: JSON_HEADERS },
    );
  }

  if (session.user_id !== user.id) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: JSON_HEADERS },
    );
  }

  if (session.title && session.recap) {
    return new Response(
      JSON.stringify({ title: session.title, recap: session.recap }),
      { status: 200, headers: JSON_HEADERS },
    );
  }

  const { data: turns } = await supabase
    .from("turns")
    .select("speaker, text, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const { data: reviews } = await supabase
    .from("reviews")
    .select("user_utterance, overall_score, issues, better_expression, praise")
    .eq("session_id", sessionId);

  const turnList = turns ?? [];
  const reviewList = reviews ?? [];

  if (turnList.length === 0) {
    const emptyResult = {
      title: session.scene_description || session.scene_preset || "Conversation",
      recap: null,
    };
    return new Response(JSON.stringify(emptyResult), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const nativeLanguage = session.native_language ?? "en";
  const learningLanguage = session.learning_language ?? "en";
  const nativeLanguageName = languageDisplayName(nativeLanguage);
  const learningLanguageName = languageDisplayName(learningLanguage);

  const conversationText = turnList
    .map(
      (t: { speaker: string; text: string }) =>
        `[${t.speaker === "self" ? "User" : "Other"}]: ${t.text}`,
    )
    .join("\n");

  const reviewSummary =
    reviewList.length > 0
      ? reviewList
          .map(
            (r: {
              user_utterance: string;
              overall_score: string;
              issues: any;
              better_expression: string | null;
              praise: string | null;
            }) => {
              const parts = [`Utterance: "${r.user_utterance}"`, `Score: ${r.overall_score}`];
              if (Array.isArray(r.issues) && r.issues.length > 0) {
                parts.push(
                  `Issues: ${r.issues.map((i: any) => `${i.type}: "${i.original}" → "${i.corrected}"`).join("; ")}`,
                );
              }
              if (r.better_expression) parts.push(`Better: "${r.better_expression}"`);
              if (r.praise) parts.push(`Praise: ${r.praise}`);
              return parts.join(" | ");
            },
          )
          .join("\n")
      : "No reviews available.";

  const scene = session.scene_description || session.scene_preset || "general conversation";

  const systemPrompt = `You are a language learning assistant. Analyze a completed ${learningLanguageName} practice conversation and produce a structured recap.

Output a JSON object with these fields:
- "title": A short descriptive title (max 15 words) summarizing the conversation topic. Write in ${nativeLanguageName}.
- "highlights": An array of 1-3 objects, each with "text" (the good expression the user used, in ${learningLanguageName}) and "explanation" (why it's good, in ${nativeLanguageName}).
- "improvements": An array of 1-3 objects, each with "type" (grammar/vocabulary/naturalness), "original" (what user said, in ${learningLanguageName}), "corrected" (better version, in ${learningLanguageName}), and "explanation" (in ${nativeLanguageName}).
- "overallComment": A brief encouraging summary (2-3 sentences) in ${nativeLanguageName}.

If there are no notable highlights, return an empty array for "highlights".
If there are no notable issues, return an empty array for "improvements".
Always provide a title and overallComment.

Respond ONLY with valid JSON. No markdown fences, no extra text.`;

  const userPrompt = `Scene: ${scene}

Conversation:
${conversationText}

Review data from real-time analysis:
${reviewSummary}`;

  const llm = createLlmRuntime();
  const responseHeaders = buildLlmResponseHeaders(llm, {
    "Content-Type": "application/json",
  });

  try {
    const completion = await llm.client.chat.completions.create(
      withLlmDefaults(llm, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
    );

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const jsonStr = extractJsonObject(rawContent);
    let parsed: any;

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        title: scene,
        highlights: [],
        improvements: [],
        overallComment: "",
      };
    }

    const title = typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : scene;

    const recap = {
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      overallComment: typeof parsed.overallComment === "string" ? parsed.overallComment : "",
    };

    adminClient
      .from("sessions")
      .update({ title, recap })
      .eq("id", sessionId)
      .then();

    return new Response(JSON.stringify({ title, recap }), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    const errorContext = {
      error: "LLM Provider Error",
      provider: llm.provider,
      model: llm.model,
      message: error.message,
    };
    console.error("[SessionRecap] LLM Error:", errorContext);

    return new Response(JSON.stringify(errorContext), {
      status: error.status || 500,
      headers: responseHeaders,
    });
  }
});
