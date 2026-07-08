import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MonthSelector from "@/components/MonthSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN } from "@/lib/finance";
import PaymentComplementDialog from "./PaymentComplementDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Complement = {
  id: string; client_id: string; folio_fiscal: string; date: string;
  total: number; payment_method: string | null; notes: string | null;
  month: number; year: number; traceability_only?: boolean;
};

const today = new Date();

export default function PaymentComplementsTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Complement | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Complement | null>(null);

  const { data: complements, isLoading } = useQuery({
    queryKey: ["payment_complements", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_complements")
        .select("*")
        .eq("year", year).eq("month", month)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Complement[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      // NOTA: incluye tipo_persona para que el select coincida con el resto de
      // consumidores de la key ["clients"] (ver IncomeInvoiceDialog) y evitar que
      // el cache sirva filas sin ese campo a un consumidor que sí lo necesita.
      const { data, error } = await supabase.from("clients").select("id, razon_social, rfc, tipo_persona").order("razon_social");
      if (error) throw error;
      return data as { id: string; razon_social: string; rfc: string; tipo_persona: "fisica" | "moral" | null }[];
    },
  });

  const { data: allocCounts } = useQuery({
    enabled: !!complements && complements.length > 0,
    queryKey: ["alloc_counts", complements?.map((c) => c.id).join(",")],
    queryFn: async () => {
      const ids = complements!.map((c) => c.id);
      const { data, error } = await supabase
        .from("payment_complement_allocations")
        .select("complement_id")
        .in("complement_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as { complement_id: string }[]).forEach((r) => {
        counts[r.complement_id] = (counts[r.complement_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const clientMap = useMemo(() => {
    const m = new Map<string, { razon_social: string; rfc: string; tipo_persona: "fisica" | "moral" | null }>();
    clients?.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    if (!complements) return [];
    const s = search.trim().toLowerCase();
    if (!s) return complements;
    return complements.filter((c) => {
      const cl = clientMap.get(c.client_id)?.razon_social.toLowerCase() ?? "";
      return `${cl} ${c.folio_fiscal.toLowerCase()}`.includes(s);
    });
  }, [complements, search, clientMap]);

  const totalSum = useMemo(() => filtered.reduce((s, c) => s + Number(c.total), 0), [filtered]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: rErr } = await supabase.rpc("revert_payment_complement", { _complement_id: id });
      if (rErr) throw rErr;
      const { error } = await supabase.from("payment_complements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment_complements"] });
      qc.invalidateQueries({ queryKey: ["income_invoices"] });
      qc.invalidateQueries({ queryKey: ["all_income_invoices_fiscal"] });
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Complemento eliminado");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["payment_complements"] });
    qc.invalidateQueries({ queryKey: ["income_invoices"] });
    qc.invalidateQueries({ queryKey: ["all_income_invoices_fiscal"] });
    qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
    qc.invalidateQueries({ queryKey: ["complement_allocations"] });
    qc.invalidateQueries({ queryKey: ["client_invoices"] });
    qc.invalidateQueries({ queryKey: ["alloc_counts"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo complemento
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente o folio" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="font-normal">{filtered.length} complementos</Badge>
          <Badge className="font-normal tabular-nums">Total: {fmtMXN(totalSum)}</Badge>
          <Badge variant="outline" className="font-normal">Informativo — los impuestos se calculan al cobrar la factura</Badge>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Sin complementos en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Facturas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const cl = clientMap.get(c.client_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm tabular-nums">{c.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-xs">{c.folio_fiscal.slice(0, 8)}…</span>
                            </TooltipTrigger>
                            <TooltipContent>{c.folio_fiscal}</TooltipContent>
                          </Tooltip>
                          {c.traceability_only && (
                            <Badge variant="outline" className="text-[10px] font-normal">Trazabilidad</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{cl?.razon_social ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.payment_method ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmtMXN(c.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{allocCounts?.[c.id] ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(c)}>
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
        <PaymentComplementDialog
          complement={editing}
          defaultYear={year}
          defaultMonth={month}
          onClose={() => setEditing(undefined)}
          onSaved={() => { invalidateAll(); setEditing(undefined); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar complemento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se reversará el cobro aplicado a las facturas relacionadas y se eliminará la entrada en flujo de efectivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
