
-- Fix permissive INSERT policies for companies
DROP POLICY "Authenticated can insert companies" ON public.companies;
CREATE POLICY "Authenticated can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY "Authenticated can update companies" ON public.companies;
CREATE POLICY "Authenticated can update companies" ON public.companies FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Fix permissive INSERT policies for contacts
DROP POLICY "Authenticated can insert contacts" ON public.contacts;
CREATE POLICY "Authenticated can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY "Authenticated can update contacts" ON public.contacts;
CREATE POLICY "Authenticated can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
