/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JSON_HEADERS } from "../_shared/access.ts";
import {
  buildLlmResponseHeaders,
  extractJsonObject,
  runLlmChatCompletion,
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

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function isMeaningfulText(value: unknown, minChars = 4): boolean {
  const text = sanitizeText(value);
  if (!text || text.includes("\uFFFD")) {
    return false;
  }

  const visibleUnits = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const suspiciousLongToken = text.split(/\s+/).some((token) => token.length > 48);
  return visibleUnits >= minChars && !suspiciousLongToken;
}

function normalizeRecapItem(
  value: unknown,
  kind: "highlight" | "improvement",
): Record<string, string> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (kind === "highlight") {
    const item = value as { text?: unknown; explanation?: unknown };
    const text = sanitizeText(item.text);
    const explanation = sanitizeText(item.explanation);
    if (!isMeaningfulText(text) || !isMeaningfulText(explanation)) {
      return null;
    }
    return { text, explanation };
  }

  const item = value as {
    type?: unknown;
    original?: unknown;
    corrected?: unknown;
    explanation?: unknown;
  };
  const type = sanitizeText(item.type).toLowerCase();
  const original = sanitizeText(item.original);
  const corrected = sanitizeText(item.corrected);
  const explanation = sanitizeText(item.explanation);

  if (
    !["grammar", "vocabulary", "naturalness"].includes(type) ||
    !isMeaningfulText(original) ||
    !isMeaningfulText(corrected) ||
    !isMeaningfulText(explanation)
  ) {
    return null;
  }

  return { type, original, corrected, explanation };
}

function normalizeRecapPayload(
  value: unknown,
): {
  highlights: Array<{ text: string; explanation: string }>;
  improvements: Array<{
    type: string;
    original: string;
    corrected: string;
    explanation: string;
  }>;
  overallComment: string;
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const recap = value as {
    highlights?: unknown;
    improvements?: unknown;
    overallComment?: unknown;
  };
  const highlights = Array.isArray(recap.highlights)
    ? recap.highlights
        .map((item) => normalizeRecapItem(item, "highlight"))
        .filter((item): item is { text: string; explanation: string } => item != null)
        .slice(0, 3)
    : [];
  const improvements = Array.isArray(recap.improvements)
    ? recap.improvements
        .map((item) => normalizeRecapItem(item, "improvement"))
        .filter(
          (
            item,
          ): item is {
            type: string;
            original: string;
            corrected: string;
            explanation: string;
          } => item != null,
        )
        .slice(0, 3)
    : [];
  const overallComment = sanitizeText(recap.overallComment);

  if (!isMeaningfulText(overallComment, 12)) {
    return null;
  }

  return {
    highlights,
    improvements,
    overallComment,
  };
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
  const forceRegenerate = body.force === true || body.force_regenerate === true;

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

  const existingRecap = normalizeRecapPayload(session.recap);
  const existingTitle = sanitizeText(session.title);

  if (!forceRegenerate && existingTitle && existingRecap) {
    return new Response(
      JSON.stringify({ title: existingTitle, recap: existingRecap }),
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
Only use evidence that is clearly supported by the transcript or review data.
If the transcript looks noisy or fragmented, stay conservative and avoid inventing details.

Respond ONLY with valid JSON. No markdown fences, no extra text.`;

  const userPrompt = `Scene: ${scene}

Conversation:
${conversationText}

Review data from real-time analysis:
${reviewSummary}`;

  try {
    const { completion, runtime, routeMode, attempts } = await runLlmChatCompletion(
      req,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      },
      {
        providerEnvName: "SESSION_RECAP_LLM_PROVIDER",
        modelEnvName: "SESSION_RECAP_LLM_MODEL",
        defaultProvider: "cerebras",
        defaultModel: "gpt-oss-120b",
      },
    );
    const responseHeaders = buildLlmResponseHeaders(runtime, {
      routeMode,
      attempts,
    }, {
      "Content-Type": "application/json",
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const jsonStr = extractJsonObject(rawContent);
    let parsed: Record<string, unknown> | null = null;

    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = null;
    }

    const title = sanitizeText(parsed?.title) || scene;
    const recap = normalizeRecapPayload(parsed);

    if (!isMeaningfulText(title) || !recap) {
      throw new Error("Session recap output failed validation");
    }

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
      message: error.message,
    };
    console.error("[SessionRecap] LLM Error:", errorContext);

    return new Response(JSON.stringify(errorContext), {
      status: error.status || 500,
      headers: JSON_HEADERS,
    });
  }
});
