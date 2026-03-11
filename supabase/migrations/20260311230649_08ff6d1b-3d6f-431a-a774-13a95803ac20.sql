
-- Sequence for deal proposal IDs
CREATE SEQUENCE IF NOT EXISTS public.deal_proposal_seq START WITH 12001;

-- Deal origins table (CRUD in settings)
CREATE TABLE public.deal_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_origins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage origins" ON public.deal_origins FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view origins" ON public.deal_origins FOR SELECT TO authenticated USING (true);

-- Qualification questions table
CREATE TABLE public.qualification_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  question_type text NOT NULL DEFAULT 'boolean',
  weight numeric NOT NULL DEFAULT 1,
  options jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);
ALTER TABLE public.qualification_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage questions" ON public.qualification_questions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view questions" ON public.qualification_questions FOR SELECT TO authenticated USING (true);

-- Deal qualification answers
CREATE TABLE public.deal_qualification_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.qualification_questions(id) ON DELETE CASCADE,
  answer text,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id, question_id)
);
ALTER TABLE public.deal_qualification_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage answers" ON public.deal_qualification_answers FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

-- Add new columns to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS proposal_id text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS orcamentista_id uuid;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS contract_type text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS market text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS business_area text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS origin_id uuid REFERENCES public.deal_origins(id);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS profit_margin numeric;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS qualification_score numeric DEFAULT 0;

-- Function to generate proposal_id
CREATE OR REPLACE FUNCTION public.generate_proposal_id(company_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  seq_val integer;
  year_suffix text;
BEGIN
  seq_val := nextval('public.deal_proposal_seq');
  year_suffix := to_char(now(), 'YY');
  RETURN 'D' || year_suffix || '_' || seq_val || '_' || COALESCE(REPLACE(company_name, ' ', ''), 'SemEmpresa');
END;
$$;
