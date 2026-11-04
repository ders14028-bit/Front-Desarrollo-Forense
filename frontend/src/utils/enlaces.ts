import { THEHIVE_RUTA_ALERTA, THEHIVE_RUTA_CASO, THEHIVE_URL_BASE } from "../config";

/**
 * Enlaces "Abrir en TheHive". Solo sirven para abrir la página de TheHive en otra pestaña: el frontend nunca llama a
 * TheHive. La base viene de VITE_THEHIVE_URL; sin ella (o si no es una URL http/https válida) no hay enlace (null).
 * PENDIENTE: confirmar el formato exacto de las rutas (ver `config/`).
 */

function baseValida(base: string | null): string | null {
  if (base === null || base.trim() === "") return null;
  try {
    const url = new URL(base.trim());
    // Solo http(s): nunca `javascript:` u otros esquemas.
    return url.protocol === "http:" || url.protocol === "https:" ? base.trim().replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

export const urlAlertaTheHive = (id: string, base: string | null = THEHIVE_URL_BASE): string | null => {
  const raiz = baseValida(base);
  return raiz === null ? null : `${raiz}${THEHIVE_RUTA_ALERTA(encodeURIComponent(id))}`;
};

export const urlCasoTheHive = (id: string, base: string | null = THEHIVE_URL_BASE): string | null => {
  const raiz = baseValida(base);
  return raiz === null ? null : `${raiz}${THEHIVE_RUTA_CASO(encodeURIComponent(id))}`;
};
