-- Los complementos de pago son SOLO trazabilidad: registro de referencia para el SAT.
-- Nunca deben modificar el saldo/cobro de las facturas, insertar en el flujo de
-- efectivo ni recalcular impuestos (los impuestos salen de income_invoices.is_collected).

-- apply_payment_complement: no-op. Se conserva la función para no romper la llamada RPC
-- del frontend, pero deja de tener cualquier efecto sobre facturas o flujo.
CREATE OR REPLACE FUNCTION public.apply_payment_complement(_complement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Solo trazabilidad: sin efectos. El complemento es únicamente referencia para el SAT.
  RETURN;
END $function$;

-- revert_payment_complement: limpieza defensiva de filas de flujo generadas por versiones
-- previas (origin='complement'); no toca facturas.
CREATE OR REPLACE FUNCTION public.revert_payment_complement(_complement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.cash_flow_entries
  WHERE origin = 'complement' AND origin_id = _complement_id;
END $function$;
