import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PostHogProvider } from "@/components/posthog-provider";

export const metadata: Metadata = {
  title: "RevLog",
  description: "Talk to your car. Log maintenance and ask questions naturally.",
};

// viewport-fit=cover makes env(safe-area-inset-*) real on iOS, so the pinned
// chat bar can pad itself above the home indicator / browser chrome.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-white antialiased">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
