/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JSON_HEADERS } from "../_shared/access.ts";
import {
  buildLlmResponseHeaders,
  runLlmChatCompletion,
} from "../_shared/llm.ts";

type RecapHighlight = { text: string; explanation: string };
type RecapImprovement = {
  type: string;
  original: string;
  corrected: string;
  explanation: string;
};
type SessionRecapPayload = {
  highlights: RecapHighlight[];
  improvements: RecapImprovement[];
  overallComment: string;
};

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
  const suspiciousLongToken = text.split(/\s+/).some((token) => token.length > 64);
  return visibleUnits >= minChars && !suspiciousLongToken;
}

function stripModelNoise(value: string): string {
  return sanitizeText(value)
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1")
    .trim();
}

function getTagContent(content: string, tag: string): string | null {
  const match = content.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "i"));
  return match?.[1] ? stripModelNoise(match[1]) : null;
}

function getTagBlocks(content: string, tag: string): string[] {
  return [...content.matchAll(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "gi"))]
    .map((match) => match[1])
    .filter((value): value is string => typeof value === "string");
}

function normalizeImprovementType(value: unknown): "grammar" | "vocabulary" | "naturalness" {
  const type = sanitizeText(value).toLowerCase();
  if (type === "grammar" || type === "vocabulary" || type === "naturalness") {
    return type;
  }
  return "naturalness";
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
): SessionRecapPayload | null {
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

function parseXmlRecapPayload(rawContent: string): {
  title: string;
  recap: SessionRecapPayload | null;
} {
  const title = stripModelNoise(getTagContent(rawContent, "title") ?? "");
  const overallComment = stripModelNoise(getTagContent(rawContent, "overall_comment") ?? "");

  const highlights = getTagBlocks(rawContent, "highlight")
    .map((block) => {
      const text = stripModelNoise(getTagContent(block, "text") ?? "");
      const explanation = stripModelNoise(getTagContent(block, "explanation") ?? "");
      if (!isMeaningfulText(text) || !isMeaningfulText(explanation)) {
        return null;
      }
      return { text, explanation };
    })
    .filter((item): item is RecapHighlight => item != null)
    .slice(0, 3);

  const improvements = getTagBlocks(rawContent, "improvement")
    .map((block) => {
      const original = stripModelNoise(getTagContent(block, "original") ?? "");
      const corrected = stripModelNoise(getTagContent(block, "corrected") ?? "");
      const explanation = stripModelNoise(getTagContent(block, "explanation") ?? "");
      if (
        !isMeaningfulText(original) ||
        !isMeaningfulText(corrected) ||
        !isMeaningfulText(explanation)
      ) {
        return null;
      }
      return {
        type: normalizeImprovementType(getTagContent(block, "type")),
        original,
        corrected,
        explanation,
      };
    })
    .filter((item): item is RecapImprovement => item != null)
    .slice(0, 3);

  if (!isMeaningfulText(overallComment, 12)) {
    return { title, recap: null };
  }

  return {
    title,
    recap: {
      highlights,
      improvements,
      overallComment,
    },
  };
}

function buildFallbackRecap(
  reviewList: Array<{
    user_utterance: string;
    overall_score: string;
    issues: any;
    better_expression: string | null;
    praise: string | null;
  }>,
  nativeLanguageName: string,
): SessionRecapPayload | null {
  const highlights = reviewList
    .map((review) => {
      const text = stripModelNoise(review.user_utterance);
      const explanation = stripModelNoise(review.praise ?? "");
      if (!isMeaningfulText(text) || !isMeaningfulText(explanation)) {
        return null;
      }
      return { text, explanation };
    })
    .filter((item): item is RecapHighlight => item != null)
    .slice(0, 3);

  const improvements = reviewList
    .flatMap((review) => (Array.isArray(review.issues) ? review.issues : []))
    .map((issue: any) => {
      const original = stripModelNoise(issue?.original);
      const corrected = stripModelNoise(issue?.corrected);
      const explanation = stripModelNoise(issue?.explanation);
      if (
        !isMeaningfulText(original) ||
        !isMeaningfulText(corrected) ||
        !isMeaningfulText(explanation)
      ) {
        return null;
      }
      return {
        type: normalizeImprovementType(issue?.type),
        original,
        corrected,
        explanation,
      };
    })
    .filter((item): item is RecapImprovement => item != null)
    .slice(0, 3);

  if (highlights.length === 0 && improvements.length === 0) {
    return null;
  }

  return {
    highlights,
    improvements,
    overallComment:
      nativeLanguageName === "Chinese (Simplified)"
        ? "本次对话已完成复盘。建议优先关注上方列出的表达亮点和可改进项，下次练习时把这些句式主动用出来。"
        : "This session recap is ready. Focus on the highlights and improvements above, then reuse these patterns in your next practice.",
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

  const cleanTurns = turnList
    .map((t: { speaker: string; text: string }) => ({
      speaker: t.speaker === "self" ? "User" : "Other",
      text: stripModelNoise(t.text),
    }))
    .filter((turn) => isMeaningfulText(turn.text, 2))
    .slice(-80);

  if (cleanTurns.length === 0) {
    const emptyResult = {
      title: session.scene_description || session.scene_preset || "Conversation",
      recap: null,
    };
    return new Response(JSON.stringify(emptyResult), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const conversationText = cleanTurns
    .map((t) => `[${t.speaker}]: ${t.text}`)
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

  const systemPrompt = `You are a senior ${learningLanguageName} conversation coach. Analyze a completed practice conversation and write a concise, useful session recap.

Output XML-like tags exactly in this shape. Do not use JSON. Do not use markdown. Do not include explanations outside the tags.

<title>short title in ${nativeLanguageName}, max 12 words</title>
<highlight>
  <text>one good expression the User actually said, in ${learningLanguageName}</text>
  <explanation>why it worked, in ${nativeLanguageName}</explanation>
</highlight>
<improvement>
  <type>grammar|vocabulary|naturalness</type>
  <original>one exact User phrase from the transcript, in ${learningLanguageName}</original>
  <corrected>a better version, in ${learningLanguageName}</corrected>
  <explanation>brief reason, in ${nativeLanguageName}</explanation>
</improvement>
<overall_comment>2 concise sentences in ${nativeLanguageName}</overall_comment>

Rules:
- Use 0-3 highlight blocks and 0-3 improvement blocks.
- Only analyze text spoken by [User]. Never correct [Other].
- Prefer concrete, high-signal feedback over generic encouragement.
- Keep explanations short and actionable.
- If the transcript is fragmented or noisy, say so briefly in overall_comment and only include items clearly supported by the transcript.
- Never output corrupted text, random characters, code, internal reasoning, or placeholders.
- If review data conflicts with the transcript, trust the transcript.`;

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
        max_tokens: 700,
        temperature: 0.2,
      },
      {
        providerEnvName: "SESSION_RECAP_LLM_PROVIDER",
        modelEnvName: "SESSION_RECAP_LLM_MODEL",
        defaultProvider: "minimax",
        defaultModel: "MiniMax-M2.5-highspeed",
      },
    );
    const responseHeaders = buildLlmResponseHeaders(runtime, {
      routeMode,
      attempts,
    }, {
      "Content-Type": "application/json",
    });

    const rawContent = completion.choices[0]?.message?.content ?? "";
    const xmlParsed = parseXmlRecapPayload(rawContent);
    const title = isMeaningfulText(xmlParsed.title) ? xmlParsed.title : sanitizeText(scene);
    const recap =
      xmlParsed.recap ??
      buildFallbackRecap(reviewList, nativeLanguageName) ??
      {
        highlights: [],
        improvements: [],
        overallComment:
          nativeLanguageName === "Chinese (Simplified)"
            ? "本次对话内容较短或转写较分散，暂时没有足够稳定的表达点可深入分析。建议继续完成一段更完整的对话后再生成复盘。"
            : "This conversation was short or fragmented, so there was not enough stable language to analyze in depth. Try a fuller conversation and generate the recap again.",
      };

    if (!isMeaningfulText(title)) {
      throw new Error("Session recap title failed validation");
    }

    await adminClient
      .from("sessions")
      .update({ title, recap })
      .eq("id", sessionId);

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
