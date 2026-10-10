ALTER TABLE public.income_invoices
  ADD COLUMN payment_type text NOT NULL DEFAULT 'PPD'
    CHECK (payment_type IN ('PUE', 'PPD')),
  ADD COLUMN quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX idx_income_invoices_quote_id
  ON public.income_invoices (quote_id)
  WHERE quote_id IS NOT NULL;
