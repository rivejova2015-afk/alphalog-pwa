import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AppAutoRefresh from "@/components/AppAutoRefresh.client";
import "./globals.css";

const soraSans = Sora({
  variable: "--font-sora",
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
  themeColor: "#e7ebf4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${soraSans.variable} ${jetbrainsMono.variable}`}>
        {children}
        <ServiceWorkerRegister />
        <AppAutoRefresh />
      </body>
    </html>
  );
}
