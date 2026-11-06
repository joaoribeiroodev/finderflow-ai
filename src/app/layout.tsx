import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/**
 * Reformulação visual "Registro & Selo" (2026-11-06): troca a dupla
 * Geist (sans/mono genérica de qualquer app Next.js) por um par com
 * personalidade deliberada — serifada de destaque + sans técnica —
 * em vez de tipografia neutra igual à de qualquer outro produto.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** Serifada de destaque (títulos, números-chave) — ver globals.css `--font-serif`. */
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
    <html
      lang="pt-BR"
      className={`${plexSans.variable} ${plexMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
