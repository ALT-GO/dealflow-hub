
-- Contact notes table
CREATE TABLE public.contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contact notes" ON public.contact_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contact notes" ON public.contact_notes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own contact notes" ON public.contact_notes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own contact notes" ON public.contact_notes FOR DELETE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_contact_notes_updated_at BEFORE UPDATE ON public.contact_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activities table (for both companies and contacts)
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'note', -- 'meeting', 'call', 'note'
  title text NOT NULL,
  description text,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  activity_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own activities" ON public.activities FOR UPDATE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own activities" ON public.activities FOR DELETE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
