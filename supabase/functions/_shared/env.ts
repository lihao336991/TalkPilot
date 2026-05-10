export function getSupabaseUrl() {
  return Deno.env.get("TALKPILOT_SUPABASE_URL") ?? "";
}

export function getSupabaseAnonKey() {
  return Deno.env.get("TALKPILOT_SUPABASE_ANON_KEY") ?? "";
}

export function getSupabaseServiceRoleKey() {
  return Deno.env.get("TALKPILOT_SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
