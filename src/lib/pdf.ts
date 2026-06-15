import jsPDF from "jspdf";
import { interpretBarthel } from "./clinical/barthel";
import { interpretLawton } from "./clinical/lawton";
import { COLOR_HEX, type ResultadoChequeo } from "./clinical/chequeo";

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
}

export interface ReporteChequeo {
  fecha: string;
  ieg: number;
  color: ResultadoChequeo["color"];
  respuestas: Record<string, string | string[]>;
}

export function generarReportePDF(paciente: ReportePaciente, ultimos: ReporteChequeo[]) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 50;

  // Encabezado
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.setTextColor(40, 70, 80);
  doc.text("Cuidador 360 — Resumen Geriátrico", M, y);
  y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, M, y);
  y += 18;

  // Paciente
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 16;
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(30);
  doc.text("Paciente", M, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`Nombre: ${paciente.nombre}`, M, y); y += 14;
  doc.text(`Edad: ${paciente.edad ?? "—"}    Sexo: ${paciente.sexo ?? "—"}`, M, y); y += 14;
  const dx = paciente.comorbilidades.length ? paciente.comorbilidades.join(", ") : "Sin registrar";
  doc.text(`Diagnósticos: ${dx}`, M, y, { maxWidth: W - 2 * M }); y += 22;

  // Estado actual
  const ultimo = ultimos[0];
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 16;
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Estado actual", M, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  if (ultimo) {
    const hex = COLOR_HEX[ultimo.color];
    const rgb = hexToRgb(hex);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(M, y - 10, 14, 14, 3, 3, "F");
    doc.text(`IEG: ${ultimo.ieg}/100   (${etiquetaColor(ultimo.color)})`, M + 22, y);
    y += 16;
    doc.text(`Último chequeo: ${ultimo.fecha}`, M, y); y += 14;
  } else {
    doc.text("Sin chequeos registrados aún.", M, y); y += 14;
  }
  y += 6;

  // Valoración basal
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 16;
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Valoración basal", M, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  if (paciente.barthel_total != null) {
    doc.text(`Barthel: ${paciente.barthel_total}/100 — ${interpretBarthel(paciente.barthel_total)}`, M, y); y += 14;
  }
  if (paciente.lawton_total != null) {
    doc.text(`Lawton: ${paciente.lawton_total}/8 — ${interpretLawton(paciente.lawton_total)}`, M, y); y += 14;
  }
  if (paciente.cfs_nivel != null) {
    doc.text(`Clinical Frailty Scale: ${paciente.cfs_nivel}/9`, M, y); y += 14;
  }
  if (paciente.movilidad) { doc.text(`Movilidad basal: ${paciente.movilidad}`, M, y); y += 14; }
  if (paciente.objetivos.length) {
    doc.text(`Objetivos de cuidado: ${paciente.objetivos.join(", ")}`, M, y, { maxWidth: W - 2 * M }); y += 18;
  }

  // Tendencia
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 16;
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Tendencia reciente (IEG)", M, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const recientes = ultimos.slice(0, 14).reverse();
  if (recientes.length === 0) {
    doc.text("Sin datos.", M, y); y += 14;
  } else {
    // mini bar chart
    const chartX = M, chartY = y, chartW = W - 2 * M, chartH = 60;
    doc.setDrawColor(230); doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
    const bw = chartW / recientes.length;
    recientes.forEach((c, i) => {
      const h = (c.ieg / 100) * chartH;
      const rgb = hexToRgb(COLOR_HEX[c.color]);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(chartX + i * bw + 2, chartY + chartH - h, Math.max(2, bw - 4), h, "F");
    });
    y += chartH + 16;
    doc.text(`Chequeos mostrados: ${recientes.length} (más reciente al final).`, M, y); y += 16;
  }

  // Resumen automático
  doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 16;
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Resumen clínico", M, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  const resumen = generarResumen(paciente, ultimos);
  const split = doc.splitTextToSize(resumen, W - 2 * M);
  doc.text(split, M, y); y += split.length * 14 + 8;

  // Pie con disclaimer
  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text(
    "Este reporte es una herramienta de seguimiento generada por el cuidador. No sustituye una valoración médica.",
    M, doc.internal.pageSize.getHeight() - 30, { maxWidth: W - 2 * M },
  );

  return doc;
}

function etiquetaColor(c: ResultadoChequeo["color"]) {
  return { verde: "Estable", amarillo: "Vigilancia", naranja: "Deterioro", rojo: "Alto riesgo" }[c];
}

function hexToRgb(h: string) {
  const v = h.replace("#", "");
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}

function generarResumen(p: ReportePaciente, chequeos: ReporteChequeo[]): string {
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

  return `Paciente ${p.nombre}, ${p.edad ?? "—"} años, ${estado}. IEG actual ${ultimo.ieg}/100, promedio de los últimos ${recientes.length} días: ${promedio}/100, ${tendencia}. Se sugiere priorizar evaluación dirigida según los hallazgos resaltados arriba.`;
}
