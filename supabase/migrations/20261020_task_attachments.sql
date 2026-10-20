-- Migration: Task Attachments & Private Storage RLS
-- Description: Configures the private storage bucket 'task_attachments' with strict
-- per-user folder isolation (auth.uid() = folder name) and 5MB upload bounds.

-- 1. Insert storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'task_attachments',
    'task_attachments',
    false,
    5242880, -- 5 MB in bytes
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'application/pdf', 'text/plain', 'text/csv', 'text/markdown']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880;

-- 2. Storage RLS Policies: Authenticated users can only read objects in their own folder
CREATE POLICY "Users can view own task attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'task_attachments' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 3. Storage RLS Policies: Authenticated users can only upload into their own folder
CREATE POLICY "Users can upload own task attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'task_attachments' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 4. Storage RLS Policies: Authenticated users can only delete their own attachments
CREATE POLICY "Users can delete own task attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'task_attachments' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
