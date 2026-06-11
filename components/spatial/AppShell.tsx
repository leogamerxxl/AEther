"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import CoastalCommandCenter from "./CoastalCommandCenter";
import StaffFeed from "./StaffFeed";
import { Toaster } from "./Toast";
import { ROLES, type Role } from "@/lib/ops";

export default function AppShell({ onSignOut }: { onSignOut?: () => void }) {
  const [persona, setPersona] = useState<Role>("owner");
  const isCommand = persona === "owner" || persona === "manager";
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {isCommand ? <CoastalCommandCenter /> : <StaffFeed role={persona} />}

      {/* demo persona switch - in production the signed-in role fixes this (auth + RLS) */}
      <div className="gx gx-bento fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2 py-1.5">
        <span className="px-2 text-[10px] font-medium uppercase tracking-[.16em] text-white/35">View as</span>
        {ROLES.map((r) => (
          <button key={r.id} onClick={() => setPersona(r.id)} className={"cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors " + (persona === r.id ? "bg-white text-[#0b0b0d]" : "text-white/65 hover:text-white")}>{r.label}</button>
        ))}
        {onSignOut ? (
          <>
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            <button onClick={onSignOut} aria-label="Sign out" className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/50 transition-colors hover:text-white">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </>
        ) : null}
      </div>

      <Toaster />
    </div>
  );
}
