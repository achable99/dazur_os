import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FlujoEfectivo from "./FlujoEfectivo";

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  deleteEntry: vi.fn(),
}));

vi.mock("@/hooks/useCashflowDashboard", () => ({ useCashflowDashboard: mocks.dashboard }));
vi.mock("@/components/cashflow/dashboard/CashflowDashboard", () => ({
  default: ({ status }: { status: string }) => <div data-testid="dashboard-status">{status}</div>,
}));
vi.mock("@/components/cashflow/CreditLinesPanel", () => ({ default: () => <div>Panel de créditos</div> }));
vi.mock("@/components/cashflow/EntryDialog", () => ({
  default: ({ onSaved }: { onSaved: () => void }) => <button onClick={onSaved}>Simular guardado</button>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ order: () => Promise.resolve({ data: table === "cash_flow_entries" ? [{
        id: "entry-1", type: "income", concept: "Ingreso manual", amount: 100,
        date: "2026-09-01", category: null, origin: "manual", origin_id: null, notes: null,
      }] : [], error: null }) }),
      delete: () => ({ eq: mocks.deleteEntry }),
    }),
  },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}><FlujoEfectivo /></QueryClientProvider>);
  return { invalidate };
}

function wasDashboardInvalidated(invalidate: ReturnType<typeof vi.spyOn>) {
  return invalidate.mock.calls.some(([filters]) => {
    const candidate = filters as { predicate?: (query: { queryKey: string[] }) => boolean } | undefined;
    return candidate?.predicate?.({ queryKey: ["all_income_invoices_fiscal", "cashflow_dashboard"] }) ?? false;
  });
}

describe("FlujoEfectivo", () => {
  beforeEach(() => {
    mocks.dashboard.mockReset();
    mocks.deleteEntry.mockReset();
    mocks.deleteEntry.mockResolvedValue({ error: null });
  });

  it.each([
    [{ isLoading: true, isError: false }, "loading"],
    [{ isLoading: false, isError: true, error: new Error("Fallo") }, "error"],
    [{ isLoading: false, isError: false, data: undefined }, "empty"],
  ])("muestra el estado %s", (result, status) => {
    mocks.dashboard.mockReturnValue(result);
    renderPage();
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent(status);
  });

  it("muestra el tablero con datos y conserva las operaciones colapsadas", async () => {
    mocks.dashboard.mockReturnValue({ isLoading: false, isError: false, data: {
      collectionsByMonth: [{ label: "Sep 2026", amount: 100 }],
      outstandingByIssueMonth: [], expensesByMonth: [], iva: { adjustments: 0, carryForward: 0 },
    } });
    renderPage();
    expect(screen.getByTestId("dashboard-status")).toHaveTextContent("ready");
    expect(screen.queryByText("Panel de créditos")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abrir movimientos y créditos/i }));
    expect(screen.getByText("Panel de créditos")).toBeInTheDocument();
    expect(await screen.findByText("Ingreso manual")).toBeInTheDocument();
  });

  it("invalida el tablero al guardar y eliminar entradas manuales", async () => {
    mocks.dashboard.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    const { invalidate } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Abrir movimientos y créditos/i }));
    fireEvent.click(screen.getByRole("button", { name: /Agregar ingreso/i }));
    fireEvent.click(screen.getByRole("button", { name: "Simular guardado" }));
    expect(wasDashboardInvalidated(invalidate)).toBe(true);

    invalidate.mockClear();
    await screen.findByText("Ingreso manual");
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Ingreso manual" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(wasDashboardInvalidated(invalidate)).toBe(true));
  });
});
