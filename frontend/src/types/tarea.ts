// PENDIENTE: confirmar con datos reales.
// TheHive todavía tiene 0 casos y por tanto 0 tareas; estos campos salen de la API v1 de
// TheHive 5/6 que conocemos. Verificar nombres y valores de `status` y `group`.

/** PENDIENTE: confirmar con tareas reales que estos son los valores de `status` (y que `Completed` es "hecha"). */
export type EstadoTarea = "Waiting" | "InProgress" | "Completed" | "Cancel";

export interface Tarea {
  _id: string;
  _type: "task";
  _createdAt: number;
  title: string;
  /** Grupo de la tarea; las contenciones son las del grupo `GRUPO_CONTENCION` (config). */
  group: string;
  status: EstadoTarea;
  /** Fecha de finalización en ms; solo si la tarea está completada. */
  endDate?: number;
  /** Caso al que pertenece. */
  caseId?: string;
}
