import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { REGIMENES_FISCALES, rfcRegex } from "@/lib/finance";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Client = {
  id: string; razon_social: string; nombre_comercial: string | null; rfc: string;
  tipo_persona: "fisica" | "moral"; regimen_fiscal: string; codigo_postal: string;
  email: string | null; telefono: string | null; address: string | null;
};

const PAGE_SIZE = 20;

export default function Clientes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<string>("all");
  const [regimen, setRegimen] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Client | null | undefined>(undefined); // undefined=closed, null=new, Client=edit
  const [deleting, setDeleting] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("razon_social");
      if (error) throw error;
      return data as Client[];
    },
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    const s = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (tipo !== "all" && c.tipo_persona !== tipo) return false;
      if (regimen !== "all" && c.regimen_fiscal !== regimen) return false;
      if (s) {
        const hay = `${c.razon_social} ${c.nombre_comercial ?? ""} ${c.rfc}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [clients, search, tipo, regimen]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const uniqueRegimenes = useMemo(() => {
    const s = new Set<string>();
    clients?.forEach((c) => c.regimen_fiscal && s.add(c.regimen_fiscal));
    return Array.from(s);
  }, [clients]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente eliminado");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${filtered.length} ${filtered.length === 1 ? "cliente" : "clientes"} registrados`}
          </p>
        </div>
        <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" /> Nuevo cliente</Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por razón social, RFC o nombre comercial"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Tipo de persona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="fisica">Física</SelectItem>
              <SelectItem value="moral">Moral</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regimen} onValueChange={(v) => { setRegimen(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Régimen fiscal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los regímenes</SelectItem>
              {uniqueRegimenes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay clientes registrados</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>Nombre Comercial</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Régimen Fiscal</TableHead>
                    <TableHead>CP</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.razon_social}</TableCell>
                      <TableCell className="text-muted-foreground">{c.nombre_comercial ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{c.rfc}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {c.tipo_persona === "fisica" ? "Física" : "Moral"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate" title={c.regimen_fiscal}>{c.regimen_fiscal}</TableCell>
                      <TableCell className="tabular-nums text-sm">{c.codigo_postal}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(c)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Anterior</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Siguiente</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {editing !== undefined && (
        <ClientDialog
          client={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["clients"] });
            setEditing(undefined);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `¿Eliminar cliente "${deleting.razon_social}"? Si tiene facturas asociadas, estas no serán eliminadas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientDialog({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const [razon, setRazon] = useState(client?.razon_social ?? "");
  const [nombre, setNombre] = useState(client?.nombre_comercial ?? "");
  const [rfc, setRfc] = useState(client?.rfc ?? "");
  const [tipo, setTipo] = useState<"fisica" | "moral">(client?.tipo_persona ?? "moral");
  const [regimen, setRegimen] = useState(client?.regimen_fiscal ?? REGIMENES_FISCALES[0]);
  const [cp, setCp] = useState(client?.codigo_postal ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [tel, setTel] = useState(client?.telefono ?? "");
  const [address, setAddress] = useState(client?.address ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!razon.trim()) throw new Error("Razón social requerida");
      const rfcUp = rfc.trim().toUpperCase();
      if (!rfcRegex().test(rfcUp)) throw new Error("RFC inválido");
      if (!/^\d{5}$/.test(cp.trim())) throw new Error("CP debe ser 5 dígitos");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Email inválido");
      const payload = {
        razon_social: razon.trim(),
        nombre_comercial: nombre.trim() || null,
        rfc: rfcUp,
        tipo_persona: tipo,
        regimen_fiscal: regimen,
        codigo_postal: cp.trim(),
        email: email.trim() || null,
        telefono: tel.trim() || null,
        address: address.trim() || null,
      };
      if (client) {
        const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Cliente guardado correctamente"); onSaved(); },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="razon">Razón Social *</Label>
            <Input id="razon" value={razon} onChange={(e) => setRazon(e.target.value)} required maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre Comercial</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rfc">RFC *</Label>
              <Input id="rfc" value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} required maxLength={13} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de persona *</Label>
              <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)} className="flex gap-4 pt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="fisica" id="tp-f" /><Label htmlFor="tp-f" className="font-normal">Física</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="moral" id="tp-m" /><Label htmlFor="tp-m" className="font-normal">Moral</Label></div>
              </RadioGroup>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Régimen fiscal *</Label>
            <Select value={regimen} onValueChange={setRegimen}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGIMENES_FISCALES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp">Código Postal *</Label>
              <Input id="cp" value={cp} onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tel">Teléfono</Label>
              <Input id="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr">Dirección</Label>
              <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
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
