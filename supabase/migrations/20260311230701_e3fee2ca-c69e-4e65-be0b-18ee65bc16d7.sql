
-- Fix overly permissive RLS on deal_qualification_answers
DROP POLICY IF EXISTS "Authenticated can manage answers" ON public.deal_qualification_answers;

-- More specific policies
CREATE POLICY "Authenticated can view answers" ON public.deal_qualification_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert answers" ON public.deal_qualification_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update answers" ON public.deal_qualification_answers FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete answers" ON public.deal_qualification_answers FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
