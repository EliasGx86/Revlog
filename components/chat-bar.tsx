"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/components/posthog-provider";

// Web Speech API types (browsers use the vendor-prefixed name)
interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}

interface Props {
  vehicleId: string;
  /** Prefills the mileage prompt so a known odometer is one tap to confirm. */
  currentMileage?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBar({ vehicleId, currentMileage }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pendingMileagePrompt, setPendingMileagePrompt] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Init Web Speech API once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).SpeechRecognition || (window as unknown as {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ");
      setInput((prev) => (prev ? prev + " " : "") + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  function toggleVoice() {
    const rec = recognitionRef.current;
    if (!rec) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
        trackEvent("voice_input_start");
      } catch {
        // already running
      }
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          message: text,
          history: messages.slice(-6),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");

      setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
      trackEvent("chat_message_sent", { intent: json.intent });

      if (json.intent === "log" && json.askMileage) {
        setPendingMileagePrompt(json.logId);
      }
      if (json.intent === "log") {
        // Server data (header mileage, alerts) changed — re-render the page.
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((m) => [...m, { role: "assistant", content: `⚠ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function submitMileage(value: number) {
    if (!pendingMileagePrompt) return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat/mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: pendingMileagePrompt, mileage: value, vehicleId }),
      });
      const json = await res.json().catch(() => ({}));
      let content = `Got it — recorded at ${value.toLocaleString()} mi.`;
      if (json.reminder) content += ` ${json.reminder}`;
      setMessages((m) => [...m, { role: "assistant", content }]);
      router.refresh();
    } finally {
      setPendingMileagePrompt(null);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* transcript (last few turns, ephemeral — server keeps the real log) */}
      {messages.length > 0 && (
        <div className="relative mb-3 rounded-xl border border-border bg-surface/80 backdrop-blur-md">
          <button
            onClick={() => setMessages([])}
            aria-label="Clear conversation"
            title="Clear conversation"
            className="absolute right-2 top-2 z-10 rounded-full border border-border bg-bg/70 px-1.5 text-xs leading-5 text-muted hover:text-white"
          >
            ✕
          </button>
          <div className="max-h-48 space-y-2 overflow-y-auto p-3 pr-8">
          {messages.slice(-6).map((m, i) => (
            <div
              key={i}
              className={`text-sm ${m.role === "user" ? "text-white" : "text-muted"}`}
            >
              <span className="mr-2 text-xs uppercase tracking-wide opacity-60">
                {m.role === "user" ? "you" : "revlog"}
              </span>
              {m.content}
            </div>
          ))}
          </div>
        </div>
      )}

      {/* common requests, one tap instead of typing — shown while the empty
          input is focused (mousedown fires before the input's blur) */}
      {focused && !input && !pendingMileagePrompt && (
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
          {[
            "Just changed my oil",
            "Put on new tires today",
            "When was my last oil change?",
            "My insurance is …",
            "What can I track?",
          ].map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput(s);
              }}
              className="rounded-full border border-border bg-surface/90 px-3 py-1 text-xs text-muted backdrop-blur-md transition hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {pendingMileagePrompt ? (
        <MileagePrompt
          initial={currentMileage}
          onSubmit={submitMileage}
          onSkip={() => setPendingMileagePrompt(null)}
        />
      ) : (
        <form
          onSubmit={send}
          className="flex items-center gap-2 rounded-full border border-border bg-surface/90 px-2 py-2 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              listening ? "bg-accent text-white" : "bg-bg text-muted hover:text-white"
            }`}
            aria-label="Toggle voice input"
          >
            {listening ? "●" : "🎙"}
          </button>
          {/* min-w-0 lets the input shrink below its placeholder's intrinsic
              width — without it the mic/send buttons get pushed off-screen
              on narrow phones */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Log a service or ask anything…"
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}

function MileagePrompt({
  initial,
  onSubmit,
  onSkip,
}: {
  initial?: number;
  onSubmit: (n: number) => void;
  onSkip: () => void;
}) {
  const [val, setVal] = useState(initial && initial > 0 ? String(initial) : "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseInt(val, 10);
        if (Number.isFinite(n) && n >= 0) onSubmit(n);
      }}
      className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-surface/90 px-2 py-2 backdrop-blur-md"
    >
      <span className="shrink-0 pl-2.5 pr-1 text-sm">Mileage?</span>
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="e.g. 87432"
        className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
      />
      <button type="button" onClick={onSkip} className="shrink-0 px-2 text-sm text-muted">
        Skip
      </button>
      <button
        type="submit"
        disabled={!val}
        className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
