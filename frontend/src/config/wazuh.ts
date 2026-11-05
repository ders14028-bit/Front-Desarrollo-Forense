import type { MarcoCumplimiento } from "../types/wazuh";

/**
 * Textos fijos de la sección "Amenazas y cumplimiento". Son explicaciones de qué significa cada táctica o marco para
 * el negocio, escritas para un gerente; no son datos: las cifras siempre salen del backend.
 */

/** Días de la ventana mientras el backend todavía no ha dicho cuántos son (la ventana real viene en la respuesta). */
export const DIAS_WAZUH = 7;

/** Cuántos elementos muestran las listas pequeñas (IPs, usuarios, reglas) aunque el backend mande más. */
export const TOP_WAZUH = 5;

/**
 * Qué significa cada táctica de MITRE ATT&CK para el negocio. La clave es la que manda el backend (ASCII, en español).
 * Una táctica que no esté aquí se muestra sin frase: no se inventa una explicación.
 */
export const FRASES_TACTICAS: Record<string, string> = {
  reconocimiento: "Alguien investiga la red y los equipos para preparar un ataque.",
  "desarrollo-de-recursos": "El atacante prepara herramientas, cuentas o servidores para usarlos contra la organización.",
  "acceso-inicial": "Intentos de entrar por primera vez a un equipo o servicio de la organización.",
  ejecucion: "Programas o comandos sospechosos ejecutándose en nuestros equipos.",
  persistencia: "Maneras de quedarse en un equipo para volver a entrar aunque se reinicie o se cambie la clave.",
  "escalada-de-privilegios": "Intentos de conseguir más permisos de los que una cuenta debería tener.",
  "evasion-de-defensas": "Intentos de esconderse o apagar las protecciones para pasar desapercibido.",
  "acceso-a-credenciales": "Intentos de adivinar o robar contraseñas.",
  descubrimiento: "Alguien explora el equipo o la red por dentro para ver qué puede alcanzar.",
  "movimiento-lateral": "Saltos de un equipo a otro dentro de la red.",
  recoleccion: "Reunir información de valor antes de llevársela.",
  "comando-y-control": "Equipos comunicándose con un servidor del atacante para recibir órdenes.",
  exfiltracion: "Salida de información de la organización hacia afuera.",
  impacto: "Daño directo: borrar, cifrar o dejar fuera de servicio sistemas o datos.",
};

/** Nombre con el que se muestra cada marco de cumplimiento. */
export const NOMBRES_MARCOS: Record<MarcoCumplimiento, string> = {
  pci_dss: "PCI DSS",
  nist_800_53: "NIST 800-53",
  gdpr: "GDPR",
  hipaa: "HIPAA",
  tsc: "TSC",
};

/** Para qué sirve cada marco, en una línea. */
export const DESCRIPCION_MARCOS: Record<MarcoCumplimiento, string> = {
  pci_dss: "Seguridad de los datos de tarjetas de pago",
  nist_800_53: "Controles de seguridad de los sistemas de información",
  gdpr: "Protección de datos personales (Unión Europea)",
  hipaa: "Protección de información de salud (Estados Unidos)",
  tsc: "Criterios de confianza de servicios (SOC 2)",
};

/**
 * Traducción al español de las reglas de Wazuh más frecuentes, por id de regla. Wazuh manda la descripción en inglés; si
 * la regla está aquí se muestra esta traducción y el original queda como texto secundario. Las reglas que no estén se
 * muestran en inglés, tal como las manda Wazuh (no se traduce a ciegas).
 */
export const TRADUCCIONES_REGLAS: Record<string, string> = {
  "5501": "PAM: sesión de inicio abierta",
  "5502": "PAM: sesión de inicio cerrada",
  "5503": "PAM: falló el inicio de sesión de un usuario",
  "5551": "PAM: varios inicios de sesión fallidos en poco tiempo",
  "5710": "sshd: intento de inicio de sesión con un usuario que no existe",
  "5712": "sshd: ataque de fuerza bruta para entrar al sistema (usuario que no existe)",
  "5760": "sshd: falló la autenticación",
  "5763": "sshd: ataque de fuerza bruta para entrar al sistema (falló la autenticación)",
};

/**
 * Traducciones por el texto original en inglés, para las reglas de las que no se ha confirmado el id. Se compara el
 * texto completo, sin distinguir mayúsculas ni el punto final.
 */
export const TRADUCCIONES_POR_TEXTO: Record<string, string> = {
  "executable file dropped in folder commonly used by malware": "Archivo ejecutable creado en una carpeta que el malware suele usar",
};
