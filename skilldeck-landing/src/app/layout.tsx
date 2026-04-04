import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { LinguiClientProvider } from "@/contexts/LinguiProvider";
import { ABTestProvider } from "@/contexts/ABTestContext";
import { UTMProvider } from "@/contexts/UTMContext";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SkillDeck -- Your AI Workflow. Your Machine. Your Rules.",
    template: "%s | SkillDeck",
  },
  description:
    "A local-first desktop app that brings multi-agent orchestration, visual workflows, and full model control to one native interface. Your code never leaves your machine.",
  keywords: [
    "SkillDeck",
    "AI orchestration",
    "local-first",
    "multi-agent",
    "MCP",
    "Ollama",
    "OpenAI",
    "Claude",
    "developer tools",
    "privacy",
  ],
  authors: [{ name: "SkillDeck Team" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%233b82f6'/><text x='16' y='22' text-anchor='middle' fill='white' font-size='13' font-weight='bold' font-family='sans-serif'>SD</text></svg>",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://skilldeck.dev",
    siteName: "SkillDeck",
    title: "SkillDeck -- Your AI Workflow. Your Machine. Your Rules.",
    description:
      "A local-first desktop app that brings multi-agent orchestration, visual workflows, and full model control to one native interface.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SkillDeck -- Your AI Workflow. Your Machine. Your Rules.",
    description:
      "A local-first desktop app that brings multi-agent orchestration, visual workflows, and full model control to one native interface.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geistMono.variable} antialiased`}>
        <LinguiClientProvider>
          <ABTestProvider>
            <UTMProvider>
              {children}
            </UTMProvider>
          </ABTestProvider>
        </LinguiClientProvider>
      </body>
    </html>
  );
}
