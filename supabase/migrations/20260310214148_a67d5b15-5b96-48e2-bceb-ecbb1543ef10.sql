
CREATE TABLE public.company_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company notes" ON public.company_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert company notes" ON public.company_notes
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own notes" ON public.company_notes
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own notes" ON public.company_notes
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_company_notes_updated_at BEFORE UPDATE ON public.company_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
