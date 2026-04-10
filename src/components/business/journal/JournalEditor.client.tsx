'use client';

import { useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { formatDate } from '@/utils/formatters';

interface JournalEntry {
  id: string;
  content: string;
  tags: string[];
  linked_to: string | null;
  created_at: string;
}

const DEMO_ENTRIES: JournalEntry[] = [
  {
    id: '1',
    content: '## Session Review — April 8\n\nGoldRange performed exceptionally today. The basket accumulation during London session was clean. Three winners, zero losers. Key insight: the 2330-2340 range is acting as strong support.\n\n**Lessons:** Patience during accumulation phase pays off. Avoided overtrading during NY open.',
    tags: ['gold', 'london-session', 'profitable'],
    linked_to: 'GoldRange Basket v3',
    created_at: '2025-04-08T20:00:00Z',
  },
  {
    id: '2',
    content: '## EUR Strategy Analysis\n\nPaper trading the EUR/USD trend follower for week 3. Noticed it struggles during high-impact news. Need to implement news filter.\n\n**Action items:**\n- Add economic calendar filter\n- Widen SL by 20% during NFP week\n- Review entry logic around ECB meetings',
    tags: ['eur', 'paper-trading', 'improvement'],
    linked_to: 'EUR Trend Follower',
    created_at: '2025-04-06T18:30:00Z',
  },
];

interface NewEntryForm {
  content: string;
  tags: string;
  linked_to: string;
}

export function JournalEditor() {
  const [entries, setEntries] = useState<JournalEntry[]>(DEMO_ENTRIES);
  const [expanded, setExpanded] = useState<string | null>(DEMO_ENTRIES[0]?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewEntryForm>({ content: '', tags: '', linked_to: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.content.trim()) return;
    setSaving(true);

    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      content: form.content,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      linked_to: form.linked_to || null,
      created_at: new Date().toISOString(),
    };

    // TODO: POST to /api/journal
    setEntries((prev) => [newEntry, ...prev]);
    setForm({ content: '', tags: '', linked_to: '' });
    setShowForm(false);
    setSaving(false);
  };

  return (
    <div>
      {/* New entry button */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-[#94a3b8]">{entries.length} entries</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] text-xs font-bold rounded transition-colors"
        >
          <Plus size={14} />
          New Entry
        </button>
      </div>

      {/* New entry form */}
      {showForm && (
        <div className="bg-[#151b28] border border-[#22d3ee]/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#22d3ee] uppercase tracking-wider">New Entry</span>
            <button onClick={() => setShowForm(false)} className="text-[#475569] hover:text-[#94a3b8]">
              <X size={14} />
            </button>
          </div>

          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Write your trading notes, reflections, analysis... (Markdown supported)"
            className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded p-3 text-sm text-[#e2e8f0] placeholder-[#475569] resize-none focus:outline-none focus:border-[#22d3ee]/50 mb-3"
            rows={6}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-[#475569] mb-1 block">Tags (comma separated)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="gold, profitable, london"
                className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#22d3ee]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#475569] mb-1 block">Linked strategy</label>
              <input
                value={form.linked_to}
                onChange={(e) => setForm((f) => ({ ...f, linked_to: e.target.value }))}
                placeholder="GoldRange Basket v3"
                className="w-full bg-[#0a0e1a] border border-[#1f2937] rounded px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#22d3ee]/50"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving || !form.content.trim()}
            className="px-4 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] disabled:opacity-50 text-[#0a0e1a] text-sm font-bold rounded transition-colors"
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-3">
        {entries.map((entry) => {
          const isOpen = expanded === entry.id;
          const preview = entry.content.replace(/#+\s/g, '').split('\n')[0];

          return (
            <div key={entry.id} className="bg-[#151b28] border border-[#1f2937] rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : entry.id)}
                className="w-full flex items-start justify-between p-4 hover:bg-[#1c2335]/40 transition-colors text-left"
                aria-expanded={isOpen}
              >
                <div className="flex-1 pr-3">
                  <p className="text-sm text-[#e2e8f0] font-medium truncate">{preview}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[#475569]">{formatDate(entry.created_at)}</span>
                    {entry.linked_to && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#22d3ee]/10 border border-[#22d3ee]/20 text-[#22d3ee] rounded">
                        {entry.linked_to}
                      </span>
                    )}
                  </div>
                </div>
                {isOpen
                  ? <ChevronUp size={16} className="text-[#475569] flex-shrink-0 mt-0.5" />
                  : <ChevronDown size={16} className="text-[#475569] flex-shrink-0 mt-0.5" />}
              </button>

              {isOpen && (
                <div className="border-t border-[#1f2937] p-4">
                  <pre className="text-sm text-[#94a3b8] whitespace-pre-wrap font-sans leading-relaxed mb-3">
                    {entry.content}
                  </pre>
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#1f2937]">
                      <Tag size={12} className="text-[#475569] mt-0.5" />
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 bg-[#1f2937] text-[#94a3b8] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
