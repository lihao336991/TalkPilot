/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    createAuthRequiredResponse,
    createFeatureAccessDeniedResponse,
    JSON_HEADERS,
    mapFeatureAccessRow,
} from "../_shared/access.ts";
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
    return createAuthRequiredResponse("review");
  }

  const body = await req.json();
  const sessionId = body.session_id ?? body.sessionId;
  const userUtterance = body.user_utterance ?? body.userUtterance;
  const scene = body.scene;
  const targetLanguage = typeof (body.learning_language ?? body.learningLanguage ?? body.target_language ?? body.targetLanguage) === "string" &&
      String(body.learning_language ?? body.learningLanguage ?? body.target_language ?? body.targetLanguage).trim()
    ? String(body.learning_language ?? body.learningLanguage ?? body.target_language ?? body.targetLanguage).trim()
    : "en";
  const reviewLocale = typeof (body.native_language ?? body.nativeLanguage ?? body.review_locale ?? body.reviewLocale) === "string" &&
      String(body.native_language ?? body.nativeLanguage ?? body.review_locale ?? body.reviewLocale).trim()
    ? String(body.native_language ?? body.nativeLanguage ?? body.review_locale ?? body.reviewLocale).trim()
    : "en";

  if (typeof sessionId !== "string" || typeof userUtterance !== "string") {
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: JSON_HEADERS,
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
        headers: JSON_HEADERS,
      },
    );
  }

  const llm = createLlmRuntime();
  const responseHeaders = buildLlmResponseHeaders(llm, {
    "Content-Type": "application/json",
  });

  const { data: accessRows, error: accessError } = await supabase.rpc(
    "consume_feature_access",
    {
      p_user_id: user.id,
      p_feature_key: "review",
    },
  );

  if (accessError) {
    return new Response(JSON.stringify({ error: "Review access check failed" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  const access = mapFeatureAccessRow("review", accessRows?.[0]);

  if (!access.allowed) {
    return createFeatureAccessDeniedResponse({
      access,
      error: "Review quota exhausted",
      extra: {
        upgrade_required: true,
      },
    });
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

  const targetLanguageName = languageDisplayName(targetLanguage);
  const reviewLocaleName = languageDisplayName(reviewLocale);

  const systemPrompt = `You are a ${targetLanguageName} language reviewer. The user is practicing ${targetLanguageName} in a "${scene || "general"}" scenario.

Review the user's utterance for grammar, vocabulary, and naturalness issues. Focus on at most 2 most important issues.

Output your review wrapped in XML-like tags exactly as follows. Do not use JSON.
<score>green|yellow|red</score>
<issue_type>grammar|vocabulary|naturalness</issue_type>
<issue_original>...</issue_original>
<issue_corrected>...</issue_corrected>
<issue_explanation>...</issue_explanation>
<better_expression>...</better_expression>
<praise>...</praise>

- score: "green" = good, "yellow" = minor issues, "red" = significant issues
- issues: Provide at most 2 issues. If you have a second issue, output another block of <issue_type>, <issue_original>, <issue_corrected>, and <issue_explanation>.
- issue_original and issue_corrected MUST stay in ${targetLanguageName}
- issue_explanation MUST be written in ${reviewLocaleName}
- better_expression: a more natural way to say the same thing, written in ${targetLanguageName}
- praise: brief positive feedback on what the user did well, written in ${reviewLocaleName}`;

  const userPrompt = `Recent conversation context:
${conversationContext}

User's utterance to review: "${userUtterance}"`;

  const startTime = Date.now();

  try {
    const completion = await llm.client.chat.completions.create(withLlmDefaults(llm, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 200,
      temperature: 0.3,
    }));

    const latencyMs = Date.now() - startTime;
    const rawContent = completion.choices[0]?.message?.content ?? "";

    const scoreMatch = rawContent.match(/<score>\s*([\s\S]*?)\s*<\/score>/i);
    const betterExprMatch = rawContent.match(/<better_expression>\s*([\s\S]*?)\s*<\/better_expression>/i);
    const praiseMatch = rawContent.match(/<praise>\s*([\s\S]*?)\s*<\/praise>/i);

    let overall_score = "green";
    if (scoreMatch && scoreMatch[1]) {
      const parsedScore = scoreMatch[1].trim().toLowerCase();
      if (["green", "yellow", "red"].includes(parsedScore)) {
        overall_score = parsedScore;
      }
    }

    const better_expression = betterExprMatch && betterExprMatch[1] ? betterExprMatch[1].trim() : null;
    const praise = praiseMatch && praiseMatch[1] ? praiseMatch[1].trim() : null;

    const issues = [];
    const issueTypeMatches = [...rawContent.matchAll(/<issue_type>\s*([\s\S]*?)\s*<\/issue_type>/gi)];
    const issueOriginalMatches = [...rawContent.matchAll(/<issue_original>\s*([\s\S]*?)\s*<\/issue_original>/gi)];
    const issueCorrectedMatches = [...rawContent.matchAll(/<issue_corrected>\s*([\s\S]*?)\s*<\/issue_corrected>/gi)];
    const issueExplanationMatches = [...rawContent.matchAll(/<issue_explanation>\s*([\s\S]*?)\s*<\/issue_explanation>/gi)];

    const issueCount = Math.min(issueTypeMatches.length, issueOriginalMatches.length, issueCorrectedMatches.length, issueExplanationMatches.length);
    for (let i = 0; i < issueCount; i++) {
      issues.push({
        type: issueTypeMatches[i][1].trim(),
        original: issueOriginalMatches[i][1].trim(),
        corrected: issueCorrectedMatches[i][1].trim(),
        explanation: issueExplanationMatches[i][1].trim()
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    adminClient
      .from("reviews")
      .insert({
        session_id: sessionId,
        user_utterance: userUtterance,
        overall_score,
        issues,
        better_expression,
        praise,
        latency_ms: latencyMs,
      })
      .then();

    return new Response(JSON.stringify({ overall_score, issues, better_expression, praise, access }), {
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
    console.error("[Review] LLM Error:", errorContext);
    
    return new Response(JSON.stringify(errorContext), {
      status: error.status || 500,
      headers: responseHeaders,
    });
  }
});
