import type { Alerta } from "../types/alerta";
import type { ResumenGerencial } from "../types/metricas";
import { ErrorApi, type FiltrosAlertas, type FuenteDatos } from "./tipos";

interface OpcionesHttp {
  timeoutMs?: number;
  /** Se inyecta en las pruebas; por defecto el `fetch` del navegador. */
  fetchFn?: typeof fetch;
}

const TIMEOUT_POR_DEFECTO_MS = 10_000;

function mensajePorEstado(estado: number): string {
  if (estado === 401 || estado === 403) return `El servidor rechazó la solicitud por falta de autorización (${estado}).`;
  if (estado === 404) return "El servicio solicitado no existe en el servidor (404).";
  if (estado >= 500) return `El servidor tuvo un error interno (${estado}). Intenta de nuevo en unos minutos.`;
  return `El servidor respondió con un error inesperado (${estado}).`;
}

/**
 * Cliente del backend Spring Boot. Solo habla con el backend (nunca con TheHive) y no envía
 * ninguna credencial: la API key de TheHive vive únicamente en el backend.
 */
export function crearFuenteHttp(baseUrl: string, opciones: OpcionesHttp = {}): FuenteDatos {
  const base = baseUrl.replace(/\/+$/, "");
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;
  const fetchFn = opciones.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function pedir(ruta: string, parametros?: URLSearchParams): Promise<unknown> {
    const consulta = parametros && parametros.size > 0 ? `?${parametros.toString()}` : "";
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      let respuesta: Response;
      try {
        respuesta = await fetchFn(`${base}${ruta}${consulta}`, {
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

      if (!respuesta.ok) throw new ErrorApi(mensajePorEstado(respuesta.status));

      try {
        return await respuesta.json();
      } catch {
        throw new ErrorApi("La respuesta del servidor no tiene el formato esperado.");
      }
    } finally {
      clearTimeout(temporizador);
    }
  }

  return {
    async obtenerResumenGerencial() {
      const datos = await pedir("/api/dashboard/resumen");
      const resumen = datos as Partial<ResumenGerencial> | null;
      if (typeof resumen !== "object" || resumen === null || !resumen.alertas || !resumen.casos) {
        throw new ErrorApi("La respuesta del servidor no tiene el formato esperado.");
      }
      return resumen as ResumenGerencial;
    },

    async listarAlertas(filtros: FiltrosAlertas = {}) {
      const parametros = new URLSearchParams();
      for (const [clave, valor] of Object.entries(filtros)) {
        if (valor !== undefined) parametros.set(clave, String(valor));
      }
      const datos = await pedir("/api/dashboard/alertas", parametros);
      if (!Array.isArray(datos)) throw new ErrorApi("La respuesta del servidor no tiene el formato esperado.");
      return datos as Alerta[];
    },
  };
}
