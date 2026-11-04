import type { Severidad } from "../types/alerta";

/** SLA de atención por severidad, en minutos. */
export const SLA_MINUTOS: Record<Severidad, number> = {
  4: 15, // crítica
  3: 30, // alta
  2: 120, // media
  1: 240, // baja
};

// PENDIENTE: confirmar estos dos nombres con el grupo de TheHive.
/** Grupo de las tareas que cuentan como contención. */
export const GRUPO_CONTENCION = "Contención";
/** Estado de un caso cerrado como incidente confirmado. */
export const ESTADO_CONFIRMADO = "TruePositive";
/** Estado de un caso cerrado como falso positivo (cuenta como cerrado, no como confirmado). */
export const ESTADO_FALSO_POSITIVO = "FalsePositive";

/** Tag que marca los datos de prueba; si hay alertas o casos con él, se muestra "Datos de laboratorio". */
export const TAG_LABORATORIO = "simulacion";

/** Intervalo de refresco automático. */
export const REFRESCO_MS = 30_000;

/** Zona horaria para agrupar por día y mostrar horas. */
export const ZONA_HORARIA = "America/Bogota";
