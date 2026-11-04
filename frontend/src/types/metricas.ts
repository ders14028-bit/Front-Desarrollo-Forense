import type { Severidad } from "./alerta";

/**
 * Resumen gerencial: forma que devolverá el backend (ya agregado).
 * Duraciones en milisegundos. `null` = no hay datos para calcularlo (la interfaz muestra "—").
 * Los días (`dia`) son fechas `YYYY-MM-DD` en America/Bogota.
 */

export interface ConteoPorTipo {
  /** Valor de la etiqueta `escenario:<tipo>`, o "Sin clasificar". */
  tipo: string;
  cantidad: number;
}

export interface ConteoPorOrigen {
  /** Campo `source` de la alerta. */
  origen: string;
  cantidad: number;
}

export interface ConteoPorDia {
  dia: string;
  cantidad: number;
}

export interface ConteoPorSeveridad {
  severidad: Severidad;
  cantidad: number;
}

export interface ResumenAlertas {
  recibidas: number;
  sinAtender: number;
  /** Severidad 3 o 4. */
  criticasYAltas: number;
  /** Antigüedad de la alerta sin atender más antigua; null si no hay sin atender. */
  masAntiguaSinAtenderMs: number | null;
  /** Antigüedad promedio de las sin atender; null si no hay sin atender. */
  antiguedadPromedioSinAtenderMs: number | null;
  /** Sin atender cuya antigüedad supera el SLA de su severidad. */
  fueraDeSla: number;
  porSeveridad: ConteoPorSeveridad[];
  porTipoAmenaza: ConteoPorTipo[];
  porOrigen: ConteoPorOrigen[];
  porDia: ConteoPorDia[];
}

export interface AlertasConvertidas {
  convertidas: number;
  total: number;
  /** 0–100; null si no hay alertas. */
  porcentaje: number | null;
}

export interface ResumenCasos {
  reportados: number;
  abiertos: number;
  enProgreso: number;
  cerrados: number;
  alertasConvertidas: AlertasConvertidas;
  contencionesHechas: number;
  confirmadosYCerrados: number;
  /** Promedio (cierre − creación) de casos cerrados; null si no hay cerrados. */
  tiempoPromedioCierreMs: number | null;
}

export interface ResumenGerencial {
  /** Instante (ms) en que se generó el resumen. */
  generadoEn: number;
  /** true si las cifras incluyen datos de prueba ("Datos de laboratorio"). */
  datosDeLaboratorio: boolean;
  alertas: ResumenAlertas;
  casos: ResumenCasos;
}
