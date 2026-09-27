import { computeIsrBrief, MONTHS_ES } from "@/lib/finance";

export type IncomeInvoice = {
  year: number; month: number; date: string; total: number; paid_amount: number;
  subtotal: number; iva: number; isr: number;
  is_collected: boolean; collected_date: string | null;
};

export type ExpenseInvoice = {
  year: number; month: number; total: number; iva: number; no_deducible: boolean;
};

export type FiscalCarryover = {
  from_year: number; from_month: number; to_year: number; to_month: number;
  iva_favor_amount: number;
};

export type FiscalAdjustment = {
  year: number; month: number; iva_acreditable_adjustment: number;
};

export type CashflowDashboardInput = {
  incomes: IncomeInvoice[];
  expenses: ExpenseInvoice[];
  carryovers: FiscalCarryover[];
  adjustments: FiscalAdjustment[];
};

const money = (value: number) => Number(value.toFixed(2));

const localIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function collectedPeriod(date: string | null): { year: number; month: number } | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

/** La factura se reconoce fiscalmente sólo al quedar cobrada, como en FiscalSummaryTab. */
function collectedIn(incomes: IncomeInvoice[], year: number, month: number) {
  return incomes.filter((invoice) => {
    if (!invoice.is_collected) return false;
    const period = collectedPeriod(invoice.collected_date);
    return period?.year === year && period.month === month;
  });
}

export function buildCashflowDashboard(input: CashflowDashboardInput, year: number, selectedMonth = 12, today = new Date()) {
  if (!Number.isInteger(year) || !Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
    throw new RangeError("El año y el mes seleccionado deben ser válidos");
  }
  const { incomes, expenses, carryovers, adjustments } = input;
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const collected = collectedIn(incomes, year, month);
    const registered = expenses.filter((expense) => expense.year === year && expense.month === month);
    const deductible = registered.filter((expense) => !expense.no_deducible);
    const credited = adjustments.filter((adjustment) => adjustment.year === year && adjustment.month === month);
    const incomingFavor = carryovers.filter((carryover) => carryover.to_year === year && carryover.to_month === month);
    const isr = computeIsrBrief(collected, "monthly");
    const ingresosCobrados = money(collected.reduce((sum, invoice) => sum + Number(invoice.total), 0));
    const gastosDeducibles = money(deductible.reduce((sum, expense) => sum + Number(expense.total), 0));
    const gastosNoDeducibles = money(registered.filter((expense) => expense.no_deducible).reduce((sum, expense) => sum + Number(expense.total), 0));
    const gastosRegistrados = money(gastosDeducibles + gastosNoDeducibles);
    const ivaTrasladado = money(collected.reduce((sum, invoice) => sum + Number(invoice.iva), 0));
    const ivaAcreditableBase = money(deductible.reduce((sum, expense) => sum + Number(expense.iva), 0));
    const ivaAcreditableAjuste = money(credited.reduce((sum, adjustment) => sum + Number(adjustment.iva_acreditable_adjustment), 0));
    const ivaAcreditable = money(ivaAcreditableBase + ivaAcreditableAjuste);
    const carryIvaFavor = money(incomingFavor.reduce((sum, carryover) => sum + Number(carryover.iva_favor_amount ?? 0), 0));
    const ivaResultado = money(ivaTrasladado - ivaAcreditable - carryIvaFavor);
    const ivaAPagar = Math.max(0, ivaResultado);
    const ivaAFavor = Math.max(0, -ivaResultado);
    const isrACargo = Math.max(0, money(isr.isr - isr.retenido));

    return {
      year, month, label: MONTHS_ES[index],
      ingresosCobrados, gastosRegistrados, gastosDeducibles, gastosNoDeducibles,
      utilidad: money(ingresosCobrados - gastosDeducibles),
      ivaTrasladado, ivaAcreditableBase, ivaAcreditableAjuste, ivaAcreditable,
      carryIvaFavor, ivaResultado, ivaAPagar, ivaAFavor,
      isrBase: money(isr.base), isrRate: isr.rate, isrCausado: isr.isr,
      isrRetenido: money(isr.retenido), isrACargo, isrExceeded: isr.exceeded,
      provisionTotal: isr.total, provisionPropia: isr.propia, provisionSobrante: isr.sobrante,
    };
  });

  // paid_amount es una foto actual; no hay fechas de cada pago para reconstruir meses pasados.
  const todayISO = localIsoDate(today);
  const pendingInvoices = incomes.filter((invoice) => !invoice.is_collected && invoice.date <= todayISO);
  const pendienteActual = money(pendingInvoices.reduce(
    (sum, invoice) => sum + Math.max(0, Number(invoice.total) - Number(invoice.paid_amount)), 0,
  ));
  const outstandingByIssueMonth = months.map((row) => ({
    label: `${row.label.slice(0, 3)} ${year}`,
    amount: money(pendingInvoices.filter((invoice) => invoice.year === year && invoice.month === row.month).reduce(
      (sum, invoice) => sum + Math.max(0, Number(invoice.total) - Number(invoice.paid_amount)), 0,
    )),
  }));
  const collectionsByMonth = months.map((row) => ({ label: `${row.label.slice(0, 3)} ${year}`, amount: row.ingresosCobrados }));
  const expensesByMonth = months.map((row) => ({
    label: `${row.label.slice(0, 3)} ${year}`,
    deductible: row.gastosDeducibles,
    nonDeductible: row.gastosNoDeducibles,
  }));
  const month = months[selectedMonth - 1];
  const sum = (field: "ingresosCobrados" | "gastosRegistrados" | "gastosDeducibles" | "gastosNoDeducibles" | "ivaAPagar") =>
    money(months.reduce((total, row) => total + row[field], 0));

  // El brief anual usa la tabla ANUAL de RESICO sobre todos los cobros del ejercicio.
  const annualCollected = incomes.filter((invoice) => {
    if (!invoice.is_collected) return false;
    const period = collectedPeriod(invoice.collected_date);
    return period?.year === year;
  });
  const annualIsr = computeIsrBrief(annualCollected, "annual");
  const annualIsrACargo = Math.max(0, money(annualIsr.isr - annualIsr.retenido));
  const annualIvaAPagar = sum("ivaAPagar");
  const annual = {
    ingresosCobrados: sum("ingresosCobrados"),
    gastosRegistrados: sum("gastosRegistrados"),
    gastosDeducibles: sum("gastosDeducibles"),
    gastosNoDeducibles: sum("gastosNoDeducibles"),
    ivaAPagar: annualIvaAPagar,
    isrBase: money(annualIsr.base), isrRate: annualIsr.rate,
    isrCausado: annualIsr.isr, isrRetenido: money(annualIsr.retenido),
    isrACargo: annualIsrACargo, isrExceeded: annualIsr.exceeded,
    provisionTotal: annualIsr.total, provisionPropia: annualIsr.propia,
    provisionSobrante: annualIsr.sobrante,
    taxes: money(annualIvaAPagar + annualIsrACargo),
  };

  return {
    year, selectedMonth, months, month, annual,
    collectionsByMonth, outstandingByIssueMonth, expensesByMonth,
    iva: {
      transferred: month.ivaTrasladado,
      creditable: month.ivaAcreditableBase,
      adjustments: month.ivaAcreditableAjuste,
      carryForward: month.carryIvaFavor,
      result: month.ivaResultado,
    },
    periodIsr: {
      base: month.isrBase, rate: month.isrRate, caused: month.isrCausado,
      withheld: month.isrRetenido, provision: month.provisionTotal,
      estimatedSurplus: month.provisionSobrante, isrExceeded: month.isrExceeded,
    },
    annualIsr: {
      base: annual.isrBase, rate: annual.isrRate, caused: annual.isrCausado,
      withheld: annual.isrRetenido, provision: annual.provisionTotal,
      estimatedSurplus: annual.provisionSobrante, isrExceeded: annual.isrExceeded,
    },
    kpis: {
      collectedFiscal: month.ingresosCobrados,
      pendingToday: pendienteActual,
      registeredExpenses: month.gastosRegistrados,
      taxes: money(month.ivaAPagar + month.isrACargo),
      ingresosCobrados: month.ingresosCobrados,
      gastosRegistrados: month.gastosRegistrados,
      pendienteActual,
      ivaAPagar: month.ivaAPagar,
      isrACargo: month.isrACargo,
    },
    metadata: {
      pendiente: {
        value: pendienteActual,
        status: "current" as const,
        basis: "invoices_issued_through_today" as const,
        warning: "Saldo pendiente actual de todas las facturas emitidas hasta hoy y sin cobrar (total − pagado); no es historial mensual.",
      },
      warnings: [
        "Los cobros fiscales se reconocen al marcar la factura como cobrada y por collected_date; los pagos parciales no tienen historial fiscal mensual.",
        "Los gastos se agrupan por el mes registrado en la factura; no hay fecha de pago del gasto.",
        "El IVA mensual usa sólo arrastres a favor guardados; los arrastres pueden quedar desactualizados si cambian facturas o ajustes.",
      ],
    },
  };
}
