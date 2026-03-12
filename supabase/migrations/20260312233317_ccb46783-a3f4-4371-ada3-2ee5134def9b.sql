
-- Table to store unresolved user references from imports
CREATE TABLE public.pending_user_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  entity_type text NOT NULL, -- 'deal'
  entity_id uuid NOT NULL,
  field_name text NOT NULL, -- 'owner_id' or 'orcamentista_id'
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_user_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage pending assignments" ON public.pending_user_assignments
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Index for fast lookups when resolving
CREATE INDEX idx_pending_user_assignments_name ON public.pending_user_assignments (user_name, resolved);

-- Function to auto-resolve pending assignments when a new profile is created
CREATE OR REPLACE FUNCTION public.resolve_pending_user_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending record;
  v_name_normalized text;
BEGIN
  v_name_normalized := lower(trim(NEW.full_name));
  
  FOR v_pending IN
    SELECT id, entity_type, entity_id, field_name
    FROM public.pending_user_assignments
    WHERE resolved = false
      AND lower(trim(user_name)) = v_name_normalized
  LOOP
    IF v_pending.entity_type = 'deal' THEN
      IF v_pending.field_name = 'owner_id' THEN
        UPDATE public.deals SET owner_id = NEW.user_id WHERE id = v_pending.entity_id;
      ELSIF v_pending.field_name = 'orcamentista_id' THEN
        UPDATE public.deals SET orcamentista_id = NEW.user_id WHERE id = v_pending.entity_id;
      END IF;
    END IF;
    
    UPDATE public.pending_user_assignments SET resolved = true WHERE id = v_pending.id;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger on profiles table
CREATE TRIGGER trg_resolve_pending_assignments
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.resolve_pending_user_assignments();
