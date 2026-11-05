import { describe, expect, it } from "vitest";
import { formatoHora } from "../../utils/fechas";
import { estadoConexion } from "./estadoConexion";

// 3 nov. 2026, 15:42 en Bogotá (UTC−5).
const DATOS_DE = Date.UTC(2026, 10, 3, 20, 42);

describe("estadoConexion", () => {
  it("el backend sin responder tiene prioridad sobre todo: 'Sin conexión con el servidor'", () => {
    expect(estadoConexion({ hayError: true, modoMock: true, tieneDatos: false })).toEqual({
      clave: "error",
      texto: "Sin conexión con el servidor",
    });
    expect(estadoConexion({ hayError: true, modoMock: false, tieneDatos: true }).clave).toBe("error");
    // aunque la última respuesta guardada dijera que TheHive no respondía
    expect(
      estadoConexion({ hayError: true, modoMock: false, tieneDatos: true, thehive: { respondio: false, consultadoEn: DATOS_DE }, datosDe: DATOS_DE }).texto,
    ).toBe("Sin conexión con el servidor");
  });

  it("el backend responde pero TheHive no: 'TheHive no responde · datos de las HH:MM' (hora de Bogotá de los datos)", () => {
    const e = estadoConexion({
      hayError: false,
      modoMock: false,
      tieneDatos: true,
      thehive: { respondio: false, consultadoEn: DATOS_DE + 90_000 },
      datosDe: DATOS_DE,
    });

    expect(e.clave).toBe("sin-thehive");
    expect(e.texto).toBe("TheHive no responde · datos de las 15:42");
    expect(e.texto).toContain(formatoHora(DATOS_DE));
  });

  it("los dos fallos se distinguen con claves y textos distintos", () => {
    const servidor = estadoConexion({ hayError: true, modoMock: false, tieneDatos: true });
    const thehive = estadoConexion({ hayError: false, modoMock: false, tieneDatos: true, thehive: { respondio: false, consultadoEn: DATOS_DE }, datosDe: DATOS_DE });

    expect(servidor.clave).not.toBe(thehive.clave);
    expect(servidor.texto).not.toBe(thehive.texto);
  });

  it("TheHive no responde con prioridad sobre el modo mock", () => {
    expect(
      estadoConexion({ hayError: false, modoMock: true, tieneDatos: true, thehive: { respondio: false, consultadoEn: DATOS_DE }, datosDe: DATOS_DE }).clave,
    ).toBe("sin-thehive");
  });

  it("sin la hora de los datos no inventa una: '—'", () => {
    expect(
      estadoConexion({ hayError: false, modoMock: false, tieneDatos: true, thehive: { respondio: false, consultadoEn: DATOS_DE } }).texto,
    ).toBe("TheHive no responde · datos de las —");
  });

  it("en modo mock sin error: 'Datos simulados'", () => {
    expect(estadoConexion({ hayError: false, modoMock: true, tieneDatos: true }).texto).toBe("Datos simulados");
    expect(estadoConexion({ hayError: false, modoMock: true, tieneDatos: false }).texto).toBe("Datos simulados");
  });

  it("con backend real: 'TheHive conectado' solo cuando ya llegaron datos y TheHive respondió", () => {
    expect(estadoConexion({ hayError: false, modoMock: false, tieneDatos: true }).texto).toBe("TheHive conectado");
    expect(
      estadoConexion({ hayError: false, modoMock: false, tieneDatos: true, thehive: { respondio: true, consultadoEn: DATOS_DE }, datosDe: DATOS_DE }).texto,
    ).toBe("TheHive conectado");
    expect(estadoConexion({ hayError: false, modoMock: false, tieneDatos: false }).clave).toBe("conectando");
  });
});
