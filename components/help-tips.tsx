"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Learnability layer: a lightbulb in the home header opens a "how to use
// RevLog" sheet (works everywhere, and is the mobile answer to hover), while
// <Tip> adds hover tooltips that only appear on devices that actually have
// hover (see the @media (hover:hover) rules in globals.css) — touch users
// never see half-broken tap-tooltips.

const SEEN_KEY = "revlog_help_seen";

/** Hover tooltip on hover-capable devices; inert wrapper on touch. */
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="tip-parent relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="tip-bubble pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] text-white shadow-xl"
      >
        {label}
      </span>
    </span>
  );
}

const TIPS: { icon: string; title: string; body: string }[] = [
  {
    icon: "💬",
    title: "Just talk to it",
    body: "The chat bar understands plain English: “logged an oil change today at 82,300 miles”, “when did I last rotate my tires?”, or “my insurance is Progressive, policy ABC-123”. Tap the mic to speak instead of type.",
  },
  {
    icon: "🚗",
    title: "Your vehicle is the record",
    body: "Drag to spin it. Click the hood (or engine on a bike), wheels, or windshield to see that area's service history and what's trackable there.",
  },
  {
    icon: "⛽",
    title: "Keep mileage fresh",
    body: "When the app asks for your current mileage, answer in the chat — alerts and service intervals depend on it.",
  },
  {
    icon: "🗂",
    title: "Glovebox",
    body: "Store photos and PDFs per vehicle — registration, insurance card, receipts — in the Glovebox, from the button in the top bar.",
  },
  {
    icon: "ⓘ",
    title: "Vehicle info",
    body: "Tap the vehicle name (top-left) for VIN, plate, mileage, and insurance at a glance. Click-to-copy on VIN and policy number.",
  },
  {
    icon: "🏍",
    title: "More vehicles",
    body: "“+ Add vehicle” puts another car, truck, SUV, or motorcycle in your garage; switch between them from the dropdown.",
  },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true); // assume seen until we know (no flash)

  useEffect(() => {
    // Hydration-safe localStorage read: the server must render "seen" (no
    // pulse) and only the client can know otherwise, so this state genuinely
    // belongs in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeen(localStorage.getItem(SEEN_KEY) === "1");
  }, []);

  function toggle() {
    if (!seen) {
      localStorage.setItem(SEEN_KEY, "1");
      setSeen(true);
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <Tip label="How to use RevLog">
        <button
          onClick={toggle}
          aria-label="How to use RevLog"
          className={`rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-sm transition hover:text-white ${
            seen ? "text-muted" : "help-pulse text-accent"
          }`}
        >
          💡
        </button>
      </Tip>

      {/* Portal: this button lives inside the header (its own stacking
          context), so without a portal the sheet renders BEHIND the chat. */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                <span className="mr-2">💡</span>How to use RevLog
              </h2>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                ✕
              </button>
            </div>

            <ul className="mt-4 space-y-4">
              {TIPS.map((t) => (
                <li key={t.title} className="flex gap-3">
                  <span className="mt-0.5 text-lg leading-none">{t.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted">
              Stuck? Ask the chat bar — “what can you do?” works too.
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
