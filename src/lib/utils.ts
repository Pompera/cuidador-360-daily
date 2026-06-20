import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fecha local en formato YYYY-MM-DD (evita el bug de UTC en zonas americanas). */
export function fechaHoy(d: Date = new Date()): string {
  return d.toLocaleDateString("sv");
}
