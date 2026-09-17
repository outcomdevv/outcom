import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Component cookie writes are handled by middleware. */ }
      },
    },
  });
}

/**
 * Server-only Supabase admin client.
 *
 * Supabase now calls the server-side key a "secret key" (sb_secret_...),
 * while older projects expose the legacy service-role key. Accept both so a
 * Vercel deployment does not unexpectedly crash the authenticated app when
 * the project has been configured with the newer key name.
 */
export function createSupabaseServiceClient() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
