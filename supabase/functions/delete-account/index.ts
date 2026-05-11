/// <reference path="../_shared/editor-shims.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "../_shared/env.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

function logDeleteAccount(stage: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      scope: "delete-account",
      stage,
      ...payload,
    }),
  );
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase function configuration" }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    );
  }

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();

    if (authError || !user) {
      logDeleteAccount("auth_failed", {
        error: authError?.message ?? null,
      });
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "auth_required" }),
        {
          status: 401,
          headers: JSON_HEADERS,
        },
      );
    }

    if (user.is_anonymous) {
      logDeleteAccount("anonymous_rejected", {
        userId: user.id,
      });
      return new Response(
        JSON.stringify({
          error: "Anonymous users do not have a deletable account",
          code: "anonymous_account_not_supported",
        }),
        {
          status: 400,
          headers: JSON_HEADERS,
        },
      );
    }

    logDeleteAccount("received", {
      userId: user.id,
      provider: user.app_metadata?.provider ?? null,
    });

    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      logDeleteAccount("delete_failed", {
        userId: user.id,
        error: deleteError.message,
      });
      throw deleteError;
    }

    logDeleteAccount("deleted", {
      userId: user.id,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        deleted_user_id: user.id,
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete account";
    logDeleteAccount("unhandled_error", {
      error: message,
    });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
