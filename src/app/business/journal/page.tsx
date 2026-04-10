import { BookOpen } from "lucide-react";
import { JournalEditor } from "@/components/business/journal/JournalEditor.client";

export default function JournalPage() {
  return (
    <div>
      <div className="flex items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <BookOpen size={22} className="text-[#c084fc]" />
            Journal
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Trading reflections and analysis notes</p>
        </div>
      </div>
      <JournalEditor />
    </div>
  );
}
