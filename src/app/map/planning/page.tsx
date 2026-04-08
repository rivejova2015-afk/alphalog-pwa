"use client";

import { Rocket } from "lucide-react";

export default function MapPlanningPage() {
  return (
    <div className="text-center py-16">
      <Rocket className="w-12 h-12 text-cyan-400/40 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-slate-200 mb-2">Future Planning</h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        Quarterly planning and future projections coming soon. Use Goals and Progress Map to track current objectives.
      </p>
    </div>
  );
}
