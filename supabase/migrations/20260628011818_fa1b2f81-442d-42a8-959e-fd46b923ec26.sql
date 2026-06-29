
ALTER TABLE public.payment_complements
  ADD COLUMN IF NOT EXISTS traceability_only boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.apply_payment_complement(_complement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF c.traceability_only THEN
    -- Solo referencia: no modificar facturas ni insertar en cash flow.
    RETURN;
  END IF;

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
END $function$;

CREATE OR REPLACE FUNCTION public.revert_payment_complement(_complement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.payment_complements%ROWTYPE;
  a RECORD; inv public.income_invoices%ROWTYPE; new_paid numeric; is_full boolean;
BEGIN
  SELECT * INTO c FROM public.payment_complements WHERE id = _complement_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF c.traceability_only THEN
    DELETE FROM public.cash_flow_entries WHERE origin = 'complement' AND origin_id = _complement_id;
    RETURN;
  END IF;

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
END $function$;
