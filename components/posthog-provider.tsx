"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
    initialized = true;
  }, []);
  return <>{children}</>;
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(name, props);
}

export function identifyUser(id: string, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.identify(id, props);
}
