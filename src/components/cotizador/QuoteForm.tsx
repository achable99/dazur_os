import { useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "@/components/DatePicker";
import { Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN, toLocalDateString, computeTotals } from "@/lib/finance";
import { QUOTE_DEFAULTS } from "@/lib/issuer";
import QuotePdf, { type QuotePdfData } from "./QuotePdf";

type ClientRow = { id: string; razon_social: string; nombre_comercial: string | null; rfc: string };

export type QuoteForEdit = {
  id: string;
  number: number;
  client_id: string | null;
  date: string;
  city: string;
  show_client: boolean;
  apply_iva: boolean;
  apply_isr: boolean;
  validity: string | null;
  payment_terms: string | null;
  delivery_time: string | null;
  currency_note: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unit: string | null; line_total: number }[];
};

type ItemRow = { description: string; quantity: string; unit: string; total: string };
type QuoteImage = { name: string; dataUrl: string };

interface Props {
  editing: QuoteForEdit | null;
  onSaved: () => void;
  onCancel: () => void;
}

const emptyItem = (): ItemRow => ({ description: "", quantity: "1", unit: "", total: "" });

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function QuoteForm({ editing, onSaved, onCancel }: Props) {
  const qc = useQueryClient();

  const [clientId, setClientId] = useState(editing?.client_id ?? "");
  const [date, setDate] = useState<Date | undefined>(
    editing ? new Date(editing.date + "T00:00:00") : new Date()
  );
  const [city, setCity] = useState(editing?.city ?? QUOTE_DEFAULTS.city);
  const [showClient, setShowClient] = useState(editing?.show_client ?? true);
  const [applyIva, setApplyIva] = useState(editing?.apply_iva ?? true);
  const [applyIsr, setApplyIsr] = useState(editing?.apply_isr ?? true);
  const [validity, setValidity] = useState(editing?.validity ?? QUOTE_DEFAULTS.validity);
  const [paymentTerms, setPaymentTerms] = useState(editing?.payment_terms ?? QUOTE_DEFAULTS.payment_terms);
  const [deliveryTime, setDeliveryTime] = useState(editing?.delivery_time ?? QUOTE_DEFAULTS.delivery_time);
  const [currencyNote, setCurrencyNote] = useState(editing?.currency_note ?? QUOTE_DEFAULTS.currency_note);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [items, setItems] = useState<ItemRow[]>(
    editing && editing.items.length
      ? editing.items.map((i) => ({
          description: i.description,
          quantity: String(i.quantity),
          unit: i.unit ?? "",
          total: String(i.line_total),
        }))
      : [emptyItem()]
  );
  const [images, setImages] = useState<QuoteImage[]>([]);

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, razon_social, nombre_comercial, rfc")
        .order("razon_social");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const lineTotal = (r: ItemRow) => Number(r.total) || 0;
  const subtotal = useMemo(
    () => items.reduce((s, r) => s + lineTotal(r), 0),
    [items]
  );
  const calc = useMemo(
    () => computeTotals(subtotal, { applyIva, applyIsr }),
    [subtotal, applyIva, applyIsr]
  );

  const setItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const onPickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded = await Promise.all(
      Array.from(files).map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) }))
    );
    setImages((prev) => [...prev, ...loaded]);
  };

  const validate = () => {
    if (!date) throw new Error("Fecha requerida");
    const clean = items
      .map((r) => ({ ...r, description: r.description.trim() }))
      .filter((r) => r.description || Number(r.total) > 0);
    if (clean.length === 0) throw new Error("Agrega al menos un concepto");
    for (const r of clean) {
      if (!r.description) throw new Error("Cada concepto necesita una descripción");
      if ((Number(r.total) || 0) <= 0) throw new Error(`Total inválido en "${r.description.slice(0, 20)}…"`);
    }
    return clean;
  };

  const buildPdfData = (numberForPdf: number): QuotePdfData => {
    const client = clients?.find((c) => c.id === clientId) ?? null;
    return {
      number: numberForPdf,
      date: date!,
      city,
      showClient,
      client: client
        ? { razon_social: client.razon_social, nombre_comercial: client.nombre_comercial, rfc: client.rfc }
        : null,
      items: items
        .filter((r) => r.description.trim())
        .map((r) => ({
          description: r.description.trim(),
          quantity: Number(r.quantity) || 0,
          unit: r.unit.trim() || null,
          line_total: Number(lineTotal(r).toFixed(2)),
        })),
      subtotal: Number(subtotal.toFixed(2)),
      iva: calc.iva,
      isr: calc.isr,
      total: calc.total,
      applyIva,
      applyIsr,
      validity,
      payment_terms: paymentTerms,
      delivery_time: deliveryTime,
      currency_note: currencyNote,
      notes,
      images: images.map((i) => i.dataUrl),
    };
  };

  const downloadPdf = async (numberForPdf: number) => {
    const blob = await pdf(<QuotePdf data={buildPdfData(numberForPdf)} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cotizacion-${numberForPdf}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const persist = async (clean: ItemRow[]): Promise<number> => {
    const quotePayload = {
      client_id: clientId || null,
      date: toLocalDateString(date!),
      city: city.trim() || QUOTE_DEFAULTS.city,
      show_client: showClient,
      apply_iva: applyIva,
      apply_isr: applyIsr,
      subtotal: Number(subtotal.toFixed(2)),
      iva: calc.iva,
      isr: calc.isr,
      total: calc.total,
      validity: validity.trim() || null,
      payment_terms: paymentTerms.trim() || null,
      delivery_time: deliveryTime.trim() || null,
      currency_note: currencyNote.trim() || null,
      notes: notes.trim() || null,
    };

    let quoteId: string;
    let number: number;
    if (editing) {
      const { data, error } = await supabase
        .from("quotes").update(quotePayload).eq("id", editing.id).select("id, number").single();
      if (error) throw error;
      quoteId = data.id; number = data.number;
      const { error: delErr } = await supabase.from("quote_items").delete().eq("quote_id", quoteId);
      if (delErr) throw delErr;
    } else {
      const { data, error } = await supabase
        .from("quotes").insert(quotePayload).select("id, number").single();
      if (error) throw error;
      quoteId = data.id; number = data.number;
    }

    const itemRows = clean.map((r, i) => ({
      quote_id: quoteId,
      position: i,
      description: r.description.trim(),
      quantity: Number(r.quantity) || 0,
      unit: r.unit.trim() || null,
      unit_price: 0,
      line_total: Number(lineTotal(r).toFixed(2)),
    }));
    const { error: itemsErr } = await supabase.from("quote_items").insert(itemRows);
    if (itemsErr) throw itemsErr;

    return number;
  };

  const save = useMutation({
    mutationFn: async ({ download }: { download: boolean }) => {
      const clean = validate();
      const number = await persist(clean);
      if (download) await downloadPdf(number);
      return number;
    },
    onSuccess: (number) => {
      toast.success(`Cotización ${number} guardada`);
      qc.invalidateQueries({ queryKey: ["quotes"] });
      onSaved();
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label>Cliente</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Sin cliente" /></SelectTrigger>
            <SelectContent>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.razon_social} — {c.rfc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha *</Label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ciudad</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showClient} onCheckedChange={setShowClient} />
          Mostrar cliente en el PDF
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={applyIva} onCheckedChange={setApplyIva} />
          Aplicar IVA (16%)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={applyIsr} onCheckedChange={setApplyIsr} />
          Aplicar ISR (1.25%)
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Conceptos</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agregar concepto
          </Button>
        </div>
        <div className="border rounded-md divide-y">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <div className="flex-1">Descripción</div>
            <div className="w-24 text-center">Cantidad</div>
            <div className="w-24">Unidad</div>
            <div className="w-32 text-right">Total</div>
            <div className="w-8" />
          </div>
          {items.map((r, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-2 p-3">
              <Textarea
                value={r.description}
                onChange={(e) => setItem(idx, { description: e.target.value })}
                placeholder="Descripción del producto o servicio"
                rows={2}
                className="flex-1 min-h-[40px]"
              />
              <Input
                type="number" step="0.01" min="0" inputMode="decimal"
                value={r.quantity}
                onChange={(e) => setItem(idx, { quantity: e.target.value })}
                className="w-full sm:w-24 tabular-nums"
                placeholder="Cant."
              />
              <Input
                value={r.unit}
                onChange={(e) => setItem(idx, { unit: e.target.value })}
                className="w-full sm:w-24"
                placeholder="pza / LOTE"
              />
              <Input
                type="number" step="0.01" min="0" inputMode="decimal"
                value={r.total}
                onChange={(e) => setItem(idx, { total: e.target.value })}
                className="w-full sm:w-32 tabular-nums"
                placeholder="0.00"
              />
              <Button
                type="button" variant="ghost" size="icon"
                className="h-9 w-8 self-center text-muted-foreground"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-full sm:w-64 space-y-1.5 text-sm tabular-nums">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{fmtMXN(subtotal)}</span></div>
          {applyIsr && <div className="flex justify-between"><span className="text-muted-foreground">ISR (1.25%)</span><span>{fmtMXN(calc.isr)}</span></div>}
          {applyIva && <div className="flex justify-between"><span className="text-muted-foreground">IVA (16%)</span><span>{fmtMXN(calc.iva)}</span></div>}
          <div className="flex justify-between border-t pt-1.5 text-base font-semibold"><span>Total</span><span>{fmtMXN(calc.total)}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="validity">Vigencia</Label>
          <Input id="validity" value={validity} onChange={(e) => setValidity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery">Plazo de entrega</Label>
          <Input id="delivery" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="terms">Condiciones de pago</Label>
          <Input id="terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Moneda / precios</Label>
          <Input id="currency" value={currencyNote} onChange={(e) => setCurrencyNote(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas adicionales</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Imágenes (opcional — se agregan al PDF, no se guardan)</Label>
        <Input type="file" accept="image/*" multiple onChange={(e) => onPickImages(e.target.files)} />
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.dataUrl} alt={img.name} className="h-20 w-20 object-cover rounded border" />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5 shadow"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="button" variant="outline" onClick={() => save.mutate({ download: false })} disabled={save.isPending}>
          Guardar
        </Button>
        <Button type="button" onClick={() => save.mutate({ download: true })} disabled={save.isPending}>
          {save.isPending ? "Procesando…" : "Guardar y descargar PDF"}
        </Button>
      </div>
    </div>
  );
}
