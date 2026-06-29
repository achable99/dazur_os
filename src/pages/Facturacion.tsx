import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IncomeInvoicesTab from "@/components/facturacion/IncomeInvoicesTab";
import ExpenseInvoicesTab from "@/components/facturacion/ExpenseInvoicesTab";
import FiscalSummaryTab from "@/components/facturacion/FiscalSummaryTab";
import PaymentComplementsTab from "@/components/facturacion/PaymentComplementsTab";

export default function Facturacion() {
  const [tab, setTab] = useState("ingreso");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturación</h1>
        <p className="text-sm text-muted-foreground">Gestión de facturas e impuestos.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="ingreso">Facturas de Ingreso</TabsTrigger>
          <TabsTrigger value="gasto">Facturas de Gasto</TabsTrigger>
          <TabsTrigger value="complementos">Complementos de Pago</TabsTrigger>
          <TabsTrigger value="fiscal">Resumen Fiscal</TabsTrigger>
        </TabsList>
        <TabsContent value="ingreso"><IncomeInvoicesTab /></TabsContent>
        <TabsContent value="gasto"><ExpenseInvoicesTab /></TabsContent>
        <TabsContent value="complementos"><PaymentComplementsTab /></TabsContent>
        <TabsContent value="fiscal"><FiscalSummaryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
