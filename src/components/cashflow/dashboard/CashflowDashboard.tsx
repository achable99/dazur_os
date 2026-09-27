import { Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtMXN, pctLabel } from "@/lib/finance";
import { CollectionsChart, ExpensesChart, OutstandingChart } from "./DashboardCharts";
import type { CashflowDashboardProps, DashboardIsr, DashboardIva, DashboardKpis } from "./types";

export type { CashflowDashboardData, CashflowDashboardProps, DashboardExpenseMonth, DashboardIva, DashboardIsr, DashboardKpis, DashboardMonth } from "./types";

function Metric({ label, value, description, className }: { label: string; value: number; description: string; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums break-words">{fmtMXN(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardKpiCards({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Cobrado fiscalmente" value={kpis.collectedFiscal} description="Cobros del período seleccionado." />
      <Metric label="Saldo pendiente hoy" value={kpis.pendingToday} description="Cartera actual de facturas emitidas en el año seleccionado; no es histórica." />
      <Metric label="Gastos registrados" value={kpis.registeredExpenses} description="Gastos capturados en el período." />
      <Metric label="Impuestos" value={kpis.taxes} description="Total de impuestos del período según el resumen fiscal." />
      <Metric label="Remanente estimado" value={kpis.remanenteEstimado} description="Estimación del período seleccionado; no es saldo bancario ni saldo fiscal definitivo." className="bg-muted/30 sm:col-span-2 xl:col-span-4" />
    </div>
  );
}

function AmountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{fmtMXN(value)}</dd>
    </div>
  );
}

export function IvaPanel({ iva }: { iva: DashboardIva }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">IVA del período</CardTitle>
        <CardDescription>Desglose fiscal de traslado, acreditamiento y saldo previo.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl>
          <AmountRow label="IVA trasladado" value={iva.transferred} />
          <AmountRow label="IVA acreditable" value={iva.creditable} />
          <AmountRow label="Ajustes al acreditable" value={iva.adjustments} />
          <AmountRow label="IVA a favor previo (arrastre)" value={iva.carryForward} />
        </dl>
        <div className="mt-4 rounded-md bg-muted p-4">
          <p className="text-sm font-medium">{iva.result >= 0 ? "IVA a pagar" : "IVA a favor"}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{fmtMXN(Math.abs(iva.result))}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function IsrCard({ title, isr }: { title: string; isr: DashboardIsr }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Estimación RESICO sobre ingresos cobrados.</CardDescription>
      </CardHeader>
      <CardContent>
        {isr.isrExceeded && (
          <Alert className="mb-4 border-amber-500/50 text-amber-600 [&>svg]:text-amber-600">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Base fuera del rango RESICO</AlertTitle>
            <AlertDescription>
              Se aplicó la tasa máxima porque la base excede el rango configurado. Los importes derivados son estimaciones y requieren revisión fiscal.
            </AlertDescription>
          </Alert>
        )}
        <dl>
          <AmountRow label="Base cobrada sin IVA" value={isr.base} />
          <div className="flex justify-between gap-4 border-b py-2 text-sm">
            <dt className="text-muted-foreground">Tasa aplicada</dt>
            <dd className="font-medium tabular-nums">{pctLabel(isr.rate)}</dd>
          </div>
          <AmountRow label="ISR causado" value={isr.caused} />
          <AmountRow label="ISR retenido" value={isr.withheld} />
          <AmountRow label="Provisión total" value={isr.provision} />
        </dl>
        <div className="mt-4 rounded-md bg-muted p-4">
          <p className="text-sm font-medium">Sobrante estimado de provisión</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{fmtMXN(isr.estimatedSurplus)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function IsrCards({ period, annual }: { period: DashboardIsr; annual: DashboardIsr }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <IsrCard title="ISR del período" isr={period} />
      <IsrCard title="ISR anual acumulado" isr={annual} />
    </div>
  );
}

export function DashboardLimitations() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Pagos parciales</AlertTitle>
        <AlertDescription>Los importes fiscales mostrados pueden no reflejar cobros parciales de una factura. Revísalos antes de usarlos para una declaración.</AlertDescription>
      </Alert>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Cartera no histórica</AlertTitle>
        <AlertDescription>La cartera pendiente se calcula con el saldo actual y se agrupa por mes de emisión; no representa el saldo que había al cierre de cada mes.</AlertDescription>
      </Alert>
    </div>
  );
}

export function DashboardLoading() {
  return <div className="space-y-4" role="status" aria-label="Cargando tablero de flujo de efectivo"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32" />)}</div><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div><span className="sr-only">Cargando tablero de flujo de efectivo</span></div>;
}

export function DashboardEmpty() {
  return <Card><CardContent className="py-10 text-center"><p className="font-medium">Aún no hay datos para este tablero.</p><p className="mt-1 text-sm text-muted-foreground">Registra facturas o gastos para ver el resumen.</p></CardContent></Card>;
}

export function DashboardError({ message }: { message?: string }) {
  return <Alert variant="destructive"><AlertTitle>No se pudo cargar el tablero</AlertTitle><AlertDescription>{message || "Intenta actualizar la página en unos momentos."}</AlertDescription></Alert>;
}

export default function CashflowDashboard(props: CashflowDashboardProps) {
  if (props.status === "loading") return <DashboardLoading />;
  if (props.status === "error") return <DashboardError message={props.error} />;
  if (props.status === "empty") return <DashboardEmpty />;

  const { data } = props;
  return (
    <section className="space-y-4" aria-label="Tablero de flujo de efectivo">
      <DashboardKpiCards kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CollectionsChart months={data.collectionsByMonth} />
        <OutstandingChart months={data.outstandingByIssueMonth} />
      </div>
      <ExpensesChart months={data.expensesByMonth} />
      <div className="grid gap-4 xl:grid-cols-2">
        <IvaPanel iva={data.iva} />
        <IsrCards period={data.periodIsr} annual={data.annualIsr} />
      </div>
      <DashboardLimitations />
    </section>
  );
}
