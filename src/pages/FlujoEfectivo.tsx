import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import MonthSelector from "@/components/MonthSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN, periodKey, EXPENSE_CATEGORIES } from "@/lib/finance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EntryDialog from "@/components/cashflow/EntryDialog";
import CreditLinesPanel from "@/components/cashflow/CreditLinesPanel";
import CashflowDashboard from "@/components/cashflow/dashboard/CashflowDashboard";
import { useCashflowDashboard } from "@/hooks/useCashflowDashboard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [operationsOpen, setOperationsOpen] = useState(false);
  const dashboard = useCashflowDashboard(year, month);

  const invalidateDashboard = () => qc.invalidateQueries({
    predicate: ({ queryKey }) => queryKey.includes("cashflow_dashboard"),
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["cash_flow_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_flow_entries").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as CFEntry[];
    },
  });

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
      invalidateDashboard();
      toast.success("Entrada eliminada");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flujo de efectivo</h1>
          <p className="text-sm text-muted-foreground">Cobros, cartera pendiente e impuestos del período.</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {dashboard.isError ? (
        <CashflowDashboard status="error" error={dashboard.error instanceof Error ? dashboard.error.message : undefined} />
      ) : dashboard.isLoading ? (
        <CashflowDashboard status="loading" />
      ) : dashboard.data && (
        dashboard.data.collectionsByMonth.some(({ amount }) => amount !== 0) ||
        dashboard.data.outstandingByIssueMonth.some(({ amount }) => amount !== 0) ||
        dashboard.data.expensesByMonth.some(({ deductible, nonDeductible }) => deductible !== 0 || nonDeductible !== 0) ||
        dashboard.data.iva.adjustments !== 0 || dashboard.data.iva.carryForward !== 0
      ) ? (
        <CashflowDashboard status="ready" data={dashboard.data} />
      ) : (
        <CashflowDashboard status="empty" />
      )}

      <Collapsible open={operationsOpen} onOpenChange={setOperationsOpen} className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Movimientos y créditos</h2>
            <p className="text-sm text-muted-foreground">Consulta y administra ingresos, gastos y líneas de crédito.</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" aria-controls="cash-operations" className="gap-2">
              {operationsOpen ? "Ocultar movimientos y créditos" : "Abrir movimientos y créditos"}
              <ChevronDown className={`h-4 w-4 transition-transform ${operationsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent id="cash-operations" className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
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
        </CollapsibleContent>
      </Collapsible>

      {editing && (
        <EntryDialog
          type={editing.type}
          entry={editing.entry}
          defaultYear={year}
          defaultMonth={month}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
            invalidateDashboard();
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
              aria-pressed={filter === opt.value}
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${e.concept}`} onClick={() => onEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Eliminar ${e.concept}`} onClick={() => onDelete(e)}>
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
