
-- Trigger: auto-log activity when a DEAL is created
CREATE OR REPLACE FUNCTION public.log_activity_on_deal_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activities (type, title, description, company_id, contact_id, created_by)
  VALUES (
    'deal_created',
    'Criou o negócio ''' || NEW.name || '''',
    'Valor: R$ ' || COALESCE(to_char(NEW.value, 'FM999G999G999D00'), '0,00') || ' · Estágio: ' || NEW.stage,
    NEW.company_id,
    NEW.contact_id,
    NEW.owner_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_activity_on_deal_insert
AFTER INSERT ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.log_activity_on_deal_insert();

-- Trigger: auto-log activity when a TASK is created
CREATE OR REPLACE FUNCTION public.log_activity_on_task_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Try to resolve company_id from the deal
  IF NEW.deal_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM public.deals WHERE id = NEW.deal_id;
  END IF;
  -- Or from the contact
  IF v_company_id IS NULL AND NEW.contact_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM public.contacts WHERE id = NEW.contact_id;
  END IF;

  INSERT INTO public.activities (type, title, description, company_id, contact_id, created_by)
  VALUES (
    'task_created',
    'Criou a tarefa ''' || NEW.title || '''',
    COALESCE('Vencimento: ' || to_char(NEW.due_date, 'DD/MM/YYYY'), 'Sem data de vencimento'),
    v_company_id,
    NEW.contact_id,
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_activity_on_task_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_activity_on_task_insert();

-- Trigger: auto-log activity when a COMPANY NOTE is created
CREATE OR REPLACE FUNCTION public.log_activity_on_company_note_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activities (type, title, description, company_id, created_by)
  VALUES (
    'note_created',
    'Adicionou uma nota',
    LEFT(NEW.content, 120),
    NEW.company_id,
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_activity_on_company_note_insert
AFTER INSERT ON public.company_notes
FOR EACH ROW
EXECUTE FUNCTION public.log_activity_on_company_note_insert();

-- Trigger: auto-log activity when a CONTACT NOTE is created
CREATE OR REPLACE FUNCTION public.log_activity_on_contact_note_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.contacts WHERE id = NEW.contact_id;

  INSERT INTO public.activities (type, title, description, company_id, contact_id, created_by)
  VALUES (
    'note_created',
    'Adicionou uma nota',
    LEFT(NEW.content, 120),
    v_company_id,
    NEW.contact_id,
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_activity_on_contact_note_insert
AFTER INSERT ON public.contact_notes
FOR EACH ROW
EXECUTE FUNCTION public.log_activity_on_contact_note_insert();
