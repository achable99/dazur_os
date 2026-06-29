DELETE FROM public.fiscal_carryovers a
USING public.fiscal_carryovers b
WHERE a.from_year = b.from_year
  AND a.from_month = b.from_month
  AND a.to_year = b.to_year
  AND a.to_month = b.to_month
  AND a.created_at > b.created_at;

ALTER TABLE public.fiscal_carryovers
  ADD CONSTRAINT fiscal_carryovers_period_unique
  UNIQUE (from_year, from_month, to_year, to_month);