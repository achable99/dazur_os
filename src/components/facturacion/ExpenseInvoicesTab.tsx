import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MonthSelector from "@/components/MonthSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Ban } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN, EXPENSE_INVOICE_CATEGORIES } from "@/lib/finance";
import ExpenseInvoiceDialog from "./ExpenseInvoiceDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Invoice = {
  id: string; concept: string; folio_fiscal: string; date: string;
  subtotal: number; iva: number; total: number; category: string;
  notes: string | null; month: number; year: number; no_deducible: boolean;
};

const today = new Date();

export default function ExpenseInvoicesTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Invoice | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["expense_invoices", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_invoices").select("*")
        .eq("year", year).eq("month", month).order("date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const s = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (cat !== "all" && i.category !== cat) return false;
      if (s && !`${i.concept} ${i.folio_fiscal}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [invoices, search, cat]);

  const totals = useMemo(() => filtered.reduce((acc, i) => ({
    subtotal: acc.subtotal + Number(i.subtotal),
    // El IVA de facturas no deducibles no se acredita (coincide con el Resumen Fiscal)
    iva: acc.iva + (i.no_deducible ? 0 : Number(i.iva)),
    total: acc.total + Number(i.total),
    noDeducibles: acc.noDeducibles + (i.no_deducible ? 1 : 0),
  }), { subtotal: 0, iva: 0, total: 0, noDeducibles: 0 }), [filtered]);

  const uniqueCats = useMemo(() => {
    const s = new Set<string>();
    invoices?.forEach((i) => s.add(i.category));
    return Array.from(s);
  }, [invoices]);

  const toggleNoDeducible = useMutation({
    mutationFn: async (inv: Invoice) => {
      const { error } = await supabase
        .from("expense_invoices").update({ no_deducible: !inv.no_deducible }).eq("id", inv.id);
      if (error) throw error;
      return !inv.no_deducible;
    },
    onSuccess: (nowNoDeducible) => {
      qc.invalidateQueries({ queryKey: ["expense_invoices"] });
      qc.invalidateQueries({ queryKey: ["all_expense_invoices"] });
      toast.success(nowNoDeducible ? "Factura marcada como no deducible" : "Factura marcada como deducible", {
        description: nowNoDeducible
          ? "Su IVA y total ya no cuentan en el Resumen Fiscal."
          : "Su IVA y total vuelven a contar en el Resumen Fiscal.",
      });
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_invoices"] });
      qc.invalidateQueries({ queryKey: ["all_expense_invoices"] });
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Factura eliminada");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" /> Nueva factura</Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por concepto o folio" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {uniqueCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="font-normal">{filtered.length} facturas</Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">Subtotal: {fmtMXN(totals.subtotal)}</Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">IVA acreditable: {fmtMXN(totals.iva)}</Badge>
          <Badge className="font-normal tabular-nums">Total: {fmtMXN(totals.total)}</Badge>
          {totals.noDeducibles > 0 && (
            <Badge variant="destructive" className="font-normal">{totals.noDeducibles} no deducible{totals.noDeducibles > 1 ? "s" : ""}</Badge>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Sin facturas en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id} className={`hover:bg-amber-50 dark:hover:bg-amber-950/40 ${i.no_deducible ? "opacity-60" : ""}`}>
                    <TableCell className="max-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{i.concept}</span>
                        {i.no_deducible && (
                          <Badge variant="destructive" className="font-normal shrink-0">No deducible</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{i.folio_fiscal}</TableCell>
                    <TableCell className="text-sm tabular-nums">{i.date}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMXN(i.subtotal)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${i.no_deducible ? "line-through text-muted-foreground" : ""}`}>{fmtMXN(i.iva)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtMXN(i.total)}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-normal">{i.category}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" size="icon"
                        className={`h-8 w-8 ${i.no_deducible ? "text-destructive hover:text-destructive" : ""}`}
                        title={i.no_deducible ? "Volver a marcar como deducible" : "Marcar como no deducible (el SAT rechazó la deducción)"}
                        disabled={toggleNoDeducible.isPending && toggleNoDeducible.variables?.id === i.id}
                        onClick={() => toggleNoDeducible.mutate(i)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {editing !== undefined && (
        <ExpenseInvoiceDialog
          invoice={editing}
          defaultYear={year}
          defaultMonth={month}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["expense_invoices"] });
            qc.invalidateQueries({ queryKey: ["all_expense_invoices"] });
            qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
            setEditing(undefined);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              También se eliminará la entrada correspondiente en flujo de efectivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteInvoice.mutate(deleting.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Re-export categories used elsewhere
export { EXPENSE_INVOICE_CATEGORIES };
