"use client";

import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
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
  return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/auth");
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

  const buttonClassName =
    "inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 shadow-[0_12px_30px_rgba(2,4,10,0.5)] transition hover:bg-slate-800/90";

  return (
    <div className="app-floating-safe app-glass-surface fixed z-50 inline-flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onGoBack}
        className={buttonClassName}
        aria-label="Atras"
      >
        <ArrowLeft size={16} />
        Atras
      </button>
      <Link
        href="/dashboard"
        className={buttonClassName}
        aria-label="Vuelta al dashboard"
      >
        <LayoutDashboard size={16} />
        Vuelta al dashboard
      </Link>
    </div>
  );
}
