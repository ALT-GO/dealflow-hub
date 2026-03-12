
DROP POLICY "Authenticated can insert deals" ON public.deals;
CREATE POLICY "Authenticated can insert deals" ON public.deals
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);
