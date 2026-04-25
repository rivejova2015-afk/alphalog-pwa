'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { NewStrategyWizard } from './NewStrategyWizard.client';

export function NewStrategyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] text-sm font-bold rounded transition-colors"
      >
        <Plus size={16} />
        New Strategy
      </button>

      {open && <NewStrategyWizard onClose={() => setOpen(false)} />}
    </>
  );
}
