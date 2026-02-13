"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

function resolveFallback(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "/dashboard";
  if (pathname.startsWith("/trading")) return "/trading";
  if (pathname.startsWith("/business")) return "/business";
  if (pathname.startsWith("/intelligence")) return "/intelligence";
  if (pathname.startsWith("/inbox")) return "/inbox";
  if (pathname.startsWith("/auth")) return "/auth";
  return "/dashboard";
}

function shouldHide(pathname: string): boolean {
  return pathname === "/" || pathname === "/dashboard" || pathname === "/auth/callback";
}

export default function GlobalBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (shouldHide(pathname)) return null;

  const fallback = resolveFallback(pathname);

  const onGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  };

  return (
    <button
      type="button"
      onClick={onGoBack}
      className="app-floating-safe app-glass-surface fixed z-50 inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 shadow-[0_12px_30px_rgba(2,4,10,0.5)] transition hover:bg-slate-800/90"
      aria-label="Atras"
    >
      <ArrowLeft size={16} />
      Atras
    </button>
  );
}
