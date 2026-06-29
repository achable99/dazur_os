import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import DatePicker from "@/components/DatePicker";
import { toast } from "sonner";
import { fmtMXN, generateFrenchSchedule, paymentDateFor, toLocalDateString } from "@/lib/finance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props { onClose: () => void; onSaved: () => void; }

type Row = { payment_number: number; due_date: string; principal: number; interest: number; total: number };

export default function CreditLineDialog({ onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"revolving" | "fixed">("fixed");
  const [totalAmount, setTotalAmount] = useState("");
  const [usedAmount, setUsedAmount] = useState("0");
  const [interestRate, setInterestRate] = useState("");
  const [rateType, setRateType] = useState<"monthly" | "annual">("annual");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [numPayments, setNumPayments] = useState("12");
  const [paymentType, setPaymentType] = useState<"fixed" | "custom">("fixed");
  const [paymentDay, setPaymentDay] = useState("1");
  const [customRows, setCustomRows] = useState<Row[]>([]);

  const principal = Math.max(0, Number(totalAmount) - Number(usedAmount || 0)) || Number(totalAmount) || 0;
  // For credit lines, we amortize the total_amount (loan). For revolving, the same flow but interpret as outstanding to amortize.
  const loanAmount = type === "fixed" ? Number(totalAmount) || 0 : Number(usedAmount) || 0;

  const previewSchedule = useMemo<Row[]>(() => {
    if (paymentType === "custom") return customRows;
    const n = Number(numPayments);
    if (!loanAmount || !n || !startDate) return [];
    return generateFrenchSchedule({
      principal: loanAmount,
      interestRate: Number(interestRate) || 0,
      rateType,
      numPayments: n,
      startDate,
      paymentDay: Number(paymentDay) || 1,
    });
  }, [paymentType, customRows, loanAmount, numPayments, interestRate, rateType, startDate, paymentDay]);

  // Initialize custom rows when switching to custom
  const initCustomRows = () => {
    const n = Number(numPayments) || 1;
    if (!startDate) return;
    const rows: Row[] = [];
    const per = loanAmount / n;
    for (let i = 1; i <= n; i++) {
      rows.push({
        payment_number: i,
        due_date: toLocalDateString(paymentDateFor(startDate, i, Number(paymentDay) || 1)),
        principal: Number(per.toFixed(2)),
        interest: 0,
        total: Number(per.toFixed(2)),
      });
    }
    setCustomRows(rows);
  };

  const customTotal = customRows.reduce((s, r) => s + Number(r.total || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nombre requerido");
      if (!totalAmount || Number(totalAmount) <= 0) throw new Error("Monto total inválido");
      if (!startDate) throw new Error("Fecha de inicio requerida");
      const n = Number(numPayments);
      if (!n || n < 1 || n > 60) throw new Error("Número de pagos entre 1 y 60");
      const day = Number(paymentDay);
      if (!day || day < 1 || day > 28) throw new Error("Día de pago entre 1 y 28");

      const schedule = previewSchedule;
      if (schedule.length === 0) throw new Error("No hay pagos programados");
      if (paymentType === "custom" && customTotal < loanAmount - 0.01) {
        throw new Error("La suma de pagos debe ser ≥ al monto del préstamo");
      }

      const { data: line, error: e1 } = await supabase.from("credit_lines").insert({
        name: name.trim(), type,
        total_amount: Number(totalAmount),
        used_amount: type === "fixed" ? Number(totalAmount) : Number(usedAmount) || 0,
        interest_rate: Number(interestRate) || 0,
        rate_type: rateType,
        start_date: toLocalDateString(startDate),
        num_payments: n,
        payment_type: paymentType,
        payment_day: day,
      }).select().single();
      if (e1) throw e1;

      const payments = schedule.map((r) => ({ credit_line_id: line.id, ...r }));
      const { error: e2 } = await supabase.from("credit_payments").insert(payments);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Línea de crédito guardada"); onSaved(); },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Agregar línea de crédito</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Datos generales</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="name">Nombre / Banco *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Tipo *</Label>
                <RadioGroup value={type} onValueChange={(v) => setType(v as typeof type)} className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="revolving" id="t-r" /><Label htmlFor="t-r" className="font-normal">Revolvente</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="fixed" id="t-f" /><Label htmlFor="t-f" className="font-normal">Plazo fijo</Label></div>
                </RadioGroup>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="total">{type === "fixed" ? "Monto total *" : "Límite *"}</Label>
                <Input id="total" type="number" step="0.01" min="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
              </div>
              {type === "revolving" && (
                <div className="space-y-1.5">
                  <Label htmlFor="used">Saldo usado</Label>
                  <Input id="used" type="number" step="0.01" min="0" value={usedAmount} onChange={(e) => setUsedAmount(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="rate">Tasa de interés (%) *</Label>
                <Input id="rate" type="number" step="0.01" min="0" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de tasa *</Label>
                <Select value={rateType} onValueChange={(v) => setRateType(v as typeof rateType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Fecha de inicio *</Label>
                <DatePicker value={startDate} onChange={setStartDate} />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Programación de pagos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np">Número de pagos *</Label>
                <Input id="np" type="number" min="1" max="60" value={numPayments} onChange={(e) => setNumPayments(e.target.value)} required />
                <p className="text-xs text-muted-foreground">Máximo 60 pagos (5 años)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd">Día de pago *</Label>
                <Input id="pd" type="number" min="1" max="28" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} required />
                <p className="text-xs text-muted-foreground">Entre 1 y 28 (para evitar inconsistencias en febrero)</p>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Tipo de pago *</Label>
                <RadioGroup
                  value={paymentType}
                  onValueChange={(v) => {
                    setPaymentType(v as typeof paymentType);
                    if (v === "custom" && customRows.length === 0) initCustomRows();
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2"><RadioGroupItem value="fixed" id="p-fix" /><Label htmlFor="p-fix" className="font-normal">Mensual fijo</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="custom" id="p-cus" /><Label htmlFor="p-cus" className="font-normal">Personalizado</Label></div>
                </RadioGroup>
              </div>
            </div>

            {previewSchedule.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground">
                  Vista previa de pagos ({previewSchedule.length})
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Capital</TableHead>
                        <TableHead className="text-right">Interés</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewSchedule.map((r, idx) => (
                        <TableRow key={r.payment_number}>
                          <TableCell className="tabular-nums">{r.payment_number}</TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {paymentType === "custom" ? (
                              <Input
                                type="date"
                                value={r.due_date}
                                className="h-8"
                                onChange={(e) => {
                                  const next = [...customRows]; next[idx] = { ...next[idx], due_date: e.target.value }; setCustomRows(next);
                                }}
                              />
                            ) : r.due_date}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {paymentType === "custom" ? (
                              <Input type="number" step="0.01" value={r.principal} className="h-8 text-right"
                                onChange={(e) => {
                                  const next = [...customRows]; const v = Number(e.target.value);
                                  next[idx] = { ...next[idx], principal: v, total: v + Number(next[idx].interest || 0) }; setCustomRows(next);
                                }} />
                            ) : fmtMXN(r.principal)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {paymentType === "custom" ? (
                              <Input type="number" step="0.01" value={r.interest} className="h-8 text-right"
                                onChange={(e) => {
                                  const next = [...customRows]; const v = Number(e.target.value);
                                  next[idx] = { ...next[idx], interest: v, total: Number(next[idx].principal || 0) + v }; setCustomRows(next);
                                }} />
                            ) : fmtMXN(r.interest)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{fmtMXN(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {paymentType === "custom" && (
                  <div className="px-3 py-2 bg-muted/50 text-xs flex justify-between">
                    <span className="text-muted-foreground">Suma de pagos</span>
                    <span className={`tabular-nums font-medium ${customTotal >= loanAmount ? "text-success" : "text-destructive"}`}>
                      {fmtMXN(customTotal)} / {fmtMXN(loanAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar línea de crédito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
