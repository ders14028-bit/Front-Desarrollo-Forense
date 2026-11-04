import { ZONA_HORARIA } from "../config";

const MS_DIA = 86_400_000;
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const formateadorDia = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día en Bogotá (`YYYY-MM-DD`) de un timestamp en ms. */
export function diaBogota(ms: number): string {
  const partes = formateadorDia.formatToParts(new Date(ms));
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

const formateadorHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Hora de un timestamp en Bogotá, `HH:MM` (24 h). */
export function formatoHora(ms: number): string {
  return formateadorHora.format(new Date(ms));
}

/** Los `n` días (`YYYY-MM-DD`, del más antiguo al más reciente) que terminan hoy en Bogotá. */
export function ultimosDias(n: number, ahora: number = Date.now()): string[] {
  const [a, m, d] = diaBogota(ahora).split("-").map(Number);
  // Aritmética de calendario puro en UTC: no depende de la zona del equipo.
  const hoyUtc = Date.UTC(a, m - 1, d);
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    dias.push(new Date(hoyUtc - i * MS_DIA).toISOString().slice(0, 10));
  }
  return dias;
}

/** "Hoy" para el día actual; "1 nov" el primer día del mes; si no, solo el número. */
export function etiquetaDia(dia: string, ahora: number = Date.now()): string {
  if (dia === diaBogota(ahora)) return "Hoy";
  const [, mes, numero] = dia.split("-").map(Number);
  return numero === 1 ? `1 ${MESES_CORTOS[mes - 1]}` : String(numero);
}

/**
 * Antigüedad legible, sin partes en cero: "7 d 6 h", "1 d", "3 h 20 min", "1 h", "45 min".
 * Menos de un minuto: "< 1 min".
 */
export function formatoAntiguedad(ms: number): string {
  const minutosTotales = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 60_000);
  const dias = Math.floor(minutosTotales / 1440);
  const horas = Math.floor((minutosTotales % 1440) / 60);
  const minutos = minutosTotales % 60;

  if (dias > 0) return horas > 0 ? `${dias} d ${horas} h` : `${dias} d`;
  if (horas > 0) return minutos > 0 ? `${horas} h ${minutos} min` : `${horas} h`;
  if (minutos > 0) return `${minutos} min`;
  return "< 1 min";
}
