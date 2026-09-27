import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import CashflowDashboard, { type CashflowDashboardData } from "./CashflowDashboard";

const isr = { base: 1000, rate: 0.0125, caused: 12.5, withheld: 5, provision: 25, estimatedSurplus: 12.5, isrExceeded: false };
const zeroMonth = { ingresosCobrados: 0, gastosRegistrados: 0, ivaTrasladado: 0, ivaAcreditableBase: 0, ivaAcreditableAjuste: 0, carryIvaFavor: 0, ivaResultado: 0, ivaAPagar: 0, isrACargo: 0 };
const months = Array.from({ length: 12 }, (_, index) => index === 8 ? { ...zeroMonth, ingresosCobrados: 1000, gastosRegistrados: 300, ivaTrasladado: 160, ivaAcreditableBase: 40, ivaAcreditableAjuste: -10, carryIvaFavor: 20, ivaResultado: 110, ivaAPagar: 110, isrACargo: 10 } : zeroMonth);
const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const data: CashflowDashboardData = {
  year: 2026, selectedMonth: 9, months, month: months[8],
  annual: { ingresosCobrados: 1400, gastosRegistrados: 350, ivaAPagar: 120, isrACargo: 20, taxes: 140 },
  kpis: { collectedFiscal: 1000, pendingToday: 200, registeredExpenses: 300, taxes: 120 },
  collectionsByMonth: labels.map((label, index) => ({ label: `${label} 2026`, amount: index === 8 ? 1000 : index === 0 ? 400 : 0 })),
  outstandingByIssueMonth: labels.map((label, index) => ({ label: `${label} 2026`, amount: index === 8 ? 200 : 0 })),
  expensesByMonth: labels.map((label, index) => ({ label: `${label} 2026`, deductible: index === 8 ? 250 : 0, nonDeductible: index === 8 ? 50 : 0 })),
  iva: { transferred: 160, creditable: 40, adjustments: -10, carryForward: 20, result: 110 },
  periodIsr: isr,
  annualIsr: { ...isr, base: 5000 },
};

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

describe("CashflowDashboard", () => {
  it("muestra los estados de carga, vacío y error", () => {
    const { rerender } = render(<CashflowDashboard status="loading" />);
    expect(screen.getByRole("status", { name: "Cargando tablero de flujo de efectivo" })).toBeInTheDocument();
    rerender(<CashflowDashboard status="empty" />);
    expect(screen.getByText("Aún no hay datos para este tablero.")).toBeInTheDocument();
    rerender(<CashflowDashboard status="error" error="Error de consulta" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Error de consulta");
  });

  it("muestra solo el mes elegido y el saldo global, sin remanente", () => {
    render(<CashflowDashboard status="ready" view="month" data={data} />);
    expect(screen.getByText("Saldo pendiente hoy")).toBeInTheDocument();
    expect(screen.getByText(/todas las facturas emitidas hasta hoy/i)).toBeInTheDocument();
    expect(screen.queryByText("Remanente estimado")).not.toBeInTheDocument();
    const collections = within(screen.getByRole("list", { name: "Valores de Cobros por mes" }));
    expect(collections.getAllByRole("listitem")).toHaveLength(1);
    expect(collections.getByText(/Sep 2026:.*1,000/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Valores de Cartera pendiente actual" })).getByText(/Sep 2026:.*200/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Valores de gastos registrados por mes" })).getByText(/deducibles.*250.*no deducibles.*50/i)).toBeInTheDocument();
    expect(screen.getByText("IVA del período")).toBeInTheDocument();
    expect(screen.getByText("ISR del período")).toBeInTheDocument();
    expect(screen.queryByText("ISR anual acumulado")).not.toBeInTheDocument();
  });

  it("muestra los doce meses, totales anuales y solo ISR anual", () => {
    render(<CashflowDashboard status="ready" view="year" data={data} />);
    expect(within(screen.getByRole("list", { name: "Valores de Cobros por mes" })).getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByText("IVA anual acumulado")).toBeInTheDocument();
    expect(screen.getByText("IVA a pagar acumulado").parentElement).toHaveTextContent(/120/);
    expect(screen.queryByText("IVA trasladado")).not.toBeInTheDocument();
    expect(screen.queryByText("ISR del período")).not.toBeInTheDocument();
    expect(screen.getByText("ISR anual acumulado")).toBeInTheDocument();
    expect(screen.getByText(/facturas emitidas en el año seleccionado/i)).toBeInTheDocument();
    expect(screen.getByText(/1,400/)).toBeInTheDocument();
  });

  it("advierte cuando el ISR del mes excede el rango RESICO", () => {
    render(<CashflowDashboard status="ready" view="month" data={{ ...data, periodIsr: { ...data.periodIsr, isrExceeded: true } }} />);
    expect(screen.getByText("Base fuera del rango RESICO")).toBeInTheDocument();
  });

  it("muestra el estado vacío de cada gráfica aunque exista un resumen", () => {
    render(<CashflowDashboard status="ready" view="month" data={{ ...data, collectionsByMonth: [], outstandingByIssueMonth: [], expensesByMonth: [] }} />);
    expect(screen.getAllByText("Sin datos para mostrar.")).toHaveLength(3);
  });
});
