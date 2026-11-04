import {
  conFiltros,
  conOrden,
  conPagina,
  ESTADO_TABLA_INICIAL,
  FILTROS_VACIOS,
  type EstadoTabla,
  type FiltrosTabla,
  type Orden,
} from "./utils/tabla";

/**
 * Estado que vive en App.tsx: la pestaña activa y el estado de la tabla de alertas (filtros, búsqueda, orden
 * y página). Está AQUÍ y no dentro de la Vista unificada para que sobreviva al cambio de pestaña: al volver,
 * la vista se monta de nuevo con el mismo estado. No se guarda en localStorage ni en la URL.
 *
 * La alerta abierta en el panel de detalle NO forma parte de este estado: el panel es un diálogo modal (deja
 * inerte toda la página, pestañas incluidas), así que no se puede cambiar de pestaña con él abierto.
 */

export type IdPestana = "gerencial" | "unificada";

const NOMBRE_PESTANA: Record<IdPestana, string> = { gerencial: "Vista gerencial", unificada: "Vista unificada" };

/** Título de la pestaña del navegador: cambia con la vista activa. */
export const tituloDelDocumento = (pestana: IdPestana): string => `${NOMBRE_PESTANA[pestana]} · Dashboard SOC`;

export interface EstadoApp {
  pestana: IdPestana;
  tabla: EstadoTabla;
}

export const ESTADO_APP_INICIAL: EstadoApp = { pestana: "gerencial", tabla: ESTADO_TABLA_INICIAL };

export type AccionApp =
  | { tipo: "pestana"; pestana: IdPestana }
  /** Recibe una función que calcula los filtros nuevos a partir de los actuales; vuelve a la página 1. */
  | { tipo: "filtros"; cambio: (actuales: FiltrosTabla) => FiltrosTabla }
  | { tipo: "orden"; orden: Orden }
  | { tipo: "pagina"; pagina: number }
  | { tipo: "limpiar-filtros" };

export function reducirApp(estado: EstadoApp, accion: AccionApp): EstadoApp {
  switch (accion.tipo) {
    case "pestana":
      // Cambiar de pestaña no toca la tabla: la MISMA referencia sigue en el estado.
      return accion.pestana === estado.pestana ? estado : { ...estado, pestana: accion.pestana };

    case "filtros": {
      const nuevos = accion.cambio(estado.tabla.filtros);
      return nuevos === estado.tabla.filtros ? estado : { ...estado, tabla: conFiltros(estado.tabla, nuevos) };
    }

    case "orden":
      return accion.orden === estado.tabla.orden ? estado : { ...estado, tabla: conOrden(estado.tabla, accion.orden) };

    case "pagina": {
      const tabla = conPagina(estado.tabla, accion.pagina);
      return tabla.pagina === estado.tabla.pagina ? estado : { ...estado, tabla };
    }

    case "limpiar-filtros":
      return { ...estado, tabla: conFiltros(estado.tabla, FILTROS_VACIOS) };
  }
}

/** Cada vista refresca SOLO mientras está activa. */
export const refrescaGerencial = (e: EstadoApp) => e.pestana === "gerencial";
export const refrescaUnificada = (e: EstadoApp) => e.pestana === "unificada";
