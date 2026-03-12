
-- Allow authenticated users to delete their own files from storage
CREATE POLICY "Users can delete own files from storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[2]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gerencia'::app_role)
  )
);
