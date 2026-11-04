import type { Alerta, EstadoAlerta, Severidad } from "./alerta";
import type { Caso, EtapaCaso } from "./caso";
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

/** Respuesta de `GET /api/dashboard/alertas`: últimos 30 días, hasta el tope. */
export interface ListaAlertas {
  generadoEn: number;
  /** Alertas dentro de la ventana, antes de aplicar el tope. */
  total: number;
  /** true si `total` supera el tope y `alertas` trae solo las más recientes. */
  truncado: boolean;
  /** true si hay alertas o casos de prueba ("Datos de laboratorio"). */
  datosDeLaboratorio: boolean;
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
