
-- Library folders table
CREATE TABLE public.library_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view library folders" ON public.library_folders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and Gerencia can manage library folders" ON public.library_folders
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerencia'::app_role)
  );

-- Library files table
CREATE TABLE public.library_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.library_folders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.library_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view library files" ON public.library_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can upload library files" ON public.library_files
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admin and Gerencia can delete library files" ON public.library_files
  FOR DELETE TO authenticated USING (
    uploaded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerencia'::app_role)
  );
