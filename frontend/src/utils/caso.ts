import { GRUPO_CONTENCION } from "../config";
import type { Tarea } from "../types/tarea";

/** Separa las tareas de contención (primero) del resto, conservando el orden de cada grupo. */
export function separarTareas(tareas: Tarea[]): { contencion: Tarea[]; otras: Tarea[] } {
  return {
    contencion: tareas.filter((t) => t.group === GRUPO_CONTENCION),
    otras: tareas.filter((t) => t.group !== GRUPO_CONTENCION),
  };
}
