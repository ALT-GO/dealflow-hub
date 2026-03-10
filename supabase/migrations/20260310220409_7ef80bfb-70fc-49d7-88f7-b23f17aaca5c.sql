
-- Automation rules table
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_event text NOT NULL, -- 'on_deal_update', 'on_deal_create', 'on_contact_create'
  conditions jsonb NOT NULL DEFAULT '{}',
  action_type text NOT NULL, -- 'create_task', 'send_notification', 'update_field'
  action_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage automation rules" ON public.automation_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view automation rules" ON public.automation_rules FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Custom properties table
CREATE TABLE public.custom_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'companies', 'contacts', 'deals'
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text', -- 'text', 'number', 'date', 'dropdown', 'email', 'currency'
  is_required boolean NOT NULL DEFAULT false,
  default_value text,
  dropdown_options jsonb, -- for dropdown type
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, field_name)
);
ALTER TABLE public.custom_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view custom properties" ON public.custom_properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage custom properties" ON public.custom_properties FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Custom property values table (EAV pattern)
CREATE TABLE public.custom_property_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.custom_properties(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL, -- the id of the company/contact/deal
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, entity_id)
);
ALTER TABLE public.custom_property_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view custom property values" ON public.custom_property_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert custom property values" ON public.custom_property_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update custom property values" ON public.custom_property_values FOR UPDATE TO authenticated USING (true);

-- Add insert policy for profiles (needed for team management)
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
