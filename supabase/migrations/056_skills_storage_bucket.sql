-- Migration 056: Create 'skills' storage bucket for Q-table models

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'skills',
  'skills',
  false,
  52428800,  -- 50 MB max per file
  ARRAY['application/json']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can only read/write in their own folder (user_id/...)
CREATE POLICY "skills_user_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'skills'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "skills_user_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'skills'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "skills_user_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'skills'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMENT ON POLICY "skills_user_read" ON storage.objects IS
  'Users can only read Q-table models from their own user_id folder';

COMMENT ON POLICY "skills_user_write" ON storage.objects IS
  'Users can only upload Q-table models to their own user_id folder';

COMMENT ON POLICY "skills_user_delete" ON storage.objects IS
  'Users can only delete Q-table models from their own user_id folder';
