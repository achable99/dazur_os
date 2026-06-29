CREATE TABLE public.fiscal_period_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL,
  iva_acreditable_adjustment numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_period_adjustments TO authenticated;
GRANT ALL ON public.fiscal_period_adjustments TO service_role;

ALTER TABLE public.fiscal_period_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to read fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR SELECT USING (true);
CREATE POLICY "Allow all to insert fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR UPDATE USING (true);
CREATE POLICY "Allow all to delete fiscal_period_adjustments" ON public.fiscal_period_adjustments FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_fiscal_period_adjustments_updated_at
  BEFORE UPDATE ON public.fiscal_period_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();