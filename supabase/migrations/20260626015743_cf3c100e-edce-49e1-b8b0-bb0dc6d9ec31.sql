
ALTER TABLE public.income_invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

UPDATE public.income_invoices SET paid_amount = total WHERE is_collected = true AND paid_amount = 0;

CREATE TABLE public.payment_complements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  folio_fiscal text NOT NULL,
  date date NOT NULL,
  total numeric NOT NULL CHECK (total > 0),
  payment_method text,
  notes text,
  month int NOT NULL,
  year int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_complements TO authenticated;
GRANT ALL ON public.payment_complements TO service_role;
ALTER TABLE public.payment_complements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pc"   ON public.payment_complements FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert pc" ON public.payment_complements FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update pc" ON public.payment_complements FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete pc" ON public.payment_complements FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE TRIGGER set_pc_updated_at BEFORE UPDATE ON public.payment_complements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_complement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complement_id uuid NOT NULL REFERENCES public.payment_complements(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.income_invoices(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_complement_allocations TO authenticated;
GRANT ALL ON public.payment_complement_allocations TO service_role;
ALTER TABLE public.payment_complement_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pca"   ON public.payment_complement_allocations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert pca" ON public.payment_complement_allocations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update pca" ON public.payment_complement_allocations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete pca" ON public.payment_complement_allocations FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_pca_complement ON public.payment_complement_allocations(complement_id);
CREATE INDEX idx_pca_invoice ON public.payment_complement_allocations(invoice_id);

CREATE OR REPLACE FUNCTION public.apply_payment_complement(_complement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.payment_complements%ROWTYPE;
  a RECORD;
  inv public.income_invoices%ROWTYPE;
  new_paid numeric;
  is_full boolean;
  client_name text;
BEGIN
  SELECT * INTO c FROM public.payment_complements WHERE id = _complement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complement not found'; END IF;
  SELECT razon_social INTO client_name FROM public.clients WHERE id = c.client_id;

  FOR a IN SELECT * FROM public.payment_complement_allocations WHERE complement_id = _complement_id LOOP
    SELECT * INTO inv FROM public.income_invoices WHERE id = a.invoice_id FOR UPDATE;
    new_paid := LEAST(inv.total, inv.paid_amount + a.amount);
    is_full := new_paid >= inv.total - 0.005;
    UPDATE public.income_invoices
      SET paid_amount = new_paid,
          is_collected = is_full,
          collected_date = CASE WHEN is_full THEN c.date ELSE collected_date END
      WHERE id = inv.id;
  END LOOP;

  INSERT INTO public.cash_flow_entries (type, concept, amount, date, origin, origin_id)
  VALUES ('income', 'Complemento ' || c.folio_fiscal || ' — ' || COALESCE(client_name,''), c.total, c.date, 'complement', c.id);
END $$;

CREATE OR REPLACE FUNCTION public.revert_payment_complement(_complement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a RECORD; inv public.income_invoices%ROWTYPE; new_paid numeric; is_full boolean;
BEGIN
  FOR a IN SELECT * FROM public.payment_complement_allocations WHERE complement_id = _complement_id LOOP
    SELECT * INTO inv FROM public.income_invoices WHERE id = a.invoice_id FOR UPDATE;
    new_paid := GREATEST(0, inv.paid_amount - a.amount);
    is_full := new_paid >= inv.total - 0.005;
    UPDATE public.income_invoices
      SET paid_amount = new_paid,
          is_collected = is_full,
          collected_date = CASE WHEN is_full THEN collected_date ELSE NULL END
      WHERE id = inv.id;
  END LOOP;
  DELETE FROM public.cash_flow_entries WHERE origin = 'complement' AND origin_id = _complement_id;
END $$;
