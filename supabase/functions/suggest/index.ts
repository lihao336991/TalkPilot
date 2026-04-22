/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JSON_HEADERS } from "../_shared/access.ts";
import {
  buildLlmResponseHeaders,
  createLlmRuntime,
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
    nl: "Dutch",
    hi: "Hindi",
    id: "Indonesian",
    tr: "Turkish",
    pl: "Polish",
    sv: "Swedish",
    da: "Danish",
    fi: "Finnish",
    no: "Norwegian",
    uk: "Ukrainian",
    th: "Thai",
    vi: "Vietnamese",
    ar: "Arabic",
    en: "English",
  };
  return map[primary] ?? tag;
}

function sanitizeSuggestionText(text: string): string {
  return text
    .replace(
      /^(here is a suggestion|you could say|how about|a natural reply would be|suggestion|reply):\s*/i,
      "",
    )
    .replace(/^["']|["']$/g, "")
    .trim();
}

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authorization = req.headers.get("Authorization") ?? "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({
      error: "Unauthorized",
      code: "auth_required",
      access: {
        feature: "suggestion",
        allowed: false,
        reason: "auth_required",
        tier: "unknown",
        used: null,
        remaining: null,
        limit: null,
        resetAt: null,
      },
    }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const body = await req.json();
  const sessionId = body.session_id ?? body.sessionId;
  const lastUtterance = body.last_utterance ?? body.lastUtterance;
  const scene = body.scene;
  const targetLanguage = typeof (body.learning_language ?? body.learningLanguage ?? body.target_language ?? body.targetLanguage) === "string" &&
      String(body.learning_language ?? body.learningLanguage ?? body.target_language ?? body.targetLanguage).trim()
    ? String(body.learning_language ?? body.learningLanguage ?? body.target_language ?? body.targetLanguage).trim()
    : "en";

  if (typeof sessionId !== "string" || typeof lastUtterance !== "string") {
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // Temporary bypass: suggestion quota enforcement is disabled until the
  // feature-access RPC path is stabilized in production.
  const access = {
    feature: "suggestion",
    allowed: true,
    reason: "bypassed",
    tier: "unknown",
    used: null,
    remaining: null,
    limit: null,
    resetAt: null,
  };

  const { data: turns } = await supabase
    .from("turns")
    .select("speaker, text")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(5);

  const conversationHistory = (turns ?? [])
    .reverse()
    .map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
    .join("\n");

  const targetLanguageName = languageDisplayName(targetLanguage);

  const systemPrompt = `You are a ${targetLanguageName} conversation coach. The user is practicing ${targetLanguageName} in a "${scene || "general"}" scenario.

Based on the conversation so far and the last thing the other person said, generate exactly ONE natural reply suggestion for the user. 
The reply should be 1-2 sentences. 
The suggestion MUST be written in ${targetLanguageName}.

CRITICAL INSTRUCTIONS:
- NEVER include any reasoning, thought process, or explanations.
- NEVER start with phrases like "Here is a suggestion", "You could say", "How about".
- NEVER use JSON, XML, or labels.
- Output ONLY the exact words the user should speak out loud.

Example Output:
That sounds like a great idea! I'd love to join you.`;

  const userPrompt = `Conversation so far:
${conversationHistory}

Last utterance from the other person: "${lastUtterance}"`;

  const llm = createLlmRuntime();
  const responseHeaders = buildLlmResponseHeaders(llm, {
    "Content-Type": "application/json",
  });

  try {
    const completion = await llm.client.chat.completions.create(withLlmDefaults(llm, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 100,
      temperature: 0.4,
    }));

    const rawContent = completion.choices[0]?.message?.content ?? "";
    const cleanText = sanitizeSuggestionText(rawContent);
    const suggestions = cleanText ? [{ style: "simple", text: cleanText }] : [];

    return new Response(JSON.stringify({ suggestions, access }), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    const errorContext = {
      error: "LLM Provider Error",
      provider: llm.provider,
      model: llm.model,
      baseUrl: llm.client.baseURL,
      message: error.message,
      name: error.name,
      status: error.status,
      type: error.type,
    };
    console.error("[Suggest] LLM Error:", errorContext);
    
    return new Response(JSON.stringify(errorContext), {
      status: error.status || 500,
      headers: buildLlmResponseHeaders(llm, {
        "Content-Type": "application/json",
      }),
    });
  }
});
