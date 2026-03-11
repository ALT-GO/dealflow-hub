
-- Create funnel_stages table
CREATE TABLE public.funnel_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'bg-muted text-muted-foreground',
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stages" ON public.funnel_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage stages" ON public.funnel_stages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Create loss_reasons table
CREATE TABLE public.loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view loss reasons" ON public.loss_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage loss reasons" ON public.loss_reasons FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default stages
INSERT INTO public.funnel_stages (key, label, color, sort_order, is_system) VALUES
  ('prospeccao', 'Prospecção', 'bg-muted text-muted-foreground', 0, true),
  ('qualificacao', 'Qualificação', 'bg-secondary text-secondary-foreground', 1, true),
  ('proposta', 'Proposta', 'bg-accent/20 text-accent-foreground', 2, true),
  ('negociacao', 'Negociação', 'bg-warning/20 text-warning', 3, true),
  ('fechado', 'Fechado', 'bg-success/20 text-success', 4, true),
  ('perdido', 'Perdido', 'bg-destructive/20 text-destructive', 5, true);

-- Seed default loss reasons
INSERT INTO public.loss_reasons (value, label, sort_order) VALUES
  ('preco', 'Preço', 0),
  ('concorrente', 'Concorrente', 1),
  ('sem_recurso', 'Falta de Recurso', 2),
  ('sumiu', 'Cliente sumiu', 3),
  ('timing', 'Timing inadequado', 4),
  ('outro', 'Outro', 5);

-- Add DELETE policies for companies and contacts (missing)
CREATE POLICY "Users can delete own companies" ON public.companies FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
