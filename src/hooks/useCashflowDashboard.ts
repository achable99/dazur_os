import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildCashflowDashboard,
  type IncomeInvoice, type ExpenseInvoice, type FiscalCarryover, type FiscalAdjustment,
} from "@/lib/cashflowDashboard";

const PAGE_SIZE = 1000;

async function fetchAll<T>(page: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

/** Datos fiscales del ejercicio. Las keys siguen los prefijos invalidados por Facturación. */
export function useCashflowDashboard(year: number, selectedMonth = 12) {
  const [incomes, expenses, carryovers, adjustments] = useQueries({
    queries: [
      {
        queryKey: ["all_income_invoices_fiscal", "cashflow_dashboard"],
        queryFn: () => fetchAll<IncomeInvoice>(async (from, to) => {
          const { data, error } = await supabase.from("income_invoices")
            .select("year,month,date,total,paid_amount,subtotal,iva,isr,is_collected,collected_date")
            .order("id").range(from, to);
          return { data, error };
        }),
      },
      {
        queryKey: ["all_expense_invoices", year, "cashflow_dashboard"],
        queryFn: () => fetchAll<ExpenseInvoice>(async (from, to) => {
          const { data, error } = await supabase.from("expense_invoices")
            .select("year,month,total,iva,no_deducible")
            .eq("year", year).order("id").range(from, to);
          return { data, error };
        }),
      },
      {
        queryKey: ["fiscal_carryovers", year, "cashflow_dashboard"],
        queryFn: () => fetchAll<FiscalCarryover>(async (from, to) => {
          const { data, error } = await supabase.from("fiscal_carryovers")
            .select("from_year,from_month,to_year,to_month,iva_favor_amount")
            .eq("to_year", year).order("id").range(from, to);
          return { data, error };
        }),
      },
      {
        queryKey: ["fiscal_period_adjustments", year, "cashflow_dashboard"],
        queryFn: () => fetchAll<FiscalAdjustment>(async (from, to) => {
          const { data, error } = await supabase.from("fiscal_period_adjustments")
            .select("year,month,iva_acreditable_adjustment")
            .eq("year", year).order("id").range(from, to);
          return { data, error };
        }),
      },
    ],
  });

  const isLoading = incomes.isPending || expenses.isPending || carryovers.isPending || adjustments.isPending;
  const error = incomes.error ?? expenses.error ?? carryovers.error ?? adjustments.error;
  const data = incomes.data && expenses.data && carryovers.data && adjustments.data
    ? buildCashflowDashboard({ incomes: incomes.data, expenses: expenses.data, carryovers: carryovers.data, adjustments: adjustments.data }, year, selectedMonth)
    : undefined;

  return {
    data, isLoading, isError: !!error, error,
    isFetching: incomes.isFetching || expenses.isFetching || carryovers.isFetching || adjustments.isFetching,
    refetch: async () => {
      await Promise.all([incomes.refetch(), expenses.refetch(), carryovers.refetch(), adjustments.refetch()]);
    },
  };
}
