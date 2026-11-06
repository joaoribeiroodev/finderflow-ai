import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinderFlow AI",
  description: "Plataforma SaaS de prospecção B2B, CRM e inteligência comercial com IA.",
};

export const viewport: Viewport = {
  themeColor: "#121826",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable} ${fraunces.variable} h-full antialiased bg-[var(--ff-bg-canvas)]`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
