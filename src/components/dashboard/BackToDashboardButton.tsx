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
      className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
    >
      <ArrowLeft size={16} />
      Back to Dashboard
    </Link>
  );
}
