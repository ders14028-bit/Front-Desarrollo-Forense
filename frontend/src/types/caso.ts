import type { Severidad } from "./alerta";

// PENDIENTE: confirmar con datos reales.
// TheHive todavía tiene 0 casos; estos campos salen de la API v1 de TheHive 5/6 que
// conocemos, no de una respuesta real. Verificar nombres, tipos y valores de `status`/`stage`.

/** Etapa del caso. En TheHive 5/6 un caso cerrado tiene `stage = "Closed"`. */
export type EtapaCaso = "New" | "InProgress" | "Closed";

export interface Caso {
  _id: string;
  _type: "case";
  _createdAt: number;
  number: number;
  title: string;
  description?: string;
  severity: Severidad;
  /**
   * Estado del caso (personalizable en TheHive). Al cerrar se usa para la resolución,
   * por ejemplo `TruePositive` o `FalsePositive` (ver `ESTADO_CONFIRMADO` en config).
   */
  status: string;
  stage: EtapaCaso;
  assignee?: string;
  /** Fecha de cierre en ms; solo si el caso está cerrado. */
  endDate?: number;
  tags: string[];
}
