"use client";

type MobileModuleTabSelectProps = {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onChange: (id: string) => void;
  ariaLabel: string;
};

export default function MobileModuleTabSelect({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
}: MobileModuleTabSelectProps) {
  return (
    <label className="block md:hidden">
      <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-slate-400">
        Modulo
      </span>
      <select
        aria-label={ariaLabel}
        value={activeTab}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.label}
          </option>
        ))}
      </select>
    </label>
  );
}
