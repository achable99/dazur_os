# DazurOS

Panel de administración interno de **DAZUR – Innovación y Obra**. Centraliza la operación financiera y comercial del negocio: flujo de efectivo, clientes, facturación, control fiscal (IVA/ISR bajo flujo de efectivo), líneas de crédito, complementos de pago y un cotizador con generación de PDF.

Aplicación SPA construida con React + Vite y respaldada por Supabase (Postgres + Auth). Toda la lógica corre en el cliente; no hay edge functions.

## Estado actual

> Actualizado: julio 2026.

**MVP funcional y desplegado.** Los cinco módulos están implementados y en uso: Flujo de Efectivo, Clientes, Facturación (ingresos, gastos, resumen fiscal y complementos de pago) y Cotizador con PDF, todos detrás de login (single-admin).

- **Despliegue:** publicado en **Vercel** como SPA (rewrites a `index.html` en `vercel.json` para el routing del lado del cliente).
- **Base de datos:** proyecto Supabase **DAZUR_OS** vinculado (`supabase link`). Hay **14 migraciones** en `supabase/migrations`; las más recientes incorporan el flag **"no deducible"** en facturas de gasto, el **endurecimiento de permisos de las RPCs**, el **trigger de sincronización** de facturas de ingreso con el flujo de efectivo y un **backfill** que corrige facturas de persona física que habían quedado con ISR retenido indebido.
- **Novedades (julio 2026):**
  - **ISR condicional por tipo de persona:** la retención de ISR (1.25 %) en facturas de ingreso ahora sólo aplica a clientes **persona moral**; persona física paga subtotal + IVA sin retención. El tipo se toma del campo `tipo_persona` del cliente.
  - **Resumen Fiscal — tarjeta "ISR del Período":** pago provisional RESICO calculado con tablas de rangos (mensual y anual, tasas planas de 1.00 % a 2.50 % según lo cobrado), separando lo retenido por clientes morales de la provisión propia del negocio (práctica del 2.5 % total) y el sobrante que se guarda para la declaración anual. El toggle "Acumulado del ejercicio" usa la tabla anual.
  - **Simulador de declaración (PDF):** botón en Resumen Fiscal que genera y descarga un PDF (mensual o anual) con membrete de la empresa, ingresos cobrados/pendientes, cuadro de IVA (cuadra con lo mostrado en pantalla, incluye ajustes y arrastres), cuadro de ISR RESICO y un brief del acumulado anual (sólo en la versión mensual). Es un documento informativo con fines de planeación, no una declaración oficial ante el SAT.
  - **Facturas de gasto "no deducibles":** cuando el SAT rechaza una deducción, la factura se marca (botón en la fila o switch en el diálogo) en lugar de borrarse; su IVA y total se excluyen del Resumen Fiscal y del traslado de saldo a favor, conservando el registro y el flujo de efectivo.
  - **Endurecimiento de seguridad:** registro público de usuarios deshabilitado, funciones RPC sin EXECUTE para el rol anónimo, protección de contraseñas filtradas activada y dependencias de producción sin vulnerabilidades (`npm audit`).
  - **Correcciones de consistencia:** trigger que mantiene el flujo de efectivo en sync al editar/borrar facturas de ingreso cobradas, fix del doble conteo de traslados de IVA en el modo acumulado, invalidaciones de caché del Resumen Fiscal en todas las mutaciones, redondeo a centavos consistente (`subtotal + IVA − ISR = total`) y fechas en hora local en avisos de vencimiento.

### En qué se está trabajando / próximos pasos

- Los complementos de pago se acaban de acotar a **solo trazabilidad** (no afectan flujo ni impuestos); conviene validar el comportamiento con datos reales.
- El **Cotizador** y el **simulador de declaración en PDF** son lo más reciente; pendientes de pruebas de uso.
- **Cobertura de pruebas parcial** — `lib/finance.ts` ya tiene tests unitarios (`computeTotals`, tablas RESICO, provisiones); falta cubrir el resto de flujos críticos (facturación, resumen fiscal, cotizador).
- `package.json` sigue en `version: 0.0.0` (sin versionado formal todavía).
- Aviso de `npm audit` en esbuild/vite (solo afecta al servidor de desarrollo); resolverlo implica migrar a Vite 8 (breaking change).

## Funcionalidades

- **Flujo de Efectivo** — Ingresos y gastos por mes con saldo arrastrado mes a mes, saldos iniciales y líneas de crédito con tabla de amortización (sistema francés) y registro de pagos.
- **Clientes** — Alta/edición de clientes con datos fiscales (razón social, RFC, régimen, código postal, etc.).
- **Facturación**
  - Facturas de ingreso (con cobro y cobro parcial) y facturas de gasto.
  - Reglas fiscales: IVA 16 % siempre trasladado; **ISR 1.25 % retenido sólo si el cliente es persona moral** (`tipo_persona`) — persona física paga subtotal + IVA sin retención.
  - Facturas de gasto marcables como **"no deducibles"** (deducción rechazada por el SAT): se conservan en el registro y el flujo de efectivo, pero su IVA y total se excluyen del resumen fiscal.
  - Resumen fiscal mensual/acumulado: IVA trasladado, IVA acreditable, ISR retenido y arrastres a favor, con alerta cuando un traslado guardado queda desactualizado.
  - Tarjeta **"ISR del Período"**: pago provisional RESICO por tablas de rangos (mensual/anual, tasas planas 1.00 %–2.50 % sobre lo cobrado sin IVA), retención acreditable de clientes morales, provisión propia del negocio (2.5 % total) y provisión sobrante para la anual.
  - **Simulador de declaración** — genera un PDF descargable (mensual o anual) con membrete de la empresa, ingresos cobrados/pendientes, cuadro de IVA, cuadro de ISR RESICO y brief del acumulado anual (sólo en la mensual). Documento informativo, no una declaración oficial.
  - Complementos de pago **solo trazabilidad** (registro de referencia para el SAT que no afecta el flujo ni recalcula impuestos).
- **Cotizador** — Genera cotizaciones para los clientes registrados y las descarga en **PDF** con el logo de la empresa. Conceptos con descripción, cantidad, precio unitario y total; desglose de impuestos con las mismas reglas que la facturación (IVA 16 %, ISR 1.25 %); numeración secuencial e historial. Opcionalmente permite adjuntar imágenes que se anexan al PDF.
- **Autenticación** — Login con Supabase Auth y rutas protegidas (un único usuario administrador).

## Stack técnico

- **Frontend:** React 18, TypeScript, Vite 5
- **UI:** Tailwind CSS + shadcn/ui (Radix), lucide-react, recharts, sonner
- **Estado/datos:** TanStack Query, react-hook-form + zod
- **Backend:** Supabase (PostgreSQL, Row Level Security, Auth)
- **PDF:** @react-pdf/renderer

## Requisitos

- Node.js 18+ y npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para migraciones)
- Un proyecto de Supabase

## Configuración

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear el archivo de entorno a partir del ejemplo y completar los valores de tu proyecto Supabase:

   ```bash
   cp .env.example .env
   ```

   Variables (las claves `VITE_` se exponen en el cliente; la *publishable/anon key* de Supabase es pública por diseño):

   | Variable | Descripción |
   |---|---|
   | `VITE_SUPABASE_URL` | URL del proyecto, p. ej. `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave anon/publishable del proyecto |
   | `VITE_SUPABASE_PROJECT_ID` | Ref del proyecto Supabase |

3. Aplicar el esquema de base de datos (migraciones en `supabase/migrations`):

   ```bash
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```

4. Crear el usuario administrador en el panel de Supabase (Auth → Users) para poder iniciar sesión.

## Desarrollo

```bash
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # build de producción a /dist
npm run preview    # previsualizar el build
npm run lint       # ESLint
npm run test       # pruebas con Vitest
```

## Estructura del proyecto

```
src/
  pages/                  # Rutas: FlujoEfectivo, Clientes, Facturacion, Cotizador, Login
  components/
    cashflow/             # Ingresos/gastos, saldos, líneas de crédito
    facturacion/          # Facturas de ingreso/gasto, resumen fiscal, complementos, simulador de declaración
    cotizador/            # Formulario, historial y plantilla PDF de cotizaciones
    pdf/                  # Componentes PDF compartidos (membrete/encabezado del emisor, estilos)
    ui/                   # Componentes base de shadcn/ui
  lib/
    finance.ts            # Reglas fiscales y utilidades (IVA/ISR/ISR RESICO, fechas, amortización)
    pdfDownload.ts        # Helper compartido para renderizar y descargar cualquier PDF (@react-pdf/renderer)
    issuer.ts             # Datos fijos del emisor para el PDF (empresa, banco, defaults)
  integrations/supabase/  # Cliente y tipos generados de Supabase
  contexts/               # AuthContext
supabase/
  migrations/             # Esquema versionado (tablas, RLS, funciones, triggers)
```

## Notas

- **Reglas fiscales:** IVA 16 % siempre trasladado; ISR 1.25 % retenido **sólo si el cliente es persona moral** (`tipo_persona`), persona física no tiene retención. `Total = Subtotal + IVA − ISR`. Bajo el régimen de flujo de efectivo, IVA e ISR se reconocen al momento del cobro (`collected_date`).
- **ISR RESICO (Resumen Fiscal):** el pago provisional se calcula por tablas de rangos (mensual y anual, tasas planas 1.00 %–2.50 % sobre lo cobrado sin IVA). La práctica del negocio es provisionar siempre el 2.5 % total de lo cobrado; a eso se le resta lo ya retenido por clientes morales (1.25 %) para obtener la provisión propia, y el sobrante contra el ISR causado del período queda apartado para la declaración anual.
- **Complementos de pago:** funcionan exclusivamente como trazabilidad/registro SAT; no generan ingresos en el flujo ni modifican impuestos.
- **Datos del emisor del cotizador** (empresa, datos bancarios y textos por defecto) se configuran en `src/lib/issuer.ts`.
- **Tipos de Supabase:** tras cambiar el esquema, regenerar con `supabase gen types typescript --linked > src/integrations/supabase/types.ts`.

### Notas técnicas

- **Lógica fiscal centralizada** en `src/lib/finance.ts`: `computeTotals` (IVA/ISR de facturas y cotizaciones), `resicoIsr` y `resicoProvision` (tablas de rangos RESICO y provisión), `computeIsrBrief` (resumen reutilizado por el Resumen Fiscal y el PDF de declaración).
- **Componentes PDF compartidos** en `src/components/pdf/` (membrete/encabezado del emisor y estilos comunes), usados tanto por el simulador de declaración como por el cotizador. La descarga se hace con el helper `src/lib/pdfDownload.ts` (renderiza a blob y dispara la descarga en el navegador).
- **Convención importante:** toda query de React Query con `queryKey: ["clients"]` debe incluir `tipo_persona` en su `select`, aunque el componente no lo use directamente — de lo contrario una colisión de caché entre queries con la misma key puede servir una respuesta sin ese campo y calcular mal el ISR (ver migración `20260705120000_backfill_isr_persona_fisica.sql`, que corrige los datos afectados por este bug).
