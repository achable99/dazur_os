import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "@/components/DatePicker";
import { toast } from "sonner";
import { fmtMXN, toLocalDateString, monthLabel } from "@/lib/finance";

type Complement = {
  id: string; client_id: string; folio_fiscal: string; date: string;
  total: number; payment_method: string | null; notes: string | null;
  traceability_only?: boolean;
};

type InvoiceRow = {
  id: string; folio_fiscal: string; date: string; total: number; paid_amount: number; is_collected: boolean;
};

interface Props {
  complement: Complement | null;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaymentComplementDialog({ complement, defaultYear, defaultMonth, onClose, onSaved }: Props) {
  const [clientId, setClientId] = useState(complement?.client_id ?? "");
  const [folio, setFolio] = useState(complement?.folio_fiscal ?? "");
  const [date, setDate] = useState<Date | undefined>(
    complement ? new Date(complement.date + "T00:00:00") : new Date(defaultYear, defaultMonth - 1, new Date().getDate())
  );
  const [total, setTotal] = useState(complement?.total?.toString() ?? "");
  const [paymentMethod, setPaymentMethod] = useState(complement?.payment_method ?? "");
  const [notes, setNotes] = useState(complement?.notes ?? "");
  const [allocations, setAllocations] = useState<Record<string, string>>({}); // invoice_id -> amount string
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "all" or "YYYY-MM"
  // Los complementos de pago son SIEMPRE solo trazabilidad: registro de referencia para el
  // SAT que no afecta flujo de efectivo ni impuestos.
  const traceabilityOnly = true;


  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, razon_social, rfc").order("razon_social");
      if (error) throw error;
      return data as { id: string; razon_social: string; rfc: string }[];
    },
  });

  // Existing allocations for this complement (if editing)
  const { data: existingAllocs } = useQuery({
    enabled: !!complement,
    queryKey: ["complement_allocations", complement?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_complement_allocations")
        .select("invoice_id, amount")
        .eq("complement_id", complement!.id);
      if (error) throw error;
      return data as { invoice_id: string; amount: number }[];
    },
  });

  // All invoices for the selected client
  const { data: invoices } = useQuery({
    enabled: !!clientId,
    queryKey: ["client_invoices", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income_invoices")
        .select("id, folio_fiscal, date, total, paid_amount, is_collected")
        .eq("client_id", clientId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as InvoiceRow[];
    },
  });

  // Allocations from OTHER complements covering this client's invoices, to exclude them
  const { data: otherAllocs } = useQuery({
    enabled: !!invoices && invoices.length > 0,
    queryKey: ["other_allocs", clientId, complement?.id, invoices?.map((i) => i.id).join(",")],
    queryFn: async () => {
      const ids = invoices!.map((i) => i.id);
      const { data, error } = await supabase
        .from("payment_complement_allocations")
        .select("invoice_id, complement_id")
        .in("invoice_id", ids);
      if (error) throw error;
      return (data as { invoice_id: string; complement_id: string }[]).filter(
        (a) => !complement || a.complement_id !== complement.id
      );
    },
  });

  // Seed allocations from existing on edit
  useEffect(() => {
    if (existingAllocs) {
      const map: Record<string, string> = {};
      existingAllocs.forEach((a) => { map[a.invoice_id] = String(a.amount); });
      setAllocations(map);
    }
  }, [existingAllocs]);

  const usedElsewhere = useMemo(
    () => new Set((otherAllocs ?? []).map((a) => a.invoice_id)),
    [otherAllocs]
  );

  // Invoices available: not in another complement, or already in this complement (editing)
  const availableInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((inv) => {
      if (allocations[inv.id] !== undefined) return true;
      return !usedElsewhere.has(inv.id);
    });
  }, [invoices, usedElsewhere, allocations]);

  // Month options from available invoices
  const monthOptions = useMemo(() => {
    const set = new Map<string, { y: number; m: number }>();
    availableInvoices.forEach((inv) => {
      const [y, m] = inv.date.split("-").map(Number);
      set.set(`${y}-${String(m).padStart(2, "0")}`, { y, m });
    });
    return Array.from(set.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, v]) => ({ key, label: monthLabel(v.m, v.y) }));
  }, [availableInvoices]);

  // Visible after month filter (but keep currently-selected ones always visible)
  const visibleInvoices = useMemo(() => {
    if (monthFilter === "all") return availableInvoices;
    return availableInvoices.filter((inv) => {
      if (allocations[inv.id] !== undefined) return true;
      const [y, m] = inv.date.split("-");
      return `${y}-${m}` === monthFilter;
    });
  }, [availableInvoices, monthFilter, allocations]);

  const toggleInvoice = (inv: InvoiceRow, checked: boolean) => {
    setAllocations((prev) => {
      const next = { ...prev };
      if (checked) {
        // Trazabilidad: el monto por CFDI es el total de la factura (referencia SAT, no afecta saldo)
        next[inv.id] = Number(inv.total).toFixed(2);
      } else {
        delete next[inv.id];
      }
      return next;
    });
  };

  const setAllocAmount = (id: string, v: string) => setAllocations((prev) => ({ ...prev, [id]: v }));

  const totalNum = Number(total) || 0;
  const allocSum = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations]
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Cliente requerido");
      if (!folio.trim()) throw new Error("Folio fiscal requerido");
      if (!date) throw new Error("Fecha requerida");
      if (!totalNum || totalNum <= 0) throw new Error("Monto total inválido");
      const entries = Object.entries(allocations)
        .map(([id, v]) => ({ id, amount: Number(v) || 0 }));
      if (entries.length === 0) throw new Error("Selecciona al menos una factura");
      // Trazabilidad: cada CFDI vinculado lleva un monto de referencia > 0 (su total).
      for (const e of entries) {
        const inv = invoices?.find((i) => i.id === e.id);
        if (!inv) throw new Error("Factura inválida");
        if (e.amount <= 0) {
          throw new Error(`El monto de la factura ${inv.folio_fiscal.slice(0,8)}… debe ser mayor a 0`);
        }
      }

      const payload = {
        client_id: clientId,
        folio_fiscal: folio.trim().toUpperCase(),
        date: toLocalDateString(date),
        total: totalNum,
        payment_method: paymentMethod.trim() || null,
        notes: notes.trim() || null,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        traceability_only: traceabilityOnly,
      };

      let complementId = complement?.id;

      if (complement) {
        const { error: rErr } = await supabase.rpc("revert_payment_complement", { _complement_id: complement.id });
        if (rErr) throw rErr;
        const { error: uErr } = await supabase.from("payment_complements").update(payload).eq("id", complement.id);
        if (uErr) throw uErr;
        const { error: dErr } = await supabase.from("payment_complement_allocations").delete().eq("complement_id", complement.id);
        if (dErr) throw dErr;
      } else {
        const { data: ins, error: iErr } = await supabase.from("payment_complements").insert(payload).select("id").single();
        if (iErr) throw iErr;
        complementId = ins.id;
      }

      const { error: aErr } = await supabase
        .from("payment_complement_allocations")
        .insert(entries.map((e) => ({ complement_id: complementId!, invoice_id: e.id, amount: e.amount })));
      if (aErr) throw aErr;

      const { error: applyErr } = await supabase.rpc("apply_payment_complement", { _complement_id: complementId! });
      if (applyErr) throw applyErr;
    },
    onSuccess: () => { toast.success("Complemento guardado"); onSaved(); },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const statusBadge = (inv: InvoiceRow) => {
    const existing = existingAllocs?.find((a) => a.invoice_id === inv.id)?.amount ?? 0;
    if (existing > 0) return <Badge variant="secondary" className="text-[10px]">En este complemento</Badge>;
    if (inv.is_collected) return <Badge variant="secondary" className="text-[10px]">Cobrada</Badge>;
    if (Number(inv.paid_amount) > 0) return <Badge variant="secondary" className="text-[10px] text-warning">Parcial</Badge>;
    return <Badge variant="outline" className="text-[10px]">Pendiente</Badge>;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{complement ? "Editar" : "Nuevo"} complemento de pago</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Select
              value={clientId}
              onValueChange={(v) => { setClientId(v); if (v !== clientId) { setAllocations({}); setMonthFilter("all"); } }}
              disabled={!!complement}
            >
              <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.razon_social} — {c.rfc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="folio">Folio Fiscal (UUID) *</Label>
              <Input id="folio" value={folio} onChange={(e) => setFolio(e.target.value.toUpperCase())} required className="font-mono uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de pago *</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="total">Monto total del complemento *</Label>
              <Input id="total" type="number" step="0.01" min="0.01" value={total} onChange={(e) => setTotal(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm">Método de pago</Label>
              <Input id="pm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Transferencia, efectivo, etc." />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
            <p className="text-sm font-medium">Solo trazabilidad</p>
            <p className="text-xs text-muted-foreground">
              Los complementos de pago se guardan únicamente como referencia para el SAT: no generan ingreso en el flujo de efectivo, no modifican el saldo de las facturas y no recalculan impuestos.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <Label>Facturas a liquidar</Label>
                {clientId && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando {visibleInvoices.length} de {availableInvoices.length} factura{availableInvoices.length === 1 ? "" : "s"} del cliente
                    {usedElsewhere.size > 0 && ` · ${usedElsewhere.size} ya en otro complemento`}
                  </p>
                )}
              </div>
              <div className="text-xs tabular-nums">
                Aplicado: <span className="font-medium">{fmtMXN(allocSum)}</span> /{" "}
                <span className="font-medium">{fmtMXN(totalNum)}</span>{" "}
                <Badge variant="secondary" className="ml-2 font-normal">Trazabilidad</Badge>
              </div>
            </div>

            {clientId && monthOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Filtrar por mes de emisión:</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los meses</SelectItem>
                    {monthOptions.map((o) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!clientId ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Selecciona un cliente.</div>
            ) : visibleInvoices.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Sin facturas disponibles para este filtro.</div>
            ) : (
              <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                {visibleInvoices.map((inv) => {
                  const existing = existingAllocs?.find((a) => a.invoice_id === inv.id)?.amount ?? 0;
                  const remaining = Math.max(0, Number(inv.total) - Number(inv.paid_amount) + existing);
                  const checked = allocations[inv.id] !== undefined;
                  const isReference = remaining <= 0.005;
                  return (
                    <div key={inv.id} className="flex items-center gap-3 p-2">
                      <Checkbox checked={checked} onCheckedChange={(c) => toggleInvoice(inv, !!c)} />
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono truncate">{inv.folio_fiscal}</span>
                          {statusBadge(inv)}
                        </div>
                        <div className="text-muted-foreground">
                          {inv.date} · Total {fmtMXN(inv.total)} · Saldo {fmtMXN(remaining)}
                          {isReference && <span className="ml-1 italic">· Solo referencia (sin saldo)</span>}
                        </div>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={inv.total}
                        value={allocations[inv.id] ?? ""}
                        onChange={(e) => setAllocAmount(inv.id, e.target.value)}
                        disabled={!checked}
                        className="w-32 tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
