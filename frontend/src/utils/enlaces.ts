import { THEHIVE_RUTA_ALERTA, THEHIVE_RUTA_CASO, THEHIVE_URL_BASE } from "../config";

/**
 * Enlaces "Abrir en TheHive". Solo sirven para abrir la página de TheHive en otra pestaña: el frontend
 * nunca llama a TheHive. PENDIENTE: confirmar el formato exacto de las rutas (ver `config/`).
 */

const unir = (base: string, ruta: string) => `${base.replace(/\/+$/, "")}${ruta}`;

export const urlAlertaTheHive = (id: string, base: string = THEHIVE_URL_BASE): string =>
  unir(base, THEHIVE_RUTA_ALERTA(encodeURIComponent(id)));

export const urlCasoTheHive = (id: string, base: string = THEHIVE_URL_BASE): string =>
  unir(base, THEHIVE_RUTA_CASO(encodeURIComponent(id)));
