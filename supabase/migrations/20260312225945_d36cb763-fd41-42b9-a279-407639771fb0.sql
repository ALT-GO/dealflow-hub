
-- Add last_activity_at column to companies, contacts, and deals
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT NULL;

-- Create trigger function to sync last_activity_at when activities are inserted
CREATE OR REPLACE FUNCTION public.sync_last_activity_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    UPDATE public.companies SET last_activity_at = NEW.activity_date WHERE id = NEW.company_id;
  END IF;
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE public.contacts SET last_activity_at = NEW.activity_date WHERE id = NEW.contact_id;
  END IF;
  IF NEW.deal_id IS NOT NULL THEN
    UPDATE public.deals SET last_activity_at = NEW.activity_date WHERE id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on activities table
DROP TRIGGER IF EXISTS trg_sync_last_activity_at ON public.activities;
CREATE TRIGGER trg_sync_last_activity_at
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.sync_last_activity_at();
