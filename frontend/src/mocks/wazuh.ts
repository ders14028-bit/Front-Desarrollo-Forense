import type { MetricasWazuh } from "../types/wazuh";
import { ultimosDias } from "../utils/fechas";

/**
 * Métricas de Wazuh FICTICIAS con la misma forma que devolverá el backend (`GET /api/dashboard/wazuh`). Las IP son de
 * documentación (RFC 5737), los usuarios son nombres genéricos y todas las cifras están inventadas para el mock.
 */

const DIAS = 7;

export interface OpcionesWazuhMock {
  /** true = simula la carga inicial del backend: estado "cargando", con progreso y todas las métricas en null. */
  cargando?: boolean;
}

export function generarMetricasWazuh(ahora: number, { cargando = false }: OpcionesWazuhMock = {}): MetricasWazuh {
  const base = {
    generadoEn: ahora,
    thehive: { respondio: true, consultadoEn: ahora },
    dias: DIAS,
    desde: ultimosDias(DIAS, ahora)[0],
  };

  if (cargando) {
    return {
      ...base,
      estado: "cargando",
      progreso: 40,
      alertasAnalizadas: null,
      sinBloque: null,
      mitre: null,
      cumplimiento: null,
      topIps: null,
      topUsuarios: null,
      topReglas: null,
      agentes: null,
      porNivel: null,
    };
  }

  return {
    ...base,
    estado: "listo",
    progreso: 100,
    alertasAnalizadas: 18420,
    sinBloque: 37,
    mitre: {
      tacticas: [
        { clave: "acceso-a-credenciales", cantidad: 9870 },
        { clave: "movimiento-lateral", cantidad: 4210 },
        { clave: "evasion-de-defensas", cantidad: 3160 },
        { clave: "persistencia", cantidad: 2940 },
        { clave: "escalada-de-privilegios", cantidad: 2880 },
        { clave: "acceso-inicial", cantidad: 1530 },
        { clave: "impacto", cantidad: 214 },
      ],
      tecnicas: [
        { id: "T1110.001", nombre: "Password Guessing", cantidad: 9120 },
        { id: "T1021.004", nombre: "SSH", cantidad: 4210 },
        { id: "T1078", nombre: "Valid Accounts", cantidad: 3010 },
        { id: "T1529", nombre: "System Shutdown/Reboot", cantidad: 214 },
      ],
    },
    cumplimiento: [
      {
        marco: "pci_dss",
        alertas: 14960,
        requisitos: [
          { requisito: "10.2.4", cantidad: 9230 },
          { requisito: "10.2.5", cantidad: 8870 },
          { requisito: "10.6.1", cantidad: 6410 },
        ],
      },
      {
        marco: "nist_800_53",
        alertas: 15120,
        requisitos: [
          { requisito: "AU.14", cantidad: 11500 },
          { requisito: "AC.7", cantidad: 10020 },
          { requisito: "AU.6", cantidad: 6410 },
        ],
      },
      {
        marco: "gdpr",
        alertas: 15040,
        requisitos: [
          { requisito: "IV_35.7.d", cantidad: 9230 },
          { requisito: "IV_32.2", cantidad: 8870 },
        ],
      },
      { marco: "hipaa", alertas: 14960, requisitos: [{ requisito: "164.312.b", cantidad: 14960 }] },
      {
        marco: "tsc",
        alertas: 14800,
        requisitos: [
          { requisito: "CC6.1", cantidad: 9230 },
          { requisito: "CC6.8", cantidad: 8870 },
          { requisito: "CC7.2", cantidad: 8870 },
        ],
      },
    ],
    topIps: [
      { ip: "203.0.113.45", cantidad: 4120 },
      { ip: "198.51.100.23", cantidad: 3305 },
      { ip: "192.0.2.77", cantidad: 2210 },
      { ip: "203.0.113.9", cantidad: 1470 },
      { ip: "198.51.100.101", cantidad: 960 },
      { ip: "192.0.2.12", cantidad: 540 },
    ],
    topUsuarios: [
      { usuario: "root", cantidad: 6120 },
      { usuario: "admin", cantidad: 2890 },
      { usuario: "ubuntu", cantidad: 1730 },
      { usuario: "test", cantidad: 1210 },
      { usuario: "oracle", cantidad: 830 },
      { usuario: "postgres", cantidad: 410 },
    ],
    topReglas: [
      { id: "5710", descripcion: "sshd: Attempt to login using a non-existent user", nivel: 5, cantidad: 9230 },
      { id: "5503", descripcion: "PAM: User login failed.", nivel: 5, cantidad: 6903 },
      { id: "5760", descripcion: "sshd: authentication failed.", nivel: 5, cantidad: 3289 },
      { id: "5551", descripcion: "PAM: Multiple failed logins in a small period of time.", nivel: 10, cantidad: 765 },
      { id: "60106", descripcion: "Windows Logon Success", nivel: 3, cantidad: 415 },
      { id: "67018", descripcion: "System shutdown initiated.", nivel: 3, cantidad: 214 },
    ],
    agentes: [
      { nombre: "wazuh-server", cantidad: 17950 },
      { nombre: "equipo-01", cantidad: 470 },
    ],
    porNivel: [
      { nivel: 10, cantidad: 765 },
      { nivel: 5, cantidad: 19422 },
      { nivel: 3, cantidad: 629 },
    ],
  };
}
