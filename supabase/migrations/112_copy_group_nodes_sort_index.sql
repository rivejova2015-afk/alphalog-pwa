-- Add sort_index to copy_group_nodes so the UI can persist slave reorder
-- after drag/drop. Default 0 keeps existing rows non-blocking. Index speeds
-- up ORDER BY in /api/copy-groups/[id]/graph.

ALTER TABLE public.copy_group_nodes
  ADD COLUMN IF NOT EXISTS sort_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_copy_group_nodes_group_sort
  ON public.copy_group_nodes (copy_group_id, role, sort_index);

COMMENT ON COLUMN public.copy_group_nodes.sort_index IS
  'Visual order within (copy_group_id, role). UI updates via PATCH /api/copy-groups/[id]/nodes/reorder.';
