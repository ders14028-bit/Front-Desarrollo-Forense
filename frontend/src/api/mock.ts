import { generarMocks } from "../mocks";
import { calcularResumen, tipoAmenaza } from "../utils/metricas";
import { ErrorApi, TIPO_SIN_CLASIFICAR, type FiltrosAlertas, type FuenteDatos } from "./tipos";

/** Semilla fija: los mocks salen siempre con la misma forma. */
const SEMILLA = 2026;

interface OpcionesMock {
  /** Reloj; por defecto `Date.now`. Se inyecta en las pruebas. */
  ahora?: () => number;
  /** Demora simulada de la "red", en ms. */
  demoraMs?: number;
  /** Si es true, toda llamada falla (para probar el estado de error de la interfaz). */
  falla?: boolean;
  semilla?: number;
}

const esperar = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * Fuente de datos falsa. Los datos crudos se generan UNA vez, al crearla; el resumen se calcula
 * con la hora actual en CADA llamada, así las antigüedades avanzan como con datos reales.
 */
export function crearFuenteMock(opciones: OpcionesMock = {}): FuenteDatos {
  const ahora = opciones.ahora ?? Date.now;
  const demoraMs = opciones.demoraMs ?? 300;
  const falla = opciones.falla ?? import.meta.env.VITE_MOCK_ERROR === "true";
  const { alertas, casos, tareas } = generarMocks(ahora(), opciones.semilla ?? SEMILLA);

  async function simularRed() {
    await esperar(demoraMs);
    if (falla) throw new ErrorApi("Error simulado (VITE_MOCK_ERROR=true): no se pudieron obtener los datos.");
  }

  return {
    async obtenerResumenGerencial() {
      await simularRed();
      return calcularResumen(alertas, casos, tareas, ahora());
    },

    async listarAlertas(filtros: FiltrosAlertas = {}) {
      await simularRed();
      const resultado = alertas
        .filter((a) => filtros.estado === undefined || a.status === filtros.estado)
        .filter((a) => filtros.severidad === undefined || a.severity === filtros.severidad)
        .filter((a) => filtros.origen === undefined || a.source === filtros.origen)
        .filter((a) => filtros.tipo === undefined || (tipoAmenaza(a) ?? TIPO_SIN_CLASIFICAR) === filtros.tipo)
        .sort((x, y) => y._createdAt - x._createdAt);
      return filtros.limite === undefined ? resultado : resultado.slice(0, filtros.limite);
    },
  };
}
