import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import MonthSelector from "@/components/MonthSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN, monthLabel, periodKey, EXPENSE_CATEGORIES } from "@/lib/finance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EntryDialog from "@/components/cashflow/EntryDialog";
import CreditLinesPanel from "@/components/cashflow/CreditLinesPanel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CFEntry = {
  id: string; type: "income" | "expense"; concept: string; amount: number;
  date: string; category: string | null;
  origin: "manual" | "invoice" | "credit"; origin_id: string | null; notes: string | null;
};

const today = new Date();

export default function FlujoEfectivo() {
  const qc = useQueryClient();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [editing, setEditing] = useState<{ type: "income" | "expense"; entry?: CFEntry } | null>(null);
  const [deleting, setDeleting] = useState<CFEntry | null>(null);
  const [expenseFilter, setExpenseFilter] = useState<OriginFilter>("all");
  const [incomeFilter, setIncomeFilter] = useState<OriginFilter>("all");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["cash_flow_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_flow_entries").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as CFEntry[];
    },
  });

  const { data: openings } = useQuery({
    queryKey: ["opening_balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opening_balances").select("*").order("year").order("month");
      if (error) throw error;
      return data as { id: string; month: number; year: number; amount: number }[];
    },
  });

  const totals = useMemo(() => {
    if (!entries) return { saldoInicial: 0, ingresos: 0, gastos: 0, balance: 0 };
    const k = periodKey(year, month);

    // Use the most recent manual opening balance with periodKey <= k as the starting point.
    // This way, a manual override (e.g. "set saldo inicial" for a given month) properly
    // resets the running balance from that month forward.
    const baseOpening = (openings ?? [])
      .filter((o) => periodKey(o.year, o.month) <= k)
      .sort((a, b) => periodKey(b.year, b.month) - periodKey(a.year, a.month))[0];
    const baseK = baseOpening ? periodKey(baseOpening.year, baseOpening.month) : null;
    const running = baseOpening ? Number(baseOpening.amount) : 0;

    let priorIn = 0, priorOut = 0;
    let curIn = 0, curOut = 0;
    for (const e of entries) {
      const d = new Date(e.date + "T00:00:00");
      const ek = periodKey(d.getFullYear(), d.getMonth() + 1);
      // Only entries from the base month onward count toward the running balance.
      if (baseK !== null && ek < baseK) continue;
      if (ek < k) {
        if (e.type === "income") priorIn += Number(e.amount);
        else priorOut += Number(e.amount);
      } else if (ek === k) {
        if (e.type === "income") curIn += Number(e.amount);
        else curOut += Number(e.amount);
      }
    }
    const saldoInicial = running + priorIn - priorOut;
    return {
      saldoInicial,
      ingresos: curIn,
      gastos: curOut,
      balance: saldoInicial + curIn - curOut,
    };
  }, [entries, openings, year, month]);

  const monthEntries = useMemo(() => {
    if (!entries) return { ingresos: [] as CFEntry[], gastos: [] as CFEntry[] };
    const k = periodKey(year, month);
    const ing: CFEntry[] = [];
    const gas: CFEntry[] = [];
    for (const e of entries) {
      const d = new Date(e.date + "T00:00:00");
      if (periodKey(d.getFullYear(), d.getMonth() + 1) === k) {
        (e.type === "income" ? ing : gas).push(e);
      }
    }
    return { ingresos: ing, gastos: gas };
  }, [entries, year, month]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_flow_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Entrada eliminada");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flujo de Efectivo</h1>
          <p className="text-sm text-muted-foreground">Saldos arrastrados mes a mes.</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Saldo Inicial"
          value={totals.saldoInicial}
          loading={isLoading}
          tooltip="Saldo acumulado de meses anteriores"
        />
        <KpiCard label="Ingresos" value={totals.ingresos} loading={isLoading} valueClassName="text-success" />
        <KpiCard label="Gastos" value={totals.gastos} loading={isLoading} valueClassName="text-destructive" />
        <KpiCard
          label="Balance Final"
          value={totals.balance}
          loading={isLoading}
          valueClassName={totals.balance >= 0 ? "text-success" : "text-destructive"}
        />
      </div>

      {/* Income / Expense panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <EntryPanel
          title="Ingresos"
          buttonLabel="Agregar ingreso"
          entries={monthEntries.ingresos}
          loading={isLoading}
          type="income"
          filter={incomeFilter}
          onFilterChange={setIncomeFilter}
          onAdd={() => setEditing({ type: "income" })}
          onEdit={(e) => setEditing({ type: "income", entry: e })}
          onDelete={(e) => setDeleting(e)}
        />
        <EntryPanel
          title="Gastos"
          buttonLabel="Agregar gasto"
          entries={monthEntries.gastos}
          loading={isLoading}
          type="expense"
          filter={expenseFilter}
          onFilterChange={setExpenseFilter}
          onAdd={() => setEditing({ type: "expense" })}
          onEdit={(e) => setEditing({ type: "expense", entry: e })}
          onDelete={(e) => setDeleting(e)}
        />
      </div>

      <CreditLinesPanel />

      {/* Monthly summary */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Resumen del Mes — {monthLabel(month, year)}</h3>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryItem label="Saldo inicial" value={fmtMXN(totals.saldoInicial)} />
          <SummaryItem label="+ Ingresos" value={fmtMXN(totals.ingresos)} className="text-success" />
          <SummaryItem label="− Gastos" value={fmtMXN(totals.gastos)} className="text-destructive" />
          <SummaryItem
            label="= Balance final"
            value={fmtMXN(totals.balance)}
            className={`text-lg ${totals.balance >= 0 ? "text-success" : "text-destructive"} font-semibold`}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Este balance se traslada automáticamente como saldo inicial del siguiente mes.
        </p>
      </Card>

      {editing && (
        <EntryDialog
          type={editing.type}
          entry={editing.entry}
          defaultYear={year}
          defaultMonth={month}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({ label, value, loading, valueClassName, tooltip }: {
  label: string; value: number; loading?: boolean; valueClassName?: string; tooltip?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button"><Info className="h-3.5 w-3.5" /></button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-9 w-32 mt-2" />
      ) : (
        <div className={`mt-2 text-2xl font-semibold tabular-nums ${valueClassName ?? "text-foreground"}`}>
          {fmtMXN(value)}
        </div>
      )}
    </Card>
  );
}

function SummaryItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums font-medium ${className ?? ""}`}>{value}</div>
    </div>
  );
}

type OriginFilter = "all" | "manual" | "invoice" | "credit";

function EntryPanel({
  title, buttonLabel, entries, loading, type, filter, onFilterChange, onAdd, onEdit, onDelete,
}: {
  title: string; buttonLabel: string; entries: CFEntry[]; loading?: boolean;
  type: "income" | "expense";
  filter: OriginFilter;
  onFilterChange: (f: OriginFilter) => void;
  onAdd: () => void;
  onEdit: (e: CFEntry) => void;
  onDelete: (e: CFEntry) => void;
}) {
  const filtered = filter === "all" ? entries : entries.filter((e) => e.origin === filter);
  const filteredSum = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const noun = type === "expense" ? "gastos" : "ingresos";

  const filterOptions: { value: OriginFilter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "invoice", label: "Con factura" },
    { value: "manual", label: "Sin factura" },
    { value: "credit", label: "Crédito" },
  ];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" /> {buttonLabel}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                filter === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!loading && entries.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            Mostrando {filtered.length} de {entries.length} {noun} ({fmtMXN(filteredSum)})
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {entries.length === 0 ? "Sin entradas en este mes." : "Sin entradas para este filtro."}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Fecha</TableHead>
                {type === "expense" && <TableHead>Categoría</TableHead>}
                <TableHead>Origen</TableHead>
                {type === "income" && <TableHead>Estado</TableHead>}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[200px] truncate">{e.concept}</TableCell>
                  <TableCell className={`text-right tabular-nums ${type === "income" ? "text-success" : "text-destructive"}`}>
                    {fmtMXN(e.amount)}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">{e.date}</TableCell>
                  {type === "expense" && (
                    <TableCell>
                      {e.category && <Badge variant="secondary" className="font-normal">{e.category}</Badge>}
                    </TableCell>
                  )}
                  <TableCell><OriginBadge origin={e.origin} /></TableCell>
                  {type === "income" && (
                    <TableCell>
                      <Badge className="bg-success text-success-foreground">Recibido</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {e.origin === "manual" ? (
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(e)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled title="Generado automáticamente">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function OriginBadge({ origin }: { origin: "manual" | "invoice" | "credit" }) {
  if (origin === "manual") return <Badge variant="secondary" className="font-normal">Manual</Badge>;
  if (origin === "invoice") return <Badge className="bg-info text-info-foreground font-normal">Factura</Badge>;
  return <Badge variant="outline" className="font-normal">Crédito</Badge>;
}

// Re-export EXPENSE_CATEGORIES for child components
export { EXPENSE_CATEGORIES };
