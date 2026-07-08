import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "@/components/DatePicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN, INVOICE_TYPES, computeTotals, toLocalDateString, pctLabel, ISR_RATE } from "@/lib/finance";

type Invoice = {
  id: string; client_id: string; folio_fiscal: string; invoice_type: string;
  date: string; subtotal: number; iva: number; isr: number; total: number;
  notes: string | null; is_collected?: boolean;
};

interface Props {
  invoice: Invoice | null;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function IncomeInvoiceDialog({ invoice, defaultYear, defaultMonth, onClose, onSaved }: Props) {
  const [clientId, setClientId] = useState(invoice?.client_id ?? "");
  const [type, setType] = useState(invoice?.invoice_type ?? INVOICE_TYPES[0]);
  const [folio, setFolio] = useState(invoice?.folio_fiscal ?? "");
  const [date, setDate] = useState<Date | undefined>(
    invoice ? new Date(invoice.date + "T00:00:00") : new Date(defaultYear, defaultMonth - 1, new Date().getDate())
  );
  const [subtotal, setSubtotal] = useState(invoice?.subtotal?.toString() ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, razon_social, rfc, tipo_persona").order("razon_social");
      if (error) throw error;
      return data as { id: string; razon_social: string; rfc: string; tipo_persona: "fisica" | "moral" | null }[];
    },
  });

  const selectedClient = clients?.find((c) => c.id === clientId);
  // La retención de ISR solo aplica a clientes persona moral. Sin cliente
  // seleccionado, se asume que no aplica (persona física por defecto).
  const applyIsr = selectedClient?.tipo_persona === "moral";

  const sub = Number(subtotal) || 0;
  const calc = useMemo(() => {
    const subR = Number(sub.toFixed(2));
    const { iva, isr, total } = computeTotals(subR, { applyIsr });
    return { subtotal: subR, iva, isr, total };
  }, [sub, applyIsr]);

  // Si se está editando una factura ya cobrada y el recálculo difiere de los
  // montos guardados, guardar reescribirá esos montos y (vía trigger en DB)
  // la entrada de flujo de efectivo del período ya cobrado.
  const collectedAmountsChanged =
    !!invoice?.is_collected &&
    (Math.abs(calc.isr - invoice.isr) > 0.005 || Math.abs(calc.total - invoice.total) > 0.005);

  const save = useMutation({
    mutationFn: async () => {
      // Cierra la ventana de carrera: si la query de clients aún no resuelve
      // (cache frío), applyIsr puede estar mal derivado (ver bug de colisión
      // de queryKey ["clients"]). Bloquea el guardado hasta que resuelva.
      if (clientsLoading) throw new Error("Espera a que carguen los clientes");
      if (!clientId) throw new Error("Cliente requerido");
      if (!folio.trim()) throw new Error("Folio fiscal requerido");
      if (!date) throw new Error("Fecha requerida");
      if (!sub || sub <= 0) throw new Error("Subtotal inválido");
      const payload = {
        client_id: clientId,
        invoice_type: type,
        folio_fiscal: folio.trim().toUpperCase(),
        date: toLocalDateString(date),
        subtotal: calc.subtotal,
        iva: calc.iva,
        isr: calc.isr,
        total: calc.total,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        notes: notes.trim() || null,
      };
      if (invoice) {
        const { error } = await supabase.from("income_invoices").update(payload).eq("id", invoice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("income_invoices").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Factura guardada"); onSaved(); },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{invoice ? "Editar" : "Nueva"} factura de ingreso</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
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
              <Label>Tipo de factura *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="folio">Folio Fiscal *</Label>
              <Input id="folio" value={folio} onChange={(e) => setFolio(e.target.value.toUpperCase())} required className="font-mono uppercase" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub">Subtotal *</Label>
              <Input id="sub" type="number" step="0.01" min="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-muted/40">
            <div>
              <div className="text-xs text-muted-foreground">IVA (16%)</div>
              <div className="tabular-nums font-medium">{fmtMXN(calc.iva)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{applyIsr ? `ISR (${pctLabel(ISR_RATE)})` : "ISR"}</div>
              <div className="tabular-nums font-medium">{applyIsr ? fmtMXN(calc.isr) : "No aplica"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="tabular-nums font-semibold">{fmtMXN(calc.total)}</div>
            </div>
          </div>
          {collectedAmountsChanged && (
            <Alert className="border-amber-500/50 text-amber-600 dark:text-amber-500 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-500">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>
                Esta factura ya está cobrada. Al guardar se actualizarán los montos de la factura y la entrada de flujo de
                efectivo del período ya cobrado.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || clientsLoading}>
              {save.isPending ? "Guardando…" : clientsLoading ? "Cargando clientes…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
