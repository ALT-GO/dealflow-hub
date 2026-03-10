
-- Tighten custom_property_values policies
DROP POLICY "Authenticated can insert custom property values" ON public.custom_property_values;
DROP POLICY "Authenticated can update custom property values" ON public.custom_property_values;

CREATE POLICY "Authenticated can insert custom property values" ON public.custom_property_values FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update custom property values" ON public.custom_property_values FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
