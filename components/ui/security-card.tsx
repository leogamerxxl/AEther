"use client";

// Adapted from the 21st.dev "security-card" - retargeted to framer-motion + lucide,
// styled to match Aether popups (gx-bento: 20px radius, matte bg, border, shadow),
// with the scan line rendered as flowing liquid metal (chrome gradient) not cyan.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const CARD_BG = "#101216";

const SCRAMBLED_STRINGS = [
  "6*7A0^!HIETD@6XS749%2$4L4RO$SH*8W#6OPLLF%WSKVI^PTT1PJUOS60EQL$*K53*Y#AK5GDM6XIWX79XR^DQOMEJF$F1ZNL*L0Z&#LJ4B$E97Q76VF0U#HY!37J5$GKCI0RMK$2P1F9JJYGVR@IAHYPZALXQMJ!519!GZTQSA$#BEXUYPSZ302Z*&DDWW!NI61S#!MAHJ0Y&3J8*EBIMM$#X%46NJ0*9P3L@UW5A8NCZX&98CQ75NL9XEH11NBB^E&LQ1YPZALMJ3DSUXBS9*DADQ7ND0SCI",
  "Y4#!I*ZO1QCFU07QJFDVW#6$17$WW^#7MR5Q50I^2FFKJQW1&1%94ABU&$TX$RRTXT3P!4JPK3^A12&DQ15S08%Q^X*GUE761@6S5DA*HACX9@AS3B04YQ5*VD1*$XX9ECF4B9%O^^LGNDKT%FT2Y2SDC0M!GCNSPVWVNBAWEPT3Q2XK6M877&Q838ZWKGW8*SVG241H51EB2SU1QZL56OR44Q$95ZEDFOVS#AL@C%FEYKZEPI*F&EQUT^65O68J3Q9O^YACNTNVMAK4S#MRM!V@GOKPV0HO2IN",
  "4HM5$8&ZBKCL0G$2ZE7OAZHBUDZXDJW81WD7YDH7##HO7VM84J&@&PV^7YACYLRBWI2HDUW9@!I#H@3%HN%AD@!ED0FOPL#4N8X%LO31#T9N1!HWCAP9DY!KQ5AEMFLF6#DK#4AX70^HXSGH2Y1XJCALNF5XYZ0L28%THU@X&83MKC4R%LZ1J8B86NW1Z$Q8^6J6FP&%PXQ7#LUHV21UM^3K%LYDYO2KWZT!3&WB51UJXJ2Y8!$D7G54RUZEI78^G&1MD%8*5NGKU201%G@FY@CE8$4BG",
  "IZE$@GCC&9OEB%@LLRX%IJ!VILBQ$%K#XALOTXTQD1%J82QSFUS512FRQHSO@#R#MK0C0@686S$XS1EPS0YLQ!%TL374LL#Y@DL4&1G85XA6S59K99DWZ8@LEVWAK94Y99VDSXS^V$71J092U2V#AB*@*45AZXIGVM^08V1&F1#!ST5PP7WBR*RE1SZ%UCJNMHP#^DJ0O1JAZIGPB7%V7DBQ^CKZ^6B^Q510BMK8Y3TA&@HZAHYCMG1J9Y1FOQ2TS3M$A@R%5^X",
];

function InfiniteScrambler() {
  const [text, setText] = useState(SCRAMBLED_STRINGS[0]);
  const index = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      index.current = (index.current + 1) % SCRAMBLED_STRINGS.length;
      setText(SCRAMBLED_STRINGS[index.current]);
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="absolute top-[14%] w-full px-6">
      <p className="whitespace-normal break-words font-mono text-[12px] leading-[1.25] text-white/25">{text}</p>
    </div>
  );
}

function ContainerMask() {
  return (
    <>
      <div className="absolute left-0 top-0 h-full w-[70px]" style={{ backgroundImage: `linear-gradient(to right, ${CARD_BG} 16%, transparent 100%)` }} />
      <div className="absolute right-0 top-0 h-full w-[70px]" style={{ backgroundImage: `linear-gradient(to left, ${CARD_BG} 16%, transparent 100%)` }} />
    </>
  );
}

function FaceCard() {
  return (
    <svg viewBox="0 0 80 96" fill="none" className="absolute inset-0 h-full w-full" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
      <defs>
        <linearGradient id="lmScan" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#8d8d92" />
          <stop offset="22%" stopColor="#f6f6f8" />
          <stop offset="48%" stopColor="#b4b4ba" />
          <stop offset="74%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#9a9aa0" />
          <animateTransform attributeName="gradientTransform" type="translate" values="-0.5 -0.5; 0.5 0.5; -0.5 -0.5" dur="3.6s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <path d="M26.22 78.25c2.679-3.522 1.485-17.776 1.485-17.776-1.084-2.098-1.918-4.288-2.123-5.619-3.573 0-3.7-8.05-3.827-9.937-.102-1.509 1.403-1.383 2.169-1.132-.298-1.3-.92-5.408-1.021-11.446C22.775 24.794 30.94 17.75 40 17.75h.005c9.059 0 17.225 7.044 17.097 14.59-.102 6.038-.723 10.147-1.021 11.446.765-.251 2.271-.377 2.169 1.132-.128 1.887-.254 9.937-3.827 9.937-.205 1.331-1.039 3.521-2.123 5.619 0 0-1.194 14.254 1.485 17.776" className="stroke-neutral-700" />
      <path d="M27.705 60.474a26.884 26.884 0 0 0 1.577 2.682c1.786 2.642 5.36 6.792 10.718 6.792h.005c5.358 0 8.932-4.15 10.718-6.792a26.884 26.884 0 0 0 1.577-2.682" className="stroke-neutral-700" />
      <path d="M26.22 78.25c2.679-3.522 1.485-17.776 1.485-17.776-1.084-2.098-1.918-4.288-2.123-5.619-3.573 0-3.7-8.05-3.827-9.937-.102-1.509 1.403-1.383 2.169-1.132-.298-1.3-.92-5.408-1.021-11.446C22.775 24.794 30.94 17.75 40 17.75h.005c9.059 0 17.225 7.044 17.097 14.59-.102 6.038-.723 10.147-1.021 11.446.765-.251 2.271-.377 2.169 1.132-.128 1.887-.254 9.937-3.827 9.937-.205 1.331-1.039 3.521-2.123 5.619 0 0-1.194 14.254 1.485 17.776" stroke="url(#lmScan)" className="animate-draw-outline [filter:drop-shadow(0_0_5px_rgba(255,255,255,.45))]" />
      <path d="M27.705 60.474a26.884 26.884 0 0 0 1.577 2.682c1.786 2.642 5.36 6.792 10.718 6.792h.005c5.358 0 8.932-4.15 10.718-6.792a26.884 26.884 0 0 0 1.577-2.682" stroke="url(#lmScan)" className="animate-draw [filter:drop-shadow(0_0_5px_rgba(255,255,255,.45))]" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <div className="relative">
      <svg width="18" height="18">
        <motion.circle cx="9" cy="9" r="6" fill="#dcdce0" className="[filter:drop-shadow(0_0_2px_rgba(255,255,255,.5))]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 2.3 }} />
      </svg>
      <motion.div className="absolute left-[4px] top-[4px] flex items-center justify-center text-[#0b0b0d]" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 2.4 }}>
        <Check className="size-2.5" strokeWidth={3.5} />
      </motion.div>
    </div>
  );
}

export default function SecurityCard({ name = "Account", email = "" }: { name?: string; email?: string }) {
  return (
    <div className="gx-bento relative flex h-[26rem] w-[384px] max-w-[calc(100vw-2.5rem)] items-center justify-center overflow-hidden" style={{ background: CARD_BG }}>
      <InfiniteScrambler />
      <ContainerMask />

      <div className="absolute bottom-0 h-1/2 w-[150%] rounded-t-[60%] bg-gradient-to-b from-[#17181c] to-[#0a0a0c] shadow-[0_0_900px_rgba(10,10,10,0.9)]" />

      <div className="absolute top-[68%] flex h-12 w-full flex-col items-center justify-center gap-1">
        <div className="flex items-center justify-center gap-1.5 text-[13px] text-white/85">
          <motion.p initial={{ x: 8 }} animate={{ x: -2 }} transition={{ duration: 0.4, ease: "easeInOut", delay: 1.8 }}>{name}</motion.p>
          <CheckCircle />
        </div>
        <div className="text-[11px] text-white/40">{email}</div>
      </div>

      <div className="relative rounded-[3px] bg-white/[.04] px-[3px] py-[3.2px]">
        <div className="relative h-32 w-24 rounded-[3px] bg-gradient-to-br from-[#1a1c20] to-[#101216]">
          <FaceCard />
        </div>
      </div>

      <div className="absolute left-0 top-0 h-[180px] w-full" style={{ backgroundImage: `linear-gradient(to bottom, ${CARD_BG} 32%, transparent 100%)` }} />

      <div className="absolute left-0 top-5 w-full px-6">
        <h3 className="text-[15px] font-semibold text-white">Smart Access Control</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-white/45">
          Verifying this login against real-time signals &mdash; device, location, and context.
        </p>
      </div>
    </div>
  );
}
