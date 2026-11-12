/**
 * Textos de la sección "Activos atacados". Las claves son las que manda el backend (application.yml,
 * `dashboard.activos`). Una clave que no esté aquí se muestra tal cual: no se inventa un nombre.
 */

/** Nombre en español de cada componente atacado. */
export const NOMBRES_COMPONENTES: Record<string, string> = {
  "base-de-datos": "Base de datos",
  "servidor-web": "Servidor web",
  ssh: "Acceso remoto (SSH)",
  "inicio-sesion-windows": "Inicio de sesión de Windows",
  "procesos-windows": "Procesos de Windows (Sysmon)",
  "sistema-windows": "Sistema de Windows",
  "cuentas-permisos": "Cuentas y permisos",
  auditoria: "Auditoría del sistema",
  vulnerabilidades: "Vulnerabilidades y software",
  integridad: "Integridad del sistema",
  "monitoreo-wazuh": "Monitoreo (Wazuh)",
  otros: "Otros",
};

/** Componente que agrupa lo que no coincide con ninguno: va al final y en gris. */
export const COMPONENTE_OTROS = "otros";

/** Nombre de cada tipo de servidor, en el orden en que se muestran las tarjetas y los botones. */
export const NOMBRES_TIPOS: Record<string, string> = {
  "base-de-datos": "Base de datos",
  web: "Web",
  windows: "Windows",
  estacion: "Estación de trabajo",
  monitoreo: "Monitoreo",
  "sin-clasificar": "Sin clasificar",
};

export const ORDEN_TIPOS: string[] = Object.keys(NOMBRES_TIPOS);
