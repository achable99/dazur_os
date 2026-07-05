-- Marca facturas de gasto cuya deducción rechazó el SAT: se conservan en el
-- registro y en flujo de efectivo, pero su IVA y total se excluyen del resumen fiscal.
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS no_deducible BOOLEAN NOT NULL DEFAULT false;
