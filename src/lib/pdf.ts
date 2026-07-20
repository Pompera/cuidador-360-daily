import jsPDF from "jspdf";
import { interpretBarthel } from "./clinical/barthel";
import { interpretLawton } from "./clinical/lawton";
import {
  COLOR_HEX,
  AREA_LABEL,
  puntajePorArea,
  type ResultadoChequeo,
} from "./clinical/chequeo";
import { calcularAdherencia, type Toma } from "./clinical/medicamentos";
import { evaluarSignos } from "./clinical/signos";
import { interpretJenkins, deltaJenkins } from "./clinical/jenkins";
import { interpretZarit, deltaZarit } from "./clinical/zarit";

export interface ReportePaciente {
  nombre: string;
  edad: number | null;
  sexo: string | null;
  comorbilidades: string[];
  barthel_total: number | null;
  lawton_total: number | null;
  cfs_nivel: number | null;
  movilidad: string | null;
  objetivos: string[];
  jenkins_basal: number | null;
  zarit_basal: number | null;
}

export interface ReporteChequeo {
  fecha: string;
  ieg: number;
  color: ResultadoChequeo["color"];
  respuestas: Record<string, string | string[]>;
}

export interface ReporteMedicamento {
  id: string;
  nombre: string;
  dosis: string | null;
  frecuencia: string | null;
  fecha_inicio: string | null;
}

export interface ReporteSignos {
  fecha: string;
  ta_sistolica: number | null;
  ta_diastolica: number | null;
  fc: number | null;
  temperatura: number | null;
  saturacion: number | null;
  glucosa: number | null;
}

export interface ReporteCaida {
  fecha: string;
  lugar: string | null;
  circunstancia: string | null;
  lesion: string | null;
  golpe_craneal: boolean;
  hospitalizacion: boolean;
}

export interface ReporteEscala {
  tipo: string; // 'jenkins' | 'zarit'
  fecha: string;
  puntaje: number;
}

export interface ReporteProfundizacion {
  fecha: string;
  dominio_principal: string | null;
  nivel_deterioro: string | null;
  resumen: string | null;
}

export interface ReporteExtras {
  medicamentos: ReporteMedicamento[];
  tomas: Toma[];
  signos: ReporteSignos[];
  caidas: ReporteCaida[];
  evaluaciones: ReporteEscala[];
  profundizaciones?: ReporteProfundizacion[];
}

export type PeriodoReporte =
  | { tipo: "global" }
  | { tipo: "mes"; anio: number; mes: number };

export interface ReporteMeta {
  periodo: PeriodoReporte;
  periodoLabel: string;
  basal: ReporteChequeo | null;
}

export function generarReportePDF(
  paciente: ReportePaciente,
  ultimos: ReporteChequeo[],
  extras: ReporteExtras = { medicamentos: [], tomas: [], signos: [], caidas: [], evaluaciones: [] },
  meta: ReporteMeta = { periodo: { tipo: "global" }, periodoLabel: "Global (desde el origen)", basal: null },
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const ctx = { doc, W, H, M, y: 50 };

  // Encabezado
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.setTextColor(40, 70, 80);
  doc.text("Cuidador 360 — Resumen Geriátrico", M, ctx.y);
  ctx.y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, M, ctx.y);
  ctx.y += 14;
  doc.text(`Periodo: ${meta.periodoLabel}`, M, ctx.y);
  ctx.y += 18;

  // Paciente
  sectionTitle(ctx, "Paciente");
  body(ctx, `Nombre: ${paciente.nombre}`);
  body(ctx, `Edad: ${paciente.edad ?? "—"}    Sexo: ${paciente.sexo ?? "—"}`);
  const dx = paciente.comorbilidades.length ? paciente.comorbilidades.join(", ") : "Sin registrar";
  wrap(ctx, `Diagnósticos: ${dx}`);
  ctx.y += 6;

  // Estado actual con IEG y desglose por área
  const ultimo = ultimos[0];
  sectionTitle(ctx, "Estado actual (IEG)");
  if (ultimo) {
    const hex = COLOR_HEX[ultimo.color];
    const rgb = hexToRgb(hex);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(M, ctx.y - 10, 14, 14, 3, 3, "F");
    body(ctx, `IEG: ${ultimo.ieg}/100   (${etiquetaColor(ultimo.color)})`, M + 22);
    body(ctx, `Último chequeo: ${ultimo.fecha}`);
    if (meta.basal) {
      const dBasal = ultimo.ieg - meta.basal.ieg;
      const signo = dBasal > 0 ? `+${dBasal}` : `${dBasal}`;
      body(ctx, `IEG inicial (basal): ${meta.basal.ieg}/100 — ${meta.basal.fecha}`);
      body(ctx, `Cambio vs basal: ${dBasal === 0 ? "sin cambio" : signo}`);
    }

    // Comparación por área vs promedio de chequeos previos
    const areasUlt = puntajePorArea(ultimo.respuestas);
    const previos = ultimos.slice(1, 8);
    const sumAreas: Record<string, { s: number; n: number }> = {};
    for (const c of previos) {
      const a = puntajePorArea(c.respuestas);
      for (const [k, v] of Object.entries(a)) {
        if (!sumAreas[k]) sumAreas[k] = { s: 0, n: 0 };
        sumAreas[k].s += v; sumAreas[k].n += 1;
      }
    }
    ctx.y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text("Cambios por área vs días previos:", M, ctx.y); ctx.y += 14;
    doc.setFont("helvetica", "normal");
    for (const area of Object.keys(AREA_LABEL)) {
      const v = areasUlt[area];
      if (v == null) continue;
      const prev = sumAreas[area];
      const base = prev && prev.n > 0 ? Math.round(prev.s / prev.n) : null;
      let cambio: string;
      if (base == null) cambio = "sin basal";
      else {
        const d = v - base;
        if (d === 0) cambio = `igual (base ${base})`;
        else if (d > 0) cambio = `mejoró +${d} (base ${base})`;
        else cambio = `empeoró ${d} (base ${base})`;
      }
      body(ctx, `• ${AREA_LABEL[area]}: ${v}/100 — ${cambio}`);
    }
  } else {
    body(ctx, "Sin chequeos registrados aún.");
  }
  ctx.y += 6;

  // Valoración basal
  sectionTitle(ctx, "Valoración basal");
  if (paciente.barthel_total != null) body(ctx, `Barthel: ${paciente.barthel_total}/100 — ${interpretBarthel(paciente.barthel_total)}`);
  if (paciente.lawton_total != null) body(ctx, `Lawton: ${paciente.lawton_total}/8 — ${interpretLawton(paciente.lawton_total)}`);
  if (paciente.cfs_nivel != null) body(ctx, `Clinical Frailty Scale: ${paciente.cfs_nivel}/9`);
  if (paciente.movilidad) body(ctx, `Movilidad basal: ${paciente.movilidad}`);
  if (paciente.objetivos.length) wrap(ctx, `Objetivos de cuidado: ${paciente.objetivos.join(", ")}`);
  ctx.y += 6;

  // Tendencia IEG
  sectionTitle(ctx, "Tendencia reciente (IEG)");
  const recientes = ultimos.slice(0, 14).reverse();
  if (recientes.length === 0) {
    body(ctx, "Sin datos.");
  } else {
    ensureSpace(ctx, 80);
    const chartX = M, chartY = ctx.y, chartW = W - 2 * M, chartH = 60;
    doc.setDrawColor(230); doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
    const bw = chartW / recientes.length;
    recientes.forEach((c, i) => {
      const h = (c.ieg / 100) * chartH;
      const rgb = hexToRgb(COLOR_HEX[c.color]);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(chartX + i * bw + 2, chartY + chartH - h, Math.max(2, bw - 4), h, "F");
    });
    ctx.y += chartH + 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30);
    body(ctx, `Chequeos mostrados: ${recientes.length} (más reciente al final).`);
  }
  ctx.y += 4;

  // === MEDICAMENTOS ===
  sectionTitle(ctx, "Medicamentos");
  if (extras.medicamentos.length === 0) {
    body(ctx, "Sin medicamentos registrados.");
  } else {
    for (const m of extras.medicamentos) {
      ensureSpace(ctx, 50);
      const tomasMed = extras.tomas.filter((t) => t.medicamento_id === m.id);
      const adh7 = calcularAdherencia(tomasMed, 7);
      const adh30 = calcularAdherencia(tomasMed, 30);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30);
      doc.text(`• ${m.nombre}`, M, ctx.y); ctx.y += 14;
      doc.setFont("helvetica", "normal");
      const det: string[] = [];
      if (m.dosis) det.push(`Dosis: ${m.dosis}`);
      if (m.frecuencia) det.push(`Frecuencia: ${m.frecuencia}`);
      if (m.fecha_inicio) det.push(`Desde: ${m.fecha_inicio}`);
      if (det.length) { body(ctx, "   " + det.join(" · ")); }
      body(ctx, `   Adherencia 7d: ${adh7.tomados}/${adh7.total} (${adh7.pct}%)  ·  30d: ${adh30.tomados}/${adh30.total} (${adh30.pct}%)`);
      ctx.y += 4;
    }
  }
  ctx.y += 4;

  // === SIGNOS VITALES ===
  sectionTitle(ctx, "Signos vitales");
  if (extras.signos.length === 0) {
    body(ctx, "Sin registros de signos vitales.");
  } else {
    // Tendencias (sparklines)
    const series: { label: string; data: (number | null)[] }[] = [
      { label: "TA sis (mmHg)", data: extras.signos.map((s) => s.ta_sistolica) },
      { label: "TA dia (mmHg)", data: extras.signos.map((s) => s.ta_diastolica) },
      { label: "FC (lpm)", data: extras.signos.map((s) => s.fc) },
      { label: "Temp (°C)", data: extras.signos.map((s) => s.temperatura) },
      { label: "SatO₂ (%)", data: extras.signos.map((s) => s.saturacion) },
      { label: "Glucosa (mg/dL)", data: extras.signos.map((s) => s.glucosa) },
    ];
    ensureSpace(ctx, 140);
    const cellW = (W - 2 * M) / 3;
    const cellH = 56;
    series.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = M + col * cellW;
      const y = ctx.y + row * cellH;
      drawSpark(doc, s.label, s.data, x + 4, y, cellW - 8, cellH - 8);
    });
    ctx.y += Math.ceil(series.length / 3) * cellH + 6;

    // Alertas detectadas en últimos 10
    const alertas: string[] = [];
    for (const r of extras.signos.slice(0, 10)) {
      const evs = evaluarSignos(r);
      for (const a of evs) {
        const tag = a.nivel === "rojo" ? "[ROJO]" : "[AMARILLO]";
        alertas.push(`${r.fecha.slice(0, 10)} ${tag} ${a.texto}`);
      }
    }
    if (alertas.length) {
      ensureSpace(ctx, 16 + alertas.length * 12);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30);
      doc.text("Alertas detectadas:", M, ctx.y); ctx.y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      for (const a of alertas.slice(0, 12)) body(ctx, `• ${a}`);
    }

    // Últimos registros
    ensureSpace(ctx, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30);
    doc.text("Últimos registros:", M, ctx.y); ctx.y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const r of extras.signos.slice(0, 10)) {
      const parts: string[] = [];
      if (r.ta_sistolica != null || r.ta_diastolica != null) parts.push(`TA ${r.ta_sistolica ?? "—"}/${r.ta_diastolica ?? "—"}`);
      if (r.fc != null) parts.push(`FC ${r.fc}`);
      if (r.temperatura != null) parts.push(`T ${r.temperatura}°`);
      if (r.saturacion != null) parts.push(`Sat ${r.saturacion}%`);
      if (r.glucosa != null) parts.push(`Glu ${r.glucosa}`);
      body(ctx, `${new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })} — ${parts.join(" · ")}`);
    }
  }
  ctx.y += 4;

  // === CAÍDAS ===
  sectionTitle(ctx, "Caídas");
  if (extras.caidas.length === 0) {
    body(ctx, "Sin caídas registradas.");
  } else {
    body(ctx, `Total registradas: ${extras.caidas.length}`);
    for (const c of extras.caidas) {
      ensureSpace(ctx, 50);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30);
      doc.text(`• ${new Date(c.fecha).toLocaleDateString("es-MX", { dateStyle: "long" })}`, M, ctx.y);
      ctx.y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      if (c.lugar) body(ctx, `   Lugar: ${c.lugar}`);
      if (c.circunstancia) wrap(ctx, `   Circunstancia: ${c.circunstancia}`);
      if (c.lesion) body(ctx, `   Lesión: ${c.lesion}`);
      const flags: string[] = [];
      if (c.golpe_craneal) flags.push("Golpe craneal");
      if (c.hospitalizacion) flags.push("Hospitalización");
      if (flags.length) body(ctx, `   ${flags.join(", ")}`);
      ctx.y += 4;
    }
  }
  ctx.y += 4;

  // === ESCALAS MENSUALES ===
  sectionTitle(ctx, "Escalas mensuales");
  const jenkins = extras.evaluaciones.filter((e) => e.tipo === "jenkins").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const zarit = extras.evaluaciones.filter((e) => e.tipo === "zarit").sort((a, b) => b.fecha.localeCompare(a.fecha));

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30);
  doc.text("Calidad de sueño (Jenkins JSS-4):", M, ctx.y); ctx.y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  if (paciente.jenkins_basal != null) body(ctx, `Basal: ${paciente.jenkins_basal}/20 — ${interpretJenkins(paciente.jenkins_basal)}`);
  if (jenkins.length === 0 && paciente.jenkins_basal == null) body(ctx, "Sin evaluaciones registradas.");
  for (const e of jenkins.slice(0, 6)) {
    body(ctx, `${e.fecha}: ${e.puntaje}/20 — ${interpretJenkins(e.puntaje)} · ${deltaJenkins(e.puntaje, paciente.jenkins_basal)}`);
  }
  ctx.y += 6;

  ensureSpace(ctx, 60);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30);
  doc.text("Sobrecarga del cuidador (Zarit abreviada):", M, ctx.y); ctx.y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  if (paciente.zarit_basal != null) body(ctx, `Basal: ${paciente.zarit_basal}/28 — ${interpretZarit(paciente.zarit_basal)}`);
  if (zarit.length === 0 && paciente.zarit_basal == null) body(ctx, "Sin evaluaciones registradas.");
  for (const e of zarit.slice(0, 6)) {
    body(ctx, `${e.fecha}: ${e.puntaje}/28 — ${interpretZarit(e.puntaje)} · ${deltaZarit(e.puntaje, paciente.zarit_basal)}`);
  }
  ctx.y += 6;

  // === CAMBIOS CLÍNICOS DETECTADOS (PROFUNDIZACIÓN) ===
  const profs = extras.profundizaciones ?? [];
  if (profs.length > 0) {
    sectionTitle(ctx, "Cambios clínicos detectados");
    for (const pr of profs.slice(0, 8)) {
      ensureSpace(ctx, 40);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30);
      const cab = `• ${pr.fecha} — ${pr.dominio_principal ?? "—"} (deterioro ${pr.nivel_deterioro ?? "—"})`;
      doc.text(cab, M, ctx.y); ctx.y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      if (pr.resumen) wrap(ctx, `   ${pr.resumen}`);
      ctx.y += 2;
    }
    ctx.y += 4;
  }

  // Resumen
  sectionTitle(ctx, "Resumen clínico");
  const resumen = generarResumen(paciente, ultimos, meta.basal);
  wrap(ctx, resumen);

  // Pie de página en última página
  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text(
    "Este reporte es una herramienta de seguimiento generada por el cuidador. No sustituye una valoración médica.",
    M, H - 30, { maxWidth: W - 2 * M },
  );

  return doc;
}

// ---------- helpers ----------

interface Ctx { doc: jsPDF; W: number; H: number; M: number; y: number }

function ensureSpace(ctx: Ctx, h: number) {
  if (ctx.y + h > ctx.H - 50) {
    ctx.doc.addPage();
    ctx.y = 50;
  }
}

function sectionTitle(ctx: Ctx, title: string) {
  ensureSpace(ctx, 40);
  ctx.doc.setDrawColor(220); ctx.doc.line(ctx.M, ctx.y, ctx.W - ctx.M, ctx.y); ctx.y += 16;
  ctx.doc.setFont("helvetica", "bold"); ctx.doc.setFontSize(13); ctx.doc.setTextColor(30);
  ctx.doc.text(title, ctx.M, ctx.y); ctx.y += 16;
  ctx.doc.setFont("helvetica", "normal"); ctx.doc.setFontSize(11);
}

function body(ctx: Ctx, text: string, x?: number) {
  ensureSpace(ctx, 16);
  ctx.doc.setFont("helvetica", "normal"); ctx.doc.setFontSize(11); ctx.doc.setTextColor(30);
  ctx.doc.text(text, x ?? ctx.M, ctx.y);
  ctx.y += 14;
}

function wrap(ctx: Ctx, text: string) {
  ctx.doc.setFont("helvetica", "normal"); ctx.doc.setFontSize(11); ctx.doc.setTextColor(30);
  const lines = ctx.doc.splitTextToSize(text, ctx.W - 2 * ctx.M);
  ensureSpace(ctx, lines.length * 14);
  ctx.doc.text(lines, ctx.M, ctx.y);
  ctx.y += lines.length * 14;
}

function drawSpark(doc: jsPDF, label: string, data: (number | null)[], x: number, y: number, w: number, h: number) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110);
  doc.text(label, x, y + 10);
  const vals = data.filter((v): v is number => v != null).reverse();
  if (vals.length === 0) {
    doc.setTextColor(160); doc.text("—", x, y + 28);
    return;
  }
  doc.setTextColor(30); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(String(vals[vals.length - 1]), x + w - 16, y + 10);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const top = y + 16, bot = y + h - 4;
  const step = vals.length > 1 ? w / (vals.length - 1) : 0;
  doc.setDrawColor(60, 120, 150); doc.setLineWidth(0.8);
  for (let i = 1; i < vals.length; i++) {
    const x1 = x + (i - 1) * step;
    const y1 = bot - ((vals[i - 1] - min) / range) * (bot - top);
    const x2 = x + i * step;
    const y2 = bot - ((vals[i] - min) / range) * (bot - top);
    doc.line(x1, y1, x2, y2);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140);
  doc.text(`min ${min} · max ${max} · n=${vals.length}`, x, bot + 2);
}

function etiquetaColor(c: ResultadoChequeo["color"]) {
  return { verde: "Estable", amarillo: "Vigilancia", naranja: "Deterioro", rojo: "Alto riesgo" }[c];
}

function hexToRgb(h: string) {
  const v = h.replace("#", "");
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}

function generarResumen(p: ReportePaciente, chequeos: ReporteChequeo[], basal: ReporteChequeo | null = null): string {
  if (chequeos.length === 0) {
    return `Paciente ${p.nombre}, ${p.edad ?? "—"} años. Aún sin chequeos diarios registrados. Se sugiere iniciar el seguimiento basal.`;
  }
  const recientes = chequeos.slice(0, 7);
  const promedio = Math.round(recientes.reduce((s, c) => s + c.ieg, 0) / recientes.length);
  const ultimo = chequeos[0];
  const previos = chequeos.slice(1, 8);
  const promPrev = previos.length ? Math.round(previos.reduce((s, c) => s + c.ieg, 0) / previos.length) : promedio;
  const delta = ultimo.ieg - promPrev;

  let estado = "estable";
  if (ultimo.color === "rojo") estado = "con datos de alto riesgo";
  else if (ultimo.color === "naranja") estado = "con deterioro clínico";
  else if (ultimo.color === "amarillo") estado = "en vigilancia";

  let tendencia = "sin cambios significativos respecto a su línea basal";
  if (delta <= -10) tendencia = "con tendencia descendente respecto a días previos";
  else if (delta >= 10) tendencia = "con mejoría respecto a días previos";

  const refBasal = basal
    ? ` Respecto al IEG basal inicial (${basal.ieg}/100 del ${basal.fecha}), el cambio acumulado es ${ultimo.ieg - basal.ieg}.`
    : "";
  return `Paciente ${p.nombre}, ${p.edad ?? "—"} años, ${estado}. IEG actual ${ultimo.ieg}/100, promedio de los últimos ${recientes.length} días: ${promedio}/100, ${tendencia}. Se sugiere priorizar evaluación dirigida según los hallazgos resaltados arriba.${refBasal}`;
}
