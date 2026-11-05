import type { EstadoTheHive } from "../../types/metricas";
import { formatoHora } from "../../utils/fechas";

export type ClaveEstado = "error" | "sin-thehive" | "simulado" | "conectando" | "conectado";

export interface EstadoConexion {
  clave: ClaveEstado;
  texto: string;
}

interface Entrada {
  /** El backend no respondió en el último intento (red, tiempo agotado o error HTTP). */
  hayError: boolean;
  /** La app usa datos simulados. */
  modoMock: boolean;
  /** Ya se recibió al menos una respuesta correcta. */
  tieneDatos: boolean;
  /** Lo que el backend dice de TheHive; null/ausente = no lo dice (mock o backend anterior): se asume que respondió. */
  thehive?: EstadoTheHive | null;
  /** Instante (ms) en que se calcularon los datos que se están viendo. */
  datosDe?: number | null;
}

/**
 * Prioridad, de mayor a menor:
 *  1. el backend no responde            → "Sin conexión con el servidor"
 *  2. el backend responde pero TheHive no (`thehive.respondio = false`) → "TheHive no responde · datos de las HH:MM"
 *  3. datos simulados                   → "Datos simulados"
 *  4. todavía no llegó nada             → "Conectando…" (no se afirma "TheHive conectado" sin haberlo comprobado)
 *  5. todo bien                         → "TheHive conectado"
 */
export function estadoConexion({ hayError, modoMock, tieneDatos, thehive, datosDe }: Entrada): EstadoConexion {
  if (hayError) return { clave: "error", texto: "Sin conexión con el servidor" };
  if (thehive && !thehive.respondio) {
    const hora = datosDe === null || datosDe === undefined ? "—" : formatoHora(datosDe);
    return { clave: "sin-thehive", texto: `TheHive no responde · datos de las ${hora}` };
  }
  if (modoMock) return { clave: "simulado", texto: "Datos simulados" };
  if (!tieneDatos) return { clave: "conectando", texto: "Conectando…" };
  return { clave: "conectado", texto: "TheHive conectado" };
}
