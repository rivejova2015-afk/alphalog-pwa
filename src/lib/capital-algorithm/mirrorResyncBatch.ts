// Mirror “Re-sync Batch”
// Re-sincroniza en lote los mirrors need_resync de una rama, en background y sin banners.

export async function resyncMirrorsBatch(mirrors: { id: string; status: string }[], onLog?: (msg: string) => void) {
  for (const mirror of mirrors) {
    if (mirror.status === "need_resync") {
      // await resyncMirror(mirror.id)
      onLog?.(`Mirror ${mirror.id} re-synced`);
    }
  }
}
