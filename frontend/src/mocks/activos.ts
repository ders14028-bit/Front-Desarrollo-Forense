import type { Activo, ActivosAtacados, AtaqueReciente, ConteoComponente } from "../types/activos";
import { ultimosDias } from "../utils/fechas";

/**
 * Activos atacados FICTICIOS con la misma forma que `GET /api/dashboard/activos`. Los nombres técnicos y las cifras
 * están inventados para el mock (no son los equipos del laboratorio).
 */

/** El valor por defecto del backend (`dashboard.wazuh.ventana-dias`). */
const DIAS = 14;

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

type Componentes = Array<[clave: string, alertas: number, altasYCriticas: number]>;

function activo(
  agenteId: string,
  equipo: string,
  nombreVisible: string,
  tipo: string,
  sistema: string,
  componentes: Componentes,
): Omit<Activo, "ultimoAtaqueEn"> {
  const lista: ConteoComponente[] = componentes
    .map(([clave, alertas, altasYCriticas]) => ({ clave, alertas, altasYCriticas }))
    .sort((x, y) => y.alertas - x.alertas);
  return {
    agenteId,
    equipo,
    nombreVisible,
    tipo,
    sistema,
    alertas: lista.reduce((s, c) => s + c.alertas, 0),
    altasYCriticas: lista.reduce((s, c) => s + c.altasYCriticas, 0),
    componentePrincipal: lista[0]?.clave ?? null,
    componentes: lista,
  };
}

const ACTIVOS = [
  activo("101", "srv-web-demo", "Servidor web", "web", "Linux", [
    ["servidor-web", 412, 37],
    ["ssh", 96, 8],
    ["cuentas-permisos", 21, 0],
    ["otros", 14, 0],
  ]),
  activo("102", "srv-datos-demo", "Servidor de base de datos", "base-de-datos", "Linux", [
    ["base-de-datos", 188, 22],
    ["ssh", 54, 3],
    ["integridad", 9, 0],
  ]),
  activo("103", "WIN-DEMO-01", "Servidor Windows 1", "windows", "Windows", [
    ["inicio-sesion-windows", 230, 11],
    ["procesos-windows", 75, 6],
    ["sistema-windows", 40, 0],
  ]),
  activo("104", "WIN-DEMO-02", "Servidor Windows 2", "windows", "Windows", [
    ["inicio-sesion-windows", 61, 2],
    ["sistema-windows", 18, 0],
  ]),
  activo("105", "estacion-demo", "Estación de trabajo Linux", "estacion", "Linux", [
    ["cuentas-permisos", 33, 0],
    ["vulnerabilidades", 12, 1],
  ]),
  activo("100", "monitor-demo", "Servidor de monitoreo (Wazuh)", "monitoreo", "Linux", [
    ["monitoreo-wazuh", 27, 0],
    ["auditoria", 8, 0],
  ]),
  activo("107", "agente-nuevo-demo", "agente-nuevo-demo", "sin-clasificar", "Linux", [["otros", 5, 0]]),
];

/**
 * Un grupo de ataques (activo + regla). `hace` es cuánto antes de `ahora` fue el último; `duro`, cuánto antes de ese
 * momento fue el primero. Las cantidades de cada activo suman sus `altasYCriticas`. Descripciones en inglés, como las
 * manda Wazuh; las de las reglas 5712, 5760 y 5763 y la de "Executable file dropped…" tienen traducción en el frontend.
 */
type Grupo = [agenteId: string, componente: string, reglaId: string, nivel: number, descripcion: string, severidad: number, cantidad: number, hace: number, duro: number];

const GRUPOS: Grupo[] = [
  ["101", "ssh", "5712", 10, "sshd: brute force trying to get access to the system. Non existent user.", 3, 6, 25 * MIN, 6 * HORA],
  ["102", "base-de-datos", "50106", 10, "MariaDB: multiple authentication failures.", 3, 12, 55 * MIN, 5 * HORA],
  ["103", "inicio-sesion-windows", "60122", 5, "Logon failure - Unknown user or bad password.", 3, 11, 40 * MIN, 9 * HORA],
  ["101", "servidor-web", "31151", 10, "Multiple web server 400 error codes from same source ip.", 3, 16, 2 * HORA + 10 * MIN, 3 * DIA],
  ["102", "base-de-datos", "50120", 12, "MariaDB: possible SQL injection attempt.", 4, 7, 3 * HORA, 90 * MIN],
  ["102", "ssh", "5760", 5, "sshd: authentication failed.", 3, 3, 4 * HORA, 2 * HORA],
  ["101", "servidor-web", "31168", 15, "Shellshock attack detected.", 4, 4, 5 * HORA, HORA],
  ["103", "procesos-windows", "92213", 15, "Executable file dropped in folder commonly used by malware", 4, 4, 6 * HORA, 30 * MIN],
  ["102", "base-de-datos", "50125", 12, "MariaDB: unauthorized privilege change.", 3, 3, DIA + 6 * HORA, 2 * HORA],
  ["103", "procesos-windows", "92200", 6, "Scripting file created under Windows Temp or User folder", 3, 2, DIA + 2 * HORA, 20 * MIN],
  ["101", "servidor-web", "31106", 12, "A web attack returned code 200 (success).", 3, 7, DIA + 3 * HORA, 2 * DIA],
  ["101", "servidor-web", "31103", 7, "SQL injection attempt.", 3, 10, 2 * DIA + 8 * HORA, 4 * DIA],
  ["104", "inicio-sesion-windows", "60122", 5, "Logon failure - Unknown user or bad password.", 3, 2, 2 * DIA + 4 * HORA, 3 * HORA],
  ["101", "ssh", "5763", 10, "sshd: brute force trying to get access to the system. Authentication failed.", 3, 2, 3 * DIA, 5 * HORA],
  ["105", "vulnerabilidades", "23504", 12, "CVE-2025-0000 affects demo-paquete", 3, 1, 4 * DIA, 0],
];

export interface OpcionesActivosMock {
  /** true = simula la carga inicial del backend: estado "cargando" y `activos` en null. */
  cargando?: boolean;
}

function ataquesRecientes(ahora: number): AtaqueReciente[] {
  return GRUPOS.map(([agenteId, componente, reglaId, nivelWazuh, descripcion, severidad, cantidad, hace, duro]) => {
    const a = ACTIVOS.find((x) => x.agenteId === agenteId)!;
    const ultimaEn = ahora - hace;
    return {
      agenteId,
      equipo: a.equipo,
      nombreVisible: a.nombreVisible,
      tipo: a.tipo,
      componente,
      reglaId,
      nivelWazuh,
      descripcion,
      severidad,
      cantidad,
      primeraEn: ultimaEn - duro,
      ultimaEn,
    };
  })
    .sort((x, y) => y.ultimaEn - x.ultimaEn)
    .slice(0, 20);
}

export function generarActivos(ahora: number, { cargando = false }: OpcionesActivosMock = {}): ActivosAtacados {
  const base = {
    generadoEn: ahora,
    thehive: { respondio: true, consultadoEn: ahora },
    ventanaDias: DIAS,
    desde: ultimosDias(DIAS, ahora)[0],
  };
  if (cargando) return { ...base, estado: "cargando", progreso: 40, activos: null, alertasSinActivo: null, ataquesRecientes: null };

  const ataques = ataquesRecientes(ahora);
  const activos: Activo[] = ACTIVOS.map((a) => {
    const suyos = ataques.filter((t) => t.agenteId === a.agenteId);
    return { ...a, componentes: [...a.componentes], ultimoAtaqueEn: suyos.length > 0 ? Math.max(...suyos.map((t) => t.ultimaEn)) : null };
  });
  return { ...base, estado: "listo", progreso: 100, activos, alertasSinActivo: 3, ataquesRecientes: ataques };
}
