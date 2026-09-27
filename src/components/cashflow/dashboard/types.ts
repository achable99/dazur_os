/** Importes en MXN ya calculados por useCashflowDashboard. Este módulo no aplica reglas fiscales. */
export type DashboardMonth = {
  /** Etiqueta visible, por ejemplo "Ene 2026". */
  label: string;
  amount: number;
};

export type DashboardExpenseMonth = {
  label: string;
  deductible: number;
  nonDeductible: number;
};

export type DashboardKpis = {
  collectedFiscal: number;
  pendingToday: number;
  registeredExpenses: number;
  taxes: number;
};

export type DashboardPeriod = {
  ingresosCobrados: number;
  gastosRegistrados: number;
  ivaTrasladado: number;
  ivaAcreditableBase: number;
  ivaAcreditableAjuste: number;
  carryIvaFavor: number;
  ivaResultado: number;
  ivaAPagar: number;
  isrACargo: number;
};

export type DashboardIva = {
  transferred: number;
  creditable: number;
  adjustments: number;
  carryForward: number;
  /** Positivo: IVA a pagar. Negativo: IVA a favor. */
  result: number;
};

export type DashboardIsr = {
  base: number;
  rate: number;
  caused: number;
  withheld: number;
  provision: number;
  estimatedSurplus: number;
  isrExceeded: boolean;
};

export type CashflowDashboardData = {
  year: number;
  selectedMonth: number;
  months: DashboardPeriod[];
  month: DashboardPeriod;
  annual: Pick<DashboardPeriod, "ingresosCobrados" | "gastosRegistrados" | "ivaAPagar" | "isrACargo"> & { taxes: number };
  /** Cobros reconocidos fiscalmente, agrupados por mes de cobro. */
  collectionsByMonth: DashboardMonth[];
  /** Cartera pendiente a la fecha actual, agrupada por mes de emisión. */
  outstandingByIssueMonth: DashboardMonth[];
  expensesByMonth: DashboardExpenseMonth[];
  kpis: DashboardKpis;
  iva: DashboardIva;
  periodIsr: DashboardIsr;
  annualIsr: DashboardIsr;
};

export type DashboardView = "month" | "year";

export type CashflowDashboardProps =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error?: string; data?: never }
  | { status: "empty"; data?: never; error?: never }
  | { status: "ready"; data: CashflowDashboardData; view: DashboardView; error?: never };
