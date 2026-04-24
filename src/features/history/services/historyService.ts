import { supabase } from "@/shared/api/supabase";
import { invokeEdgeFunction } from "@/shared/api/request";
import { useAuthStore } from "@/shared/store/authStore";

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

  const next = (data ?? []) as HistorySession[];
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
      session: sessionRes.data as HistorySession,
      turns: (turnsRes.data ?? []) as HistoryTurn[],
      reviews: (reviewsRes.data ?? []) as HistoryReview[],
    },
    error: null,
  };
}

async function generateRecap(
  sessionId: string,
): Promise<{ title: string | null; recap: SessionRecap | null; error: string | null }> {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    return { title: null, recap: null, error: "No access token" };
  }

  try {
    const { data } = await invokeEdgeFunction<RecapResponse>({
      functionName: "session-recap",
      accessToken,
      body: { session_id: sessionId },
    });

    invalidateSessionsCache();

    return {
      title: data.title ?? null,
      recap: data.recap ?? null,
      error: null,
    };
  } catch (e: any) {
    console.warn("[HistoryService] generateRecap failed:", e.message);
    return { title: null, recap: null, error: e.message };
  }
}

export const historyService = {
  loadSessions,
  loadSessionDetail,
  generateRecap,
  invalidateSessionsCache,
};
