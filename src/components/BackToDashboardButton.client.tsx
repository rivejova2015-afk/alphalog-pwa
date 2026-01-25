"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackToDashboardButton() {
  return (
    <Link
      href="/dashboard"
      className="hidden md:inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
    >
      <ArrowLeft size={16} />
      Back
    </Link>
  );
}
