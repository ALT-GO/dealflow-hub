
DROP POLICY "Authenticated can manage pending assignments" ON public.pending_user_assignments;

CREATE POLICY "Admins can manage pending assignments" ON public.pending_user_assignments
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert pending assignments" ON public.pending_user_assignments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view pending assignments" ON public.pending_user_assignments
FOR SELECT TO authenticated
USING (true);
