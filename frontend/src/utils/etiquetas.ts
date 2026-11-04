import { ESTADO_CONFIRMADO, ESTADO_FALSO_POSITIVO, NOMBRES_LEGIBLES } from "../config";
import type { EstadoAlerta, Severidad } from "../types/alerta";
import type { EtapaCaso } from "../types/caso";
import type { CasoResumen, SlaAlerta } from "../types/listaAlertas";
import { formatoAntiguedad } from "./fechas";

/** Todas las etiquetas en español de la interfaz para estados, severidad, SLA, caso y nombres. */

const MIN = 60_000;

// ---------- Nombres de tipos y herramientas ----------

const SIGLAS = new Set(["misp", "ioc", "dns", "vpn", "siem"]);

/** "fuerza-bruta" → "Fuerza bruta"; "inteligencia-misp" → "Inteligencia MISP"; "wazuh" → "Wazuh". */
export function nombreLegible(clave: string): string {
  const conocido = NOMBRES_LEGIBLES[clave];
  if (conocido) return conocido;

  const palabras = clave.split(/[-_\s]+/).filter(Boolean);
  if (palabras.length === 0) return clave;
  const texto = palabras.map((p) => (SIGLAS.has(p.toLowerCase()) ? p.toUpperCase() : p.toLowerCase())).join(" ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const TEXTO_SIN_CLASIFICAR = "Sin clasificar";

/** Tipo de amenaza: nombre legible, o "Sin clasificar" si la alerta no tiene etiqueta `escenario:`. */
export const etiquetaTipo = (tipo: string | null): string => (tipo === null ? TEXTO_SIN_CLASIFICAR : nombreLegible(tipo));

/** Herramienta de origen (`source`). */
export const etiquetaOrigen = (origen: string): string => nombreLegible(origen);

// ---------- Severidad y estado ----------

const SEVERIDAD: Record<Severidad, string> = { 4: "Crítica", 3: "Alta", 2: "Media", 1: "Baja" };
export const etiquetaSeveridad = (severidad: Severidad): string => SEVERIDAD[severidad];

const ESTADO_ALERTA: Record<EstadoAlerta, string> = {
  New: "Sin atender",
  InProgress: "En progreso",
  Imported: "Convertida en caso",
  Ignored: "Ignorada",
};
export const etiquetaEstadoAlerta = (estado: EstadoAlerta): string => ESTADO_ALERTA[estado];

// ---------- SLA ----------

export function etiquetaSla(sla: SlaAlerta): string {
  if (sla.estado === "fuera") return "Fuera de SLA";
  if (sla.estado === "dentro") return "Dentro de SLA";
  return "—"; // no aplica: la alerta no está sin atender
}

/** "+2 d 4 h" cuando está fuera de SLA; null en los demás casos. */
export function textoExcesoSla(sla: SlaAlerta): string | null {
  if (sla.estado !== "fuera" || sla.excesoMs === null) return null;
  return sla.excesoMs < MIN ? "+menos de 1 min" : `+${formatoAntiguedad(sla.excesoMs)}`;
}

// ---------- Antigüedad ----------

/** "Hace 3 d 4 h", "Hace 45 min", "Hace menos de 1 min". */
export function etiquetaAntiguedad(ms: number): string {
  return ms < MIN ? "Hace menos de 1 min" : `Hace ${formatoAntiguedad(ms)}`;
}

// ---------- Caso ----------

const ETAPA_CASO: Record<EtapaCaso, string> = { New: "Abierto", InProgress: "En progreso", Closed: "Cerrado" };

// Resolución al cerrar el caso (`status`). Lo que no esté aquí se muestra tal cual.
const RESOLUCION: Record<string, string> = {
  [ESTADO_CONFIRMADO]: "Confirmado",
  [ESTADO_FALSO_POSITIVO]: "Falso positivo",
  Other: "Otro",
  Indeterminate: "Indeterminado",
  Duplicated: "Duplicado",
};

/**
 * "Sin caso", "#4 · Abierto", "#3 · En progreso", "#2 · Cerrado · Confirmado",
 * "#5 · Cerrado · Falso positivo" o "Caso no disponible" (tiene caseId pero sin datos).
 */
export function etiquetaCaso(caso: CasoResumen | null): string {
  if (caso === null) return "Sin caso";

  const partes: string[] = [];
  if (caso.numero !== null) partes.push(`#${caso.numero}`);
  if (caso.etapa !== null) {
    partes.push(ETAPA_CASO[caso.etapa]);
    if (caso.etapa === "Closed" && caso.estado) partes.push(RESOLUCION[caso.estado] ?? caso.estado);
  }
  return partes.length > 0 ? partes.join(" · ") : "Caso no disponible";
}
