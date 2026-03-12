
-- 1. Update deal stage change trigger to also notify followers
CREATE OR REPLACE FUNCTION public.notify_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_name text;
  v_old_label text;
  v_new_label text;
  v_follower record;
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

    -- Notify all followers (excluding owner and orcamentista already notified)
    FOR v_follower IN
      SELECT user_id FROM public.deal_followers
      WHERE deal_id = NEW.id
        AND user_id IS DISTINCT FROM NEW.owner_id
        AND user_id IS DISTINCT FROM NEW.orcamentista_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
      VALUES (
        v_follower.user_id,
        'deal_stage_changed',
        'Negócio "' || v_deal_name || '" mudou de estágio',
        COALESCE(v_old_label, OLD.stage) || ' → ' || COALESCE(v_new_label, NEW.stage),
        'deal',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Trigger for new comments on deals: notify owner, orcamentista, followers
CREATE OR REPLACE FUNCTION public.notify_deal_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal record;
  v_follower record;
  v_notif_title text;
BEGIN
  IF NEW.entity_type = 'deal' THEN
    SELECT id, name, owner_id, orcamentista_id INTO v_deal
    FROM public.deals WHERE id = NEW.entity_id;

    IF v_deal.id IS NOT NULL THEN
      v_notif_title := 'Novo comentário em "' || v_deal.name || '"';

      -- Notify owner (if not the commenter)
      IF v_deal.owner_id IS DISTINCT FROM NEW.created_by THEN
        INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
        VALUES (v_deal.owner_id, 'deal_comment', v_notif_title, LEFT(NEW.content, 120), 'deal', v_deal.id);
      END IF;

      -- Notify orcamentista (if exists, different from owner and commenter)
      IF v_deal.orcamentista_id IS NOT NULL
        AND v_deal.orcamentista_id IS DISTINCT FROM NEW.created_by
        AND v_deal.orcamentista_id IS DISTINCT FROM v_deal.owner_id
      THEN
        INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
        VALUES (v_deal.orcamentista_id, 'deal_comment', v_notif_title, LEFT(NEW.content, 120), 'deal', v_deal.id);
      END IF;

      -- Notify followers (excluding already notified)
      FOR v_follower IN
        SELECT user_id FROM public.deal_followers
        WHERE deal_id = v_deal.id
          AND user_id IS DISTINCT FROM NEW.created_by
          AND user_id IS DISTINCT FROM v_deal.owner_id
          AND user_id IS DISTINCT FROM v_deal.orcamentista_id
      LOOP
        INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
        VALUES (v_follower.user_id, 'deal_comment', v_notif_title, LEFT(NEW.content, 120), 'deal', v_deal.id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_deal_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_deal_comment();

-- 3. Trigger for new files on deals: notify owner, orcamentista, followers
CREATE OR REPLACE FUNCTION public.notify_deal_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal record;
  v_follower record;
  v_notif_title text;
BEGIN
  IF NEW.entity_type = 'deal' THEN
    SELECT id, name, owner_id, orcamentista_id INTO v_deal
    FROM public.deals WHERE id = NEW.entity_id;

    IF v_deal.id IS NOT NULL THEN
      v_notif_title := 'Novo arquivo em "' || v_deal.name || '"';

      IF v_deal.owner_id IS DISTINCT FROM NEW.uploaded_by THEN
        INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
        VALUES (v_deal.owner_id, 'deal_file', v_notif_title, NEW.file_name, 'deal', v_deal.id);
      END IF;

      IF v_deal.orcamentista_id IS NOT NULL
        AND v_deal.orcamentista_id IS DISTINCT FROM NEW.uploaded_by
        AND v_deal.orcamentista_id IS DISTINCT FROM v_deal.owner_id
      THEN
        INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
        VALUES (v_deal.orcamentista_id, 'deal_file', v_notif_title, NEW.file_name, 'deal', v_deal.id);
      END IF;

      FOR v_follower IN
        SELECT user_id FROM public.deal_followers
        WHERE deal_id = v_deal.id
          AND user_id IS DISTINCT FROM NEW.uploaded_by
          AND user_id IS DISTINCT FROM v_deal.owner_id
          AND user_id IS DISTINCT FROM v_deal.orcamentista_id
      LOOP
        INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
        VALUES (v_follower.user_id, 'deal_file', v_notif_title, NEW.file_name, 'deal', v_deal.id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_deal_file
AFTER INSERT ON public.file_attachments
FOR EACH ROW EXECUTE FUNCTION public.notify_deal_file();

-- 4. Trigger for tasks: notify ONLY assigned user
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only notify if assigned to someone different from creator
  IF NEW.assigned_to IS DISTINCT FROM NEW.created_by THEN
    INSERT INTO public.notifications (user_id, type, title, description, entity_type, entity_id)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      'Nova tarefa: "' || NEW.title || '"',
      COALESCE('Vencimento: ' || to_char(NEW.due_date, 'DD/MM/YYYY'), 'Sem data de vencimento'),
      'task',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- 5. Create trigger for deal stage changes (if not exists)
DROP TRIGGER IF EXISTS trg_notify_deal_stage_change ON public.deals;
CREATE TRIGGER trg_notify_deal_stage_change
AFTER UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.notify_deal_stage_change();

-- 6. Update get_estimator_availability to only return users with active assignments
CREATE OR REPLACE FUNCTION public.get_estimator_availability()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'estimators', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name))
      FROM public.profiles p
      WHERE EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.stage NOT IN ('fechado', 'perdido', '__won__', '__lost__')
          AND (d.orcamentista_id = p.user_id OR d.owner_id = p.user_id)
      )
    ), '[]'::jsonb),
    'deals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'orcamentista_id', d.orcamentista_id,
        'budget_start_date', d.budget_start_date,
        'proposal_delivery_date', d.proposal_delivery_date,
        'target_delivery_date', d.target_delivery_date,
        'close_date', d.close_date,
        'created_at', d.created_at,
        'stage', d.stage
      ))
      FROM public.deals d
      WHERE d.orcamentista_id IS NOT NULL
        AND d.stage NOT IN ('fechado', 'perdido', '__won__', '__lost__')
    ), '[]'::jsonb)
  );
$function$;
