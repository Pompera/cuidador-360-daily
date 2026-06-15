# Plan: Bitácoras del paciente

Tres módulos independientes accesibles desde la ficha del paciente, cada uno con su propia ruta, tabla y flujo de registro.

## 1. Base de datos (una sola migración)

Tres tablas nuevas, todas con `owner_id` + RLS por `auth.uid()`, `patient_id` con FK a `patients`, índice por `(patient_id, fecha)`.

### `medicamentos`
- `nombre` (text), `dosis` (text), `frecuencia` (text, ej. "cada 8 h"), `fecha_inicio` (date, opcional), `activo` (bool, default true).

### `medicamento_tomas` (registro de adherencia)
- `medicamento_id` (FK), `patient_id`, `fecha` (date), `estado` ('tomado' | 'omitido'), `nota` opcional.
- Único `(medicamento_id, fecha)` para que cada día se registre una vez.

### `signos_vitales`
- `fecha` (timestamptz), `ta_sistolica`, `ta_diastolica`, `fc`, `temperatura`, `saturacion`, `glucosa` (todos nullable numeric).

### `caidas`
- `fecha` (date), `lugar` (text), `circunstancia` (text), `lesion` (text), `golpe_craneal` (bool), `hospitalizacion` (bool).

GRANTs a `authenticated` y `service_role`. Triggers `updated_at` donde aplica.

## 2. Rutas nuevas

```
src/routes/_app.paciente.$id.bitacoras.index.tsx        -> hub con 3 tarjetas
src/routes/_app.paciente.$id.medicamentos.tsx           -> lista + alta + registro toma + adherencia
src/routes/_app.paciente.$id.signos.tsx                 -> alta + tendencia + alertas
src/routes/_app.paciente.$id.caidas.tsx                 -> alta + lista cronológica
```

Botón nuevo en `_app.paciente.$id.index.tsx`: "Bitácoras" → `/paciente/$id/bitacoras`.

## 3. Lógica clínica (`src/lib/clinical/`)

- `medicamentos.ts`: `calcularAdherencia(tomas, dias=7)` → % tomado vs total esperado.
- `signos.ts`: `evaluarSignos({sistolica, diastolica, ...})` → array de alertas:
  - TA sistólica > 180 o < 90 → alerta roja
  - TA diastólica > 110 o < 60 → alerta roja
  - TA sistólica > 140 o diastólica > 90 → vigilancia amarilla
  - FC < 50 o > 110 → alerta
  - Temp > 38 → alerta
  - SatO2 < 92 → alerta roja
  - Glucosa < 70 o > 250 → alerta

## 4. UX por módulo

**Medicamentos**: lista de medicamentos activos; cada uno muestra nombre + dosis + frecuencia y dos botones grandes "Tomado" / "Omitido" para hoy (deshabilitados si ya se registró). Barra de adherencia 7 días. Botón "Agregar medicamento" abre formulario.

**Signos vitales**: formulario con todos los campos opcionales (placeholder y unidades visibles). Al guardar, muestra alertas si aplica. Debajo, sparkline simple por parámetro con últimos 14 registros.

**Caídas**: formulario con fecha, lugar (texto libre), circunstancia (texto), lesión (texto), golpe craneal (sí/no), hospitalización (sí/no). Lista cronológica debajo con badges para golpe craneal / hospitalización.

## 5. Notas técnicas

- Consultas directas con `supabase` cliente (mismo patrón que `chequeo`/`reporte`).
- Validación con `zod` en formularios.
- Componentes UI de shadcn ya existentes (Button, Input, Label, Card).
- Sin server functions nuevas: RLS protege todo.

¿Procedo con la migración y el código?
