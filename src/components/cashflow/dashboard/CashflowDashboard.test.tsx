import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import CashflowDashboard, { type CashflowDashboardData } from "./CashflowDashboard";

const isr = { base: 1000, rate: 0.0125, caused: 12.5, withheld: 5, provision: 25, estimatedSurplus: 12.5, isrExceeded: false };

const data: CashflowDashboardData = {
  kpis: { collectedFiscal: 1000, pendingToday: 200, registeredExpenses: 300, taxes: 40, remanenteEstimado: 660.25 },
  collectionsByMonth: [{ label: "Ene 2026", amount: 1000 }],
  outstandingByIssueMonth: [{ label: "Dic 2025", amount: 200 }],
  expensesByMonth: [{ label: "Ene 2026", deductible: 250, nonDeductible: 50 }],
  iva: { transferred: 160, creditable: 40, adjustments: -10, carryForward: 20, result: -5 },
  periodIsr: isr,
  annualIsr: { ...isr, base: 5000 },
};

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
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

  it("expone importes y desglose mensual como texto accesible", () => {
    render(<CashflowDashboard status="ready" data={data} />);
    expect(screen.getByText("Cobrado fiscalmente")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Valores de Cobros por mes" })).getByText(/Ene 2026:.*1,000/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Valores de Cartera pendiente actual" })).getByText(/Dic 2025:.*200/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Valores de gastos registrados por mes" })).getByText(/deducibles.*250.*no deducibles.*50/i)).toBeInTheDocument();
    expect(screen.getByText("IVA a favor")).toBeInTheDocument();
    expect(screen.getByText("ISR anual acumulado")).toBeInTheDocument();
    expect(screen.getByText("Pagos parciales")).toBeInTheDocument();
    expect(screen.getByText("Cartera no histórica")).toBeInTheDocument();
  });

  it("muestra el remanente estimado con su importe y alcance", () => {
    render(<CashflowDashboard status="ready" data={data} />);
    expect(screen.getByText("Remanente estimado")).toBeInTheDocument();
    expect(screen.getByText(/660[.,]25/)).toBeInTheDocument();
    expect(screen.getByText("Estimación del período seleccionado; no es saldo bancario ni saldo fiscal definitivo.")).toBeInTheDocument();
  });

  it("muestra la advertencia cuando el ISR excede el rango RESICO", () => {
    render(<CashflowDashboard status="ready" data={{ ...data, periodIsr: { ...data.periodIsr, isrExceeded: true } }} />);
    expect(screen.getByText("Base fuera del rango RESICO")).toBeInTheDocument();
    expect(screen.getByText(/tasa máxima/i)).toBeInTheDocument();
  });

  it("muestra el estado vacío de cada gráfica aunque exista un resumen", () => {
    render(<CashflowDashboard status="ready" data={{ ...data, collectionsByMonth: [], outstandingByIssueMonth: [], expensesByMonth: [] }} />);
    expect(screen.getAllByText("Sin datos para mostrar.")).toHaveLength(3);
  });
});
