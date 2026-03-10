
-- Create storage bucket for CRM attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- RLS policies for storage: anyone authenticated can upload, only admin can delete
CREATE POLICY "Authenticated can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Authenticated can view" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY "Admins can delete files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'attachments' AND has_role(auth.uid(), 'admin'));

-- File metadata table
CREATE TABLE public.file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'company', 'contact', 'deal'
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  category text NOT NULL DEFAULT 'outros', -- 'contrato', 'proposta', 'documento_tecnico', 'outros'
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view files" ON public.file_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert files" ON public.file_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Admins can delete file records" ON public.file_attachments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
