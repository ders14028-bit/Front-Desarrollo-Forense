import type { DetalleAlerta, ListaAlertas } from "../types/listaAlertas";
import type { ResumenGerencial } from "../types/metricas";
import { ErrorApi, type FuenteDatos } from "./tipos";

interface OpcionesHttp {
  timeoutMs?: number;
  /** Se inyecta en las pruebas; por defecto el `fetch` del navegador. */
  fetchFn?: typeof fetch;
}

const TIMEOUT_POR_DEFECTO_MS = 10_000;
const FORMATO_INESPERADO = "La respuesta del servidor no tiene el formato esperado.";

function mensajePorEstado(estado: number, mensaje404: string): string {
  if (estado === 401 || estado === 403) return `El servidor rechazó la solicitud por falta de autorización (${estado}).`;
  if (estado === 404) return mensaje404;
  if (estado >= 500) return `El servidor tuvo un error interno (${estado}). Intenta de nuevo en unos minutos.`;
  return `El servidor respondió con un error inesperado (${estado}).`;
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Cliente del backend Spring Boot. Solo habla con el backend (nunca con TheHive) y no envía
 * ninguna credencial: la API key de TheHive vive únicamente en el backend.
 */
export function crearFuenteHttp(baseUrl: string, opciones: OpcionesHttp = {}): FuenteDatos {
  const base = baseUrl.replace(/\/+$/, "");
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;
  const fetchFn = opciones.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function pedir(ruta: string, mensaje404 = "El servicio solicitado no existe en el servidor (404)."): Promise<unknown> {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      let respuesta: Response;
      try {
        respuesta = await fetchFn(`${base}${ruta}`, {
          headers: { Accept: "application/json" },
          signal: controlador.signal,
        });
      } catch {
        if (controlador.signal.aborted) {
          throw new ErrorApi(
            `El servidor no respondió en ${Math.ceil(timeoutMs / 1000)} s. Revisa que el backend esté en ejecución.`,
          );
        }
        throw new ErrorApi("No se pudo conectar con el servidor. Revisa tu conexión y que el backend esté en ejecución.");
      }

      if (!respuesta.ok) throw new ErrorApi(mensajePorEstado(respuesta.status, mensaje404));

      try {
        return await respuesta.json();
      } catch {
        throw new ErrorApi(FORMATO_INESPERADO);
      }
    } finally {
      clearTimeout(temporizador);
    }
  }

  return {
    async obtenerResumenGerencial() {
      const datos = await pedir("/api/dashboard/resumen");
      if (!esObjeto(datos) || !datos.alertas || !datos.casos) throw new ErrorApi(FORMATO_INESPERADO);
      return datos as unknown as ResumenGerencial;
    },

    async listarAlertas() {
      const datos = await pedir("/api/dashboard/alertas");
      if (!esObjeto(datos) || !Array.isArray(datos.alertas)) throw new ErrorApi(FORMATO_INESPERADO);
      return datos as unknown as ListaAlertas;
    },

    async obtenerDetalleAlerta(id) {
      const datos = await pedir(`/api/dashboard/alertas/${encodeURIComponent(id)}`, "No se encontró la alerta solicitada.");
      if (!esObjeto(datos) || !datos.alerta || !datos.fila) throw new ErrorApi(FORMATO_INESPERADO);
      return datos as unknown as DetalleAlerta;
    },
  };
}
