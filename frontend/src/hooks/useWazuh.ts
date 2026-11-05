import { obtenerMetricasWazuh } from "../api/cliente";
import type { MetricasWazuh } from "../types/wazuh";
import { useRefresco, type ResultadoRefresco } from "./useRefresco";

export type ResultadoWazuh = ResultadoRefresco<MetricasWazuh>;

/** Métricas de Wazuh, refrescadas cada 30 s solo mientras `activo` (la Vista gerencial está a la vista). */
export const useWazuh = (activo: boolean): ResultadoWazuh => useRefresco(obtenerMetricasWazuh, activo);
