'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#0a0e1a] border-b border-[#1f2937] flex items-center justify-between px-6 z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#22d3ee]/20 border border-[#22d3ee]/40 rounded flex items-center justify-center">
          <span className="text-[#22d3ee] font-bold text-xs font-mono">AL</span>
        </div>
        <span className="text-lg font-bold text-[#e2e8f0] tracking-tight hidden sm:block font-mono">
          AlphaLog
        </span>
      </Link>

      {/* Quick Status */}
      <div className="hidden sm:flex items-center gap-4 text-sm text-[#94a3b8] font-mono">
        <div>
          <span className="text-[#34d399]">2.1</span>
        </div>
      </div>

      {/* Settings */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="p-2 hover:bg-[#151b28] rounded transition-colors"
          aria-label="Settings"
          aria-expanded={settingsOpen}
        >
          <Settings size={18} className="text-[#94a3b8]" />
        </button>

        {settingsOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-[#151b28] border border-[#1f2937] rounded-lg shadow-lg py-2 z-50">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm text-[#e2e8f0] hover:bg-[#0a0e1a] transition-colors"
              onClick={() => setSettingsOpen(false)}
            >
              Legacy Dashboard
            </Link>
            <Link
              href="/auth"
              className="block px-4 py-2 text-sm text-[#ef4444] hover:bg-[#0a0e1a] transition-colors"
              onClick={() => setSettingsOpen(false)}
            >
              Logout
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
