import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. Never import this from
// client components — it must only run in API routes / server code.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
