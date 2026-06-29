import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "@/components/DatePicker";
import { toast } from "sonner";
import { EXPENSE_CATEGORIES, toLocalDateString } from "@/lib/finance";

type Entry = {
  id: string; concept: string; amount: number; date: string;
  category: string | null; notes: string | null;
};

interface Props {
  type: "income" | "expense";
  entry?: Entry;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function EntryDialog({ type, entry, defaultYear, defaultMonth, onClose, onSaved }: Props) {
  const [concept, setConcept] = useState(entry?.concept ?? "");
  const [amount, setAmount] = useState(entry?.amount?.toString() ?? "");
  const [date, setDate] = useState<Date | undefined>(
    entry ? new Date(entry.date + "T00:00:00") : new Date(defaultYear, defaultMonth - 1, new Date().getDate())
  );
  const [category, setCategory] = useState(entry?.category ?? (type === "expense" ? "Operación" : ""));
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!concept.trim()) throw new Error("Concepto requerido");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Monto inválido");
      if (!date) throw new Error("Fecha requerida");
      const payload = {
        type,
        concept: concept.trim(),
        amount: amt,
        date: toLocalDateString(date),
        category: type === "expense" ? category : null,
        notes: notes.trim() || null,
        origin: "manual" as const,
      };
      if (entry) {
        const { error } = await supabase.from("cash_flow_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cash_flow_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(entry ? "Entrada actualizada" : "Entrada creada");
      onSaved();
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const title = entry ? "Editar" : "Agregar";
  const noun = type === "income" ? "ingreso" : "gasto";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title} {noun}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="concept">Concepto *</Label>
            <Input id="concept" value={concept} onChange={(e) => setConcept(e.target.value)} required maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount" type="number" step="0.01" min="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{type === "income" ? "Fecha esperada" : "Fecha"} *</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>
          {type === "expense" && (
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
