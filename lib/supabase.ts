import { createClient } from "@supabase/supabase-js";

// Browser client (publishable/anon key, client-safe). Reads RLS-protected data.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
);
