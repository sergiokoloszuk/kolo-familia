import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { BetaConviteConsumer } from "@/components/providers/beta-convite-consumer";
import { ErrorTracker } from "@/components/providers/error-tracker";
import { ServiceWorkerRegister } from "@/components/providers/sw-register";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://kolofamilia.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Kolo Família",
    template: "%s · Kolo Família",
  },
  description:
    "Estratégia personalizada pro dia a dia da família atípica. Acolhimento e orientação no WhatsApp + app PWA com conteúdo personalizado.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kolo",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: APP_URL,
    siteName: "Kolo Família",
    title: "Kolo Família — Cuidado diário, onde você já está",
    description:
      "Estratégia personalizada pro dia a dia da família atípica. Acolhimento e orientação no WhatsApp + app PWA.",
    images: [{ url: "/icons/icon.svg" }],
  },
  twitter: {
    card: "summary",
    title: "Kolo Família",
    description:
      "Estratégia personalizada pro dia a dia da família atípica.",
    images: ["/icons/icon.svg"],
  },
  alternates: {
    canonical: APP_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0716" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <ErrorTracker />
        <ServiceWorkerRegister />
        <BetaConviteConsumer />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
