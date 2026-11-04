import type { DetalleAlerta, ListaAlertas } from "../types/listaAlertas";
import type { ResumenGerencial } from "../types/metricas";

/** Contrato único que cumplen tanto el mock como el backend real (ver docs/contrato-api.md). */
export interface FuenteDatos {
  obtenerResumenGerencial(): Promise<ResumenGerencial>;
  /** Últimos 30 días (tope 1000), sin filtros: filtrar, ordenar y paginar es trabajo del frontend. */
  listarAlertas(): Promise<ListaAlertas>;
  /** Alerta completa con su caso y tareas. Rechaza con un ErrorApi si la alerta no existe. */
  obtenerDetalleAlerta(id: string): Promise<DetalleAlerta>;
}

/** Error con un mensaje en español listo para mostrar al usuario. */
export class ErrorApi extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}
