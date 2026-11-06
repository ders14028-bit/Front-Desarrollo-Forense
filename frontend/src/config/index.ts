import type { Severidad } from "../types/alerta";

/** SLA de atención por severidad, en minutos. */
export const SLA_MINUTOS: Record<Severidad, number> = {
  4: 15, // crítica
  3: 30, // alta
  2: 120, // media
  1: 240, // baja
};

// PENDIENTE: confirmar estos dos nombres con el grupo de TheHive.
/** Grupo de las tareas que cuentan como contención. */
export const GRUPO_CONTENCION = "Contención";
/** Estado de un caso cerrado como incidente confirmado. */
export const ESTADO_CONFIRMADO = "TruePositive";
/** Estado de un caso cerrado como falso positivo (cuenta como cerrado, no como confirmado). */
export const ESTADO_FALSO_POSITIVO = "FalsePositive";

/**
 * `type` de las alertas de prueba. Es el mismo criterio que usa el backend para excluirlas: una alerta es
 * simulación SOLO si su `type` es este (la etiqueta "simulacion" no cuenta). Si la respuesta trae alguna,
 * se muestra el aviso "Datos de laboratorio".
 */
export const TIPO_SIMULACION = "simulacion";

/**
 * Nombres legibles de escenarios (etiqueta `escenario:<clave>`) y herramientas (`source`) cuyo
 * nombre no sale de una regla simple. Lo que no esté aquí se formatea solo ("wazuh" → "Wazuh").
 */
export const NOMBRES_LEGIBLES: Record<string, string> = {
  auditd: "AuditD",
  "fuerza-bruta": "Fuerza bruta",
  phishing: "Phishing",
  malware: "Malware",
  vulnerabilidad: "Vulnerabilidad",
  escalamiento: "Escalamiento",
  correlacion: "Correlación",
  "inteligencia-misp": "Inteligencia MISP",
  // Tácticas MITRE ATT&CK: el backend manda la clave en ASCII y aquí se le ponen las tildes.
  reconocimiento: "Reconocimiento",
  "desarrollo-de-recursos": "Desarrollo de recursos",
  "acceso-inicial": "Acceso inicial",
  ejecucion: "Ejecución",
  persistencia: "Persistencia",
  "escalada-de-privilegios": "Escalada de privilegios",
  "evasion-de-defensas": "Evasión de defensas",
  "acceso-a-credenciales": "Acceso a credenciales",
  descubrimiento: "Descubrimiento",
  "movimiento-lateral": "Movimiento lateral",
  recoleccion: "Recolección",
  "comando-y-control": "Comando y control",
  exfiltracion: "Exfiltración",
  impacto: "Impacto",
};

/** Intervalo de refresco automático. */
export const REFRESCO_MS = 30_000;

/** Zona horaria para agrupar por día y mostrar horas. */
export const ZONA_HORARIA = "America/Bogota";
