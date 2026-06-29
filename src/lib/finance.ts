export const fmtMXN = (v: number | string | null | undefined) => {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
};

export const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const monthLabel = (m: number, y: number) => `${MONTHS_ES[m - 1]} ${y}`;

export const REGIMENES_FISCALES = [
  "Régimen Simplificado de Confianza (RESICO)",
  "Régimen de Actividades Empresariales y Profesionales",
  "Régimen General de Ley Personas Morales",
  "Régimen de Incorporación Fiscal (RIF)",
  "Asalariados",
  "Arrendamiento",
  "Otro",
];

export const EXPENSE_CATEGORIES = [
  "Operación", "Nómina", "Servicios", "Proveedor", "Impuestos", "Crédito", "Otro",
];

export const EXPENSE_INVOICE_CATEGORIES = [
  "Servicios", "Proveedor", "Nómina", "Arrendamiento", "Otro",
];

export const INVOICE_TYPES = ["Ingreso", "Honorarios", "Arrendamiento", "Otro"];

export const IVA_RATE = 0.16;
export const ISR_RATE = 0.0125;

export const periodKey = (y: number, m: number) => y * 100 + m;

/** Format a Date as "23 de Junio de 2026" (long Spanish date). */
export function longDateEs(d: Date): string {
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Reglas fiscales del negocio (idénticas a facturas de ingreso):
 * IVA 16% trasladado, ISR 1.25% retenido, Total = subtotal + IVA − ISR.
 * Los toggles permiten omitir IVA o ISR en una cotización puntual.
 */
export function computeTotals(
  subtotal: number,
  opts?: { applyIva?: boolean; applyIsr?: boolean }
) {
  const applyIva = opts?.applyIva ?? true;
  const applyIsr = opts?.applyIsr ?? true;
  const iva = applyIva ? subtotal * IVA_RATE : 0;
  const isr = applyIsr ? subtotal * ISR_RATE : 0;
  const total = subtotal + iva - isr;
  return {
    iva: Number(iva.toFixed(2)),
    isr: Number(isr.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/**
 * Serialize a Date as YYYY-MM-DD using its LOCAL components.
 * Avoids UTC drift caused by Date.prototype.toISOString() in negative timezones (e.g. America/Mexico_City).
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function paymentDateFor(start: Date, paymentNumber: number, paymentDay: number) {
  const d = new Date(start.getFullYear(), start.getMonth() + paymentNumber, 1);
  const day = Math.min(paymentDay, 28);
  return new Date(d.getFullYear(), d.getMonth(), day);
}

/** French amortization: constant cuota, increasing principal, decreasing interest. */
export function generateFrenchSchedule(opts: {
  principal: number;
  interestRate: number; // percentage (e.g. 12 for 12%)
  rateType: "monthly" | "annual";
  numPayments: number;
  startDate: Date;
  paymentDay: number;
}) {
  const { principal, interestRate, rateType, numPayments, startDate, paymentDay } = opts;
  const i = (rateType === "annual" ? interestRate / 12 : interestRate) / 100;
  let cuota: number;
  if (i === 0) {
    cuota = principal / numPayments;
  } else {
    cuota = (principal * i) / (1 - Math.pow(1 + i, -numPayments));
  }
  let remaining = principal;
  const rows = [] as { payment_number: number; due_date: string; principal: number; interest: number; total: number }[];
  for (let n = 1; n <= numPayments; n++) {
    const interest = remaining * i;
    let principalPart = cuota - interest;
    if (n === numPayments) principalPart = remaining; // adjust last
    const total = principalPart + interest;
    remaining -= principalPart;
    const due = paymentDateFor(startDate, n, paymentDay);
    rows.push({
      payment_number: n,
      due_date: toLocalDateString(due),
      principal: Number(principalPart.toFixed(2)),
      interest: Number(interest.toFixed(2)),
      total: Number(total.toFixed(2)),
    });
  }
  return rows;
}

export function rfcRegex() {
  // 3-4 letters, 6 digits (YYMMDD), 2-3 alphanumeric homoclave
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}$/;
}
