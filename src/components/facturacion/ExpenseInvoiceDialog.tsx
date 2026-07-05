import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "@/components/DatePicker";
import { toast } from "sonner";
import { fmtMXN, EXPENSE_INVOICE_CATEGORIES, toLocalDateString } from "@/lib/finance";

type Invoice = {
  id: string; concept: string; folio_fiscal: string; date: string;
  subtotal: number; iva: number; total: number; category: string; notes: string | null;
  no_deducible: boolean;
};

interface Props {
  invoice: Invoice | null;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function ExpenseInvoiceDialog({ invoice, defaultYear, defaultMonth, onClose, onSaved }: Props) {
  const [concept, setConcept] = useState(invoice?.concept ?? "");
  const [folio, setFolio] = useState(invoice?.folio_fiscal ?? "");
  const [date, setDate] = useState<Date | undefined>(
    invoice ? new Date(invoice.date + "T00:00:00") : new Date(defaultYear, defaultMonth - 1, new Date().getDate())
  );
  const [subtotal, setSubtotal] = useState(invoice?.subtotal?.toString() ?? "");
  const [iva, setIva] = useState(invoice?.iva?.toString() ?? "0");
  const [category, setCategory] = useState(invoice?.category ?? EXPENSE_INVOICE_CATEGORIES[0]);
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [noDeducible, setNoDeducible] = useState(invoice?.no_deducible ?? false);

  // Subtotal e IVA se redondean a centavos ANTES de sumar, para que el total
  // almacenado siempre cuadre con el desglose (subtotal + IVA).
  const subR = useMemo(() => Number((Number(subtotal) || 0).toFixed(2)), [subtotal]);
  const ivaR = useMemo(() => Number((Number(iva) || 0).toFixed(2)), [iva]);
  const total = useMemo(() => Number((subR + ivaR).toFixed(2)), [subR, ivaR]);

  const save = useMutation({
    mutationFn: async () => {
      if (!concept.trim()) throw new Error("Concepto requerido");
      if (!folio.trim()) throw new Error("Folio fiscal requerido");
      if (!date) throw new Error("Fecha requerida");
      if (!subR || subR <= 0) throw new Error("Subtotal inválido");
      const payload = {
        concept: concept.trim(),
        folio_fiscal: folio.trim().toUpperCase(),
        date: toLocalDateString(date),
        subtotal: subR,
        iva: ivaR,
        total,
        category,
        notes: notes.trim() || null,
        no_deducible: noDeducible,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      };
      if (invoice) {
        const { error } = await supabase.from("expense_invoices").update(payload).eq("id", invoice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_invoices").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Factura guardada"); onSaved(); },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{invoice ? "Editar" : "Nueva"} factura de gasto</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="concept">Concepto *</Label>
            <Input id="concept" value={concept} onChange={(e) => setConcept(e.target.value)} required maxLength={200} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="folio">Folio Fiscal *</Label>
              <Input id="folio" value={folio} onChange={(e) => setFolio(e.target.value.toUpperCase())} required className="font-mono uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub">Subtotal *</Label>
              <Input id="sub" type="number" step="0.01" min="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iva">IVA acreditable</Label>
              <Input id="iva" type="number" step="0.01" min="0" value={iva} onChange={(e) => setIva(e.target.value)} />
              <p className="text-xs text-muted-foreground">Captura el IVA indicado en la factura del proveedor</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/40">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="tabular-nums font-semibold">{fmtMXN(total)}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_INVOICE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="no-deducible">No deducible</Label>
              <p className="text-xs text-muted-foreground">
                El SAT rechazó esta deducción: su IVA y total se excluyen del Resumen Fiscal, pero se conserva el registro y el flujo de efectivo.
              </p>
            </div>
            <Switch id="no-deducible" checked={noDeducible} onCheckedChange={setNoDeducible} />
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
