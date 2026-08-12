"use client";

import { createClient } from "@supabase/supabase-js";

// Browser-side client using the public anon key. Only used to upload files
// directly to Storage via signed URLs our API generates - never for
// reading/writing tables directly (RLS has no policies, so the anon key
// can't touch the database even if this file is inspected).
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
