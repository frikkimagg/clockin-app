import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the service role key, which must NEVER be exposed
// to the browser. This file should only ever be imported from API routes
// (app/api/**) or other server-side code, never from a "use client" component.
export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
