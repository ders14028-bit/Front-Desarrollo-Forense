import type { EstadoTheHive } from "./metricas";

/**
 * Respuesta de `GET /api/dashboard/wazuh` (ver docs/contrato-api.md): métricas de las alertas de Wazuh de los últimos
 * días, calculadas por el backend desde el bloque JSON de cada alerta.
 *
 * Mientras `estado` es "cargando" (carga inicial del backend) TODAS las métricas son null: nunca ceros que parezcan datos.
 */

export type MarcoCumplimiento = "pci_dss" | "nist_800_53" | "gdpr" | "hipaa" | "tsc";

/** @param clave Clave ASCII en español de la táctica MITRE (por ejemplo `acceso-a-credenciales`). */
export interface ConteoTactica {
  clave: string;
  cantidad: number;
}

export interface ConteoTecnica {
  id: string;
  /** null si Wazuh no mandó el nombre alineado con el id. */
  nombre: string | null;
  cantidad: number;
}

export interface Requisito {
  /** Control del marco, por ejemplo "10.2.5". */
  requisito: string;
  cantidad: number;
}

export interface MarcoAfectado {
  marco: MarcoCumplimiento;
  /** Alertas que tocan al menos un control de este marco. */
  alertas: number;
  /** Los 3 requisitos más afectados, de mayor a menor. */
  requisitos: Requisito[];
}

export interface ConteoIp {
  ip: string;
  cantidad: number;
}

export interface ConteoUsuario {
  usuario: string;
  cantidad: number;
}

export interface ConteoRegla {
  id: string;
  descripcion: string | null;
  /** Nivel original de Wazuh (0–15). */
  nivel: number | null;
  cantidad: number;
}

export interface ConteoAgente {
  nombre: string;
  cantidad: number;
}

export interface ConteoNivel {
  nivel: number;
  cantidad: number;
}

export interface MetricasWazuh {
  generadoEn: number;
  estado: "cargando" | "listo";
  /** Porcentaje (1–99) mientras carga; null si todavía no se sabe. 100 cuando está listo. */
  progreso: number | null;
  thehive?: EstadoTheHive;
  /** Tamaño de la ventana, en días. */
  dias: number;
  /** Primer día de la ventana (YYYY-MM-DD, Bogotá). */
  desde: string;
  /** Alertas de la ventana con bloque legible; null mientras carga. */
  alertasAnalizadas: number | null;
  /** Alertas de la ventana sin bloque legible (cuentan, pero no aportan a las métricas); null mientras carga. */
  sinBloque: number | null;
  mitre: { tacticas: ConteoTactica[]; tecnicas: ConteoTecnica[] } | null;
  /** Siempre los cinco marcos, en orden. */
  cumplimiento: MarcoAfectado[] | null;
  topIps: ConteoIp[] | null;
  topUsuarios: ConteoUsuario[] | null;
  topReglas: ConteoRegla[] | null;
  agentes: ConteoAgente[] | null;
  porNivel: ConteoNivel[] | null;
}
