import type { Severidad } from "../types/alerta";
import type { ConteoPorDia, ConteoPorOrigen, ConteoPorSeveridad, ConteoPorTipo } from "../types/metricas";
import { diaBogota, diaCorto, etiquetaDia } from "./fechas";
import { etiquetaSeveridad, nombreLegible } from "./etiquetas";

/** Transformaciones puras que preparan los datos del resumen para las gráficas. */

// ---------- Escala ----------

/** Ancho (0–100) de una barra respecto al máximo de su gráfica. Todo valor > 0 se ve (mínimo 2 %). */
export function anchoRelativo(valor: number, maximo: number): number {
  if (valor <= 0 || maximo <= 0) return 0;
  return Math.max(2, (valor / maximo) * 100);
}

// ---------- Filas ----------

export interface Fila {
  clave: string;
  etiqueta: string;
  cantidad: number;
}

export interface FilaSeveridad extends Fila {
  severidad: Severidad;
}

/** Siempre cuatro filas, en este orden: Crítica, Alta, Media, Baja. */
export function filasSeveridad(porSeveridad: ConteoPorSeveridad[]): FilaSeveridad[] {
  return ([4, 3, 2, 1] as Severidad[]).map((severidad) => ({
    severidad,
    clave: String(severidad),
    etiqueta: etiquetaSeveridad(severidad),
    cantidad: porSeveridad.find((s) => s.severidad === severidad)?.cantidad ?? 0,
  }));
}

/** Herramientas de origen, de mayor a menor, con nombre legible. */
export function filasOrigen(porOrigen: ConteoPorOrigen[]): Fila[] {
  return ordenar(porOrigen.map((o) => ({ clave: o.origen, etiqueta: nombreLegible(o.origen), cantidad: o.cantidad })));
}

function ordenar(filas: Fila[]): Fila[] {
  return [...filas].sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave, "es"));
}

export function maximoDe(valores: number[]): number {
  return Math.max(0, ...valores);
}

// ---------- Tipo de amenaza: top N + "Otros" + "Sin clasificar" ----------

/** Cuántos tipos se muestran por separado; el resto va en "Otros". */
export const TIPOS_PRINCIPALES = 5;

export interface GrupoOtros {
  /** "Otros (2 tipos)". */
  etiqueta: string;
  /** Suma de las alertas de los tipos agrupados. */
  cantidad: number;
  tipos: Fila[];
}

export interface TiposArmados {
  principales: Fila[];
  otros: GrupoOtros | null;
  /** Va aparte, al final de la gráfica. */
  sinClasificar: number;
  /**
   * Máximo de las filas visibles (principales, suma de "Otros" y "Sin clasificar"). No cambia al
   * desplegar "Otros", porque ningún hijo supera su suma.
   */
  maximo: number;
}

export function armarTipos(porTipo: ConteoPorTipo[], sinClasificar: number, topN = TIPOS_PRINCIPALES): TiposArmados {
  const filas = ordenar(porTipo.map((t) => ({ clave: t.tipo, etiqueta: nombreLegible(t.tipo), cantidad: t.cantidad })));
  const principales = filas.slice(0, topN);
  const resto = filas.slice(topN);

  const otros: GrupoOtros | null =
    resto.length === 0
      ? null
      : {
          etiqueta: `Otros (${resto.length} ${resto.length === 1 ? "tipo" : "tipos"})`,
          cantidad: resto.reduce((suma, f) => suma + f.cantidad, 0),
          tipos: resto,
        };

  return {
    principales,
    otros,
    sinClasificar,
    maximo: maximoDe([...principales.map((f) => f.cantidad), otros?.cantidad ?? 0, sinClasificar]),
  };
}

// ---------- Serie por día ----------

export type RangoDias = 7 | 14 | 30;
export const RANGOS_DIAS: readonly RangoDias[] = [7, 14, 30];
export const RANGO_POR_DEFECTO: RangoDias = 14;

export interface DiaVisible {
  /** `YYYY-MM-DD` en Bogotá. */
  dia: string;
  /** "Hoy", el número del día o "1 nov". */
  etiqueta: string;
  /** "3 nov", para lectores de pantalla. */
  fecha: string;
  cantidad: number;
  esHoy: boolean;
}

/** Los últimos `n` días de la serie (que termina hoy), con sus etiquetas. `ahora` define "Hoy". */
export function serieVisible(porDia: ConteoPorDia[], n: number, ahora: number): DiaVisible[] {
  if (n <= 0) return [];
  const hoy = diaBogota(ahora);
  return porDia.slice(-n).map((d) => ({
    dia: d.dia,
    etiqueta: etiquetaDia(d.dia, ahora),
    fecha: diaCorto(d.dia),
    cantidad: d.cantidad,
    esHoy: d.dia === hoy,
  }));
}
