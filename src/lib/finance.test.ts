import { describe, it, expect } from "vitest";
import { computeTotals, resicoIsr, resicoProvision } from "@/lib/finance";

describe("computeTotals", () => {
  it("applies IVA and ISR when applyIsr is true", () => {
    const result = computeTotals(1000, { applyIsr: true });
    expect(result.iva).toBe(160);
    expect(result.isr).toBe(12.5);
    expect(result.total).toBe(1147.5);
  });

  it("omits ISR when applyIsr is false", () => {
    const result = computeTotals(1000, { applyIsr: false });
    expect(result.iva).toBe(160);
    expect(result.isr).toBe(0);
    expect(result.total).toBe(1160);
  });

  it("rounds each component to cents before totaling", () => {
    const result = computeTotals(999.99, { applyIsr: true });
    expect(result.iva).toBe(160);
    expect(result.isr).toBe(12.5);
    expect(result.total).toBe(1147.49);
  });
});

describe("resicoIsr", () => {
  describe("monthly brackets", () => {
    it("25000 -> 1%", () => {
      const r = resicoIsr(25000, "monthly");
      expect(r.rate).toBe(0.01);
      expect(r.isr).toBe(250);
      expect(r.exceeded).toBe(false);
    });

    it("25000.01 -> 1.1%", () => {
      const r = resicoIsr(25000.01, "monthly");
      expect(r.rate).toBe(0.011);
      expect(r.exceeded).toBe(false);
    });

    it("50000 -> 1.1%", () => {
      const r = resicoIsr(50000, "monthly");
      expect(r.rate).toBe(0.011);
      expect(r.isr).toBe(550);
      expect(r.exceeded).toBe(false);
    });

    it("83333.33 -> 1.5%", () => {
      const r = resicoIsr(83333.33, "monthly");
      expect(r.rate).toBe(0.015);
      expect(r.exceeded).toBe(false);
    });

    it("100000 -> 2%", () => {
      const r = resicoIsr(100000, "monthly");
      expect(r.rate).toBe(0.02);
      expect(r.isr).toBe(2000);
      expect(r.exceeded).toBe(false);
    });

    it("208333.34 -> 2.5%", () => {
      const r = resicoIsr(208333.34, "monthly");
      expect(r.rate).toBe(0.025);
      expect(r.exceeded).toBe(false);
    });

    it("3500000.01 -> 2.5% with exceeded=true", () => {
      const r = resicoIsr(3500000.01, "monthly");
      expect(r.rate).toBe(0.025);
      expect(r.exceeded).toBe(true);
    });

    it("0 -> isr 0", () => {
      const r = resicoIsr(0, "monthly");
      expect(r.isr).toBe(0);
      expect(r.exceeded).toBe(false);
    });
  });

  describe("annual brackets", () => {
    it("300000 -> 1%", () => {
      const r = resicoIsr(300000, "annual");
      expect(r.rate).toBe(0.01);
      expect(r.exceeded).toBe(false);
    });

    it("1000000 -> 1.5%", () => {
      const r = resicoIsr(1000000, "annual");
      expect(r.rate).toBe(0.015);
      expect(r.exceeded).toBe(false);
    });

    it("2500000 -> 2%", () => {
      const r = resicoIsr(2500000, "annual");
      expect(r.rate).toBe(0.02);
      expect(r.exceeded).toBe(false);
    });

    it("3000000 -> 2.5%", () => {
      const r = resicoIsr(3000000, "annual");
      expect(r.rate).toBe(0.025);
      expect(r.exceeded).toBe(false);
    });
  });

  it("real case: base mensual 111679.20 -> rate 0.02, isr 2233.58", () => {
    const r = resicoIsr(111679.2, "monthly");
    expect(r.rate).toBe(0.02);
    expect(r.isr).toBe(2233.58);
  });
});

describe("resicoProvision", () => {
  it("real case: base 111679.20, retenido 1395.99 -> total 2791.98, propia 1395.99", () => {
    const r = resicoProvision(111679.2, 1395.99);
    expect(r.total).toBe(2791.98);
    expect(r.propia).toBe(1395.99);
  });

  it("factura persona física: base 1000, retenido 0 -> total 25, propia 25", () => {
    const r = resicoProvision(1000, 0);
    expect(r.total).toBe(25);
    expect(r.propia).toBe(25);
  });

  it("factura persona moral: base 1000, retenido 12.5 -> total 25, propia 12.5", () => {
    const r = resicoProvision(1000, 12.5);
    expect(r.total).toBe(25);
    expect(r.propia).toBe(12.5);
  });

  it("base 0, retenido 0 -> total 0, propia 0", () => {
    const r = resicoProvision(0, 0);
    expect(r.total).toBe(0);
    expect(r.propia).toBe(0);
  });

  it("retenido mayor que total (caso anómalo) -> propia 0, sin negativos", () => {
    const r = resicoProvision(1000, 100);
    expect(r.total).toBe(25);
    expect(r.propia).toBe(0);
  });
});
