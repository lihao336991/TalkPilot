import { supabase } from "@/shared/api/supabase";
import { invokeEdgeFunction } from "@/shared/api/request";
import { buildLlmDebugHeaders } from "@/shared/llm/debugConfig";
import { useAuthStore } from "@/shared/store/authStore";
import { useLlmDebugStore } from "@/shared/store/llmDebugStore";
import { analytics } from "@/shared/analytics/analytics";

export type HistorySession = {
  id: string;
  title: string | null;
  scene_preset: string | null;
  scene_description: string | null;
  native_language?: string | null;
  learning_language?: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  recap: SessionRecap | null;
};

export type RecapHighlight = {
  text: string;
  explanation: string;
};

export type RecapImprovement = {
  type: "grammar" | "vocabulary" | "naturalness";
  original: string;
  corrected: string;
  explanation: string;
};

export type SessionRecap = {
  highlights: RecapHighlight[];
  improvements: RecapImprovement[];
  overallComment: string;
};

export type HistoryTurn = {
  id: string;
  turn_id: string;
  speaker: "self" | "other";
  text: string;
  confidence: number | null;
  created_at: string;
};

export type HistoryReview = {
  id: string;
  user_utterance: string;
  overall_score: "green" | "yellow" | "red";
  issues: Array<{
    type: string;
    original: string;
    corrected: string;
    explanation: string;
  }>;
  better_expression: string | null;
  praise: string | null;
  created_at: string;
};

export type SessionDetail = {
  session: HistorySession;
  turns: HistoryTurn[];
  reviews: HistoryReview[];
};

type RecapResponse = {
  title: string;
  recap: SessionRecap | null;
};

const SESSIONS_CACHE_TTL_MS = 30_000;
let sessionsCache: HistorySession[] = [];
let sessionsCacheAt = 0;

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

function normalizeRecap(value: unknown): SessionRecap | null {
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
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as { text?: unknown; explanation?: unknown };
          const text = sanitizeText(candidate.text);
          const explanation = sanitizeText(candidate.explanation);
          if (!isMeaningfulText(text) || !isMeaningfulText(explanation)) {
            return null;
          }
          return { text, explanation };
        })
        .filter((item): item is RecapHighlight => item != null)
        .slice(0, 3)
    : [];

  const improvements = Array.isArray(recap.improvements)
    ? recap.improvements
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const candidate = item as {
            type?: unknown;
            original?: unknown;
            corrected?: unknown;
            explanation?: unknown;
          };
          const type = sanitizeText(candidate.type).toLowerCase();
          const original = sanitizeText(candidate.original);
          const corrected = sanitizeText(candidate.corrected);
          const explanation = sanitizeText(candidate.explanation);
          if (
            !["grammar", "vocabulary", "naturalness"].includes(type) ||
            !isMeaningfulText(original) ||
            !isMeaningfulText(corrected) ||
            !isMeaningfulText(explanation)
          ) {
            return null;
          }
          return {
            type: type as RecapImprovement["type"],
            original,
            corrected,
            explanation,
          };
        })
        .filter((item): item is RecapImprovement => item != null)
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

function normalizeSession(session: HistorySession): HistorySession {
  return {
    ...session,
    title: sanitizeText(session.title) || null,
    scene_preset: sanitizeText(session.scene_preset) || null,
    scene_description: sanitizeText(session.scene_description) || null,
    recap: normalizeRecap(session.recap),
  };
}

function normalizeReview(review: HistoryReview): HistoryReview {
  const issues = Array.isArray(review.issues)
    ? review.issues
        .map((issue) => {
          const type = sanitizeText(issue?.type).toLowerCase();
          const original = sanitizeText(issue?.original);
          const corrected = sanitizeText(issue?.corrected);
          const explanation = sanitizeText(issue?.explanation);
          if (
            !["grammar", "vocabulary", "naturalness"].includes(type) ||
            !isMeaningfulText(original) ||
            !isMeaningfulText(corrected) ||
            !isMeaningfulText(explanation)
          ) {
            return null;
          }
          return {
            type,
            original,
            corrected,
            explanation,
          };
        })
        .filter((item): item is HistoryReview["issues"][number] => item != null)
        .slice(0, 2)
    : [];

  return {
    ...review,
    user_utterance: sanitizeText(review.user_utterance),
    issues,
    better_expression: isMeaningfulText(review.better_expression)
      ? sanitizeText(review.better_expression)
      : null,
    praise: isMeaningfulText(review.praise) ? sanitizeText(review.praise) : null,
  };
}

async function loadSessions(opts?: {
  force?: boolean;
}): Promise<{ data: HistorySession[]; error: string | null }> {
  const useCache =
    !opts?.force &&
    sessionsCache.length > 0 &&
    Date.now() - sessionsCacheAt < SESSIONS_CACHE_TTL_MS;

  if (useCache) {
    return { data: sessionsCache, error: null };
  }

  const { data, error } = await supabase.rpc("list_history_sessions");

  if (error) {
    return { data: sessionsCache, error: error.message };
  }

  const next = ((data ?? []) as HistorySession[]).map(normalizeSession);
  sessionsCache = next;
  sessionsCacheAt = Date.now();
  return { data: next, error: null };
}

function invalidateSessionsCache() {
  sessionsCacheAt = 0;
}

async function loadSessionDetail(
  sessionId: string,
): Promise<{ data: SessionDetail | null; error: string | null }> {
  const [sessionRes, turnsRes, reviewsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, title, scene_preset, scene_description, native_language, learning_language, started_at, ended_at, duration_seconds, status, recap",
      )
      .eq("id", sessionId)
      .single(),
    supabase
      .from("turns")
      .select("id, turn_id, speaker, text, confidence, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("reviews")
      .select(
        "id, user_utterance, overall_score, issues, better_expression, praise, created_at",
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  ]);

  if (sessionRes.error || !sessionRes.data) {
    return { data: null, error: sessionRes.error?.message ?? "Session not found" };
  }

  return {
    data: {
      session: normalizeSession(sessionRes.data as HistorySession),
      turns: (turnsRes.data ?? []) as HistoryTurn[],
      reviews: ((reviewsRes.data ?? []) as HistoryReview[]).map(normalizeReview),
    },
    error: null,
  };
}

async function generateRecap(
  sessionId: string,
  opts?: { force?: boolean },
): Promise<{ title: string | null; recap: SessionRecap | null; error: string | null }> {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    return { title: null, recap: null, error: "No access token" };
  }

  try {
    analytics.capture("llm_session_recap_requested", {
      force: opts?.force === true,
    });
    const { data } = await invokeEdgeFunction<RecapResponse>({
      functionName: "session-recap",
      accessToken,
      headers: buildLlmDebugHeaders(useLlmDebugStore.getState()),
      body: { session_id: sessionId, force: opts?.force === true },
    });

    invalidateSessionsCache();

    analytics.capture("llm_session_recap_succeeded", {
      has_recap: Boolean(data.recap),
      title_len: typeof data.title === "string" ? data.title.length : 0,
    });
    return {
      title: sanitizeText(data.title) || null,
      recap: normalizeRecap(data.recap),
      error: null,
    };
  } catch (e: any) {
    console.warn("[HistoryService] generateRecap failed:", e.message);
    analytics.captureError("llm_session_recap_failed", e, {
      force: opts?.force === true,
    });
    return { title: null, recap: null, error: e.message };
  }
}

export const historyService = {
  loadSessions,
  loadSessionDetail,
  generateRecap,
  invalidateSessionsCache,
};
