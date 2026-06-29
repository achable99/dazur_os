import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/DatePicker";
import { toast } from "sonner";
import { toLocalDateString } from "@/lib/finance";

interface Props { invoice: { id: string; total: number }; onClose: () => void; onSaved: () => void; }

export default function CollectInvoiceDialog({ invoice, onClose, onSaved }: Props) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const collect = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Selecciona la fecha de cobro");
      const { error } = await supabase.rpc("collect_invoice", {
        _invoice_id: invoice.id,
        _collected_date: toLocalDateString(date),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Factura marcada como cobrada"); onSaved(); },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Marcar como cobrada</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Se creará una entrada de ingreso en flujo de efectivo y se sumarán IVA e ISR al resumen fiscal.
          </p>
          <div className="space-y-1.5">
            <Label>Fecha de cobro *</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => collect.mutate()} disabled={collect.isPending}>
            {collect.isPending ? "Guardando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
