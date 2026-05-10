/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    createAuthRequiredResponse,
    JSON_HEADERS,
} from "../_shared/access.ts";
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

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function isMeaningfulText(value: unknown, minChars = 3): boolean {
  const text = sanitizeText(value);
  if (!text || text.includes("\uFFFD")) {
    return false;
  }

  const visibleUnits = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const suspiciousLongToken = text.split(/\s+/).some((token) => token.length > 48);
  return visibleUnits >= minChars && !suspiciousLongToken;
}

function countVisibleUnits(value: unknown): number {
  return (sanitizeText(value).match(/[\p{L}\p{N}]/gu) ?? []).length;
}

function normalizeScore(value: unknown): "green" | "yellow" | "red" {
  const score = sanitizeText(value).toLowerCase();
  return score === "yellow" || score === "red" ? score : "green";
}

function normalizeIssueType(value: unknown): "grammar" | "vocabulary" | "naturalness" | null {
  const type = sanitizeText(value).toLowerCase();
  if (type === "grammar" || type === "vocabulary" || type === "naturalness") {
    return type;
  }
  return null;
}

function extractXmlTag(content: string, tag: string): string | null {
  const match = content.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "i"));
  return match?.[1] ? sanitizeText(match[1]) : null;
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

  if (
    typeof sessionId !== "string" ||
    typeof userUtterance !== "string"
  ) {
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (countVisibleUnits(userUtterance) < 8) {
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

  const reviewSchema = {
    type: "object",
    additionalProperties: false,
    required: ["score", "issues", "better_expression", "praise"],
    properties: {
      score: {
        type: "string",
        enum: ["green", "yellow", "red"],
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "original", "corrected", "explanation"],
          properties: {
            type: {
              type: "string",
              enum: ["grammar", "vocabulary", "naturalness"],
            },
            original: { type: "string" },
            corrected: { type: "string" },
            explanation: { type: "string" },
          },
        },
      },
      better_expression: {
        type: ["string", "null"],
      },
      praise: {
        type: ["string", "null"],
      },
    },
  };

  const systemPrompt = `You are TalkPilot's ${targetLanguageName} conversation coach for real-time speaking practice.

Your job is not to grade like a school exam. Your job is to create a tiny "aha moment" that helps a language learner sound clearer, more natural, and more confident in daily conversation.

Review principles:
- Prioritize communicative value: meaning, conversational logic, word choice, collocation, tone, and natural phrasing.
- Treat ASR transcripts as noisy. Do not punish likely speech-recognition errors, homophones, missing punctuation, casing, or a single odd word if the intended meaning is recoverable from context.
- You may infer the likely intended meaning from the recent conversation, but never invent a totally new message.
- Prefer one high-leverage correction over many small fixes. At most 2 issues.
- If the utterance is already good, return green with no issues and give a memorable upgrade in better_expression.
- Make feedback feel useful and pleasantly surprising: include a reusable pattern, a native-sounding chunk, or a sharper conversational move.
- Keep it concise enough for an in-call popup.

Scoring:
- green: understandable and natural enough for conversation; no important fix needed.
- yellow: understandable, but one wording/logic/naturalness upgrade would noticeably improve it.
- red: likely confusing, noticeably unnatural, or contains a core grammar/word-choice problem that changes meaning.

Output rules:
- Return only JSON matching the provided schema.
- issue.original and issue.corrected must be in ${targetLanguageName}.
- issue.explanation must be in ${reviewLocaleName}.
- better_expression must be in ${targetLanguageName}; make it a polished, reusable version of the user's intended meaning.
- praise must be in ${reviewLocaleName}; use it for a short, specific positive observation or a learning insight. If there are issues, praise may still mention what worked.
- Use issue.type "naturalness" for conversation logic, tone, discourse flow, or phrasing that is grammatical but awkward.`;

  const userPrompt = `Scenario: ${scene || "general"}
Target language: ${targetLanguageName}
Review language: ${reviewLocaleName}

Recent conversation context:
${conversationContext}

ASR transcript of learner utterance:
"${userUtterance}"

Remember: infer around likely ASR noise; focus on expression logic and word choice.`;

  const startTime = Date.now();

  try {
    const { completion, runtime, routeMode, attempts } = await runLlmChatCompletion(
      req,
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 650,
        temperature: 0.35,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "talkpilot_review",
            strict: true,
            schema: reviewSchema,
          },
        },
      },
      { taskKey: "review" },
    );
    const responseHeaders = buildLlmResponseHeaders(runtime, {
      routeMode,
      attempts,
    }, {
      "Content-Type": "application/json",
    });

    const latencyMs = Date.now() - startTime;
    const rawContent = completion.choices[0]?.message?.content ?? "";

    let parsedReview: any = null;
    try {
      parsedReview = JSON.parse(extractJsonObject(rawContent));
    } catch {
      parsedReview = null;
    }

    let overall_score = normalizeScore(parsedReview?.score ?? extractXmlTag(rawContent, "score"));
    const betterExpressionRaw =
      parsedReview?.better_expression ?? extractXmlTag(rawContent, "better_expression");
    const praiseRaw = parsedReview?.praise ?? extractXmlTag(rawContent, "praise");

    const better_expression = isMeaningfulText(betterExpressionRaw)
      ? sanitizeText(betterExpressionRaw)
      : null;
    const praise = isMeaningfulText(praiseRaw)
      ? sanitizeText(praiseRaw)
      : null;

    const issues = [];
    if (Array.isArray(parsedReview?.issues)) {
      for (const issue of parsedReview.issues.slice(0, 2)) {
        const type = normalizeIssueType(issue?.type);
        const original = sanitizeText(issue?.original);
        const corrected = sanitizeText(issue?.corrected);
        const explanation = sanitizeText(issue?.explanation);
        if (
          !type ||
          !isMeaningfulText(original) ||
          !isMeaningfulText(corrected) ||
          !isMeaningfulText(explanation)
        ) {
          continue;
        }
        issues.push({ type, original, corrected, explanation });
      }
    } else {
      const issueTypeMatches = [...rawContent.matchAll(/<issue_type>\s*([\s\S]*?)\s*<\/issue_type>/gi)];
      const issueOriginalMatches = [...rawContent.matchAll(/<issue_original>\s*([\s\S]*?)\s*<\/issue_original>/gi)];
      const issueCorrectedMatches = [...rawContent.matchAll(/<issue_corrected>\s*([\s\S]*?)\s*<\/issue_corrected>/gi)];
      const issueExplanationMatches = [...rawContent.matchAll(/<issue_explanation>\s*([\s\S]*?)\s*<\/issue_explanation>/gi)];

      const issueCount = Math.min(issueTypeMatches.length, issueOriginalMatches.length, issueCorrectedMatches.length, issueExplanationMatches.length, 2);
      for (let i = 0; i < issueCount; i++) {
        const type = normalizeIssueType(issueTypeMatches[i][1]);
        const original = sanitizeText(issueOriginalMatches[i][1]);
        const corrected = sanitizeText(issueCorrectedMatches[i][1]);
        const explanation = sanitizeText(issueExplanationMatches[i][1]);
        if (
          !type ||
          !isMeaningfulText(original) ||
          !isMeaningfulText(corrected) ||
          !isMeaningfulText(explanation)
        ) {
          continue;
        }
        issues.push({ type, original, corrected, explanation });
      }
    }

    if (overall_score === "green" && issues.length > 0) {
      overall_score = "yellow";
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

    return new Response(JSON.stringify({ overall_score, issues, better_expression, praise }), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    const errorContext = {
      error: "LLM Provider Error",
      message: error.message,
      name: error.name,
      status: error.status,
      type: error.type,
    };
    console.error("[Review] LLM Error:", errorContext);
    
    return new Response(JSON.stringify(errorContext), {
      status: error.status || 500,
      headers: JSON_HEADERS,
    });
  }
});
