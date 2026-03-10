
-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Team members junction table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view team members" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage team members" ON public.team_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Page permissions table
CREATE TABLE public.page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL,
  page_label text NOT NULL,
  allowed_roles text[] NOT NULL DEFAULT ARRAY['admin', 'vendedor'],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_path)
);

ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view page permissions" ON public.page_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage page permissions" ON public.page_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed default page permissions
INSERT INTO public.page_permissions (page_path, page_label, allowed_roles) VALUES
  ('/', 'Negócios', ARRAY['admin', 'vendedor']),
  ('/companies', 'Empresas', ARRAY['admin', 'vendedor']),
  ('/contacts', 'Contatos', ARRAY['admin', 'vendedor']),
  ('/performance', 'Performance', ARRAY['admin']),
  ('/settings', 'Configurações', ARRAY['admin']),
  ('/settings/automations', 'Automações', ARRAY['admin']);

-- User invitations table
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'vendedor',
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view invitations" ON public.user_invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage invitations" ON public.user_invitations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
