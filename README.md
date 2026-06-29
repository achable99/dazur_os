# DazurOS

Panel de administración interno de **DAZUR – Innovación y Obra**. Centraliza la operación financiera y comercial del negocio: flujo de efectivo, clientes, facturación, control fiscal (IVA/ISR bajo flujo de efectivo), líneas de crédito, complementos de pago y un cotizador con generación de PDF.

Aplicación SPA construida con React + Vite y respaldada por Supabase (Postgres + Auth). Toda la lógica corre en el cliente; no hay edge functions.

## Funcionalidades

- **Flujo de Efectivo** — Ingresos y gastos por mes con saldo arrastrado mes a mes, saldos iniciales y líneas de crédito con tabla de amortización (sistema francés) y registro de pagos.
- **Clientes** — Alta/edición de clientes con datos fiscales (razón social, RFC, régimen, código postal, etc.).
- **Facturación**
  - Facturas de ingreso (con cobro y cobro parcial) y facturas de gasto.
  - Resumen fiscal mensual/acumulado: IVA trasladado, IVA acreditable, ISR retenido y arrastres a favor.
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
    facturacion/          # Facturas de ingreso/gasto, resumen fiscal, complementos
    cotizador/            # Formulario, historial y plantilla PDF de cotizaciones
    ui/                   # Componentes base de shadcn/ui
  lib/
    finance.ts            # Reglas fiscales y utilidades (IVA/ISR, fechas, amortización)
    issuer.ts             # Datos fijos del emisor para el PDF (empresa, banco, defaults)
  integrations/supabase/  # Cliente y tipos generados de Supabase
  contexts/               # AuthContext
supabase/
  migrations/             # Esquema versionado (tablas, RLS, funciones, triggers)
```

## Notas

- **Reglas fiscales:** IVA 16 % trasladado, ISR 1.25 % retenido, `Total = Subtotal + IVA − ISR`. Bajo el régimen de flujo de efectivo, IVA e ISR se reconocen al momento del cobro (`collected_date`).
- **Complementos de pago:** funcionan exclusivamente como trazabilidad/registro SAT; no generan ingresos en el flujo ni modifican impuestos.
- **Datos del emisor del cotizador** (empresa, datos bancarios y textos por defecto) se configuran en `src/lib/issuer.ts`.
- **Tipos de Supabase:** tras cambiar el esquema, regenerar con `supabase gen types typescript --linked > src/integrations/supabase/types.ts`.
