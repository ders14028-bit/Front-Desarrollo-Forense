/** Catálogo de alertas ficticias (40 títulos únicos). `escenario: null` = sin etiqueta de escenario. */
export interface EntradaCatalogo {
  escenario: string | null;
  source: string;
  title: string;
}

export const CATALOGO: readonly EntradaCatalogo[] = [
  // fuerza-bruta (6)
  { escenario: "fuerza-bruta", source: "wazuh", title: "Múltiples intentos fallidos de inicio de sesión SSH desde 203.0.113.45" },
  { escenario: "fuerza-bruta", source: "wazuh", title: "Ataque de fuerza bruta contra el servicio RDP del servidor de archivos" },
  { escenario: "fuerza-bruta", source: "auditd", title: "Ráfaga de fallos de autenticación para el usuario root en srvlinuxqa" },
  { escenario: "fuerza-bruta", source: "wazuh", title: "Intentos de acceso masivos al panel de administración de Moodle" },
  { escenario: "fuerza-bruta", source: "auditd", title: "Credential stuffing detectado contra el portal VPN institucional" },
  { escenario: "fuerza-bruta", source: "wazuh", title: "Bloqueo de cuentas por intentos repetidos en Active Directory" },
  // phishing (6)
  { escenario: "phishing", source: "correo", title: "Correo de suplantación con enlace a un falso portal de Office 365" },
  { escenario: "phishing", source: "correo", title: "Campaña de phishing que imita al área de nómina de la universidad" },
  { escenario: "phishing", source: "correo", title: "Adjunto sospechoso en correo dirigido a docentes del programa de Sistemas" },
  { escenario: "phishing", source: "correo", title: "Mensaje con dominio parecido a escuelaing.edu.co que solicita credenciales" },
  { escenario: "phishing", source: "correo", title: "Reporte de phishing enviado por un estudiante de Ingeniería Civil" },
  { escenario: "phishing", source: "correo", title: "Correo con código QR malicioso reportado por la mesa de ayuda" },
  // malware (5)
  { escenario: "malware", source: "sysmon", title: "Ejecución de PowerShell codificado en base64 en el laboratorio 3" },
  { escenario: "malware", source: "wazuh", title: "Archivo con firma de ransomware detectado en una carpeta compartida" },
  { escenario: "malware", source: "sysmon", title: "Proceso desconocido se conecta a un dominio de comando y control" },
  { escenario: "malware", source: "wazuh", title: "Troyano detectado en una descarga desde un equipo de la biblioteca" },
  { escenario: "malware", source: "sysmon", title: "Tarea programada persistente creada por un proceso sin firma" },
  // vulnerabilidad (4)
  { escenario: "vulnerabilidad", source: "wazuh", title: "Vulnerabilidad crítica CVE-2024-3094 detectada en el paquete xz-utils" },
  { escenario: "vulnerabilidad", source: "wazuh", title: "Servidor web con OpenSSL desactualizado y vulnerable" },
  { escenario: "vulnerabilidad", source: "wazuh", title: "Servicio SMB expuesto con versión vulnerable en la red de laboratorios" },
  { escenario: "vulnerabilidad", source: "wazuh", title: "Parches de seguridad pendientes en 12 equipos del dominio" },
  // escalamiento (4)
  { escenario: "escalamiento", source: "auditd", title: "Usuario sin privilegios ejecutó sudo su de forma anómala" },
  { escenario: "escalamiento", source: "sysmon", title: "Intento de volcado de memoria de LSASS en un servidor de aplicaciones" },
  { escenario: "escalamiento", source: "auditd", title: "Modificación no autorizada del archivo sudoers" },
  { escenario: "escalamiento", source: "sysmon", title: "Cuenta de servicio agregada al grupo de administradores del dominio" },
  // correlacion (3)
  { escenario: "correlacion", source: "wazuh", title: "Correlación: fallos de autenticación seguidos de un acceso exitoso desde IP externa" },
  { escenario: "correlacion", source: "wazuh", title: "Correlación: escaneo de puertos y posterior intento de explotación al mismo host" },
  { escenario: "correlacion", source: "wazuh", title: "Correlación: inicio de sesión fuera de horario y descarga masiva de archivos" },
  // inteligencia-misp (4)
  { escenario: "inteligencia-misp", source: "misp", title: "Indicador de compromiso de MISP coincide con tráfico saliente del campus" },
  { escenario: "inteligencia-misp", source: "misp", title: "Hash de malware del evento MISP 4821 observado en un endpoint" },
  { escenario: "inteligencia-misp", source: "misp", title: "Dominio de un feed de inteligencia contactado desde la red de estudiantes" },
  { escenario: "inteligencia-misp", source: "misp", title: "IP maliciosa del feed de CIRCL aparece en los registros del firewall" },
  // sin escenario (8)
  { escenario: null, source: "wazuh", title: "Alerta de integridad de archivos en el directorio /etc del servidor QA" },
  { escenario: null, source: "sysmon", title: "Creación de proceso inusual en una estación de trabajo administrativa" },
  { escenario: null, source: "auditd", title: "Cambio de permisos en el directorio de respaldos" },
  { escenario: null, source: "wazuh", title: "Pico de tráfico DNS hacia dominios de baja reputación" },
  { escenario: null, source: "misp", title: "Actualización de un evento MISP pendiente de revisión" },
  { escenario: null, source: "correo", title: "Correo reportado como sospechoso sin análisis de contenido" },
  { escenario: null, source: "wazuh", title: "Reinicio inesperado del agente Wazuh en el servidor de bases de datos" },
  { escenario: null, source: "sysmon", title: "Instalación de software no autorizado en una sala de cómputo" },
];
