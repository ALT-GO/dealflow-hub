
ALTER TABLE public.custom_properties
  ADD COLUMN IF NOT EXISTS display_section text NOT NULL DEFAULT 'Informações do Negócio';
