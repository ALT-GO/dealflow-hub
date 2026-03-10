
-- Deal followers table
CREATE TABLE public.deal_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, user_id)
);

ALTER TABLE public.deal_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view deal followers" ON public.deal_followers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert deal followers" ON public.deal_followers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can remove own follow or admin" ON public.deal_followers FOR DELETE TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Add reply_to column to comments for threads
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.comments(id);
