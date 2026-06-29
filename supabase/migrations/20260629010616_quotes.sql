-- Cotizador: cotizaciones (quotes) y sus conceptos (quote_items).
-- Numeración secuencial iniciando en 165.

CREATE SEQUENCE IF NOT EXISTS public.quotes_number_seq START WITH 165;

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL DEFAULT nextval('public.quotes_number_seq') UNIQUE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  date date NOT NULL,
  city text NOT NULL DEFAULT 'Mérida, Yucatán',
  show_client boolean NOT NULL DEFAULT true,
  apply_iva boolean NOT NULL DEFAULT true,
  apply_isr boolean NOT NULL DEFAULT true,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  iva numeric(14,2) NOT NULL DEFAULT 0,
  isr numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  validity text,
  payment_terms text,
  delivery_time text,
  currency_note text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.quotes_number_seq OWNED BY public.quotes.number;
CREATE INDEX idx_quotes_date ON public.quotes(date);

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);

-- RLS (mismo patrón single-admin: cualquier usuario autenticado tiene acceso completo)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read quotes"   ON public.quotes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update quotes" ON public.quotes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete quotes" ON public.quotes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth read quote_items"   ON public.quote_items FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert quote_items" ON public.quote_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update quote_items" ON public.quote_items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete quote_items" ON public.quote_items FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER set_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
