import type { Activo, ActivosAtacados, ConteoComponente } from "../types/activos";
import { ultimosDias } from "../utils/fechas";

/**
 * Activos atacados FICTICIOS con la misma forma que `GET /api/dashboard/activos`. Los nombres técnicos y las cifras
 * están inventados para el mock (no son los equipos del laboratorio).
 */

const DIAS = 7;

type Componentes = Array<[clave: string, alertas: number, altasYCriticas: number]>;

function activo(
  agenteId: string,
  equipo: string,
  nombreVisible: string,
  tipo: string,
  sistema: string,
  componentes: Componentes,
): Activo {
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

const ACTIVOS: Activo[] = [
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

export interface OpcionesActivosMock {
  /** true = simula la carga inicial del backend: estado "cargando" y `activos` en null. */
  cargando?: boolean;
}

export function generarActivos(ahora: number, { cargando = false }: OpcionesActivosMock = {}): ActivosAtacados {
  const base = {
    generadoEn: ahora,
    thehive: { respondio: true, consultadoEn: ahora },
    ventanaDias: DIAS,
    desde: ultimosDias(DIAS, ahora)[0],
  };
  if (cargando) return { ...base, estado: "cargando", progreso: 40, activos: null, alertasSinActivo: null };
  return { ...base, estado: "listo", progreso: 100, activos: ACTIVOS.map((a) => ({ ...a, componentes: [...a.componentes] })), alertasSinActivo: 3 };
}
