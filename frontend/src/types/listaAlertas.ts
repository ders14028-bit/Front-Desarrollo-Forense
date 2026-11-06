import type { EtapaCaso } from "./caso";

/**
 * Tipos de SLA y caso que aún usan las etiquetas (`utils/etiquetas.ts`). La Vista unificada ya no existe
 * (recuperable desde el tag `con-vista-unificada`).
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
