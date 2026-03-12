
-- Add state, team_type, qualification_level columns to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS team_type text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS qualification_level text;

-- Create lead scoring trigger function
CREATE OR REPLACE FUNCTION public.calculate_lead_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_fields integer := 0;
  filled_fields integer := 0;
  rule_a_score numeric := 0;
  rule_b_score numeric := 0;
  rule_c_score numeric := 0;
  final_score numeric := 0;
BEGIN
  -- ═══ RULE A: Form Completion (max 40 points) ═══
  -- Scorable fields (excluding carbono_zero, cortex, estudo_equipe/has_team booleans)
  total_fields := 15;
  
  IF NEW.name IS NOT NULL AND NEW.name <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.value IS NOT NULL AND NEW.value > 0 THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.company_id IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.contact_id IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.business_area IS NOT NULL AND NEW.business_area <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.market IS NOT NULL AND NEW.market <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.scope IS NOT NULL AND NEW.scope <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.endereco_execucao IS NOT NULL AND NEW.endereco_execucao <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.tipo_negocio IS NOT NULL AND NEW.tipo_negocio <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.vendedor_externo IS NOT NULL AND NEW.vendedor_externo <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.target_delivery_date IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.close_date IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.contract_type IS NOT NULL AND NEW.contract_type <> '' THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.orcamentista_id IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  IF NEW.state IS NOT NULL AND NEW.state <> '' THEN filled_fields := filled_fields + 1; END IF;

  rule_a_score := (filled_fields::numeric / total_fields::numeric) * 40;

  -- ═══ RULE B: Location + Team Type Matrix (max 35 points) ═══
  IF NEW.state IS NOT NULL AND NEW.team_type IS NOT NULL THEN
    IF (NEW.state IN ('SP', 'MG')) AND NEW.team_type = 'Residente' THEN
      rule_b_score := 35;
    ELSIF NEW.state NOT IN ('SP', 'MG') AND NEW.team_type = 'Residente' THEN
      rule_b_score := 25;
    ELSIF (NEW.state IN ('SP', 'MG')) AND NEW.team_type = 'Volante' THEN
      rule_b_score := 20;
    ELSE
      rule_b_score := 10;
    END IF;
  END IF;

  -- ═══ RULE C: Business Profile Adjustments (max 25 points) ═══
  rule_c_score := 15; -- base
  IF NEW.qualification_level = 'Avançado' THEN
    rule_c_score := rule_c_score + 10;
  END IF;
  IF NEW.business_area = 'Outro' THEN
    rule_c_score := GREATEST(rule_c_score - 10, 0);
  END IF;

  final_score := LEAST(GREATEST(ROUND(rule_a_score + rule_b_score + rule_c_score), 0), 100);
  
  NEW.qualification_score := final_score;
  RETURN NEW;
END;
$function$;

-- Create trigger on deals for insert and update
DROP TRIGGER IF EXISTS trg_calculate_lead_score ON public.deals;
CREATE TRIGGER trg_calculate_lead_score
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_lead_score();
