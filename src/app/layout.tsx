import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Manrope } from "next/font/google";
import UpdateManager from "@/components/pwa/UpdateManager";
import CsrfBridge from "@/components/security/CsrfBridge.client";
import GlobalBackButton from "@/components/navigation/GlobalBackButton.client";
import DeviceProfileRuntime from "@/components/runtime/DeviceProfileRuntime.client";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlphaLog",
  description: "AlphaLog PWA",
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
  themeColor: "#0f1115",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
        {children}
        <GlobalBackButton />
        <DeviceProfileRuntime />
        <UpdateManager />
        <CsrfBridge />
      </body>
    </html>
  );
}
