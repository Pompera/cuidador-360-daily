import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

// ============ Paleta de marca (RGB para jsPDF) ============
const BRAND   = { r: 30,  g: 90,  b: 105 };
const ACCENT  = { r: 214, g: 140, b: 95  };
const INK     = { r: 33,  g: 41,  b: 55  };
const MUTED   = { r: 110, g: 120, b: 130 };
const LINE    = { r: 224, g: 228, b: 232 };
const BG_SOFT = { r: 245, g: 243, b: 236 };
const WHITE   = { r: 255, g: 255, b: 255 };
const SP = { xs: 4, sm: 8, md: 14, lg: 22 };

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
  tipo: string;
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
  logoDataUrl?: string | null;
}

interface Ctx {
  doc: jsPDF;
  W: number;
  H: number;
  M: number;
  y: number;
  topY: number;
  bottomY: number;
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
  const topY = 90;    // deja espacio para el chrome superior (banda + logo)
  const bottomY = H - 56;
  const ctx: Ctx = { doc, W, H, M, y: topY, topY, bottomY };

  // ---- PORTADA / cabecera principal (solo en página 1) ----
  if (meta.logoDataUrl) {
    try { doc.addImage(meta.logoDataUrl, "PNG", M, 46, 34, 34); } catch { /* noop */ }
  }
  const titleX = meta.logoDataUrl ? M + 44 : M;
  setFont(doc, "bold", 18); setColor(doc, BRAND);
  doc.text("Cuidador 360", titleX, 62);
  setFont(doc, "normal", 11); setColor(doc, MUTED);
  doc.text("Resumen Geriátrico", titleX, 78);
  ctx.y = topY + 6;

  setFont(doc, "normal", 10); setColor(doc, MUTED);
  doc.text(`Periodo: ${meta.periodoLabel}`, M, ctx.y);
  ctx.y += SP.md;

  // ---------------- Paciente ----------------
  sectionTitle(ctx, "Paciente", BRAND);
  body(ctx, `Nombre: ${paciente.nombre}`);
  body(ctx, `Edad: ${paciente.edad ?? "—"}    Sexo: ${paciente.sexo ?? "—"}`);
  const dx = paciente.comorbilidades.length ? paciente.comorbilidades.join(", ") : "Sin registrar";
  wrap(ctx, `Diagnósticos: ${dx}`);
  ctx.y += SP.xs;

  // ---------------- Estado actual (IEG) con chip ----------------
  const ultimo = ultimos[0];
  sectionTitle(ctx, "Estado actual (IEG)", BRAND);
  if (ultimo) {
    // Chip
    const hex = COLOR_HEX[ultimo.color];
    const rgb = hexToRgb(hex);
    const label = etiquetaColor(ultimo.color);
    setFont(doc, "bold", 10);
    const chipTextW = doc.getTextWidth(label);
    const chipW = chipTextW + 20;
    const chipH = 18;
    const chipY = ctx.y - 2;
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(M, chipY, chipW, chipH, 9, 9, "F");
    setColor(doc, WHITE);
    doc.text(label, M + 10, chipY + 12);
    setColor(doc, INK); setFont(doc, "bold", 12);
    doc.text(`IEG ${ultimo.ieg}/100`, M + chipW + 10, chipY + 12);
    ctx.y = chipY + chipH + SP.sm;

    body(ctx, `Último chequeo: ${ultimo.fecha}`);
    if (meta.basal) {
      const dBasal = ultimo.ieg - meta.basal.ieg;
      const signo = dBasal > 0 ? `+${dBasal}` : `${dBasal}`;
      body(ctx, `IEG inicial (basal): ${meta.basal.ieg}/100 — ${meta.basal.fecha}`);
      body(ctx, `Cambio vs basal: ${dBasal === 0 ? "sin cambio" : signo}`);
    }

    // Cambios por área
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
    ctx.y += SP.xs;
    subheader(ctx, "Cambios por área vs días previos");
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
  ctx.y += SP.sm;

  // ---------------- Valoración basal ----------------
  sectionTitle(ctx, "Valoración basal", BRAND);
  if (paciente.barthel_total != null) body(ctx, `Barthel: ${paciente.barthel_total}/100 — ${interpretBarthel(paciente.barthel_total)}`);
  if (paciente.lawton_total != null) body(ctx, `Lawton: ${paciente.lawton_total}/8 — ${interpretLawton(paciente.lawton_total)}`);
  if (paciente.cfs_nivel != null) body(ctx, `Clinical Frailty Scale: ${paciente.cfs_nivel}/9`);
  if (paciente.movilidad) body(ctx, `Movilidad basal: ${paciente.movilidad}`);
  if (paciente.objetivos.length) wrap(ctx, `Objetivos de cuidado: ${paciente.objetivos.join(", ")}`);
  ctx.y += SP.sm;

  // ---------------- Tendencia IEG ----------------
  sectionTitle(ctx, "Tendencia reciente (IEG)", BRAND);
  const recientes = ultimos.slice(0, 14).reverse();
  if (recientes.length === 0) {
    body(ctx, "Sin datos.");
  } else {
    const chartH = 70;
    ensureSpace(ctx, chartH + 40);
    const chartX = M, chartY = ctx.y, chartW = W - 2 * M;
    // eje
    doc.setDrawColor(LINE.r, LINE.g, LINE.b); doc.setLineWidth(0.5);
    doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
    doc.line(chartX, chartY, chartX, chartY + chartH);
    const bw = chartW / recientes.length;
    recientes.forEach((c, i) => {
      const h = (c.ieg / 100) * (chartH - 6);
      const rgb = hexToRgb(COLOR_HEX[c.color]);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.roundedRect(chartX + i * bw + 3, chartY + chartH - h, Math.max(2, bw - 6), h, 2, 2, "F");
    });
    // etiqueta del último
    const last = recientes[recientes.length - 1];
    const lx = chartX + (recientes.length - 1) * bw + bw / 2;
    const lh = (last.ieg / 100) * (chartH - 6);
    setFont(doc, "bold", 9); setColor(doc, INK);
    doc.text(String(last.ieg), lx, chartY + chartH - lh - 3, { align: "center" });
    ctx.y = chartY + chartH + SP.md;

    // leyenda
    setFont(doc, "normal", 8);
    const states: ResultadoChequeo["color"][] = ["verde", "amarillo", "naranja", "rojo"];
    let lgx = M;
    for (const s of states) {
      const rgb = hexToRgb(COLOR_HEX[s]);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.roundedRect(lgx, ctx.y - 7, 8, 8, 2, 2, "F");
      setColor(doc, MUTED);
      doc.text(etiquetaColor(s), lgx + 12, ctx.y);
      lgx += doc.getTextWidth(etiquetaColor(s)) + 26;
    }
    ctx.y += SP.md;
    setColor(doc, MUTED); setFont(doc, "normal", 9);
    doc.text(`Chequeos mostrados: ${recientes.length} (más reciente al final).`, M, ctx.y);
    ctx.y += SP.md;
  }

  // ---------------- MEDICAMENTOS ----------------
  sectionTitle(ctx, "Medicamentos", BRAND);
  if (extras.medicamentos.length === 0) {
    body(ctx, "Sin medicamentos registrados.");
  } else {
    const rows = extras.medicamentos.map((m) => {
      const tomasMed = extras.tomas.filter((t) => t.medicamento_id === m.id);
      const a7 = calcularAdherencia(tomasMed, 7);
      const a30 = calcularAdherencia(tomasMed, 30);
      return [
        m.nombre,
        m.dosis ?? "—",
        m.frecuencia ?? "—",
        `${a7.tomados}/${a7.total} (${a7.pct}%)`,
        `${a30.tomados}/${a30.total} (${a30.pct}%)`,
      ];
    });
    renderTable(ctx, ["Medicamento", "Dosis", "Frecuencia", "Adherencia 7d", "Adherencia 30d"], rows);
  }
  ctx.y += SP.sm;

  // ---------------- SIGNOS VITALES ----------------
  sectionTitle(ctx, "Signos vitales", ACCENT);
  if (extras.signos.length === 0) {
    body(ctx, "Sin registros de signos vitales.");
  } else {
    // Sparklines en tarjetas
    const series: { label: string; data: (number | null)[] }[] = [
      { label: "TA sis (mmHg)", data: extras.signos.map((s) => s.ta_sistolica) },
      { label: "TA dia (mmHg)", data: extras.signos.map((s) => s.ta_diastolica) },
      { label: "FC (lpm)", data: extras.signos.map((s) => s.fc) },
      { label: "Temp (°C)", data: extras.signos.map((s) => s.temperatura) },
      { label: "SatO₂ (%)", data: extras.signos.map((s) => s.saturacion) },
      { label: "Glucosa (mg/dL)", data: extras.signos.map((s) => s.glucosa) },
    ];
    const rows = Math.ceil(series.length / 3);
    const cellW = (W - 2 * M) / 3;
    const cellH = 60;
    ensureSpace(ctx, rows * cellH + SP.sm);
    series.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = M + col * cellW;
      const y = ctx.y + row * cellH;
      // tarjeta
      doc.setDrawColor(LINE.r, LINE.g, LINE.b); doc.setLineWidth(0.5);
      doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
      doc.roundedRect(x + 2, y + 2, cellW - 4, cellH - 6, 6, 6, "FD");
      drawSpark(doc, s.label, s.data, x + 8, y + 4, cellW - 16, cellH - 14);
    });
    ctx.y += rows * cellH + SP.sm;

    // Alertas (chips)
    const alertas: { fecha: string; nivel: string; texto: string }[] = [];
    for (const r of extras.signos.slice(0, 10)) {
      const evs = evaluarSignos(r);
      for (const a of evs) alertas.push({ fecha: r.fecha.slice(0, 10), nivel: a.nivel, texto: a.texto });
    }
    if (alertas.length) {
      subheader(ctx, "Alertas detectadas");
      for (const a of alertas.slice(0, 12)) {
        ensureSpace(ctx, 16);
        const tag = a.nivel === "rojo" ? "ALTO" : "AVISO";
        const tagRgb = a.nivel === "rojo" ? hexToRgb(COLOR_HEX.rojo) : hexToRgb(COLOR_HEX.amarillo);
        setFont(doc, "bold", 8);
        const tagW = doc.getTextWidth(tag) + 10;
        doc.setFillColor(tagRgb.r, tagRgb.g, tagRgb.b);
        doc.roundedRect(M, ctx.y - 8, tagW, 12, 3, 3, "F");
        setColor(doc, WHITE);
        doc.text(tag, M + 5, ctx.y);
        setFont(doc, "normal", 10); setColor(doc, INK);
        doc.text(`${a.fecha}  ${a.texto}`, M + tagW + 6, ctx.y);
        ctx.y += SP.md;
      }
      ctx.y += SP.xs;
    }

    // Tabla últimos registros
    subheader(ctx, "Últimos registros");
    const rowsT = extras.signos.slice(0, 10).map((r) => [
      new Date(r.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }),
      r.ta_sistolica != null || r.ta_diastolica != null ? `${r.ta_sistolica ?? "—"}/${r.ta_diastolica ?? "—"}` : "—",
      r.fc != null ? String(r.fc) : "—",
      r.temperatura != null ? `${r.temperatura}°` : "—",
      r.saturacion != null ? `${r.saturacion}%` : "—",
      r.glucosa != null ? String(r.glucosa) : "—",
    ]);
    renderTable(ctx, ["Fecha", "TA", "FC", "Temp", "SatO₂", "Glucosa"], rowsT);
  }
  ctx.y += SP.sm;

  // ---------------- CAÍDAS ----------------
  sectionTitle(ctx, "Caídas", ACCENT);
  if (extras.caidas.length === 0) {
    body(ctx, "Sin caídas registradas.");
  } else {
    body(ctx, `Total registradas: ${extras.caidas.length}`);
    const rows = extras.caidas.map((c) => {
      const flags: string[] = [];
      if (c.golpe_craneal) flags.push("Golpe craneal");
      if (c.hospitalizacion) flags.push("Hospitalización");
      return [
        new Date(c.fecha).toLocaleDateString("es-MX", { dateStyle: "medium" }),
        c.lugar ?? "—",
        c.circunstancia ?? "—",
        c.lesion ?? "—",
        flags.join(", ") || "—",
      ];
    });
    renderTable(ctx, ["Fecha", "Lugar", "Circunstancia", "Lesión", "Alertas"], rows, {
      columnStyles: { 2: { cellWidth: "auto" } },
    });
  }
  ctx.y += SP.sm;

  // ---------------- ESCALAS ----------------
  sectionTitle(ctx, "Escalas mensuales", BRAND);
  const jenkins = extras.evaluaciones.filter((e) => e.tipo === "jenkins").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const zarit = extras.evaluaciones.filter((e) => e.tipo === "zarit").sort((a, b) => b.fecha.localeCompare(a.fecha));

  subheader(ctx, "Calidad de sueño (Jenkins JSS-4)");
  {
    const rows: (string | number)[][] = [];
    if (paciente.jenkins_basal != null) {
      rows.push(["Basal", `${paciente.jenkins_basal}/20`, interpretJenkins(paciente.jenkins_basal), "—"]);
    }
    for (const e of jenkins.slice(0, 6)) {
      rows.push([e.fecha, `${e.puntaje}/20`, interpretJenkins(e.puntaje), deltaJenkins(e.puntaje, paciente.jenkins_basal)]);
    }
    if (rows.length === 0) body(ctx, "Sin evaluaciones registradas.");
    else renderTable(ctx, ["Fecha", "Puntaje", "Interpretación", "Δ vs basal"], rows);
  }
  ctx.y += SP.sm;

  subheader(ctx, "Sobrecarga del cuidador (Zarit abreviada)");
  {
    const rows: (string | number)[][] = [];
    if (paciente.zarit_basal != null) {
      rows.push(["Basal", `${paciente.zarit_basal}/28`, interpretZarit(paciente.zarit_basal), "—"]);
    }
    for (const e of zarit.slice(0, 6)) {
      rows.push([e.fecha, `${e.puntaje}/28`, interpretZarit(e.puntaje), deltaZarit(e.puntaje, paciente.zarit_basal)]);
    }
    if (rows.length === 0) body(ctx, "Sin evaluaciones registradas.");
    else renderTable(ctx, ["Fecha", "Puntaje", "Interpretación", "Δ vs basal"], rows);
  }
  ctx.y += SP.sm;

  // ---------------- PROFUNDIZACIÓN ----------------
  const profs = extras.profundizaciones ?? [];
  if (profs.length > 0) {
    sectionTitle(ctx, "Cambios clínicos detectados", ACCENT);
    for (const pr of profs.slice(0, 8)) {
      ensureSpace(ctx, 40);
      setFont(doc, "bold", 11); setColor(doc, INK);
      doc.text(`• ${pr.fecha} — ${pr.dominio_principal ?? "—"} (deterioro ${pr.nivel_deterioro ?? "—"})`, M, ctx.y);
      ctx.y += SP.md;
      if (pr.resumen) wrap(ctx, `   ${pr.resumen}`);
      ctx.y += SP.xs;
    }
  }

  // ---------------- Resumen ----------------
  sectionTitle(ctx, "Resumen clínico", BRAND);
  wrap(ctx, generarResumen(paciente, ultimos, meta.basal));

  // ---------------- Chrome recurrente (header + footer + página X/Y) ----------------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawPageChrome(doc, W, H, M, meta, i, total);
  }

  return doc;
}

// ---------- helpers ----------

function setFont(doc: jsPDF, style: "normal" | "bold" | "italic", size: number) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
}
function setColor(doc: jsPDF, c: { r: number; g: number; b: number }) {
  doc.setTextColor(c.r, c.g, c.b);
}

function drawPageChrome(
  doc: jsPDF,
  W: number,
  H: number,
  M: number,
  meta: ReporteMeta,
  page: number,
  total: number,
) {
  // Banda superior
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, W, 4, "F");

  // Encabezado (páginas > 1 con miniatura de logo)
  if (page > 1) {
    if (meta.logoDataUrl) {
      try { doc.addImage(meta.logoDataUrl, "PNG", M, 16, 18, 18); } catch { /* noop */ }
    }
    setFont(doc, "bold", 9); setColor(doc, BRAND);
    doc.text("Cuidador 360 — Resumen Geriátrico", meta.logoDataUrl ? M + 24 : M, 28);
  }
  // Fecha a la derecha (todas las páginas)
  setFont(doc, "normal", 8); setColor(doc, MUTED);
  const fecha = `Generado: ${new Date().toLocaleString("es-MX")}`;
  doc.text(fecha, W - M, 28, { align: "right" });

  // Pie
  doc.setDrawColor(LINE.r, LINE.g, LINE.b); doc.setLineWidth(0.5);
  doc.line(M, H - 40, W - M, H - 40);
  setFont(doc, "italic", 8); setColor(doc, MUTED);
  doc.text(
    "Este reporte es una herramienta de seguimiento generada por el cuidador. No sustituye una valoración médica.",
    M, H - 26, { maxWidth: W - 2 * M - 80 },
  );
  setFont(doc, "normal", 8); setColor(doc, MUTED);
  doc.text(`Página ${page} de ${total}`, W - M, H - 26, { align: "right" });
}

function ensureSpace(ctx: Ctx, h: number) {
  if (ctx.y + h > ctx.bottomY) {
    ctx.doc.addPage();
    ctx.y = ctx.topY;
  }
}

function sectionTitle(ctx: Ctx, title: string, color: { r: number; g: number; b: number }) {
  ensureSpace(ctx, SP.lg + 26);
  ctx.y += SP.sm;
  const bandH = 22;
  const x = ctx.M, w = ctx.W - 2 * ctx.M;
  // Fondo suave
  ctx.doc.setFillColor(BG_SOFT.r, BG_SOFT.g, BG_SOFT.b);
  ctx.doc.roundedRect(x, ctx.y, w, bandH, 4, 4, "F");
  // Barra de acento
  ctx.doc.setFillColor(color.r, color.g, color.b);
  ctx.doc.rect(x, ctx.y, 3, bandH, "F");
  // Título
  setFont(ctx.doc, "bold", 12); setColor(ctx.doc, BRAND);
  ctx.doc.text(title, x + 12, ctx.y + 14);
  ctx.y += bandH + SP.sm;
}

function subheader(ctx: Ctx, text: string) {
  ensureSpace(ctx, 20);
  setFont(ctx.doc, "bold", 10); setColor(ctx.doc, BRAND);
  ctx.doc.text(text, ctx.M, ctx.y);
  ctx.y += SP.md;
}

function body(ctx: Ctx, text: string, x?: number) {
  ensureSpace(ctx, 16);
  setFont(ctx.doc, "normal", 10); setColor(ctx.doc, INK);
  ctx.doc.text(text, x ?? ctx.M, ctx.y);
  ctx.y += SP.md;
}

function wrap(ctx: Ctx, text: string) {
  setFont(ctx.doc, "normal", 10); setColor(ctx.doc, INK);
  const lines = ctx.doc.splitTextToSize(text, ctx.W - 2 * ctx.M);
  ensureSpace(ctx, lines.length * 13);
  ctx.doc.text(lines, ctx.M, ctx.y);
  ctx.y += lines.length * 13;
}

function renderTable(
  ctx: Ctx,
  head: string[],
  body: (string | number)[][],
  extra: Record<string, unknown> = {},
) {
  ensureSpace(ctx, 40);
  autoTable(ctx.doc, {
    head: [head],
    body,
    startY: ctx.y,
    theme: "grid",
    margin: { left: ctx.M, right: ctx.M, top: ctx.topY, bottom: ctx.H - ctx.bottomY + 10 },
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: [INK.r, INK.g, INK.b],
      lineColor: [LINE.r, LINE.g, LINE.b],
      lineWidth: 0.4,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [BG_SOFT.r, BG_SOFT.g, BG_SOFT.b],
    },
    ...extra,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx.y = ((ctx.doc as any).lastAutoTable?.finalY ?? ctx.y) + SP.md;
}

function drawSpark(doc: jsPDF, label: string, data: (number | null)[], x: number, y: number, w: number, h: number) {
  setFont(doc, "normal", 8); setColor(doc, MUTED);
  doc.text(label, x, y + 10);
  const vals = data.filter((v): v is number => v != null).reverse();
  if (vals.length === 0) {
    setColor(doc, MUTED);
    doc.text("—", x, y + 28);
    return;
  }
  setColor(doc, INK); setFont(doc, "bold", 11);
  doc.text(String(vals[vals.length - 1]), x + w - 4, y + 10, { align: "right" });
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const top = y + 16, bot = y + h - 4;
  const step = vals.length > 1 ? w / (vals.length - 1) : 0;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b); doc.setLineWidth(0.9);
  for (let i = 1; i < vals.length; i++) {
    const x1 = x + (i - 1) * step;
    const y1 = bot - ((vals[i - 1] - min) / range) * (bot - top);
    const x2 = x + i * step;
    const y2 = bot - ((vals[i] - min) / range) * (bot - top);
    doc.line(x1, y1, x2, y2);
  }
  setFont(doc, "normal", 7); setColor(doc, MUTED);
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
