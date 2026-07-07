import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MonthSelector from "@/components/MonthSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowRight, Check, Pencil, X, TriangleAlert } from "lucide-react";
import { fmtMXN, monthLabel, shiftMonth, resicoIsr, resicoProvision } from "@/lib/finance";
import { toast } from "sonner";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const today = new Date();

type IncomeInv = { iva: number; isr: number; total: number; subtotal: number; is_collected: boolean; year: number; month: number; collected_date: string | null };
type ExpenseInv = { iva: number; total: number; year: number; month: number; no_deducible: boolean };
type Carryover = { from_month: number; from_year: number; to_month: number; to_year: number; iva_amount: number; isr_amount: number; iva_pending_amount: number; iva_favor_amount: number };
type PeriodAdjustment = { year: number; month: number; iva_acreditable_adjustment: number };

export default function FiscalSummaryTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [accumulated, setAccumulated] = useState(false);
  const [confirmCarry, setConfirmCarry] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState(false);
  const [adjustmentInput, setAdjustmentInput] = useState("");

  const { data: incomes, isLoading: l1 } = useQuery({
    queryKey: ["all_income_invoices_fiscal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income_invoices").select("iva,isr,total,subtotal,is_collected,year,month,collected_date");
      if (error) throw error;
      return data as IncomeInv[];
    },
  });

  const { data: expenses, isLoading: l2 } = useQuery({
    queryKey: ["all_expense_invoices", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_invoices").select("iva,total,year,month,no_deducible").eq("year", year);
      if (error) throw error;
      return data as ExpenseInv[];
    },
  });

  const { data: carryovers, isLoading: l3 } = useQuery({
    queryKey: ["fiscal_carryovers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_carryovers").select("*");
      if (error) throw error;
      return data as Carryover[];
    },
  });

  const { data: adjustments, isLoading: l4 } = useQuery({
    queryKey: ["fiscal_period_adjustments", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_period_adjustments")
        .select("year,month,iva_acreditable_adjustment")
        .eq("year", year);
      if (error) throw error;
      return data as PeriodAdjustment[];
    },
  });

  const isLoading = l1 || l2 || l3 || l4;

  const filterPeriod = <T extends { year: number; month: number }>(arr: T[] | undefined): T[] => {
    if (!arr) return [];
    if (accumulated) return arr.filter((x) => x.year === year && x.month <= month);
    return arr.filter((x) => x.year === year && x.month === month);
  };

  const currentMonthAdjustment = useMemo(() => {
    const found = adjustments?.find((a) => a.year === year && a.month === month);
    return found ? Number(found.iva_acreditable_adjustment) : 0;
  }, [adjustments, year, month]);

  useEffect(() => {
    setEditingAdjustment(false);
    setAdjustmentInput(currentMonthAdjustment ? String(currentMonthAdjustment) : "");
  }, [year, month, currentMonthAdjustment]);

  const summary = useMemo(() => {
    // Cobradas: se reconocen en el mes/año de collected_date (flujo de efectivo)
    const collected = (incomes ?? []).filter((i) => {
      if (!i.is_collected || !i.collected_date) return false;
      const d = new Date(i.collected_date + "T00:00:00");
      const cy = d.getFullYear();
      const cm = d.getMonth() + 1;
      if (accumulated) return cy === year && cm <= month;
      return cy === year && cm === month;
    });
    // Pendientes: se quedan en el mes/año de emisión hasta que se cobren
    const pending = (incomes ?? []).filter((i) => {
      if (i.is_collected) return false;
      if (accumulated) return i.year === year && i.month <= month;
      return i.year === year && i.month === month;
    });
    // Las facturas marcadas como no deducibles (deducción rechazada por el SAT)
    // se excluyen del gasto deducible y del IVA acreditable, pero no del flujo de efectivo.
    const exp = filterPeriod(expenses).filter((i) => !i.no_deducible);
    const adj = filterPeriod(adjustments);

    const ingresosCobrados = collected.reduce((s, i) => s + Number(i.total), 0);
    const gastosDeducibles = exp.reduce((s, i) => s + Number(i.total), 0);
    const ivaTrasladado = collected.reduce((s, i) => s + Number(i.iva), 0);
    const ivaAcreditableBase = exp.reduce((s, i) => s + Number(i.iva), 0);
    const ivaAcreditableAjuste = adj.reduce((s, a) => s + Number(a.iva_acreditable_adjustment), 0);
    const ivaAcreditable = ivaAcreditableBase + ivaAcreditableAjuste;
    const isrRetenido = collected.reduce((s, i) => s + Number(i.isr), 0);
    const ivaPendiente = pending.reduce((s, i) => s + Number(i.iva), 0);
    const isrPendiente = pending.reduce((s, i) => s + Number(i.isr), 0);

    // ISR RESICO: siempre se aparta el 2.5% del subtotal cobrado (tasa máxima
    // de la tabla), repartido entre lo retenido por clientes persona moral
    // (1.25%) y la provisión propia del negocio. El ISR causado del período
    // (tabla RESICO, tasa según lo acumulado) se cubre con esa provisión total;
    // el sobrante queda apartado para la declaración anual.
    const isrBase = collected.reduce((s, i) => s + Number(i.subtotal), 0);
    const { rate: isrRate, isr: isrCausado, exceeded: isrExceeded } =
      resicoIsr(isrBase, accumulated ? "annual" : "monthly");
    const { total: provisionTotal, propia: provisionPropia } = resicoProvision(isrBase, isrRetenido);
    const isrACargo = Math.max(0, Number((isrCausado - isrRetenido).toFixed(2)));
    const provisionSobrante = Math.max(0, Number((provisionTotal - isrCausado).toFixed(2)));

    // Bajo flujo de efectivo (México): IVA e ISR se reconocen cuando se cobran,
    // por lo que sólo trasladamos saldo a FAVOR de IVA al siguiente período.
    // No se arrastran "IVA pendiente" ni "ISR pendiente": aparecen automáticamente
    // en el mes en que se cobre la factura (via collected_date).
    let carryIvaFavor = 0;
    // En modo acumulado sólo se restan traslados que ENTRAN desde fuera del rango
    // (p.ej. diciembre del año anterior). Un traslado cuyo mes de origen está dentro
    // del rango acumulado (from_year === year) ya está implícito en las sumas de
    // IVA trasladado/acreditable del propio rango; volver a restarlo duplicaría
    // el saldo a favor.
    const relevantCarryovers = carryovers
      ? carryovers.filter((c) =>
          accumulated
            ? c.to_year === year && c.to_month <= month && c.from_year !== year
            : c.to_year === year && c.to_month === month,
        )
      : [];
    relevantCarryovers.forEach((c) => {
      carryIvaFavor += Number(c.iva_favor_amount ?? 0);
    });
    const carryIva = -carryIvaFavor; // resta del IVA a pagar

    return {
      ingresosCobrados, gastosDeducibles,
      utilidad: ingresosCobrados - gastosDeducibles,
      ivaTrasladado,
      ivaAcreditableBase,
      ivaAcreditableAjuste,
      ivaAcreditable,
      ivaResultado: ivaTrasladado + carryIva - ivaAcreditable,
      isrRetenido,
      isrBase, isrRate, isrCausado, isrExceeded, isrACargo,
      provisionTotal, provisionPropia, provisionSobrante,
      ivaPendiente, isrPendiente,
      carryIva, carryIvaPending: 0, carryIvaFavor, carryIsr: 0,
    };
  }, [incomes, expenses, carryovers, adjustments, year, month, accumulated]);


  const next = shiftMonth(year, month, 1);

  const ivaFavor = summary.ivaResultado < 0 ? summary.ivaResultado : 0;
  const ivaToCarry = ivaFavor; // sólo a favor (negativo) bajo flujo de efectivo
  const hasSomethingToCarry = Math.abs(ivaToCarry) > 0.005;
  const isFavorOnly = true;
  const hasBoth = false;

  const storedCarryover = useMemo(() => {
    if (!carryovers) return undefined;
    return carryovers.find(
      (c) => c.from_year === year && c.from_month === month
        && c.to_year === next.year && c.to_month === next.month,
    );
  }, [carryovers, year, month, next.year, next.month]);
  const alreadyCarried = !!storedCarryover;
  const storedCarryFavor = Number(storedCarryover?.iva_favor_amount ?? 0);

  // El traslado guardado es una foto al momento de confirmarlo: si después se
  // editan facturas o se marcan como no deducibles, queda obsoleto y hay que
  // volver a trasladar. Detectamos la discrepancia comparando contra el saldo
  // a favor recalculado (incluye el caso en que ahora ya no hay saldo a favor).
  const carryMismatch =
    !accumulated && alreadyCarried && Math.abs(storedCarryFavor - Math.abs(ivaToCarry)) > 0.005;

  const carryMutation = useMutation({
    mutationFn: async () => {
      const favorAmt = Math.max(-ivaFavor, 0);
      const { error } = await supabase
        .from("fiscal_carryovers")
        .upsert(
          {
            from_month: month, from_year: year,
            to_month: next.month, to_year: next.year,
            iva_amount: Number((-favorAmt).toFixed(2)),
            iva_pending_amount: 0,
            iva_favor_amount: Number(favorAmt.toFixed(2)),
            isr_amount: 0,
          },
          { onConflict: "from_year,from_month,to_year,to_month" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal_carryovers"] });
      toast.success(alreadyCarried ? "Traslado actualizado" : "Saldo a favor trasladado al siguiente período");
      setConfirmCarry(false);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });


  const adjustmentMutation = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("fiscal_period_adjustments")
        .upsert(
          {
            year, month,
            iva_acreditable_adjustment: Number(value.toFixed(2)),
          },
          { onConflict: "year,month" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal_period_adjustments", year] });
      toast.success("Ajuste de IVA acreditable guardado");
      setEditingAdjustment(false);
    },
    onError: (e: Error) => toast.error("Error", { description: e.message }),
  });

  const handleSaveAdjustment = () => {
    const parsed = parseFloat(adjustmentInput.replace(",", "."));
    if (isNaN(parsed)) {
      toast.error("Ingresa un número válido");
      return;
    }
    adjustmentMutation.mutate(parsed);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <div className="flex items-center gap-2">
          <Switch id="acc" checked={accumulated} onCheckedChange={setAccumulated} />
          <Label htmlFor="acc" className="text-sm cursor-pointer">Acumulado del ejercicio</Label>
        </div>
      </div>

      {summary.carryIvaFavor > 0.005 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este período incluye del mes anterior:{" "}
            <span className="font-medium tabular-nums">{fmtMXN(summary.carryIvaFavor)}</span> de IVA a favor a acreditar.
          </AlertDescription>
        </Alert>
      )}


      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Resultado del Ejercicio
            </h3>
            <Row label="Ingresos facturados (cobrados)" value={summary.ingresosCobrados} />
            <Row label="Gastos deducibles" value={summary.gastosDeducibles} />
            <div className="border-t border-border pt-3">
              <Row
                label="Utilidad"
                value={summary.utilidad}
                bold
                className={summary.utilidad >= 0 ? "text-success" : "text-destructive"}
              />
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">IVA</h3>
            <Row label="IVA trasladado" value={summary.ivaTrasladado} />
            {summary.carryIvaFavor > 0.005 && (
              <Row
                label="IVA a favor previo (de arrastre)"
                value={-summary.carryIvaFavor}
                className="text-success"
              />
            )}
            <Row label="IVA acreditable" value={summary.ivaAcreditableBase} />


            {/* Ajuste manual al IVA acreditable */}
            {accumulated ? (
              Math.abs(summary.ivaAcreditableAjuste) > 0.005 && (
                <Row
                  label="Ajuste a IVA acreditable (acumulado)"
                  value={summary.ivaAcreditableAjuste}
                  className={summary.ivaAcreditableAjuste >= 0 ? "text-success" : "text-destructive"}
                />
              )
            ) : editingAdjustment ? (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground flex-1">
                  Ajuste a IVA acreditable
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjustmentInput}
                  onChange={(e) => setAdjustmentInput(e.target.value)}
                  placeholder="0.00"
                  className="h-8 w-32 text-right tabular-nums"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleSaveAdjustment}
                  disabled={adjustmentMutation.isPending}
                  aria-label="Guardar ajuste"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingAdjustment(false);
                    setAdjustmentInput(currentMonthAdjustment ? String(currentMonthAdjustment) : "");
                  }}
                  aria-label="Cancelar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : Math.abs(currentMonthAdjustment) > 0.005 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  Ajuste a IVA acreditable
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Corrige el IVA acreditable del mes (ej. facturas no registradas). Las facturas marcadas como no deducibles ya se excluyen automáticamente — no las ajustes aquí. Afecta el IVA a pagar/a favor y el traslado al siguiente mes.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <div className="flex items-center gap-2">
                  <span className={`tabular-nums font-medium ${currentMonthAdjustment >= 0 ? "text-success" : "text-destructive"}`}>
                    {currentMonthAdjustment >= 0 ? "+" : ""}{fmtMXN(currentMonthAdjustment)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingAdjustment(true)}
                    aria-label="Editar ajuste"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground justify-start -ml-2"
                onClick={() => setEditingAdjustment(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Ajustar IVA acreditable
              </Button>
            )}

            <div className="border-t border-border pt-3">
              <Row
                label={summary.ivaResultado >= 0 ? "IVA a pagar" : "IVA a favor"}
                value={Math.abs(summary.ivaResultado)}
                bold
                className={summary.ivaResultado >= 0 ? "text-destructive" : "text-success"}
              />
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">ISR del Período</h3>
            <Row label="Ingresos cobrados (base sin IVA)" value={summary.isrBase} />
            <Row
              label={`ISR del ${accumulated ? "ejercicio" : "mes"} (${(summary.isrRate * 100).toFixed(2)}%)`}
              value={summary.isrCausado}
            />

            <div className="border-t border-border pt-3 space-y-3">
              <Row label="Retenido por clientes (1.25% morales)" value={summary.isrRetenido} />
              <Row label="Provisión propia (a apartar)" value={summary.provisionPropia} />
              <Row label="Total provisionado (2.50%)" value={summary.provisionTotal} className="!font-semibold" />
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <Row label="ISR a cargo (cubierto con provisión propia)" value={summary.isrACargo} />
              <Row label="Provisión ISR sobrante (para anual)" value={summary.provisionSobrante} bold className="text-success" />
            </div>

            {summary.isrExceeded && (
              <Alert className="border-amber-500/50 text-amber-600 dark:text-amber-500 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-500">
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>
                  La base cobrada rebasa el tope de $3,500,000 de RESICO. Se aplicó la tasa máxima (2.5%).
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              De cada factura cobrada se aparta el 2.5% (retención de clientes persona moral + provisión propia).
              Con eso se cubre el ISR del período según la tabla RESICO, y el sobrante queda provisionado para la
              declaración anual.
            </p>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Impuestos por Trasladar</h3>
            <Row label="IVA pendiente (no cobrado)" value={summary.ivaPendiente} />
            <Row label="ISR pendiente (no cobrado)" value={summary.isrPendiente} />
            <p className="text-xs text-muted-foreground">
              Estos montos son informativos. Bajo flujo de efectivo, se reconocerán automáticamente en el mes en que se cobren las facturas.
            </p>
            {hasSomethingToCarry && (
              <Row
                label="IVA a favor (acreditar siguiente mes)"
                value={Math.abs(ivaToCarry)}
                className="text-success"
              />
            )}
            {carryMismatch && (
              <Alert className="border-amber-500/50 text-amber-600 dark:text-amber-500 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-500">
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>
                  El traslado de IVA guardado hacia {monthLabel(next.month, next.year)}{" "}
                  (<span className="tabular-nums font-medium">{fmtMXN(storedCarryFavor)}</span>) ya no coincide con el
                  cálculo actual (<span className="tabular-nums font-medium">{fmtMXN(Math.abs(ivaToCarry))}</span>),
                  probablemente por facturas editadas o marcadas como no deducibles. Usa "Actualizar traslado" para corregirlo.
                </AlertDescription>
              </Alert>
            )}
            <Button
              variant="outline" size="sm" className="w-full"
              disabled={accumulated || (!hasSomethingToCarry && !carryMismatch)}
              onClick={() => setConfirmCarry(true)}
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              {alreadyCarried ? "Actualizar traslado de IVA a favor" : "Trasladar IVA a favor"}
            </Button>
            {alreadyCarried && !accumulated && (
              <p className="text-xs text-muted-foreground">
                Ya hay un traslado registrado para {monthLabel(next.month, next.year)}. Confirmar volverá a calcularlo con el saldo a favor actual.
              </p>
            )}
            {accumulated && (
              <p className="text-xs text-muted-foreground">Desactiva el modo acumulado para trasladar.</p>
            )}
            {!accumulated && !hasSomethingToCarry && !carryMismatch && (
              <p className="text-xs text-muted-foreground">No hay saldo a favor de IVA para trasladar.</p>
            )}

          </Card>
        </div>
      )}

      <AlertDialog open={confirmCarry} onOpenChange={setConfirmCarry}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trasladar saldo a favor de IVA</AlertDialogTitle>
            <AlertDialogDescription>
              Se trasladará un <span className="font-medium tabular-nums">saldo a favor de IVA de {fmtMXN(Math.abs(ivaToCarry))}</span> a {monthLabel(next.month, next.year)}, donde se acreditará automáticamente contra el IVA por pagar de ese mes. Si no se agota, podrás volver a trasladarlo al mes siguiente.
              <br /><br />
              <span className="text-xs">Nota: bajo flujo de efectivo, el IVA e ISR pendientes (de facturas no cobradas) se reconocen automáticamente en el mes en que se cobren, por lo que no se trasladan.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => carryMutation.mutate()}>Confirmar traslado</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: number; bold?: boolean; className?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "text-lg font-semibold" : "font-medium"} ${className ?? ""}`}>
        {fmtMXN(value)}
      </span>
    </div>
  );
}
