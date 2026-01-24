"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackToDashboardButton() {
  return (
    <Link
      href="/dashboard"
      className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-300 hover:text-slate-50 text-sm font-medium"
    >
      <ArrowLeft size={16} />
      Back
    </Link>
  );
}
