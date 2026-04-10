import { ClipboardList } from "lucide-react";
import { SOPsList } from "@/components/business/sops/SOPsList";

export default function SOPsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <ClipboardList size={22} className="text-[#eab308]" />
            SOPs
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Standard operating procedures with runnable checklists</p>
        </div>
      </div>
      <SOPsList />
    </div>
  );
}
