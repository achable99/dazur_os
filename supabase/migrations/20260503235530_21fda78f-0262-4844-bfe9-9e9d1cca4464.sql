CREATE OR REPLACE FUNCTION public.mark_credit_payment_paid(_payment_id uuid, _paid_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pay public.credit_payments%ROWTYPE;
  cl public.credit_lines%ROWTYPE;
BEGIN
  SELECT * INTO pay FROM public.credit_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF pay.status = 'paid' THEN RETURN; END IF;
  SELECT * INTO cl FROM public.credit_lines WHERE id = pay.credit_line_id;

  UPDATE public.credit_payments SET status = 'paid', paid_date = _paid_date WHERE id = _payment_id;

  UPDATE public.credit_lines
    SET used_amount = GREATEST(0, used_amount - pay.principal)
    WHERE id = pay.credit_line_id;

  INSERT INTO public.cash_flow_entries (type, concept, amount, date, category, origin, origin_id)
  VALUES ('expense', 'Pago crédito — ' || cl.name || ' (#' || pay.payment_number || ')', pay.total, _paid_date, 'Crédito', 'credit', pay.id);
END $function$;

CREATE OR REPLACE FUNCTION public.unmark_credit_payment_paid(_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pay public.credit_payments%ROWTYPE;
BEGIN
  SELECT * INTO pay FROM public.credit_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF pay.status <> 'paid' THEN RETURN; END IF;

  UPDATE public.credit_payments SET status = 'pending', paid_date = NULL WHERE id = _payment_id;

  UPDATE public.credit_lines
    SET used_amount = used_amount + pay.principal
    WHERE id = pay.credit_line_id;

  DELETE FROM public.cash_flow_entries WHERE origin = 'credit' AND origin_id = _payment_id;
END $function$;

UPDATE public.credit_lines cl
SET used_amount = GREATEST(0, cl.total_amount - COALESCE((
  SELECT SUM(principal) FROM public.credit_payments
  WHERE credit_line_id = cl.id AND status = 'paid'
), 0))
WHERE cl.type = 'fixed';