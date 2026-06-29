DROP POLICY IF EXISTS "Allow all to read fiscal_period_adjustments" ON public.fiscal_period_adjustments;
DROP POLICY IF EXISTS "Allow all to insert fiscal_period_adjustments" ON public.fiscal_period_adjustments;
DROP POLICY IF EXISTS "Allow all to update fiscal_period_adjustments" ON public.fiscal_period_adjustments;
DROP POLICY IF EXISTS "Allow all to delete fiscal_period_adjustments" ON public.fiscal_period_adjustments;

CREATE POLICY "Authenticated read fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);