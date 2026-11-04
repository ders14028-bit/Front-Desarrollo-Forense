import type { Alerta, EstadoAlerta, Severidad } from "../types/alerta";
import type { ResumenGerencial } from "../types/metricas";

/** Filtros opcionales de `listarAlertas`. Todos se combinan con "y". */
export interface FiltrosAlertas {
  estado?: EstadoAlerta;
  severidad?: Severidad;
  /** Campo `source` de la alerta. */
  origen?: string;
  /** Tipo de amenaza (valor de `escenario:<tipo>`) o "Sin clasificar". */
  tipo?: string;
  /** Máximo de alertas a devolver (las más recientes primero). */
  limite?: number;
}

/** Contrato único que cumplen tanto el mock como el backend real. */
export interface FuenteDatos {
  obtenerResumenGerencial(): Promise<ResumenGerencial>;
  listarAlertas(filtros?: FiltrosAlertas): Promise<Alerta[]>;
}

/** Error con un mensaje en español listo para mostrar al usuario. */
export class ErrorApi extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

export const TIPO_SIN_CLASIFICAR = "Sin clasificar";
