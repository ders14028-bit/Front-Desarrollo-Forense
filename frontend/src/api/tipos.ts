import type { ResumenGerencial } from "../types/metricas";
import type { MetricasWazuh } from "../types/wazuh";

/** Contrato único que cumplen tanto el mock como el backend real (ver docs/contrato-api.md). */
export interface FuenteDatos {
  obtenerResumenGerencial(): Promise<ResumenGerencial>;
  /** Métricas de Wazuh de los últimos días (MITRE, cumplimiento, IPs, usuarios, reglas). Con `estado: "cargando"` todas van en null. */
  obtenerMetricasWazuh(): Promise<MetricasWazuh>;
}

/** Error con un mensaje en español listo para mostrar al usuario. */
export class ErrorApi extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}
