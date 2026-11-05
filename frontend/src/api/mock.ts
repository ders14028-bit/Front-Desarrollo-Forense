import { generarMocks } from "../mocks";
import { construirDetalle, construirListaAlertas } from "../utils/alertas";
import { calcularResumen } from "../utils/metricas";
import { ErrorApi, type FuenteDatos } from "./tipos";

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
 * Fuente de datos falsa. Los datos crudos se generan UNA vez, al crearla; el resumen, la lista y
 * el detalle se calculan con la hora actual en CADA llamada, así las antigüedades avanzan como
 * con datos reales.
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
      const resumen = calcularResumen(alertas, casos, tareas, ahora());
      return { ...resumen, thehive: { respondio: true, consultadoEn: resumen.generadoEn } };
    },

    async listarAlertas() {
      await simularRed();
      const lista = construirListaAlertas(alertas, casos, ahora());
      return { ...lista, thehive: { respondio: true, consultadoEn: lista.generadoEn } };
    },

    async obtenerDetalleAlerta(id) {
      await simularRed();
      const detalle = construirDetalle(id, alertas, casos, tareas, ahora());
      if (!detalle) throw new ErrorApi("No se encontró la alerta solicitada.");
      return detalle;
    },
  };
}
