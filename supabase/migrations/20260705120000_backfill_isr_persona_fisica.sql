-- Backfill: corrige facturas de ingreso emitidas a clientes PERSONA FÍSICA que
-- quedaron con ISR retenido (isr > 0).
--
-- Contexto del bug (colisión de queryKey ["clients"] en React Query, ver
-- IncomeInvoiceDialog.tsx): con staleTime global de 30s, el diálogo de factura
-- podía recibir del cache una respuesta de ["clients"] servida a OTRO
-- consumidor de la misma key cuyo `select` no incluía `tipo_persona`. Al
-- resolver `tipo_persona` como `undefined`, `applyIsr` (que sólo debe ser true
-- para clientes persona MORAL) se evaluaba `false` — pero si esa carrera
-- ocurría al revés (formulario ya tenía el cliente correcto cacheado como
-- moral y luego el usuario cambiaba a un cliente físico sin que el cache se
-- refrescara) también podía guardarse una factura de persona física con ISR
-- retenido indebido. Este backfill corrige los datos ya persistidos; el fix
-- de código (unificar el `select` de toda query con key ["clients"] para que
-- siempre incluya `tipo_persona`) se aplica por separado y evita que el bug
-- se repita hacia adelante.
--
-- Reglas de negocio: persona física NO tiene retención de ISR (1.25%) — sólo
-- aplica a clientes persona moral. Por lo tanto, para las facturas afectadas:
--   * isr = 0
--   * total = round(subtotal + iva, 2)   (ya no se resta ISR)
--   * si la factura ya estaba cobrada (is_collected) y el paid_amount
--     registrado coincidía con el total ANTERIOR (pago completo bajo el total
--     viejo, con tolerancia de 1 centavo), se actualiza paid_amount al nuevo
--     total — para no dejar la factura marcada como "pagada" con un saldo
--     pendiente artificial de lo que antes era el ISR retenido.
--
-- Flujo de efectivo (cash_flow_entries): NO se toca directamente en este
-- backfill. La migración 20260704091000_income_invoice_cashflow_sync.sql
-- instaló un trigger AFTER UPDATE en income_invoices
-- (trg_income_invoice_sync / sync_income_invoice_cashflow) que, para
-- cualquier UPDATE donde is_collected sea true, sincroniza
-- cash_flow_entries.amount = NEW.total de la entrada vinculada
-- (origin='invoice', origin_id=factura). Como el UPDATE de abajo modifica
-- `total` en la MISMA sentencia (el trigger ve el NEW.total ya corregido),
-- ese trigger cubre por completo la corrección del flujo de efectivo para las
-- facturas cobradas afectadas: no se requiere una actualización explícita de
-- cash_flow_entries aquí. Verificado: el trigger no tiene condición WHEN, por
-- lo que se dispara en cada fila de este UPDATE sin importar qué columnas
-- cambiaron.
--
-- Idempotencia: el UPDATE sólo afecta filas con isr > 0; tras la primera
-- ejecución esas filas quedan con isr = 0 y por lo tanto quedan excluidas del
-- WHERE en corridas subsecuentes (no-op). Es seguro re-ejecutar esta
-- migración.

UPDATE public.income_invoices ii
SET
  isr = 0,
  total = round(ii.subtotal + ii.iva, 2),
  -- Sólo se re-ajusta paid_amount si la factura ya estaba cobrada Y el monto
  -- pagado coincidía (±1 centavo) con el total ANTERIOR (pago completo bajo
  -- el total viejo que incluía ISR). Todas las referencias a ii.* en este SET
  -- usan la fila PRE-UPDATE (comportamiento estándar de PostgreSQL: un mismo
  -- UPDATE evalúa todas las expresiones del SET contra los valores previos),
  -- así que `ii.total` aquí es el total ANTERIOR, no el recién calculado.
  paid_amount = CASE
    WHEN ii.is_collected AND abs(ii.paid_amount - ii.total) <= 0.01
      THEN round(ii.subtotal + ii.iva, 2)
    ELSE ii.paid_amount
  END
FROM public.clients c
WHERE c.id = ii.client_id
  AND c.tipo_persona = 'fisica'
  AND ii.isr > 0;
