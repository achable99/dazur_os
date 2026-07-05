-- Sincronización income_invoices ↔ cash_flow_entries.
--
-- Contexto: collect_invoice/uncollect_invoice crean y eliminan la entrada de flujo
-- (origin='invoice', origin_id=factura), pero editar o eliminar la factura
-- directamente dejaba la entrada de flujo desactualizada o huérfana.
--
-- Este trigger:
--   * ON UPDATE: si la factura sigue cobrada, mantiene sincronizada la entrada
--     vinculada (monto = NEW.total, concepto con el mismo formato que
--     collect_invoice, fecha = collected_date). Si is_collected pasa a false por
--     un UPDATE directo (fuera del RPC uncollect_invoice), elimina la entrada.
--   * ON DELETE: elimina la entrada vinculada (cumple lo que promete el diálogo
--     de confirmación de borrado).
--
-- Nunca INSERTA: la creación de la entrada sigue siendo responsabilidad exclusiva
-- de collect_invoice, por lo que no puede duplicar filas (collect_invoice hace su
-- UPDATE antes del INSERT; en ese momento no existe fila vinculada y este trigger
-- no hace nada).

CREATE OR REPLACE FUNCTION public.sync_income_invoice_cashflow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  client_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_collected THEN
      SELECT razon_social INTO client_name FROM public.clients WHERE id = NEW.client_id;
      -- Solo actualiza la fila ya creada por collect_invoice; jamás inserta.
      UPDATE public.cash_flow_entries
        SET concept = 'Factura ' || NEW.folio_fiscal || ' — ' || COALESCE(client_name, ''),
            amount = NEW.total,
            date = COALESCE(NEW.collected_date, date)
        WHERE origin = 'invoice' AND origin_id = NEW.id;
    ELSE
      -- is_collected pasó a false por UPDATE directo: limpiar la entrada vinculada.
      -- (uncollect_invoice también la elimina; esta operación es idempotente.)
      DELETE FROM public.cash_flow_entries WHERE origin = 'invoice' AND origin_id = NEW.id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.cash_flow_entries WHERE origin = 'invoice' AND origin_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

-- Igual que el resto de funciones (ver 20260704090000): sin EXECUTE para roles cliente.
REVOKE EXECUTE ON FUNCTION public.sync_income_invoice_cashflow() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_income_invoice_sync ON public.income_invoices;
CREATE TRIGGER trg_income_invoice_sync
AFTER UPDATE OR DELETE ON public.income_invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_income_invoice_cashflow();

-- NOTA: intencionalmente NO se reparan datos históricos (entradas huérfanas o
-- desincronizadas previas al trigger): el propietario ya cuadró el sistema
-- manualmente y un backfill rompería esos ajustes. El trigger solo aplica
-- hacia adelante.
