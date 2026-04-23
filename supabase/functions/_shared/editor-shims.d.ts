// Editor/TS shims for Supabase Edge Functions (Deno runtime).
// This file is referenced via triple-slash in function entry files to silence
// TypeScript diagnostics in a Node/React Native workspace. It has no runtime effect.

declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export { createClient } from "@supabase/supabase-js";
}

declare module "https://esm.sh/openai@4" {
  const OpenAI: any;
  export default OpenAI;
}
