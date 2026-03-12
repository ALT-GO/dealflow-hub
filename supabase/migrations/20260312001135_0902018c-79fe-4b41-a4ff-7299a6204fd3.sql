
-- Drop the old restrictive SELECT policy for vendedor/orcamentista
DROP POLICY IF EXISTS "Vendedor and Orcamentista view own deals" ON public.deals;

-- Recreate with orcamentista_id check
CREATE POLICY "Vendedor and Orcamentista view own deals"
ON public.deals
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR orcamentista_id = auth.uid());
