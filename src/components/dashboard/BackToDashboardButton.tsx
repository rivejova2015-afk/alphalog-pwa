'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * BackToDashboardButton
 * Reusable component for navigating back to dashboard from any module
 */
export default function BackToDashboardButton() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 shadow-[0_12px_24px_rgba(2,4,10,0.35)] transition hover:bg-slate-800/80 hover:text-slate-50"
    >
      <ArrowLeft size={16} />
      Back to Dashboard
    </Link>
  );
}
