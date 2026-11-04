import { crearFuenteHttp } from "./http";
import { crearFuenteMock } from "./mock";
import { decidirModoMock } from "./modo";
import type { FiltrosAlertas, FuenteDatos } from "./tipos";

export { ErrorApi } from "./tipos";
export type { FiltrosAlertas, FuenteDatos } from "./tipos";

/**
 * true = datos simulados. Con VITE_USE_MOCK definido manda su valor; sin definir, el mock es
 * el valor por defecto solo en desarrollo (en el build de producción se usa el backend).
 * El encabezado lo usa para mostrar "Datos simulados".
 */
export const modoMock: boolean = decidirModoMock(import.meta.env.VITE_USE_MOCK, import.meta.env.PROD);

const fuente: FuenteDatos = modoMock ? crearFuenteMock() : crearFuenteHttp(import.meta.env.VITE_API_URL ?? "");

export const obtenerResumenGerencial = () => fuente.obtenerResumenGerencial();
export const listarAlertas = (filtros?: FiltrosAlertas) => fuente.listarAlertas(filtros);
