import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import QuoteForm, { type QuoteForEdit } from "@/components/cotizador/QuoteForm";
import QuotesList from "@/components/cotizador/QuotesList";

export default function Cotizador() {
  // undefined = lista, null = nueva, QuoteForEdit = editar
  const [editing, setEditing] = useState<QuoteForEdit | null | undefined>(undefined);
  const inForm = editing !== undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizador</h1>
          <p className="text-sm text-muted-foreground">
            {inForm
              ? editing
                ? `Editando cotización ${editing.number}`
                : "Nueva cotización"
              : "Genera cotizaciones en PDF para tus clientes."}
          </p>
        </div>
        {inForm ? (
          <Button variant="outline" onClick={() => setEditing(undefined)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al historial
          </Button>
        ) : (
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva cotización
          </Button>
        )}
      </div>

      {inForm ? (
        <Card className="p-4 sm:p-6">
          <QuoteForm
            editing={editing ?? null}
            onSaved={() => setEditing(undefined)}
            onCancel={() => setEditing(undefined)}
          />
        </Card>
      ) : (
        <QuotesList onEdit={(q) => setEditing(q)} />
      )}
    </div>
  );
}
