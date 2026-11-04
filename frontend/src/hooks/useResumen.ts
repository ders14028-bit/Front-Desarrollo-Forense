import { obtenerResumenGerencial } from "../api/cliente";
import type { ResumenGerencial } from "../types/metricas";
import { useRefresco, type ResultadoRefresco } from "./useRefresco";

export type ResultadoResumen = ResultadoRefresco<ResumenGerencial>;

/** Resumen gerencial, refrescado cada 30 s solo mientras `activo` (la Vista gerencial está a la vista). */
export const useResumen = (activo: boolean): ResultadoResumen => useRefresco(obtenerResumenGerencial, activo);
