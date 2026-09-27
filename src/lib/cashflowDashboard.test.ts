import { describe, expect, it } from "vitest";
import { buildCashflowDashboard, type CashflowDashboardInput, type IncomeInvoice } from "@/lib/cashflowDashboard";

const empty = (): CashflowDashboardInput => ({ incomes: [], expenses: [], carryovers: [], adjustments: [] });
const income = (changes: Partial<IncomeInvoice> = {}): IncomeInvoice => ({
  year: 2026, month: 1, date: "2026-01-01", total: 1147.5, paid_amount: 0,
  subtotal: 1000, iva: 160, isr: 12.5,
  is_collected: false, collected_date: null, ...changes,
});

describe("buildCashflowDashboard", () => {
  it("calcula pendiente ACTUAL con pago parcial y no inventa cobro fiscal", () => {
    const data = empty();
    data.incomes = [income({ paid_amount: 400 })];
    const result = buildCashflowDashboard(data, 2026, 1);
    expect(result.kpis.pendienteActual).toBe(747.5);
    expect(result.month.ingresosCobrados).toBe(0);
    expect(result.metadata.pendiente.status).toBe("current");
    expect(result.metadata.pendiente.warning).toContain("todas las facturas");
    expect(result.outstandingByIssueMonth[0].amount).toBe(747.5);
    expect(result.kpis.pendingToday).toBe(747.5);
  });

  it("suma pendientes de todos los años hasta la fecha local y excluye cobradas, futuras y sobrepagadas", () => {
    const data = empty();
    data.incomes = [
      income({ year: 2025, month: 12, date: "2025-12-31", paid_amount: 200 }),
      income({ month: 9, date: "2026-09-27", paid_amount: 100 }),
      income({ month: 9, date: "2026-09-28" }),
      income({ month: 9, date: "2026-09-26", is_collected: true }),
      income({ month: 9, date: "2026-09-26", paid_amount: 2000 }),
    ];
    const result = buildCashflowDashboard(data, 2026, 9, new Date(2026, 8, 27, 23, 30));
    expect(result.kpis.pendingToday).toBe(1995);
    expect(result.outstandingByIssueMonth[8].amount).toBe(1047.5);
    expect(result.outstandingByIssueMonth).toHaveLength(12);
  });

  it("reconoce en enero una factura emitida en diciembre al cobrarse en enero", () => {
    const data = empty();
    data.incomes = [income({
      year: 2025, month: 12, date: "2025-12-01", paid_amount: 1147.5,
      is_collected: true, collected_date: "2026-01-04",
    })];
    const result = buildCashflowDashboard(data, 2026, 1);
    expect(result.month.ingresosCobrados).toBe(1147.5);
    expect(result.month.ivaTrasladado).toBe(160);
    expect(result.month.isrCausado).toBe(10);
    expect(result.kpis.pendienteActual).toBe(0);
  });

  it("separa el gasto no deducible y excluye su IVA del acreditable", () => {
    const data = empty();
    data.expenses = [
      { year: 2026, month: 2, total: 116, iva: 16, no_deducible: false },
      { year: 2026, month: 2, total: 232, iva: 32, no_deducible: true },
    ];
    const result = buildCashflowDashboard(data, 2026, 2).month;
    expect(result.gastosRegistrados).toBe(348);
    expect(result.gastosDeducibles).toBe(116);
    expect(result.gastosNoDeducibles).toBe(232);
    expect(result.ivaAcreditableBase).toBe(16);
  });

  it("aplica ajuste y arrastre de IVA a favor, incluso de diciembre a enero", () => {
    const data = empty();
    data.incomes = [income({ paid_amount: 1147.5, is_collected: true, collected_date: "2026-01-12" })];
    data.adjustments = [{ year: 2026, month: 1, iva_acreditable_adjustment: 20 }];
    data.carryovers = [{ from_year: 2025, from_month: 12, to_year: 2026, to_month: 1, iva_favor_amount: 50 }];
    const result = buildCashflowDashboard(data, 2026, 1).month;
    expect(result.ivaAcreditable).toBe(20);
    expect(result.carryIvaFavor).toBe(50);
    expect(result.ivaResultado).toBe(90);
    expect(result.ivaAPagar).toBe(90);
  });

  it("suma el año completo y calcula ISR anual con su tabla anual", () => {
    const data = empty();
    data.incomes = [income({ paid_amount: 1147.5, is_collected: true, collected_date: "2026-01-15" })];
    data.expenses = [{ year: 2026, month: 1, total: 116, iva: 16, no_deducible: false }];
    const result = buildCashflowDashboard(data, 2026, 1);
    expect(result.month.ivaAPagar).toBe(144);
    expect(result.month.isrACargo).toBe(0);
    expect(result.annual.isrCausado).toBe(10);
    expect(result.annual.ivaAPagar).toBe(144);
    expect(result.annual.taxes).toBe(144);
    expect(result.months).toHaveLength(12);
    expect(result.collectionsByMonth).toHaveLength(12);
    expect(result.expensesByMonth[0].deductible).toBe(116);
    expect(result.iva.result).toBe(144);
    expect(result.periodIsr.caused).toBe(10);
    expect(result.kpis.taxes).toBe(144);
  });

  it("mantiene el total anual completo aunque cambie el mes seleccionado", () => {
    const data = empty();
    data.incomes = [
      income({ paid_amount: 1147.5, is_collected: true, collected_date: "2026-01-15" }),
      income({ month: 12, date: "2026-12-01", paid_amount: 1147.5, is_collected: true, collected_date: "2026-12-15" }),
    ];
    const january = buildCashflowDashboard(data, 2026, 1);
    const december = buildCashflowDashboard(data, 2026, 12);
    expect(january.month.ingresosCobrados).toBe(1147.5);
    expect(january.annual).toEqual(december.annual);
    expect(january.annual.ingresosCobrados).toBe(2295);
    expect(january.annual.ivaAPagar).toBe(320);
    expect(january.annual.taxes).toBe(320);
  });

  it("usa rangos diferentes para ISR mensual y anual acumulado", () => {
    const data = empty();
    data.incomes = [
      income({ total: 114750, paid_amount: 114750, subtotal: 100000, iva: 16000, isr: 1250, is_collected: true, collected_date: "2026-01-15" }),
      income({ month: 2, total: 114750, paid_amount: 114750, subtotal: 100000, iva: 16000, isr: 1250, is_collected: true, collected_date: "2026-02-15" }),
    ];
    const result = buildCashflowDashboard(data, 2026, 2);
    expect(result.periodIsr.rate).toBe(0.02);
    expect(result.periodIsr.caused).toBe(2000);
    expect(result.annualIsr.rate).toBe(0.01);
    expect(result.annualIsr.caused).toBe(2000);
  });

  it("propaga la alerta cuando la base excede el rango RESICO", () => {
    const data = empty();
    data.incomes = [income({
      total: 4_060_000, paid_amount: 4_060_000, subtotal: 4_000_000,
      iva: 640_000, isr: 50_000, is_collected: true, collected_date: "2026-01-15",
    })];
    const result = buildCashflowDashboard(data, 2026, 1);
    expect(result.periodIsr.isrExceeded).toBe(true);
    expect(result.annualIsr.isrExceeded).toBe(true);
  });
});
