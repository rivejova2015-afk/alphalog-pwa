import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { Toaster } from "sonner";
import UpdateManager from "@/components/pwa/UpdateManager";
import CsrfBridge from "@/components/security/CsrfBridge.client";
import GlobalBackButton from "@/components/navigation/GlobalBackButton.client";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlphaLog 2.1",
  description: "WebApp for AI Agents & Algorithmic Trading",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AlphaLog",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${ibmPlexMono.variable} ${instrumentSans.variable}`}>
        {children}
        <GlobalBackButton />
        <UpdateManager />
        <CsrfBridge />
        <Toaster position="bottom-right" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
