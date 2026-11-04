import type { EstadoAlerta, Severidad } from "../types/alerta";
import type { AlertaFila } from "../types/listaAlertas";
import { diaBogota, ultimosDias } from "./fechas";

/** Lógica pura de la tabla de la Vista unificada: filtrar, ordenar y paginar en el frontend. */

// ---------- Filtros ----------

/** Filtro de sí/no: "todos" no filtra. */
export type TresEstados = "todos" | "si" | "no";

export interface FiltrosTabla {
  /** Texto buscado en el título (sin distinguir mayúsculas ni tildes; se recortan los espacios). */
  busqueda: string;
  /** En las listas, vacío = sin filtrar; con valores, basta con coincidir con UNO (O). */
  severidades: Severidad[];
  estados: EstadoAlerta[];
  origenes: string[];
  /** `null` = "Sin clasificar" (alertas sin etiqueta `escenario:`). */
  tipos: (string | null)[];
  /** "si": con `caseId`, aunque el caso no tenga datos. "no": sin `caseId`. */
  tieneCaso: TresEstados;
  /** "si": fuera de SLA. "no": dentro de SLA o sin SLA aplicable (no está sin atender). */
  fueraDeSla: TresEstados;
  /** Día Bogotá `YYYY-MM-DD`, inclusive. null = sin límite. */
  desde: string | null;
  hasta: string | null;
}

export const FILTROS_VACIOS: FiltrosTabla = {
  busqueda: "",
  severidades: [],
  estados: [],
  origenes: [],
  tipos: [],
  tieneCaso: "todos",
  fueraDeSla: "todos",
  desde: null,
  hasta: null,
};

/** Minúsculas, sin tildes ni diacríticos y sin espacios en los extremos. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function pasaTresEstados(filtro: TresEstados, valor: boolean): boolean {
  return filtro === "todos" || (filtro === "si") === valor;
}

/**
 * Entre filtros distintos se combinan con Y; dentro de una selección múltiple, con O.
 * Un rango con `desde` posterior a `hasta` no deja pasar ninguna alerta.
 */
export function filtrarAlertas(filas: AlertaFila[], f: FiltrosTabla): AlertaFila[] {
  const texto = normalizarTexto(f.busqueda);

  return filas.filter((fila) => {
    if (texto !== "" && !normalizarTexto(fila.titulo).includes(texto)) return false;
    if (f.severidades.length > 0 && !f.severidades.includes(fila.severidad)) return false;
    if (f.estados.length > 0 && !f.estados.includes(fila.estado)) return false;
    if (f.origenes.length > 0 && !f.origenes.includes(fila.origen)) return false;
    if (f.tipos.length > 0 && !f.tipos.includes(fila.tipo)) return false;
    if (!pasaTresEstados(f.tieneCaso, fila.caso !== null)) return false;
    if (!pasaTresEstados(f.fueraDeSla, fila.sla.estado === "fuera")) return false;

    if (f.desde !== null || f.hasta !== null) {
      const dia = diaBogota(fila.creadaEn); // 'YYYY-MM-DD' se compara como texto
      if (f.desde !== null && dia < f.desde) return false;
      if (f.hasta !== null && dia > f.hasta) return false;
    }
    return true;
  });
}

export type PresetFecha = "hoy" | 7 | 14 | 30;

/** Rango de días de Bogotá que termina hoy. "Hoy" = desde las 00:00 de Bogotá. */
export function rangoPreset(preset: PresetFecha, ahora: number): { desde: string; hasta: string } {
  const dias = ultimosDias(preset === "hoy" ? 1 : preset, ahora);
  return { desde: dias[0], hasta: dias[dias.length - 1] };
}

// ---------- Orden ----------

export type Orden = "prioridad" | "recientes" | "antiguas" | "severidad";

export const ORDENES: readonly Orden[] = ["prioridad", "recientes", "antiguas", "severidad"];

export const ETIQUETA_ORDEN: Record<Orden, string> = {
  prioridad: "Prioridad (recomendado)",
  recientes: "Más recientes",
  antiguas: "Más antiguas",
  severidad: "Severidad",
};

/** 0 = sin atender fuera de SLA, 1 = sin atender dentro de SLA, 2 = el resto. */
function nivelDePrioridad(fila: AlertaFila): number {
  if (fila.sla.estado === "fuera") return 0;
  if (fila.sla.estado === "dentro") return 1;
  return 2;
}

/** Comparación de ids por texto (no por idioma): estable y igual en cualquier equipo. */
const porId = (a: AlertaFila, b: AlertaFila) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const COMPARADORES: Record<Orden, (a: AlertaFila, b: AlertaFila) => number> = {
  // nivel → severidad (mayor primero) → la más antigua primero → id
  prioridad: (a, b) =>
    nivelDePrioridad(a) - nivelDePrioridad(b) ||
    b.severidad - a.severidad ||
    a.creadaEn - b.creadaEn ||
    porId(a, b),
  recientes: (a, b) => b.creadaEn - a.creadaEn || porId(a, b),
  antiguas: (a, b) => a.creadaEn - b.creadaEn || porId(a, b),
  severidad: (a, b) => b.severidad - a.severidad || porId(a, b),
};

/** Devuelve una copia ordenada. Todos los órdenes desempatan por id, así el orden no salta entre refrescos. */
export function ordenarAlertas(filas: AlertaFila[], orden: Orden): AlertaFila[] {
  return [...filas].sort(COMPARADORES[orden]);
}

// ---------- Paginación ----------

export const TAMANO_PAGINA = 25;

export interface Pagina<T> {
  items: T[];
  /** Página mostrada, ya ajustada al rango válido. */
  pagina: number;
  /** Mínimo 1, aunque no haya elementos. */
  totalPaginas: number;
  total: number;
  /** Posición (desde 1) del primer y último elemento mostrados; 0 y 0 si no hay. */
  desde: number;
  hasta: number;
}

/** Deja la página dentro de [1, última]: si la lista se achicó, va a la última que existe. */
export function ajustarPagina(pagina: number, total: number, tamano = TAMANO_PAGINA): number {
  const ultima = Math.max(1, Math.ceil(total / tamano));
  if (!Number.isFinite(pagina)) return 1;
  return Math.min(Math.max(1, Math.trunc(pagina)), ultima);
}

export function paginar<T>(items: T[], pagina: number, tamano = TAMANO_PAGINA): Pagina<T> {
  const total = items.length;
  const actual = ajustarPagina(pagina, total, tamano);
  const inicio = (actual - 1) * tamano;

  return {
    items: items.slice(inicio, inicio + tamano),
    pagina: actual,
    totalPaginas: Math.max(1, Math.ceil(total / tamano)),
    total,
    desde: total === 0 ? 0 : inicio + 1,
    hasta: Math.min(total, inicio + tamano),
  };
}

/** "Mostrando 26–50 de 112" (con un solo elemento: "Mostrando 101 de 101"). */
export function textoMostrando(p: Pagina<unknown>): string {
  if (p.total === 0) return "No hay alertas que mostrar";
  if (p.desde === p.hasta) return `Mostrando ${p.desde} de ${p.total}`;
  return `Mostrando ${p.desde}–${p.hasta} de ${p.total}`;
}

// ---------- Estado de la tabla ----------

export interface EstadoTabla {
  filtros: FiltrosTabla;
  orden: Orden;
  /** Página pedida; la mostrada puede ser menor si la lista se achicó (ver `calcularVista`). */
  pagina: number;
}

export const ESTADO_TABLA_INICIAL: EstadoTabla = { filtros: FILTROS_VACIOS, orden: "prioridad", pagina: 1 };

/** Cambiar un filtro o el orden vuelve a la página 1. */
export const conFiltros = (e: EstadoTabla, filtros: FiltrosTabla): EstadoTabla => ({ ...e, filtros, pagina: 1 });
export const conOrden = (e: EstadoTabla, orden: Orden): EstadoTabla => ({ ...e, orden, pagina: 1 });
export const conPagina = (e: EstadoTabla, pagina: number): EstadoTabla => ({ ...e, pagina: Math.max(1, Math.trunc(pagina) || 1) });

export interface VistaTabla {
  pagina: Pagina<AlertaFila>;
  /** Alertas que cumplen los filtros (todas las páginas). */
  coincidencias: number;
}

/** Filtra, ordena y pagina. Si la página pedida ya no existe, muestra la última que sí. */
export function calcularVista(filas: AlertaFila[], estado: EstadoTabla, tamano = TAMANO_PAGINA): VistaTabla {
  const filtradas = filtrarAlertas(filas, estado.filtros);
  const ordenadas = ordenarAlertas(filtradas, estado.orden);
  return { pagina: paginar(ordenadas, estado.pagina, tamano), coincidencias: filtradas.length };
}
