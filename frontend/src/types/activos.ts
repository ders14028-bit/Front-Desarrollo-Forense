import type { EstadoTheHive } from "./metricas";

/**
 * Respuesta de `GET /api/dashboard/activos` (ver docs/contrato-api.md): qué activos y qué componentes se atacaron en la
 * ventana de Wazuh. Sin IPs de origen ni usuarios.
 *
 * Mientras `estado` es "cargando", `activos` y `alertasSinActivo` son null: nunca una lista vacía que parezca
 * "no hay ataques".
 */

/** Tipos de servidor del inventario (application.yml). Puede llegar uno nuevo: se muestra tal cual. */
export type TipoActivo = "monitoreo" | "base-de-datos" | "web" | "estacion" | "windows" | "sin-clasificar" | (string & {});

export interface ConteoComponente {
  /** Clave del componente (base-de-datos, servidor-web, ssh…, "otros"). */
  clave: string;
  alertas: number;
  /** Severidad 3 o 4 de TheHive. */
  altasYCriticas: number;
}

export interface Activo {
  /** Id de agente de Wazuh; null si solo se reconoció por nombre. */
  agenteId: string | null;
  /** Nombre técnico del agente. */
  equipo: string | null;
  nombreVisible: string;
  tipo: TipoActivo;
  sistema: "Linux" | "Windows" | (string & {});
  alertas: number;
  altasYCriticas: number;
  /** El componente con más alertas; null si el activo no tiene alertas. */
  componentePrincipal: string | null;
  /** De mayor a menor; suman `alertas`. */
  componentes: ConteoComponente[];
}

export interface ActivosAtacados {
  generadoEn: number;
  estado: "cargando" | "listo";
  /** 1–99 mientras carga (null si aún no se sabe); 100 listo. */
  progreso: number | null;
  ventanaDias: number;
  /** Primer día de la ventana (YYYY-MM-DD, Bogotá). */
  desde: string;
  thehive?: EstadoTheHive;
  /** De más a menos alertas; los del inventario salen aunque no tengan alertas. null mientras carga. */
  activos: Activo[] | null;
  /** Alertas sin agente (no se pueden asignar a un activo); null mientras carga. */
  alertasSinActivo: number | null;
}
