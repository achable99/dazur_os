-- Seguridad: restringir EXECUTE en funciones SECURITY DEFINER.
-- Por defecto Postgres/Supabase otorga EXECUTE a PUBLIC (y por default privileges
-- a anon). Estas funciones mutan datos financieros, por lo que solo el rol
-- `authenticated` (y `service_role`) debe poder invocarlas vía RPC.
--
-- Firmas verificadas contra las migraciones:
--   collect_invoice(uuid, date)            -- 20260502044911
--   uncollect_invoice(uuid)                -- 20260502044911
--   mark_credit_payment_paid(uuid, date)   -- 20260502044911 / 20260503235530
--   unmark_credit_payment_paid(uuid)       -- 20260502044911 / 20260503235530
--   apply_payment_complement(uuid)         -- 20260626015743 / 20260629004235
--   revert_payment_complement(uuid)        -- 20260626015743 / 20260629004235
--   sync_expense_invoice_cashflow()        -- trigger, 20260502044911
--   update_updated_at_column()             -- trigger, 20260611013626

-- ============ RPCs invocadas por el frontend (supabase.rpc) ============
-- Revocar de PUBLIC y anon; conservar/asegurar EXECUTE para authenticated y service_role.
REVOKE EXECUTE ON FUNCTION public.collect_invoice(uuid, date)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.uncollect_invoice(uuid)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_credit_payment_paid(uuid, date)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unmark_credit_payment_paid(uuid)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_payment_complement(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revert_payment_complement(uuid)        FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.collect_invoice(uuid, date)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uncollect_invoice(uuid)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_credit_payment_paid(uuid, date)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unmark_credit_payment_paid(uuid)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_payment_complement(uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revert_payment_complement(uuid)        TO authenticated, service_role;

-- ============ Funciones de trigger ============
-- Los triggers se ejecutan con los privilegios del dueño de la tabla; ningún rol
-- de cliente necesita EXECUTE directo. Revocar también de authenticated para que
-- no puedan invocarse vía RPC.
REVOKE EXECUTE ON FUNCTION public.sync_expense_invoice_cashflow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()      FROM PUBLIC, anon, authenticated;

-- ============ Default privileges para funciones futuras ============
-- Evitar que funciones creadas en el futuro obtengan EXECUTE para PUBLIC/anon
-- automáticamente. (Aplica a funciones creadas por el rol que ejecuta esta
-- migración, que es el que crea las migraciones del proyecto.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
