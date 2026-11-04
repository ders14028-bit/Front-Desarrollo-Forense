import { listarAlertas } from "../api/cliente";
import type { ListaAlertas } from "../types/listaAlertas";
import { useRefresco, type ResultadoRefresco } from "./useRefresco";

export type ResultadoAlertas = ResultadoRefresco<ListaAlertas>;

/** Lista de alertas (30 días), refrescada cada 30 s solo mientras `activo` (la Vista unificada está a la vista). */
export const useAlertas = (activo: boolean): ResultadoAlertas => useRefresco(listarAlertas, activo);
