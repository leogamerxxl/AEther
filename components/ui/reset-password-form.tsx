"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { LiquidMetalChip } from "@/components/ui/liquid-metal-surface";
import { cn } from "@/lib/utils";

interface ResetPasswordFormProps {
  email: string;
  onVerifyCode: (code: string) => Promise<boolean>;
  onSubmit: (password: string) => Promise<void>;
  onCancel?: () => void;
}

function Requirement({ met, text }: { met: boolean; text: string }) {
  const Icon = met ? CheckCircle2 : XCircle;
  return (
    <motion.div
      className={cn("flex items-center gap-2 text-[12px]", met ? "text-[#5fd0a0]" : "text-white/40")}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Icon className="size-3.5 shrink-0" />
      {text}
    </motion.div>
  );
}

export function ResetPasswordForm({ email, onVerifyCode, onSubmit, onCancel }: ResetPasswordFormProps) {
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const requirements = useMemo(() => [
    { text: "At least 8 characters", met: password.length >= 8 },
    { text: "A lowercase letter", met: /[a-z]/.test(password) },
    { text: "An uppercase letter", met: /[A-Z]/.test(password) },
    { text: "A number", met: /[0-9]/.test(password) },
  ], [password]);
  const allMet = requirements.every((r) => r.met);

  const verify = async (code: string) => {
    setVerifying(true);
    setError(null);
    const ok = await onVerifyCode(code);
    if (ok) setVerified(true);
    else { setError("Invalid code. Please try again."); setOtp(""); refs.current[0]?.focus(); }
    setVerifying(false);
  };

  const onOtpChange = (index: number, value: string) => {
    if (value && Number.isNaN(Number(value))) return;
    const next = otp.split("");
    next[index] = value;
    const joined = next.join("");
    setOtp(joined);
    if (value && index < 5) refs.current[index + 1]?.focus();
    if (joined.replace(/\s/g, "").length === 6) verify(joined);
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) refs.current[index - 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d{6}$/.test(data)) { setOtp(data); refs.current[5]?.focus(); verify(data); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verified || !allMet || submitting) return;
    setSubmitting(true);
    await onSubmit(password);
    setSubmitting(false);
  };

  return (
    <div className="gx gx-bento p-7">
      <h1 className="text-[20px] font-semibold tracking-[-.01em] text-white">Reset password</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
        Enter the 6-digit code sent to <span className="font-medium text-white/80">{email}</span>.
      </p>

      <form onSubmit={submit} className="mt-6">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-center gap-2" onPaste={onPaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] || ""}
                  onChange={(e) => onOtpChange(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  disabled={verified || verifying}
                  aria-label={"Digit " + (i + 1)}
                  className="h-12 w-11 rounded-xl border border-white/10 bg-white/[.04] text-center text-[18px] font-semibold text-white outline-none transition-colors focus:border-white/30 focus:bg-white/[.06] disabled:opacity-60"
                />
              ))}
            </div>
            {verifying ? <p className="text-center text-[12.5px] text-white/45">Verifying...</p> : null}
            {error ? <p className="text-center text-[12.5px] text-[#f2a594]">{error}</p> : null}
            {verified ? (
              <motion.div className="flex items-center justify-center gap-2 text-[12.5px] text-[#5fd0a0]" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                <CheckCircle2 className="size-4" /> Code verified
              </motion.div>
            ) : null}
          </div>

          <div className="h-px bg-white/[.08]" />

          <AnimatePresence>
            {verified ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.45, ease: "easeInOut" }} className="overflow-hidden">
                <div className="space-y-3 pt-1">
                  <div className="text-[11px] font-medium uppercase tracking-[.13em] text-white/40">New password</div>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 pr-11 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-white/25 focus:bg-white/[.06]"
                    />
                    <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((s) => !s)} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-white/40 transition-colors hover:text-white/80">
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                    {requirements.map((r) => <Requirement key={r.text} met={r.met} text={r.text} />)}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-7 flex items-center justify-end gap-3">
          {onCancel ? (
            <LiquidMetalChip type="button" variant="dark" onClick={onCancel} className="h-11 rounded-xl px-5 text-[13px] font-semibold">Cancel</LiquidMetalChip>
          ) : null}
          <LiquidMetalChip type="submit" variant="light" disabled={!verified || !allMet || submitting} className="h-11 rounded-xl px-6 text-[13px] font-semibold">
            {submitting ? "Resetting..." : "Reset password"}
          </LiquidMetalChip>
        </div>
      </form>
    </div>
  );
}
