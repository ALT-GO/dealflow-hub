
-- Add periodicity and period columns to sales_goals
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS periodicity text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS period_start integer NOT NULL DEFAULT 1;

-- Create trigger function for deal stage change notifications (owner + orcamentista)
CREATE OR REPLACE FUNCTION public.notify_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal_name text;
  v_old_label text;
  v_new_label text;
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    v_deal_name := NEW.name;
    SELECT label INTO v_old_label FROM public.funnel_stages WHERE key = OLD.stage LIMIT 1;
    SELECT label INTO v_new_label FROM public.funnel_stages WHERE key = NEW.stage LIMIT 1;

    -- Notify owner
    INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
    VALUES (
      NEW.owner_id,
      'deal_stage_changed',
      'Negócio "' || v_deal_name || '" mudou de estágio',
      COALESCE(v_old_label, OLD.stage) || ' → ' || COALESCE(v_new_label, NEW.stage),
      'deal',
      NEW.id
    );

    -- Notify orcamentista if exists and different from owner
    IF NEW.orcamentista_id IS NOT NULL AND NEW.orcamentista_id IS DISTINCT FROM NEW.owner_id THEN
      INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
      VALUES (
        NEW.orcamentista_id,
        'deal_stage_changed',
        'Negócio "' || v_deal_name || '" mudou de estágio',
        COALESCE(v_old_label, OLD.stage) || ' → ' || COALESCE(v_new_label, NEW.stage),
        'deal',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_deal_stage_change ON public.deals;
CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_deal_stage_change();
