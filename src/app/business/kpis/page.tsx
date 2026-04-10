import { LineChart } from "lucide-react";
import { KPIDashboard } from "@/components/business/kpis/KPIDashboard";

export default function KPIsPage() {
  return (
    <div>
      <div className="flex items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <LineChart size={22} className="text-[#60a5fa]" />
            KPIs
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Key performance indicators across trading and business</p>
        </div>
      </div>
      <KPIDashboard />
    </div>
  );
}
