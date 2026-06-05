"use client";

/**
 * ConflictBadge — globally mounted pill that surfaces unresolved AlphaCore
 * outbox conflicts. Renders nothing when count is 0.
 *
 * Rendered from the root layout next to GlobalBackButton so the user sees
 * "you have unresolved conflicts" the moment they happen, on any route,
 * without us having to plumb a count prop through every page.
 *
 * UX rules:
 *   - Hidden on the conflicts page itself (would be redundant + the page
 *     already has its own list and resolve actions).
 *   - Hidden on auth pages (signed-out users don't have an outbox).
 *   - Single Sonner toast on the first conflict-appearance per session.
 *     Repeated polls that find the same count don't re-toast.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useConflictCount } from "@/hooks/useConflictCount";

const HIDDEN_PATH_PREFIXES = ["/auth", "/dashboard/conflicts", "/offline", "/health"];

export default function ConflictBadge() {
  const pathname = usePathname();
  const router = useRouter();
  const hiddenByPath =
    typeof pathname === "string" && HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // The hook itself is cheap when disabled, but we still skip the IDB
  // round-trip on routes that would never render the badge anyway.
  const { count } = useConflictCount({ disabled: hiddenByPath });

  // Toast once when count transitions 0 → N. Re-arms if it goes back to 0
  // (eg. all conflicts resolved) so the next batch toasts again.
  const lastToastedRef = useRef(0);
  useEffect(() => {
    if (count === 0) {
      lastToastedRef.current = 0;
      return;
    }
    if (count > 0 && lastToastedRef.current === 0) {
      lastToastedRef.current = count;
      toast.warning(
        count === 1
          ? "Hay 1 conflicto pendiente de sincronización"
          : `Hay ${count} conflictos pendientes de sincronización`,
        {
          description: "Tocá el badge para resolverlos.",
          duration: 6000,
        }
      );
    }
  }, [count]);

  if (hiddenByPath || count === 0) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard/conflicts")}
      aria-label={`Resolver ${count} conflicto${count === 1 ? "" : "s"} pendiente${count === 1 ? "" : "s"}`}
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-amber-500/70 bg-amber-900/90 px-3 py-2 text-xs font-medium text-amber-100 shadow-lg backdrop-blur transition hover:bg-amber-800/90 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>
        {count} conflicto{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}
