
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS budget_start_date date,
  ADD COLUMN IF NOT EXISTS proposal_delivery_date date;
