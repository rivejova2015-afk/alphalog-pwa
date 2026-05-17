import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import CopyGroupNewButton from "@/components/copygroups/CopyGroupNewButton.client";

export const dynamic = "force-dynamic";

interface CopyGroupRow {
  id: string;
  name: string;
  active_version: number;
  sync_mode: "hard" | "soft";
  created_at: string;
  updated_at: string;
}

export default async function CopyGroupsListPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const groups: CopyGroupRow[] = userData?.user
    ? ((await supabase
        .from("copy_groups")
        .select("id, name, active_version, sync_mode, created_at, updated_at")
        .eq("owner_id", userData.user.id)
        .order("created_at", { ascending: false })).data ?? [])
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <Users size={22} className="text-[#22d3ee]" />
            Copy Groups
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            Replicación de trades entre cuentas (master → slaves)
          </p>
        </div>
        <CopyGroupNewButton />
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20">
          <Users size={40} className="text-[#1f2937] mx-auto mb-4" />
          <p className="text-[#475569] text-sm">No tienes copy groups todavía.</p>
          <p className="text-[#2d3748] text-xs mt-1">
            Crea uno para empezar a replicar trades de una cuenta master a múltiples slaves.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/dashboard/copy-groups/${g.id}`}
                className="block bg-[#151b28] border border-[#1f2937] hover:border-[#22d3ee]/40 rounded-lg p-4 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-mono text-[#e2e8f0] truncate">{g.name}</h3>
                  <span className="text-[10px] text-[#475569] uppercase tracking-wide">
                    {g.sync_mode}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#94a3b8]">
                  <span>v{g.active_version}</span>
                  <time className="text-[#475569]">
                    {new Date(g.updated_at).toLocaleDateString()}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
