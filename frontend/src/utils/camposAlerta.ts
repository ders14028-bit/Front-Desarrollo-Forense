import type { Alerta } from "../types/alerta";
import { formatoFechaHora } from "./fechas";

/** Todos los campos de una alerta de TheHive, listos para mostrarse (fechas en hora de Bogotá). */

export type ValorCampo =
  | { tipo: "texto"; texto: string }
  /** Etiquetas (`tags`), que se muestran como chips. Vacío = sin etiquetas. */
  | { tipo: "etiquetas"; etiquetas: string[] }
  /** Estructuras (`customFields`, `extraData`) en JSON legible. */
  | { tipo: "json"; texto: string };

export interface CampoAlerta {
  /** Nombre del campo en TheHive (`_createdAt`). */
  clave: string;
  /** Nombre en español. */
  etiqueta: string;
  valor: ValorCampo;
}

const SIN_VALOR = "—";

const texto = (valor: string | number | undefined | null): ValorCampo => ({
  tipo: "texto",
  texto: valor === undefined || valor === null || valor === "" ? SIN_VALOR : String(valor),
});
const fecha = (ms: number): ValorCampo => ({ tipo: "texto", texto: formatoFechaHora(ms) });
const siNo = (valor: boolean): ValorCampo => ({ tipo: "texto", texto: valor ? "Sí" : "No" });

function json(valor: unknown): ValorCampo {
  const vacio = Array.isArray(valor) ? valor.length === 0 : valor === null || typeof valor !== "object" || Object.keys(valor).length === 0;
  return vacio ? { tipo: "texto", texto: SIN_VALOR } : { tipo: "json", texto: JSON.stringify(valor, null, 2) };
}

export function camposDeAlerta(a: Alerta): CampoAlerta[] {
  const campo = (clave: string, etiqueta: string, valor: ValorCampo): CampoAlerta => ({ clave, etiqueta, valor });

  return [
    campo("_id", "Identificador", texto(a._id)),
    campo("_type", "Tipo de objeto", texto(a._type)),
    campo("_createdBy", "Creada por", texto(a._createdBy)),
    campo("_createdAt", "Creada", fecha(a._createdAt)),
    campo("type", "Tipo", texto(a.type)),
    campo("source", "Origen", texto(a.source)),
    campo("sourceRef", "Referencia de origen", texto(a.sourceRef)),
    campo("title", "Título", texto(a.title)),
    campo("description", "Descripción", texto(a.description)),
    campo("severity", "Severidad", texto(a.severity)),
    campo("severityLabel", "Etiqueta de severidad", texto(a.severityLabel)),
    campo("date", "Fecha del evento", fecha(a.date)),
    campo("tags", "Etiquetas", { tipo: "etiquetas", etiquetas: a.tags }),
    campo("tlp", "TLP", texto(a.tlp)),
    campo("tlpLabel", "Etiqueta de TLP", texto(a.tlpLabel)),
    campo("pap", "PAP", texto(a.pap)),
    campo("papLabel", "Etiqueta de PAP", texto(a.papLabel)),
    campo("follow", "Seguida", siNo(a.follow)),
    campo("customFields", "Campos personalizados", json(a.customFields)),
    campo("observableCount", "Observables", texto(a.observableCount)),
    campo("status", "Estado", texto(a.status)),
    campo("stage", "Etapa", texto(a.stage)),
    campo("extraData", "Datos adicionales", json(a.extraData)),
    campo("newDate", "Fecha de entrada en estado nuevo", fecha(a.newDate)),
    campo("timeToDetect", "Tiempo de detección", texto(a.timeToDetect)),
    campo("caseId", "Caso", texto(a.caseId)),
  ];
}
