import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aegis — Forensic Supply Chain Gateway",
  description:
    "Money only moves when authenticity is mathematically proven. Forensic procurement gateway for pharmaceutical supply chains.",
};

// Runs before React hydrates so the initial paint matches the user's
// persisted theme. Without this the dark default would flash before
// JavaScript can swap to light.
const THEME_BOOT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem("aegis.theme");
    if (t !== "light" && t !== "dark") t = "dark";
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
