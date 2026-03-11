
-- Drop existing SELECT policies on deals and recreate for 4 roles
DROP POLICY IF EXISTS "Admins can view all deals" ON public.deals;
DROP POLICY IF EXISTS "Vendedores can view own deals" ON public.deals;

-- Admin and Gerencia see all deals
CREATE POLICY "Admin and Gerencia view all deals"
  ON public.deals FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerencia'::app_role));

-- Vendedor and Orcamentista see only own deals
CREATE POLICY "Vendedor and Orcamentista view own deals"
  ON public.deals FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
