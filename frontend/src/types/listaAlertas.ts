import type { Alerta, EstadoAlerta, Severidad } from "./alerta";
import type { Caso, EtapaCaso } from "./caso";
import type { EstadoTheHive } from "./metricas";
import type { Tarea } from "./tarea";

/**
 * Contrato de la Vista unificada (ver docs/contrato-api.md). El backend calcula los campos
 * derivados (tipo, SLA, caso); el frontend solo filtra, ordena, pagina y presenta.
 */

/** "dentro" / "fuera" del SLA; null = no aplica (la alerta no está sin atender). */
export type EstadoSla = "dentro" | "fuera" | null;

export interface SlaAlerta {
  estado: EstadoSla;
  /** SLA configurado para la severidad de la alerta, en minutos. */
  limiteMin: number;
  /** Cuánto excede el SLA, en ms; solo si `estado` es "fuera". */
  excesoMs: number | null;
}

/**
 * Resumen del caso al que se convirtió la alerta. Si la alerta tiene `caseId` pero el caso no
 * está disponible, `id` viene y el resto es null (la alerta SÍ tiene caso).
 */
export interface CasoResumen {
  id: string;
  numero: number | null;
  etapa: EtapaCaso | null;
  /** `status` del caso (por ejemplo `TruePositive` al cerrarlo como confirmado). */
  estado: string | null;
}

/** Una fila de la tabla. Fechas en ms (UTC); duraciones en ms. */
export interface AlertaFila {
  id: string;
  creadaEn: number;
  titulo: string;
  severidad: Severidad;
  estado: EstadoAlerta;
  /** Campo `source`. */
  origen: string;
  /** Clave de la etiqueta `escenario:<tipo>`; null = "Sin clasificar". */
  tipo: string | null;
  /** Edad de la alerta en el instante `generadoEn` de la lista. */
  antiguedadMs: number;
  sla: SlaAlerta;
  caso: CasoResumen | null;
}

/** De qué se compone la lista: las más recientes y las críticas/altas sin atender más antiguas que se añadieron. */
export interface ComposicionLista {
  /** Las alertas más recientes de la ventana (hasta el tope de 1000). */
  recientes: number;
  /** Críticas y altas sin atender MÁS ANTIGUAS que las recientes, añadidas aparte para que ninguna quede fuera. */
  criticasYAltasAdicionales: number;
}

/**
 * Respuesta de `GET /api/dashboard/alertas`: las más recientes de los últimos 30 días (hasta el tope) más todas las
 * críticas y altas sin atender de esa ventana.
 */
export interface ListaAlertas {
  generadoEn: number;
  /** Alertas dentro de la ventana, antes de aplicar el tope. */
  total: number;
  /** true si `total` es mayor que las alertas que vienen en `alertas`. */
  truncado: boolean;
  /** Cuántas son recientes y cuántas se añadieron por ser críticas o altas sin atender. */
  composicion: ComposicionLista;
  /** true si hay alertas o casos de prueba ("Datos de laboratorio"). */
  datosDeLaboratorio: boolean;
  /** Ausente = se asume que TheHive respondió. */
  thehive?: EstadoTheHive;
  /** Más recientes primero. */
  alertas: AlertaFila[];
}

export interface CasoDetalle extends Caso {
  tareas: Tarea[];
}

/** Respuesta de `GET /api/dashboard/alertas/{id}`. */
export interface DetalleAlerta {
  generadoEn: number;
  /** Todos los campos de la alerta, tal como los da TheHive. */
  alerta: Alerta;
  fila: AlertaFila;
  /** Caso completo con sus tareas; null si la alerta no tiene caso (o no está disponible). */
  caso: CasoDetalle | null;
}
