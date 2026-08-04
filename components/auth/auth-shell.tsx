"use client";

import Link from "next/link";
import { useState } from "react";
import { Chakra_Petch } from "next/font/google";

// Shared chrome for the sign-in / sign-up screens: "the garage at night".
// Instrument-cluster tachometer with a needle sweep on load, a horizon glow
// that echoes the 3D showroom floor, and a condensed technical display face
// for the wordmark. All motion is CSS-only (see globals.css "auth-*" rules).

const display = Chakra_Petch({
  weight: ["500", "600"],
  subsets: ["latin"],
  display: "swap",
});

function Tachometer() {
  // 270° sweep, 0–8 (x1000 rpm), redline from 6.5. Needle rest angle -225°
  // (pointing at 0); CSS animates a sweep to -45° and back to a low idle.
  const ticks = [];
  for (let i = 0; i <= 16; i++) {
    const major = i % 2 === 0;
    const angle = (-225 + i * (270 / 16)) * (Math.PI / 180);
    const r1 = major ? 74 : 80;
    const r2 = 88;
    const redline = i >= 13;
    ticks.push(
      <line
        key={i}
        x1={100 + r1 * Math.cos(angle)}
        y1={100 + r1 * Math.sin(angle)}
        x2={100 + r2 * Math.cos(angle)}
        y2={100 + r2 * Math.sin(angle)}
        stroke={redline ? "#ff5722" : "#3a3a40"}
        strokeWidth={major ? 3 : 1.5}
      />
    );
  }
  const labels = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const angle = (-225 + n * (270 / 8)) * (Math.PI / 180);
    return (
      <text
        key={n}
        x={100 + 60 * Math.cos(angle)}
        y={100 + 60 * Math.sin(angle)}
        textAnchor="middle"
        dominantBaseline="central"
        fill={n >= 7 ? "#ff5722" : "#6a6a72"}
        fontSize="11"
        fontFamily="inherit"
      >
        {n}
      </text>
    );
  });

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      {/* bezel */}
      <circle cx="100" cy="100" r="96" fill="#0d0d0f" stroke="#26262a" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="#1a1a1e" />
      {ticks}
      {labels}
      <text
        x="100"
        y="142"
        textAnchor="middle"
        fill="#4a4a52"
        fontSize="9"
        letterSpacing="2"
      >
        RPM ×1000
      </text>
      {/* needle */}
      {/* base transform = idle pose, shown when reduced-motion disables the sweep */}
      <g
        className="auth-needle"
        style={{ transformOrigin: "100px 100px", transform: "rotate(-107deg)" }}
      >
        <line x1="100" y1="100" x2="100" y2="22" stroke="#ff5722" strokeWidth="3" strokeLinecap="round" />
        <line x1="100" y1="100" x2="100" y2="112" stroke="#ff5722" strokeWidth="5" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="7" fill="#141416" stroke="#3a3a40" strokeWidth="2" />
    </svg>
  );
}

interface Props {
  children: React.ReactNode;
}

export default function AuthShell({ children }: Props) {
  return (
    <main
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 ${display.className}`}
    >
      {/* horizon glow — echo of the showroom floor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% 100%, rgba(255,87,34,0.09), rgba(38,38,42,0.25) 45%, transparent 75%)",
        }}
      />
      {/* floor line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[18%] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,87,34,0.35) 30%, rgba(255,255,255,0.16) 50%, rgba(255,87,34,0.35) 70%, transparent)",
        }}
      />
      {/* fine grain */}
      <div aria-hidden className="auth-grain pointer-events-none absolute inset-0" />

      <div className="relative grid w-full max-w-4xl items-center gap-10 py-16 md:grid-cols-[1fr_minmax(0,22rem)] md:gap-16">
        {/* brand / instrument panel */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="auth-rise h-44 w-44 md:h-56 md:w-56" style={{ animationDelay: "0ms" }}>
            <Tachometer />
          </div>
          <h1
            className="auth-rise mt-6 text-5xl font-semibold tracking-tight md:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Rev<span className="text-accent">Log</span>
          </h1>
          <p
            className="auth-rise mt-3 max-w-xs text-sm leading-relaxed text-muted"
            style={{ animationDelay: "160ms" }}
          >
            Your garage, in your pocket. Log maintenance, ask questions, and
            keep every vehicle&apos;s history — just by talking to it.
          </p>
        </div>

        {/* form card */}
        <div
          className="auth-rise rounded-2xl border border-border bg-surface/70 p-6 shadow-2xl backdrop-blur-sm"
          style={{ animationDelay: "240ms" }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

/** Consistent input styling for the auth forms. */
export function AuthField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <input
        {...rest}
        className="w-full rounded-md border border-border bg-bg/70 px-3 py-2 text-sm outline-none transition-colors focus:border-accent/70 focus:ring-1 focus:ring-accent/40"
      />
    </label>
  );
}

/** Password input with a show/hide eye toggle so typos are catchable. */
export function AuthPasswordField(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }
) {
  const { label, ...rest } = props;
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <div className="relative">
        <input
          {...rest}
          type={visible ? "text" : "password"}
          className="w-full rounded-md border border-border bg-bg/70 px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-accent/70 focus:ring-1 focus:ring-accent/40"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition hover:text-white"
        >
          {visible ? (
            /* eye-off */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            /* eye */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

export function AuthSwitchLink({
  prompt,
  href,
  cta,
}: {
  prompt: string;
  href: string;
  cta: string;
}) {
  return (
    <p className="text-center text-xs text-muted">
      {prompt}{" "}
      <Link href={href} className="text-white underline decoration-accent/60 underline-offset-4 hover:decoration-accent">
        {cta}
      </Link>
    </p>
  );
}
