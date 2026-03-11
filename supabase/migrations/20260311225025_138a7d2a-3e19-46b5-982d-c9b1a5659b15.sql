
-- Add new roles to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerencia';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'orcamentista';

-- Add allowed_roles column to funnel_stages for stage visibility per role
ALTER TABLE public.funnel_stages ADD COLUMN IF NOT EXISTS allowed_roles text[] NOT NULL DEFAULT ARRAY['admin', 'gerencia', 'orcamentista', 'vendedor'];
