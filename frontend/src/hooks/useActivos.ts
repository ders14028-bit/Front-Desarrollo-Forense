import { obtenerActivos } from "../api/cliente";
import type { ActivosAtacados } from "../types/activos";
import { useRefresco, type ResultadoRefresco } from "./useRefresco";

export type ResultadoActivos = ResultadoRefresco<ActivosAtacados>;

/** Activos atacados, con su propio refresco de 30 s, solo mientras `activo`. */
export const useActivos = (activo: boolean): ResultadoActivos => useRefresco(obtenerActivos, activo);
