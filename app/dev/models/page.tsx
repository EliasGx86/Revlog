"use client";

// Dev-only viewer for iterating on the procedural 3D models without signing in.
// 404s in production; /dev is whitelisted in middleware.ts.

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { useState } from "react";
import type { BodyType } from "@/lib/types";

const CarScene = dynamic(() => import("@/components/car/car-scene"), { ssr: false });

// In a hidden/non-composited tab ResizeObserver callbacks never run, which
// keeps react-three-fiber from ever mounting the scene. Replace it with a
// polling version so this page also works for headless snapshot tooling.
declare global {
  interface Window {
    __roShimmed?: boolean;
  }
}
if (typeof window !== "undefined" && !window.__roShimmed) {
  window.__roShimmed = true;
  window.ResizeObserver = class {
    private cb: ResizeObserverCallback;
    private els = new Set<Element>();
    private timer: ReturnType<typeof setInterval>;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
      this.timer = setInterval(() => this.measure(), 300);
    }
    observe(el: Element) {
      this.els.add(el);
      // Defer: a synchronous callback here fires setState during React render.
      setTimeout(() => this.measure(), 0);
    }
    unobserve(el: Element) {
      this.els.delete(el);
    }
    disconnect() {
      this.els.clear();
      clearInterval(this.timer);
    }
    private measure() {
      if (!this.els.size) return;
      const entries = [...this.els].map((el) => ({
        target: el,
        contentRect: el.getBoundingClientRect(),
      })) as unknown as ResizeObserverEntry[];
      this.cb(entries, this as unknown as ResizeObserver);
    }
  } as unknown as typeof ResizeObserver;
}

const TYPES: BodyType[] = ["sedan", "suv", "truck", "motorcycle"];
const SWATCHES = ["#cc2222", "#1e4fd8", "#f2f2f2", "#111114", "#c7c9cc", "#e46b1a", "#1f7a3d"];

export default function ModelDevPage() {
  const [bodyType, setBodyType] = useState<BodyType>("sedan");
  const [color, setColor] = useState("#cc2222");
  const [plate, setPlate] = useState("REV 402");

  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0">
        <CarScene
          bodyType={bodyType}
          color={color}
          licensePlate={plate}
          onZoneClick={() => {}}
          preserveBuffer
        />
      </div>
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface/80 px-3 py-2 backdrop-blur">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setBodyType(t)}
            className={`rounded-full px-3 py-1 text-xs capitalize ${
              bodyType === t ? "bg-accent text-white" : "text-muted hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={c}
            className={`h-5 w-5 rounded-full border ${
              color === c ? "border-white" : "border-border"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <input
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="plate"
          className="w-20 rounded-md border border-border bg-transparent px-2 py-0.5 text-xs"
        />
      </div>
    </div>
  );
}
