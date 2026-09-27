import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { fmtMXN } from "@/lib/finance";
import type { DashboardExpenseMonth, DashboardMonth } from "./types";

type MonthlyChartProps = {
  title: string;
  description: string;
  months: DashboardMonth[];
  color: string;
};

function formatAxisAmount(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return fmtMXN(value);
}

function MonthlyChart({ title, description, months, color }: MonthlyChartProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos para mostrar.</p>
        ) : (
          <>
            <ChartContainer config={{ amount: { label: title, color } }} className="h-56 w-full aspect-auto" aria-hidden="true">
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tickFormatter={formatAxisAmount} width={52} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => fmtMXN(value)} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <ul className="sr-only" aria-label={`Valores de ${title}`}>
              {months.map((month, index) => <li key={`${month.label}-${index}`}>{month.label}: {fmtMXN(month.amount)}</li>)}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function CollectionsChart({ months }: { months: DashboardMonth[] }) {
  return <MonthlyChart title="Cobros por mes" description="Facturas cobradas fiscalmente según el mes de cobro." months={months} color="hsl(var(--primary))" />;
}

export function OutstandingChart({ months }: { months: DashboardMonth[] }) {
  return <MonthlyChart title="Cartera pendiente actual" description="Saldo pendiente hoy de facturas emitidas en el año seleccionado; no es un histórico." months={months} color="hsl(var(--chart-2))" />;
}

export function ExpensesChart({ months }: { months: DashboardExpenseMonth[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Gastos registrados por mes</CardTitle>
        <CardDescription>Desglose de gastos deducibles y no deducibles.</CardDescription>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos para mostrar.</p>
        ) : (
          <>
            <ChartContainer config={{ deductible: { label: "Deducibles", color: "hsl(var(--chart-1))" }, nonDeductible: { label: "No deducibles", color: "hsl(var(--chart-3))" } }} className="h-56 w-full aspect-auto" aria-hidden="true">
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tickFormatter={formatAxisAmount} width={52} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value: number) => fmtMXN(value)} />
                <Bar dataKey="deductible" stackId="expenses" fill="var(--color-deductible)" />
                <Bar dataKey="nonDeductible" stackId="expenses" fill="var(--color-nonDeductible)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--chart-1))]" />Deducibles</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--chart-3))]" />No deducibles</span>
            </div>
            <ul className="sr-only" aria-label="Valores de gastos registrados por mes">
              {months.map((month, index) => <li key={`${month.label}-${index}`}>{month.label}: deducibles {fmtMXN(month.deductible)}, no deducibles {fmtMXN(month.nonDeductible)}</li>)}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
