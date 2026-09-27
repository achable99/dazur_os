import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MonthSelector from "@/components/MonthSelector";
import { Button } from "@/components/ui/button";
import CashflowDashboard from "@/components/cashflow/dashboard/CashflowDashboard";
import type { DashboardView } from "@/components/cashflow/dashboard/types";
import { useCashflowDashboard } from "@/hooks/useCashflowDashboard";

const today = new Date();

export default function FlujoEfectivo() {
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [view, setView] = useState<DashboardView>("month");
  const dashboard = useCashflowDashboard(year, month);
  const period = view === "year" ? dashboard.data?.annual : dashboard.data?.month;
  const hasPeriodData = period && (
    period.ingresosCobrados !== 0 || period.gastosRegistrados !== 0 || period.ivaAPagar !== 0 || period.isrACargo !== 0
  );
  const hasFiscalDetail = view === "year"
    ? dashboard.data?.months.some((row) => row.ivaAcreditableAjuste !== 0 || row.carryIvaFavor !== 0 || row.ivaResultado !== 0)
    : dashboard.data?.iva.adjustments !== 0 || dashboard.data?.iva.carryForward !== 0 || dashboard.data?.iva.result !== 0;
  const hasData = hasPeriodData || hasFiscalDetail || (dashboard.data?.kpis.pendingToday ?? 0) !== 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flujo de efectivo</h1>
          <p className="text-sm text-muted-foreground">Cobros, cartera pendiente e impuestos del período.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-border bg-card p-1" role="group" aria-label="Vista del flujo de efectivo">
            <Button type="button" size="sm" variant={view === "month" ? "secondary" : "ghost"} aria-pressed={view === "month"} onClick={() => setView("month")}>Mes</Button>
            <Button type="button" size="sm" variant={view === "year" ? "secondary" : "ghost"} aria-pressed={view === "year"} onClick={() => setView("year")}>Año</Button>
          </div>
          {view === "month" ? (
            <MonthSelector year={year} month={month} onChange={(nextYear, nextMonth) => { setYear(nextYear); setMonth(nextMonth); }} />
          ) : (
            <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card p-1">
              <Button type="button" variant="ghost" size="sm" aria-label="Año anterior" onClick={() => setYear((current) => current - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-16 text-center text-sm font-medium tabular-nums" aria-label={`Año ${year}`}>{year}</span>
              <Button type="button" variant="ghost" size="sm" aria-label="Año siguiente" onClick={() => setYear((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </div>

      {dashboard.isError ? (
        <CashflowDashboard status="error" error={dashboard.error instanceof Error ? dashboard.error.message : undefined} />
      ) : dashboard.isLoading ? (
        <CashflowDashboard status="loading" />
      ) : dashboard.data && hasData ? (
        <CashflowDashboard status="ready" data={dashboard.data} view={view} />
      ) : (
        <CashflowDashboard status="empty" />
      )}
    </div>
  );
}
