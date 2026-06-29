
-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social TEXT NOT NULL,
  nombre_comercial TEXT,
  rfc TEXT NOT NULL,
  tipo_persona TEXT NOT NULL CHECK (tipo_persona IN ('fisica','moral')),
  regimen_fiscal TEXT NOT NULL,
  codigo_postal TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ CASH FLOW ============
CREATE TABLE public.cash_flow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  concept TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','invoice','credit')),
  origin_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cf_date ON public.cash_flow_entries(date);
CREATE INDEX idx_cf_origin ON public.cash_flow_entries(origin, origin_id);

-- ============ OPENING BALANCES ============
CREATE TABLE public.opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_manual_override BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- ============ CREDIT LINES ============
CREATE TABLE public.credit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revolving','fixed')),
  total_amount NUMERIC(14,2) NOT NULL,
  used_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(8,4) NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('monthly','annual')),
  start_date DATE NOT NULL,
  num_payments INT NOT NULL CHECK (num_payments BETWEEN 1 AND 60),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('fixed','custom')),
  payment_day INT NOT NULL CHECK (payment_day BETWEEN 1 AND 28),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_line_id UUID NOT NULL REFERENCES public.credit_lines(id) ON DELETE CASCADE,
  payment_number INT NOT NULL,
  due_date DATE NOT NULL,
  principal NUMERIC(14,2) NOT NULL,
  interest NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cp_credit ON public.credit_payments(credit_line_id);

-- ============ INVOICES ============
CREATE TABLE public.income_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  folio_fiscal TEXT NOT NULL,
  invoice_type TEXT NOT NULL,
  date DATE NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL,
  iva NUMERIC(14,2) NOT NULL,
  isr NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  is_collected BOOLEAN NOT NULL DEFAULT false,
  collected_date DATE,
  notes TEXT,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ii_period ON public.income_invoices(year, month);

CREATE TABLE public.expense_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept TEXT NOT NULL,
  folio_fiscal TEXT NOT NULL,
  date DATE NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL,
  iva NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ei_period ON public.expense_invoices(year, month);

-- ============ FISCAL CARRYOVERS ============
CREATE TABLE public.fiscal_carryovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_month INT NOT NULL,
  from_year INT NOT NULL,
  to_month INT NOT NULL,
  to_year INT NOT NULL,
  iva_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  isr_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fc_to ON public.fiscal_carryovers(to_year, to_month);

-- Auto sync expense invoices into cash flow via trigger
CREATE OR REPLACE FUNCTION public.sync_expense_invoice_cashflow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cash_flow_entries (type, concept, amount, date, category, origin, origin_id)
    VALUES ('expense', 'Factura ' || NEW.folio_fiscal || ' — ' || NEW.concept, NEW.total, NEW.date, NEW.category, 'invoice', NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cash_flow_entries
      SET concept = 'Factura ' || NEW.folio_fiscal || ' — ' || NEW.concept,
          amount = NEW.total, date = NEW.date, category = NEW.category
      WHERE origin = 'invoice' AND origin_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_flow_entries WHERE origin = 'invoice' AND origin_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_expense_invoice_sync
AFTER INSERT OR UPDATE OR DELETE ON public.expense_invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_expense_invoice_cashflow();

-- Collect invoice transactional function
CREATE OR REPLACE FUNCTION public.collect_invoice(_invoice_id UUID, _collected_date DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.income_invoices%ROWTYPE;
  client_name TEXT;
BEGIN
  SELECT * INTO inv FROM public.income_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF inv.is_collected THEN RETURN; END IF;

  SELECT razon_social INTO client_name FROM public.clients WHERE id = inv.client_id;

  UPDATE public.income_invoices
    SET is_collected = true, collected_date = _collected_date
    WHERE id = _invoice_id;

  INSERT INTO public.cash_flow_entries (type, concept, amount, date, origin, origin_id)
  VALUES ('income', 'Factura ' || inv.folio_fiscal || ' — ' || COALESCE(client_name,''), inv.total, _collected_date, 'invoice', inv.id);
END $$;

CREATE OR REPLACE FUNCTION public.uncollect_invoice(_invoice_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.income_invoices SET is_collected = false, collected_date = NULL WHERE id = _invoice_id;
  DELETE FROM public.cash_flow_entries WHERE origin = 'invoice' AND origin_id = _invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_credit_payment_paid(_payment_id UUID, _paid_date DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pay public.credit_payments%ROWTYPE;
  cl public.credit_lines%ROWTYPE;
BEGIN
  SELECT * INTO pay FROM public.credit_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF pay.status = 'paid' THEN RETURN; END IF;
  SELECT * INTO cl FROM public.credit_lines WHERE id = pay.credit_line_id;

  UPDATE public.credit_payments SET status = 'paid', paid_date = _paid_date WHERE id = _payment_id;

  INSERT INTO public.cash_flow_entries (type, concept, amount, date, category, origin, origin_id)
  VALUES ('expense', 'Pago crédito — ' || cl.name || ' (#' || pay.payment_number || ')', pay.total, _paid_date, 'Crédito', 'credit', pay.id);
END $$;

CREATE OR REPLACE FUNCTION public.unmark_credit_payment_paid(_payment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.credit_payments SET status = 'pending', paid_date = NULL WHERE id = _payment_id;
  DELETE FROM public.cash_flow_entries WHERE origin = 'credit' AND origin_id = _payment_id;
END $$;

-- ============ RLS (single-admin: any authenticated user has full access) ============
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_carryovers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','cash_flow_entries','opening_balances','credit_lines','credit_payments','income_invoices','expense_invoices','fiscal_carryovers']
  LOOP
    EXECUTE format('CREATE POLICY "auth read %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "auth write %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "auth update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "auth delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (true);', t);
  END LOOP;
END $$;
