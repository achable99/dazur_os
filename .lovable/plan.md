## Problema

Las facturas marcadas como Cobradas antes de existir los complementos ya generaron su ingreso e impuestos en el flujo. Al intentar registrar un complemento de pago "solo trazabilidad" para ellas:
- La validación exige que la suma aplicada iguale el total → bloquea el guardado (Falta $105,707.70).
- El RPC `apply_payment_complement` inserta una entrada en `cash_flow_entries` por el total → duplicaría el ingreso.

## Objetivo

Agregar la opción **"Solo trazabilidad (no calcular impuestos ni flujo)"** al complemento de pago, para registrarlo con su monto real ante el SAT sin afectar cash flow, `paid_amount`, `is_collected` ni impuestos.

## Cambios

### 1. Base de datos (migración)
- `payment_complements`: agregar columna `traceability_only boolean NOT NULL DEFAULT false`.
- `apply_payment_complement(_complement_id)`:
  - Si `traceability_only = true` → NO actualizar `paid_amount`, `is_collected`, `collected_date`, y NO insertar en `cash_flow_entries`. Solo registrar las allocations como referencia.
- `revert_payment_complement(_complement_id)`:
  - Si `traceability_only = true` → solo borrar allocations / cash flow (que no existe). No revertir `paid_amount`.

### 2. UI — `PaymentComplementDialog.tsx`
- Nuevo `Checkbox` "Solo trazabilidad (no calcular impuestos ni afectar flujo)" debajo de Método de pago, con leyenda de ayuda.
- Cuando está activo:
  - Saltar la validación `suma aplicada == total` (permitir $0 aplicado).
  - Permitir guardar aunque ninguna factura tenga monto > 0.
  - Las allocations seleccionadas se guardan con el monto que el usuario ponga (típicamente 0) puramente como vínculo.
- Mostrar badge informativo "Modo trazabilidad" en el header del diálogo cuando esté activo.
- El estado inicial al editar viene del registro existente.

### 3. UI — listado de complementos (`PaymentComplementsTab.tsx`)
- Mostrar badge "Trazabilidad" junto a los complementos con `traceability_only = true` para distinguirlos.

## Fuera de alcance
- No se cambia la lógica de Resumen Fiscal (ya reconoce por `collected_date` y no usa complementos para impuestos).
- No se cambian complementos existentes (default `false`).

## Verificación
- Crear complemento con 4 facturas Cobradas y `traceability_only` activo, monto $105,707.70 → guarda sin error, no aparece en cash flow, las facturas siguen igual.
- Crear complemento normal (sin checkbox) → comportamiento actual sin cambios: exige suma = total y genera ingreso.
- Editar y desmarcar `traceability_only` no es soportado (avisar al usuario que elimine y recree); o si simple, recalcular al apply — se documenta como "no soportado" para evitar inconsistencias.
