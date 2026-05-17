import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CopyGroupDetailWorkspace from "@/components/copygroups/CopyGroupDetailWorkspace.client";

export const dynamic = "force-dynamic";

export default async function CopyGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/dashboard/copy-groups"
          className="inline-flex items-center gap-1 text-sm text-[#94a3b8] hover:text-[#22d3ee]"
        >
          <ArrowLeft size={14} />
          Volver a Copy Groups
        </Link>
      </div>

      <CopyGroupDetailWorkspace copyGroupId={id} />
    </div>
  );
}
