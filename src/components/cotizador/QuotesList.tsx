import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMXN } from "@/lib/finance";
import { downloadPdfDocument } from "@/lib/pdfDownload";
import QuotePdf, { type QuotePdfData } from "./QuotePdf";
import type { QuoteForEdit } from "./QuoteForm";

type QuoteListRow = {
  id: string;
  number: number;
  date: string;
  total: number;
  client: { razon_social: string } | null;
};

interface Props {
  onEdit: (quote: QuoteForEdit) => void;
}

export default function QuotesList({ onEdit }: Props) {
  const qc = useQueryClient();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, number, date, total, client:clients(razon_social)")
        .order("number", { ascending: false });
      if (error) throw error;
      return data as unknown as QuoteListRow[];
    },
  });

  const fetchFull = async (id: string) => {
    const { data: q, error } = await supabase
      .from("quotes")
      .select("*, client:clients(razon_social, nombre_comercial, rfc)")
      .eq("id", id)
      .single();
    if (error) throw error;
    const { data: items, error: iErr } = await supabase
      .from("quote_items")
      .select("description, quantity, unit, line_total")
      .eq("quote_id", id)
      .order("position");
    if (iErr) throw iErr;
    return { q, items: items ?? [] };
  };

  const download = useMutation({
    mutationFn: async (id: string) => {
      const { q, items } = await fetchFull(id);
      const client = (q.client as { razon_social: string; nombre_comercial: string | null; rfc: string } | null) ?? null;
      const data: QuotePdfData = {
        number: q.number,
        date: new Date(q.date + "T00:00:00"),
        city: q.city,
        showClient: q.show_client,
        client,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          line_total: Number(it.line_total),
        })),
        subtotal: Number(q.subtotal),
        iva: Number(q.iva),
        isr: Number(q.isr),
        total: Number(q.total),
        applyIva: q.apply_iva,
        applyIsr: q.apply_isr,
        validity: q.validity,
        payment_terms: q.payment_terms,
        delivery_time: q.delivery_time,
        currency_note: q.currency_note,
        notes: q.notes,
        images: [],
      };
      await downloadPdfDocument(<QuotePdf data={data} />, `Cotizacion-${q.number}.pdf`);
    },
    onError: (e: Error) => toast.error("Error al generar PDF", { description: e.message }),
  });

  const startEdit = useMutation({
    mutationFn: async (id: string) => {
      const { q, items } = await fetchFull(id);
      const edit: QuoteForEdit = {
        id: q.id,
        number: q.number,
        client_id: q.client_id,
        date: q.date,
        city: q.city,
        show_client: q.show_client,
        apply_iva: q.apply_iva,
        apply_isr: q.apply_isr,
        validity: q.validity,
        payment_terms: q.payment_terms,
        delivery_time: q.delivery_time,
        currency_note: q.currency_note,
        notes: q.notes,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          line_total: Number(it.line_total),
        })),
      };
      return edit;
    },
    onSuccess: (edit) => onEdit(edit),
    onError: (e: Error) => toast.error("Error al abrir la cotización", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cotización eliminada");
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: Error) => toast.error("Error al eliminar", { description: e.message }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>;
  if (!quotes || quotes.length === 0)
    return <div className="text-sm text-muted-foreground py-10 text-center">Aún no hay cotizaciones. Crea la primera con “Nueva cotización”.</div>;

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">No.</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="font-medium tabular-nums">{q.number}</TableCell>
              <TableCell>{q.client?.razon_social ?? <span className="text-muted-foreground">Sin cliente</span>}</TableCell>
              <TableCell className="tabular-nums text-sm">{q.date}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{fmtMXN(q.total)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar PDF"
                    onClick={() => download.mutate(q.id)} disabled={download.isPending}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                    onClick={() => startEdit.mutate(q.id)} disabled={startEdit.isPending}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar cotización {q.number}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará la cotización y sus conceptos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(q.id)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
