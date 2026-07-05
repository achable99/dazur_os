import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronDown, ChevronUp, Trash2, Pencil, Check, X } from "lucide-react";
import { fmtMXN, toLocalDateString } from "@/lib/finance";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import CreditLineDialog from "./CreditLineDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CreditLine = {
  id: string; name: string; type: "revolving" | "fixed";
  total_amount: number; used_amount: number;
  interest_rate: number; rate_type: "monthly" | "annual";
  start_date: string; num_payments: number; payment_day: number;
};

type CreditPayment = {
  id: string; credit_line_id: string; payment_number: number;
  due_date: string; principal: number; interest: number; total: number;
  status: "pending" | "paid"; paid_date: string | null;
};

export default function CreditLinesPanel() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<CreditLine | null>(null);
  const [editingDate, setEditingDate] = useState<{ id: string; value: string } | null>(null);

  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ["credit_lines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_lines").select("*").order("created_at");
      if (error) throw error;
      return data as CreditLine[];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["credit_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_payments").select("*").order("payment_number");
      if (error) throw error;
      return data as CreditPayment[];
    },
  });

  const paymentsByLine = useMemo(() => {
    const m: Record<string, CreditPayment[]> = {};
    payments?.forEach((p) => {
      (m[p.credit_line_id] ||= []).push(p);
    });
    return m;
  }, [payments]);

  const markPaid = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.rpc("mark_credit_payment_paid", {
        _payment_id: paymentId,
        _paid_date: toLocalDateString(new Date()),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_payments"] });
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Pago registrado");
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const unmarkPaid = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.rpc("unmark_credit_payment_paid", { _payment_id: paymentId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_payments"] });
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Pago revertido");
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const updateDueDate = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string }) => {
      if (!due_date) throw new Error("Fecha inválida");
      const { error } = await supabase
        .from("credit_payments")
        .update({ due_date })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_payments"] });
      toast.success("Fecha actualizada");
      setEditingDate(null);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_lines"] });
      qc.invalidateQueries({ queryKey: ["credit_payments"] });
      qc.invalidateQueries({ queryKey: ["cash_flow_entries"] });
      toast.success("Línea eliminada");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Líneas de Crédito</h3>
          <p className="text-xs text-muted-foreground">Gestiona créditos revolventes y a plazo fijo.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Agregar línea
        </Button>
      </div>

      {linesLoading ? (
        <div className="space-y-2"><Skeleton className="h-24 w-full" /></div>
      ) : lines && lines.length > 0 ? (
        <div className="space-y-3">
          {lines.map((l) => {
            const linePayments = paymentsByLine[l.id] ?? [];
            const paidPayments = linePayments.filter((p) => p.status === "paid");
            const totalPrincipal = linePayments.reduce((s, p) => s + Number(p.principal), 0);
            const paidPrincipal = paidPayments.reduce((s, p) => s + Number(p.principal), 0);
            const isFixed = l.type === "fixed";
            const progressRatio = isFixed
              ? (totalPrincipal > 0 ? Math.min(100, (paidPrincipal / totalPrincipal) * 100) : 0)
              : (Number(l.total_amount) > 0
                  ? Math.min(100, (Number(l.used_amount) / Number(l.total_amount)) * 100)
                  : 0);
            const next = linePayments.find((p) => p.status === "pending");
            const dueSoon = next
              ? (new Date(next.due_date + "T00:00:00").getTime() - Date.now()) / 86400000 <= 7
              : false;
            const isOpen = expanded[l.id];

            return (
              <div key={l.id} className="rounded-md border border-border">
                <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                  <div className="lg:col-span-3">
                    <div className="font-medium">{l.name}</div>
                    <Badge
                      variant="secondary"
                      className={`mt-1 font-normal ${l.type === "revolving" ? "bg-info/10 text-info" : "bg-purple-500/10 text-purple-600 dark:text-purple-300"}`}
                    >
                      {l.type === "revolving" ? "Revolvente" : "Plazo fijo"}
                    </Badge>
                  </div>
                  <div className="lg:col-span-6 space-y-1.5">
                    {isFixed ? (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        <span>Pagado: <span className="text-foreground font-medium">{fmtMXN(paidPrincipal)}</span> de <span className="text-foreground font-medium">{fmtMXN(totalPrincipal)}</span></span>
                        <span className="mx-2">·</span>
                        <span>{paidPayments.length} de {linePayments.length} cuotas</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        <span>Límite: <span className="text-foreground font-medium">{fmtMXN(l.total_amount)}</span></span>
                        <span className="mx-2">·</span>
                        <span>Usado: <span className="text-foreground font-medium">{fmtMXN(l.used_amount)}</span></span>
                        <span className="mx-2">·</span>
                        <span>Disponible: <span className="text-foreground font-medium">{fmtMXN(Number(l.total_amount) - Number(l.used_amount))}</span></span>
                      </div>
                    )}
                    <Progress value={progressRatio} className="h-1.5" />
                    <div className="text-xs text-muted-foreground">
                      Tasa: {l.interest_rate}% {l.rate_type === "monthly" ? "mensual" : "anual"}
                    </div>
                  </div>
                  <div className="lg:col-span-3 flex flex-col gap-1.5 lg:items-end">
                    {next ? (
                      <>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>Próximo: {next.due_date}</span>
                          {dueSoon && <Badge className="bg-warning text-warning-foreground font-normal">Vence pronto</Badge>}
                        </div>
                        <div className="text-sm font-medium tabular-nums">{fmtMXN(next.total)}</div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">Sin pagos pendientes</div>
                    )}
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setExpanded((s) => ({ ...s, [l.id]: !s[l.id] }))}>
                        {isOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                        Ver pagos
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(l)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-border bg-muted/30 p-3 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Capital</TableHead>
                          <TableHead className="text-right">Interés</TableHead>
                          <TableHead className="text-right">Total cuota</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linePayments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="tabular-nums">{p.payment_number}</TableCell>
                            <TableCell className="tabular-nums text-sm">
                              {editingDate?.id === p.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="date"
                                    value={editingDate.value}
                                    className="h-8 w-auto"
                                    onChange={(e) => setEditingDate({ id: p.id, value: e.target.value })}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => updateDueDate.mutate({ id: p.id, due_date: editingDate.value })}
                                    disabled={updateDueDate.isPending}
                                  >
                                    <Check className="h-4 w-4 text-success" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => setEditingDate(null)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span>{p.due_date}</span>
                                  {p.status === "pending" && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => setEditingDate({ id: p.id, value: p.due_date })}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{fmtMXN(p.principal)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtMXN(p.interest)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmtMXN(p.total)}</TableCell>
                            <TableCell>
                              {p.status === "paid"
                                ? <Badge className="bg-success text-success-foreground font-normal">Pagado</Badge>
                                : <Badge variant="secondary" className="font-normal text-warning">Pendiente</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.status === "pending" ? (
                                <Button size="sm" variant="outline" onClick={() => markPaid.mutate(p.id)}>
                                  Marcar pagado
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => unmarkPaid.mutate(p.id)}>
                                  Revertir
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">Sin líneas de crédito registradas.</div>
      )}

      {creating && (
        <CreditLineDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["credit_lines"] });
            qc.invalidateQueries({ queryKey: ["credit_payments"] });
            setCreating(false);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar línea de crédito?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también los pagos programados. Los pagos ya marcados como pagados generaron entradas en flujo de efectivo que se mantendrán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteLine.mutate(deleting.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
