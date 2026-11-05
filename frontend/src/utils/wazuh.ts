import { FRASES_TACTICAS, NOMBRES_MARCOS, TOP_WAZUH, TRADUCCIONES_POR_TEXTO, TRADUCCIONES_REGLAS } from "../config/wazuh";
import type { ConteoTactica, MarcoAfectado } from "../types/wazuh";
import { nombreLegible } from "./etiquetas";

/** Lógica pura de la sección "Amenazas y cumplimiento": prepara lo que el backend manda para mostrarlo. */

export interface FilaTactica {
  clave: string;
  /** Nombre en español con tildes ("Evasión de defensas"). */
  etiqueta: string;
  cantidad: number;
  /** Qué significa para el negocio; undefined si la táctica no está en `config/wazuh.ts` (no se inventa). */
  frase: string | undefined;
}

/** Las tácticas, de mayor a menor, con su nombre legible y su frase de negocio. */
export function filasTacticas(tacticas: ConteoTactica[]): FilaTactica[] {
  return [...tacticas]
    .sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave, "es"))
    .map((t) => ({ clave: t.clave, etiqueta: nombreLegible(t.clave), cantidad: t.cantidad, frase: FRASES_TACTICAS[t.clave] }));
}

export const nombreMarco = (marco: string): string => (NOMBRES_MARCOS as Record<string, string | undefined>)[marco] ?? marco.toUpperCase();

/** Los marcos en el orden en que los manda el backend, con los que no tienen alertas al final. */
export function marcosOrdenados(marcos: MarcoAfectado[]): MarcoAfectado[] {
  return [...marcos].sort((a, b) => (b.alertas > 0 ? 1 : 0) - (a.alertas > 0 ? 1 : 0));
}

/** Los primeros `TOP_WAZUH` de una lista que ya viene ordenada. */
export const primeros = <T>(lista: T[], n = TOP_WAZUH): T[] => lista.slice(0, n);

/**
 * Texto de la carga inicial. El porcentaje solo aparece cuando ya es real (1–99): nunca "0 %" ni "100 %" mientras se
 * carga, y sin porcentaje si el backend todavía no sabe cuánto lleva.
 */
export function textoCargaWazuh(progreso: number | null): string {
  if (progreso === null || progreso < 1) return "Cargando datos de Wazuh…";
  return `Cargando datos de Wazuh… ${Math.min(99, Math.floor(progreso))} %`;
}

export interface ReglaTraducida {
  /** Lo que se muestra como principal: la traducción si la hay; si no, el original en inglés. */
  texto: string;
  /** El original en inglés cuando `texto` es una traducción (texto secundario); null si no hay traducción. */
  original: string | null;
}

const normalizar = (texto: string) => texto.trim().replace(/\.+$/, "").replace(/\s+/g, " ").toLowerCase();

/**
 * Descripción de una regla de Wazuh para mostrar. Con traducción: la traducción y, aparte, el original en inglés. Sin
 * traducción: el original, que es lo que manda Wazuh. Primero se busca por id de regla y luego por el texto exacto.
 */
export function describirRegla(id: string, descripcion: string | null): ReglaTraducida {
  const original = descripcion?.trim() ? descripcion.trim() : null;
  const traduccion = TRADUCCIONES_REGLAS[id] ?? (original ? TRADUCCIONES_POR_TEXTO[normalizar(original)] : undefined);
  if (traduccion) return { texto: traduccion, original };
  return { texto: original ?? "Sin descripción", original: null };
}
