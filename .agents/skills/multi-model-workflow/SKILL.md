---
name: multi-model-workflow
description: Orquesta desde la conversación principal un flujo de desarrollo con varios modelos. Úsalo para solicitudes directas del usuario de implementar, corregir o preparar un PR; no lo invoques dentro de un subagente que recibió una tarea del orquestador. Para diagnóstico sin fix usa bug-triage; para incidentes urgentes usa hotfix-workflow.
---

# Flujo de trabajo multi-modelo

Este flujo usa ruteo explícito de Codex para equilibrar costo y calidad:

- **GPT-6 Luna medium** (`explorer`, `reviewer`): exploración y revisión
  inicial; **Luna low** para `pr-publisher`.
- **GPT-6 Sol medium** (`developer-backend`, `developer-frontend`,
  `qa-tester`): escritura de código y tests; **Sol high** para
  `architect` y `plan-reviewer`.
- **GPT-6 Astra high** (`tech-lead`, `security-auditor`): gates finales.
  Ambos reciben la base de comparación y revisan solo el diff; no exploran
  código circundante ni el repositorio completo.

Tú, en la conversación principal, actúas como orquestador: clasificas la
tarea, repartes el trabajo entre los subagentes y consolidas sus
resultados. No escribes código tú mismo salvo en tareas de nivel trivial.

**Alcance:** estas instrucciones de clasificación, delegación y gates son
exclusivas del orquestador en la conversación principal. Un subagente que
recibe una tarea, incluido un hallazgo de revisión, ejecuta su rol
directamente: no vuelve a iniciar este flujo, no reclasifica la tarea ni
crea o coordina otros subagentes. Si no puede completar el encargo,
reporta el bloqueo al orquestador.

## Clasifica la tarea antes de empezar

Declara el nivel al usuario y procede:

- **Trivial** — typo, string, cambio de una línea sin lógica: edítalo
  directo, sin subagentes.
- **Estándar** — bug fix o feature chica, pocos archivos: flujo estándar.
- **Mayor** — feature grande, multi-archivo o refactor amplio: flujo
  completo.

**Pisos duros (no negociables):** si el cambio toca autenticación, pagos,
migraciones de datos, manejo de secretos o lógica de negocio central,
nunca es trivial — mínimo estándar — y `security-auditor` es obligatorio
antes de publicar, sea cual sea el nivel.

## Flujo estándar

1. `explorer` ubica contexto. No escribas código sin este resumen si la
   tarea toca archivos no leídos en esta sesión.
2. El developer que corresponda (`developer-backend` o
   `developer-frontend`) implementa con ese contexto.
3. `reviewer` revisa el diff acumulado al completarse el trabajo.
4. Entrega a `tech-lead` el diff contra la base explícita para el
   veredicto final (más `security-auditor` si aplica un piso duro). Ambos
   revisan solo ese diff. Espera `VEREDICTO: APROBADO`.
5. `pr-publisher` crea rama, commit y PR.

## Flujo completo (nivel mayor)

1. `explorer` — levantamiento; lanza varios en paralelo si hay áreas
   independientes que investigar.
2. `architect` — arma el plan: sub-tareas, criterios de aceptación,
   riesgos.
3. `plan-reviewer` — revisión adversarial del plan. Espera
   `PLAN: APROBADO`; con objeciones, `architect` ajusta y se re-revisa
   solo lo objetado.
4. Developers — ejecutan las sub-tareas del plan; en paralelo cuando el
   plan marca sub-tareas independientes con archivos disjuntos.
5. `reviewer` — revisa por hito: el diff acumulado de cada sub-tarea
   completada, no cada edición.
6. `qa-tester` — valida contra los criterios de aceptación del plan.
7. Entrega a `tech-lead` y `security-auditor` en paralelo el mismo diff
   contra una base explícita — ambos revisan solo ese diff y deben aprobar:
   `VEREDICTO: APROBADO` y `SEGURIDAD: SIN HALLAZGOS` (o solo hallazgos
   medios/bajos aceptados explícitamente por el usuario).
8. `pr-publisher` — rama, commit y PR.

## Reglas

- Si `reviewer`, `qa-tester`, `tech-lead` o `security-auditor` señalan un
  problema, envía los hallazgos concretos al developer responsable del
  cambio para que los corrija él mismo. Continúa con el mismo subagente
  cuando sea posible; no le encargues reiniciar el flujo ni delegar cada
  hallazgo. Repite la revisión del hito corregido antes de volver a pedir
  aprobación.
- En cada encargo a un subagente, indica el rol, los archivos o alcance,
  el resultado esperado y que debe ejecutar la tarea directamente sin
  invocar este workflow ni crear otros agentes. El orquestador conserva
  la responsabilidad de los handoffs y gates.
- No uses `tech-lead` para dudas triviales; resérvalo para el gate final,
  riesgos de diseño reales, o cuando un developer esté atascado tras dos
  intentos.
- Nada se commitea ni publica sin `VEREDICTO: APROBADO` del `tech-lead`
  (y sin pasar `security-auditor` cuando aplica).
- Nunca pidas a los gates finales analizar el repositorio completo: su
  evidencia se limita al diff y a los reportes que recibieron.
- Cada handoff usa el formato de salida definido en el agente; si un
  reporte llega incompleto, pídelo de nuevo antes de continuar.
