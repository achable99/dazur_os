import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MonthSelector from "@/components/MonthSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN, INVOICE_TYPES } from "@/lib/finance";
import IncomeInvoiceDialog from "./IncomeInvoiceDialog";
import CollectInvoiceDialog from "./CollectInvoiceDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Invoice = {
  id: string; client_id: string; folio_fiscal: string; invoice_type: string;
  date: string; subtotal: number; iva: number; isr: number; total: number;
  is_collected: boolean; collected_date: string | null; notes: string | null;
  month: number; year: number; paid_amount: number;
};

const today = new Date();

export default function IncomeInvoicesTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("all");
  const [estado, setEstado] = useState("all");
  const [editing, setEditing] = useState<Invoice | null | undefined>(undefined);
  const [collecting, setCollecting] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["income_invoices", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income_invoices")
        .select("*")
        .eq("year", year).eq("month", month)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      // NOTA: incluye tipo_persona aunque este componente no lo use directamente —
      // TODAS las queries con key ["clients"] deben compartir el mismo select
      // (superset), ya que React Query cachea por key y sirve la última respuesta
      // a cualquier consumidor de esa key (ver IncomeInvoiceDialog).
      const { data, error } = await supabase.from("clients").select("id, razon_social, rfc, tipo_persona").order("razon_social");
      if (error) throw error;
      return data as { id: string; razon_social: string; rfc: string; tipo_persona: "fisica" | "moral" | null }[];
    },
  });

  const clientMap = useMemo(() => {
    const m = new Map<string, { razon_social: string; rfc: string; tipo_persona: "fisica" | "moral" | null }>();
    clients?.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const s = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (tipo !== "all" && i.invoice_type !== tipo) return false;
      if (estado === "collected" && !i.is_collected) return false;
      if (estado === "pending" && i.is_collected) return false;
      if (s) {
        const cl = clientMap.get(i.client_id)?.razon_social.toLowerCase() ?? "";
        if (!`${cl} ${i.folio_fiscal.toLowerCase()}`.includes(s)) return false;
      }
      return true;
    });
  }, [invoices, search, tipo, estado, clientMap]);

  const totals = useMemo(() => filtered.reduce((acc, i) => ({
    subtotal: acc.subtotal + Number(i.subtotal),
    iva: acc.iva + Number(i.iva),
    isr: acc.isr + Number(i.isr),
    total: acc.total + Number(i.total),
  }), { subtotal: 0, iva: 0, isr: 0, total: 0 }), [filtered]);

  const uncollect = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("uncollect_invoice", { _invoice_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income_invoices"] });
      qc.invalidateQueries({ queryKey: ["all_income_invoices_fiscal"] });
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Factura marcada como pendiente");
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("income_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income_invoices"] });
      qc.invalidateQueries({ queryKey: ["all_income_invoices_fiscal"] });
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
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva factura
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente o folio fiscal" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {INVOICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="collected">Cobradas</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="font-normal">{filtered.length} facturas</Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">Subtotal: {fmtMXN(totals.subtotal)}</Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">IVA: {fmtMXN(totals.iva)}</Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">ISR: {fmtMXN(totals.isr)}</Badge>
          <Badge className="font-normal tabular-nums">Total: {fmtMXN(totals.total)}</Badge>
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">ISR</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cobrada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => {
                  const cl = clientMap.get(i.client_id);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="max-w-[180px] truncate">{cl?.razon_social ?? "—"}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono text-xs">{i.folio_fiscal.slice(0, 8)}…</span>
                          </TooltipTrigger>
                          <TooltipContent>{i.folio_fiscal}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="font-normal">{i.invoice_type}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMXN(i.subtotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMXN(i.iva)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMXN(i.isr)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtMXN(i.total)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{i.date}</TableCell>
                      <TableCell>
                        {(() => {
                          const paid = Number(i.paid_amount);
                          const tot = Number(i.total);
                          const isPartial = !i.is_collected && paid > 0.005;
                          return (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={i.is_collected}
                                onCheckedChange={(c) => {
                                  if (c) setCollecting(i);
                                  else uncollect.mutate(i.id);
                                }}
                              />
                              {i.is_collected ? (
                                <Badge className="bg-success text-success-foreground font-normal">
                                  Cobrada {i.collected_date}
                                </Badge>
                              ) : isPartial ? (
                                <Badge variant="secondary" className="font-normal text-warning tabular-nums">
                                  Parcial {fmtMXN(paid)} / {fmtMXN(tot)}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="font-normal text-warning">Pendiente</Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {editing !== undefined && (
        <IncomeInvoiceDialog
          invoice={editing}
          defaultYear={year}
          defaultMonth={month}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["income_invoices"] });
            qc.invalidateQueries({ queryKey: ["all_income_invoices_fiscal"] });
            // Editar una factura cobrada actualiza su entrada de flujo (trigger en DB)
            qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
            setEditing(undefined);
          }}
        />
      )}

      {collecting && (
        <CollectInvoiceDialog
          invoice={collecting}
          onClose={() => setCollecting(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["income_invoices"] });
            qc.invalidateQueries({ queryKey: ["all_income_invoices_fiscal"] });
            qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
            setCollecting(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Si la factura estaba cobrada, se eliminará también la entrada de ingreso en flujo de efectivo.
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
