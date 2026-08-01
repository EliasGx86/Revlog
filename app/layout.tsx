import type { Metadata } from "next";
import "./globals.css";
import { PostHogProvider } from "@/components/posthog-provider";

export const metadata: Metadata = {
  title: "GarageIQ",
  description: "Talk to your car. Log maintenance and ask questions naturally.",
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
