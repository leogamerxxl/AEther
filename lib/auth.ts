// Aether auth seam.
//
// Two modes, one interface - so the Entry flow, AuthGate and sign-out never
// change:
//   - DEMO (default): UI gate only, session in localStorage/sessionStorage.
//   - REAL: Supabase Auth (email/password, OAuth, magic link, reset). Enabled by
//     NEXT_PUBLIC_USE_SUPABASE_AUTH=true once Supabase Auth + redirect URLs are
//     configured. We still mirror the session into local storage so getSession()
//     stays synchronous and the rest of the app is unchanged.

import type { Role } from "./ops";
import { supabase } from "./supabase";

export type Provider = "google" | "microsoft" | "apple" | "sso";
export type Session = { email: string; name?: string; role: Role };

const KEY = "aether.session";

// Flip to real Supabase Auth. Default off keeps the demo flow working offline.
const USE_SUPABASE_AUTH =
  process.env.NEXT_PUBLIC_USE_SUPABASE_AUTH === "true" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

// "Remember me" => persist across sessions (localStorage); otherwise only for the
// tab session (sessionStorage). Either way, exactly one store holds it.
function persist(s: Session, remember = true) {
  try {
    if (remember) { localStorage.setItem(KEY, JSON.stringify(s)); sessionStorage.removeItem(KEY); }
    else { sessionStorage.setItem(KEY, JSON.stringify(s)); localStorage.removeItem(KEY); }
  } catch { /* noop */ }
}

export function signOut() {
  if (USE_SUPABASE_AUTH) { void supabase.auth.signOut().catch(() => {}); }
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

// Update the current profile in-place (keeps the same store). Real effect:
// the Aether menu and greeting reflect the new name immediately. In real mode it
// also writes Supabase user_metadata (best-effort).
export function updateProfile(patch: { name?: string }): Session | null {
  const cur = getSession();
  if (!cur) return null;
  const next: Session = { ...cur, ...patch };
  const remembered = typeof window !== "undefined" && !!localStorage.getItem(KEY);
  persist(next, remembered);
  if (USE_SUPABASE_AUTH) { void supabase.auth.updateUser({ data: { name: next.name } }).catch(() => {}); }
  return next;
}

// === Supabase mapping helpers ================================================

// Build our Session from a Supabase user, preferring stored metadata.
function sessionFromUser(
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
  fallbackEmail: string,
  fallbackRole: Role,
): Session {
  const meta = user?.user_metadata ?? {};
  const role = (meta.role as Role) || fallbackRole;
  const name = typeof meta.name === "string" ? meta.name : undefined;
  return { email: user?.email ?? fallbackEmail, name, role };
}

const PROVIDER_MAP: Record<Provider, "google" | "azure" | "apple"> = {
  google: "google",
  microsoft: "azure",
  apple: "apple",
  sso: "azure",
};

// =============================================================================

export async function signIn(email: string, password: string, role: Role, remember = true): Promise<Session> {
  if (USE_SUPABASE_AUTH) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const s = sessionFromUser(data.user, email, role);
    persist(s, remember);
    return s;
  }
  const s: Session = { email, role };
  persist(s, remember);
  return s;
}

export async function signUp(name: string, email: string, password: string, role: Role, remember = true): Promise<Session> {
  if (USE_SUPABASE_AUTH) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    });
    if (error) throw error;
    const s = sessionFromUser(data.user, email, role);
    s.name = s.name ?? name;
    persist(s, remember);
    return s;
  }
  const s: Session = { email, name, role };
  persist(s, remember);
  return s;
}

export async function signInWithProvider(provider: Provider, role: Role, email?: string, remember = true): Promise<Session> {
  if (USE_SUPABASE_AUTH) {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: PROVIDER_MAP[provider],
      options: { redirectTo, queryParams: { aether_role: role } },
    });
    if (error) throw error;
    // The browser redirects to the provider; the callback completes the session.
    return { email: email ?? "", role };
  }
  const fallback =
    provider === "google" ? "you@gmail.com" :
    provider === "apple" ? "you@icloud.com" :
    provider === "microsoft" ? "you@outlook.com" : "you@company.com";
  const valid = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const s: Session = { email: valid ? (email as string) : fallback, role };
  persist(s, remember);
  return s;
}

export async function sendMagicLink(email: string): Promise<void> {
  if (USE_SUPABASE_AUTH) {
    const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
    if (error) throw error;
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (USE_SUPABASE_AUTH) {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }
}
