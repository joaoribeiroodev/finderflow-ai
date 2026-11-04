import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinderFlow AI",
  description: "Plataforma SaaS de prospecção B2B, CRM e inteligência comercial com IA.",
};

/**
 * Next.js 16 (Cache Components) valida que toda navegação produza UI
 * instantânea, o que exigiria mover toda leitura de `cookies()`/sessão
 * para dentro de `<Suspense>` com `use cache: private` em cada rota.
 * Para a Fase 1 (autenticação é praticamente toda a superfície do app),
 * desativamos essa validação no layout raiz — caminho de migração
 * oficial recomendado para apps com sessão pervasiva — e revisitamos
 * rota a rota nas próximas fases, conforme a UI de workspace cresce.
 * https://nextjs.org/docs/app/guides/authentication-with-cache-components
 */
export const instant = false;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
