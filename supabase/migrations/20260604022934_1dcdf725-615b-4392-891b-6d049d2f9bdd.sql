ALTER TABLE public.fiscal_carryovers
  ADD COLUMN IF NOT EXISTS iva_pending_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_favor_amount NUMERIC NOT NULL DEFAULT 0;

UPDATE public.fiscal_carryovers
SET iva_pending_amount = GREATEST(iva_amount, 0),
    iva_favor_amount = GREATEST(-iva_amount, 0)
WHERE iva_pending_amount = 0 AND iva_favor_amount = 0;