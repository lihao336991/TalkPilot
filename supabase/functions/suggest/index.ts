import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLlmRuntime, withLlmDefaults } from "../_shared/llm.ts";

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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const sessionId = body.session_id ?? body.sessionId;
  const lastUtterance = body.last_utterance ?? body.lastUtterance;
  const scene = body.scene;

  if (typeof sessionId !== "string" || typeof lastUtterance !== "string") {
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: turns } = await supabase
    .from("turns")
    .select("speaker, text")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(10);

  const conversationHistory = (turns ?? [])
    .reverse()
    .map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
    .join("\n");

  const systemPrompt = `You are an English conversation coach. The user is practicing English in a "${scene || "general"}" scenario.

Based on the conversation so far and the last thing the other person said, generate 2 reply suggestions for the user: one formal and one casual. Each suggestion should be 1-3 sentences.

Output strictly in JSON format:
{"suggestions":[{"style":"formal","text":"..."},{"style":"casual","text":"..."}]}

Conversation so far:
${conversationHistory}

Last utterance from the other person: "${lastUtterance}"`;

  const llm = createLlmRuntime();

  const stream = await llm.client.chat.completions.create(withLlmDefaults(llm, {
    messages: [{ role: "system", content: systemPrompt }],
    stream: true,
  }));

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          controller.enqueue(encoder.encode(`data: ${content}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
