import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FlujoEfectivo from "./FlujoEfectivo";

const mocks = vi.hoisted(() => ({ dashboard: vi.fn() }));
vi.mock("@/hooks/useCashflowDashboard", () => ({ useCashflowDashboard: mocks.dashboard }));
vi.mock("@/components/cashflow/dashboard/CashflowDashboard", () => ({
  default: ({ status, view }: { status: string; view?: string }) => <div data-testid="dashboard-status">{status}:{view}</div>,
}));

const period = { ingresosCobrados: 100, gastosRegistrados: 0, ivaAPagar: 0, isrACargo: 0 };
const data = { month: period, annual: period, months: [], iva: { adjustments: 0, carryForward: 0, result: 0 }, kpis: { pendingToday: 0 } };

describe("FlujoEfectivo", () => {
  beforeEach(() => mocks.dashboard.mockReset());

  it.each([
    [{ isLoading: true, isError: false }, "loading:"],
    [{ isLoading: false, isError: true, error: new Error("Fallo") }, "error:"],
    [{ isLoading: false, isError: false, data: undefined }, "empty:"],
  ])("muestra el estado %s", (result, status) => {
    mocks.dashboard.mockReturnValue(result);
    render(<FlujoEfectivo />);
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent(status);
  });

  it("alterna mes y año y conserva el mes elegido", () => {
    mocks.dashboard.mockReturnValue({ isLoading: false, isError: false, data });
    render(<FlujoEfectivo />);
    const [initialYear, initialMonth] = mocks.dashboard.mock.lastCall as [number, number];
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ready:month");
    fireEvent.click(screen.getByRole("button", { name: /Mes anterior/i }));
    const [chosenYear, chosenMonth] = mocks.dashboard.mock.lastCall as [number, number];
    expect(chosenMonth).not.toBe(initialMonth);
    fireEvent.click(screen.getByRole("button", { name: "Año", exact: true }));
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ready:year");
    expect(screen.getByRole("button", { name: "Año", exact: true })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Año anterior" }));
    expect(mocks.dashboard).toHaveBeenLastCalledWith(chosenYear - 1, chosenMonth);
    fireEvent.click(screen.getByRole("button", { name: "Mes", exact: true }));
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ready:month");
    expect(mocks.dashboard).toHaveBeenLastCalledWith(chosenYear - 1, chosenMonth);
    expect(initialYear).toBeGreaterThan(2000);
  });

  it("muestra el saldo global aun cuando el período no tiene actividad y retira operaciones de esta vista", () => {
    mocks.dashboard.mockReturnValue({ isLoading: false, isError: false, data: {
      month: { ingresosCobrados: 0, gastosRegistrados: 0, ivaAPagar: 0, isrACargo: 0 },
      annual: { ingresosCobrados: 0, gastosRegistrados: 0, ivaAPagar: 0, isrACargo: 0 },
      months: [], iva: { adjustments: 0, carryForward: 0, result: 0 },
      kpis: { pendingToday: 200 },
    } });
    render(<FlujoEfectivo />);
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ready:month");
    expect(screen.queryByText("Movimientos y créditos")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar ingreso|Agregar gasto/i })).not.toBeInTheDocument();
  });

  it("mantiene el tablero si solo hay un arrastre de IVA en el mes o el año", () => {
    mocks.dashboard.mockReturnValue({ isLoading: false, isError: false, data: {
      month: { ingresosCobrados: 0, gastosRegistrados: 0, ivaAPagar: 0, isrACargo: 0 },
      annual: { ingresosCobrados: 0, gastosRegistrados: 0, ivaAPagar: 0, isrACargo: 0 },
      months: [{ ivaAcreditableAjuste: 0, carryIvaFavor: 75, ivaResultado: -75 }],
      iva: { adjustments: 0, carryForward: 75, result: -75 },
      kpis: { pendingToday: 0 },
    } });
    render(<FlujoEfectivo />);
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ready:month");
    fireEvent.click(screen.getByRole("button", { name: "Año", exact: true }));
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ready:year");
  });
});
