
CREATE TABLE public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  target_deals_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- Admins can manage all goals
CREATE POLICY "Admins can manage goals"
ON public.sales_goals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own goals
CREATE POLICY "Users can view own goals"
ON public.sales_goals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_sales_goals_updated_at
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
