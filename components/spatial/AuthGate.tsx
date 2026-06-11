"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Mail, KeyRound, Eye, EyeOff, Sparkles, Check } from "lucide-react";
import { signIn, signUp, signInWithProvider, sendMagicLink, type Session, type Provider } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/ops";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { AuthBackdrop } from "@/components/ui/auth-backdrop";
import { ResetPasswordForm } from "@/components/ui/reset-password-form";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";
type View = "auth" | "reset";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" /><path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.45 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function Field({ label, labelRight, type, value, onChange, placeholder, autoFocus, icon, trailing }: { label: string; labelRight?: React.ReactNode; type: string; value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; icon?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[.13em] text-white/40">{label}</span>
        {labelRight}
      </div>
      <div className="relative">
        {icon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">{icon}</span> : null}
        <input
          type={type}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-white/25 focus:bg-white/[.06]", icon && "pl-10", trailing && "pr-11")}
        />
        {trailing ? <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </div>
    </label>
  );
}

const PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  { id: "google", label: "Google", icon: <GoogleIcon className="size-4" /> },
  { id: "microsoft", label: "Microsoft", icon: <MicrosoftIcon className="size-4" /> },
  { id: "apple", label: "Apple", icon: <AppleIcon className="size-4 text-white" /> },
  { id: "sso", label: "SSO", icon: <KeyRound className="size-4 text-white/70" /> },
];

export default function AuthGate({ onAuthed, onClose }: { onAuthed: (s: Session) => void; onClose?: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [view, setView] = useState<View>("auth");
  const [role, setRole] = useState<Role>("owner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    if (mode === "signup" && name.trim().length < 2) return setError("Enter your name.");
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "signup" && password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const s = mode === "login" ? await signIn(email, password, role, remember) : await signUp(name.trim(), email, password, role, remember);
      onAuthed(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const social = async (provider: Provider) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const s = await signInWithProvider(provider, role, email, remember);
      onAuthed(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const forgot = () => {
    if (!EMAIL_RE.test(email)) return setError("Enter your email above, then tap reset.");
    setError(null);
    setView("reset");
  };

  const magicLink = async () => {
    if (!EMAIL_RE.test(email)) return setError("Enter your email for a sign-in link.");
    setError(null);
    await sendMagicLink(email);
    toast("Sign-in link sent to " + email);
  };

  return (
    <div className="fixed inset-0 z-[95] grid h-[100dvh] w-full place-items-center overflow-y-auto px-5 py-10" style={{ background: "rgba(2,3,5,.72)", backdropFilter: "blur(7px)" }}>
      <AuthBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="relative z-10 w-full max-w-[400px]"
      >
        {onClose ? (
          <button onClick={onClose} aria-label="Close" className="gx gx-bento absolute -right-1 -top-10 grid size-9 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:text-white"><X className="size-4" /></button>
        ) : null}

        <div className="mb-6 text-center">
          <div className="text-[30px] font-extralight tracking-[0.16em] text-white" style={{ textShadow: "0 0 30px rgba(200,161,101,0.25)" }}>&AElig;ther</div>
          <div className="mt-2 text-[12px] text-white/40">Coastal revenue &amp; operations intelligence</div>
        </div>

        {view === "reset" ? (
          <ResetPasswordForm
            email={email}
            onVerifyCode={async (code) => { await new Promise((r) => setTimeout(r, 650)); return /^\d{6}$/.test(code); }}
            onSubmit={async () => { toast("Password updated - sign in with your new password."); setPassword(""); setView("auth"); }}
            onCancel={() => { setError(null); setView("auth"); }}
          />
        ) : (
          <>
            <div className="gx gx-bento p-7">
              <h1 className="text-[20px] font-semibold tracking-[-.01em] text-white">{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
              <p className="mt-1.5 text-[13px] text-white/45">{mode === "login" ? "Sign in to your command center." : "Start your Hotel Terra pilot."}</p>

              <div className="mt-5">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[.13em] text-white/40">I sign in as</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {ROLES.map((r) => (
                    <button key={r.id} type="button" onClick={() => setRole(r.id)} className={"cursor-pointer rounded-lg px-2 py-2 text-[12px] font-medium transition-colors " + (role === r.id ? "gx-metal" : "gx-ghost text-white/65 hover:text-white")}>{r.label}</button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[.13em] text-white/40">Continue with</div>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <button key={p.id} type="button" disabled={busy} onClick={() => social(p.id)} className="gx-ghost flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-white/85 transition-colors disabled:opacity-50">
                      {p.icon}<span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/[.08]" />
                <span className="text-[10px] uppercase tracking-[.18em] text-white/30">or</span>
                <span className="h-px flex-1 bg-white/[.08]" />
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" ? <Field label="Full name" type="text" value={name} onChange={setName} placeholder="Leonardo Cozaciuc" /> : null}
                <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@hotel.com" autoFocus={mode === "login"} icon={<Mail className="size-4" />} />
                <Field
                  label="Password"
                  labelRight={mode === "login" ? <button type="button" onClick={forgot} className="cursor-pointer text-[12px] font-medium text-white/55 hover:text-white">Forgot password?</button> : undefined}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 6 characters"
                  icon={<KeyRound className="size-4" />}
                  trailing={<button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)} className="grid size-8 cursor-pointer place-items-center rounded-md text-white/40 transition-colors hover:text-white/80">{showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}
                />
                {mode === "signup" ? <Field label="Confirm password" type={showPw ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="Repeat password" icon={<KeyRound className="size-4" />} /> : null}

                {mode === "login" ? (
                  <button type="button" role="checkbox" aria-checked={remember} onClick={() => setRemember((r) => !r)} className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-white/55 transition-colors hover:text-white/80">
                    <span className={cn("grid size-4 place-items-center rounded border transition-colors", remember ? "border-white/30 bg-white text-[#0b0b0d]" : "border-white/20 bg-white/[.04]")}>
                      {remember ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    Remember me
                  </button>
                ) : null}

                {error ? <div className="rounded-lg border border-[#ef8b7a]/30 bg-[#ef8b7a]/10 px-3.5 py-2.5 text-[12.5px] text-[#f2a594]">{error}</div> : null}

                <button type="submit" className="sr-only" aria-hidden tabIndex={-1}>Submit</button>

                <div className="flex justify-center pt-1">
                  <LiquidMetalButton width={336} onClick={() => submit()} label={busy ? (mode === "login" ? "Signing in..." : "Creating...") : (mode === "login" ? "Sign in" : "Create workspace")} />
                </div>
              </form>

              <button type="button" onClick={magicLink} className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/55 transition-colors hover:bg-white/[.05] hover:text-white">
                <Sparkles className="size-4" /> Or email me a sign-in link
              </button>

              <div className="mt-4 text-center text-[12.5px] text-white/45">
                {mode === "login" ? "New to Aether? " : "Already have an account? "}
                <button onClick={() => { setError(null); setMode(mode === "login" ? "signup" : "login"); }} className="cursor-pointer font-medium text-white/85 underline-offset-4 hover:underline">
                  {mode === "login" ? "Create a workspace" : "Sign in"}
                </button>
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-white/30">
              By continuing you agree to our{" "}
              <button type="button" onClick={() => toast("Terms of Service - coming soon")} className="cursor-pointer text-white/55 underline underline-offset-2 hover:text-white">Terms of Service</button>
              {" & "}
              <button type="button" onClick={() => toast("Privacy Policy - coming soon")} className="cursor-pointer text-white/55 underline underline-offset-2 hover:text-white">Privacy Policy</button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
