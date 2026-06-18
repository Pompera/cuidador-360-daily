# Plan: Evaluación clínica en 2 capas

Sistema de filtro escalonado: el chequeo diario actual no cambia; cuando detecta alertas, se activa automáticamente un módulo de profundización dirigido al dominio afectado.

## 1. Capa 1 — Detección de alertas (sin tocar el cuestionario)

Nuevo módulo `src/lib/clinical/alertas.ts` con función `detectarAlertas(historial)`:
- Recibe los últimos chequeos diarios del paciente (ya guardados en `chequeos_diarios`).
- Aplica las reglas pedidas:
  - Cognición: "poco" confuso 2 días seguidos, o "mucho" un día.
  - Función: "ayuda = sí", o "caminó menos" (poco/mucho).
  - Nutrición: "comió menos" 2 días seguidos, "líquidos menos" 2 días seguidos.
  - Seguridad: caída o casi caída.
  - Síntomas: disnea, dolor importante o fiebre.
- Devuelve `{ dominios: ["cognicion"|"funcion"|...], detalles: [...] }`.

Se ejecuta automáticamente al guardar un chequeo (en `_app.paciente.$id.chequeo.tsx`, dentro de `finalizar`).

## 2. Capa 2 — Profundización automática

Nueva tabla `profundizaciones_clinicas`:
- `id`, `patient_id`, `owner_id`, `fecha`, `chequeo_id` (FK opcional)
- `dominios` (jsonb: array de dominios alertados)
- `respuestas` (jsonb: respuestas de profundización)
- `dominio_principal` (text), `nivel_deterioro` (text: leve/moderado/severo)
- `resumen` (text, autogenerado para el PDF)
- RLS por `owner_id`, GRANTs a `authenticated` y `service_role`.

Nueva ruta `_app.paciente.$id.profundizacion.tsx`:
- Recibe los dominios alertados como search params.
- Muestra solo las preguntas relevantes a esos dominios (las listadas en el requerimiento).
- Al final calcula:
  - **Dominio principal**: el que tiene más respuestas "rojas" (o el primero si empatan).
  - **Nivel de deterioro**:
    - Severo: cambio repentino + "no reconoce" / no camina post-caída / disnea en reposo / golpe craneal.
    - Moderado: cambios "parciales" / progresivo con impacto / dolor continuo / esfuerzo.
    - Leve: resto.
  - **Resumen narrativo** tipo: *"Se detectaron cambios clínicos a expensas de cognición: cambios conductuales notados desde hace 2-3 días, con fluctuación del estado mental durante el día."*

## 3. Integración en el flujo existente

**Al terminar chequeo** (`_app.paciente.$id.chequeo.tsx`):
- Tras guardar, llamar `detectarAlertas` con los últimos N chequeos.
- Si hay dominios alertados: en la pantalla de resultado mostrar un CTA destacado **"Profundizar evaluación (recomendado)"** que abre `/paciente/$id/profundizacion?dominios=...`.
- Si no hay alertas: flujo igual al actual.

**En el perfil del paciente** (`_app.paciente.$id.index.tsx`):
- Si hay alertas activas sin profundización del día → banner "Profundización pendiente".
- Mostrar última profundización (dominio + nivel + fecha) si existe.

## 4. Actualización de IEG / ICB / semáforo

- En `calcularIEG`, agregar un **modificador de profundización**: si existe profundización del mismo día, restar puntos según nivel (leve −5, moderado −10, severo −20). El color del semáforo se recalcula con el IEG ajustado.
- El IEG guardado en `chequeos_diarios` se actualiza tras guardar la profundización (UPDATE al row del día).

## 5. PDF para el médico

`src/lib/pdf.ts`:
- Nueva sección **"Cambios clínicos detectados"** después del resumen, listando las profundizaciones recientes con su `resumen` narrativo, dominio y nivel.
- `_app.paciente.$id.reporte.tsx` carga `profundizaciones_clinicas` del paciente y las pasa en `extras`.

## 6. Cambios técnicos puntuales

- Migración: tabla + RLS + GRANTs + trigger `updated_at`.
- `src/lib/clinical/alertas.ts` (reglas de detección).
- `src/lib/clinical/profundizacion.ts` (preguntas, cálculo de dominio/nivel, generación de resumen).
- Ruta nueva `_app.paciente.$id.profundizacion.tsx`.
- Edits: `_app.paciente.$id.chequeo.tsx`, `_app.paciente.$id.index.tsx`, `_app.paciente.$id.reporte.tsx`, `src/lib/pdf.ts`, `src/lib/clinical/chequeo.ts` (modificador IEG).

## Notas

- El cuestionario diario **no se toca**.
- La profundización es **opcional pero recomendada**: si el cuidador no la hace, el chequeo se guarda igual.
- Todo dentro del patrón actual (supabase cliente directo, RLS).

¿Procedo con la migración y el código?
