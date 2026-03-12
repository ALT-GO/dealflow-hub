
-- Add deal_id column to activities
ALTER TABLE public.activities ADD COLUMN deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE;

-- Update existing trigger to include deal_id
CREATE OR REPLACE FUNCTION public.log_activity_on_deal_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.activities (type, title, description, company_id, contact_id, created_by, deal_id)
  VALUES (
    'deal_created',
    'Criou o negócio ''' || NEW.name || '''',
    'Valor: R$ ' || COALESCE(to_char(NEW.value, 'FM999G999G999D00'), '0,00') || ' · Estágio: ' || NEW.stage,
    NEW.company_id,
    NEW.contact_id,
    NEW.owner_id,
    NEW.id
  );
  RETURN NEW;
END;
$function$;

-- Update task trigger to include deal_id
CREATE OR REPLACE FUNCTION public.log_activity_on_task_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM public.deals WHERE id = NEW.deal_id;
  END IF;
  IF v_company_id IS NULL AND NEW.contact_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM public.contacts WHERE id = NEW.contact_id;
  END IF;

  INSERT INTO public.activities (type, title, description, company_id, contact_id, created_by, deal_id)
  VALUES (
    'task_created',
    'Criou a tarefa ''' || NEW.title || '''',
    COALESCE('Vencimento: ' || to_char(NEW.due_date, 'DD/MM/YYYY'), 'Sem data de vencimento'),
    v_company_id,
    NEW.contact_id,
    NEW.created_by,
    NEW.deal_id
  );
  RETURN NEW;
END;
$function$;
