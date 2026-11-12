import { FRESCURA_AVISO_MS, ZONA_HORARIA } from "../config";

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

/** "30 oct 2026, 23:30": fecha y hora en Bogotá. */
export function formatoFechaHora(ms: number): string {
  const dia = diaBogota(ms);
  return `${diaCorto(dia)} ${dia.slice(0, 4)}, ${formatoHora(ms)}`;
}

/** Los `n` días (`YYYY-MM-DD`, del más antiguo al más reciente) que terminan hoy en Bogotá. `ahora` (ms) es el instante de referencia. */
export function ultimosDias(n: number, ahora: number): string[] {
  const [a, m, d] = diaBogota(ahora).split("-").map(Number);
  // Aritmética de calendario puro en UTC: no depende de la zona del equipo.
  const hoyUtc = Date.UTC(a, m - 1, d);
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    dias.push(new Date(hoyUtc - i * MS_DIA).toISOString().slice(0, 10));
  }
  return dias;
}

/** "3 nov" a partir de `YYYY-MM-DD`. */
export function diaCorto(dia: string): string {
  const [, mes, numero] = dia.split("-").map(Number);
  return `${numero} ${MESES_CORTOS[mes - 1]}`;
}

/** "Hoy" para el día actual; "1 nov" el primer día del mes; si no, solo el número. */
export function etiquetaDia(dia: string, ahora: number): string {
  if (dia === diaBogota(ahora)) return "Hoy";
  const numero = Number(dia.split("-")[2]);
  return numero === 1 ? diaCorto(dia) : String(numero);
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

/** "hace 3 días", "hace 1 día", "hace 5 h", "hace 12 min", "hace menos de 1 min". */
export function textoHace(ms: number): string {
  const minutos = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 60_000);
  const dias = Math.floor(minutos / 1440);
  if (dias > 0) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  if (minutos >= 60) return `hace ${Math.floor(minutos / 60)} h`;
  if (minutos > 0) return `hace ${minutos} min`;
  return "hace menos de 1 min";
}

export interface Frescura {
  texto: string;
  /** true = la última alerta tiene más de 24 h (o no hay ninguna): la integración puede haber dejado de enviar. */
  atrasada: boolean;
}

/** "Última alerta recibida: 6 nov, 14:05 (hace 3 días)", con la fecha y la hora en Bogotá. */
export function frescuraAlertas(ultimaAlertaEn: number | null | undefined, ahora: number): Frescura {
  if (ultimaAlertaEn === null || ultimaAlertaEn === undefined) {
    return { texto: "Aún no se ha recibido ninguna alerta", atrasada: false };
  }
  const fecha = `${diaCorto(diaBogota(ultimaAlertaEn))}, ${formatoHora(ultimaAlertaEn)}`;
  return {
    texto: `Última alerta recibida: ${fecha} (${textoHace(ahora - ultimaAlertaEn)})`,
    atrasada: ahora - ultimaAlertaEn > FRESCURA_AVISO_MS,
  };
}

/** "últimos 14 días" (o "último día" si la ventana es de 1). El número sale de la respuesta del backend. */
export function textoUltimosDias(dias: number): string {
  return dias === 1 ? "último día" : `últimos ${dias} días`;
}

/** "Activos atacados (últimos 14 días)". Mientras no se sabe la ventana (sin respuesta aún) va el título solo: no se inventa. */
export function tituloConVentana(titulo: string, dias: number | null | undefined): string {
  return dias === null || dias === undefined ? titulo : `${titulo} (${textoUltimosDias(dias)})`;
}
