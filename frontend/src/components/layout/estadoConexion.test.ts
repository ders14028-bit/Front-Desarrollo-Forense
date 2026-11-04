import { describe, expect, it } from "vitest";
import { estadoConexion } from "./estadoConexion";

describe("estadoConexion", () => {
  it("el error tiene prioridad sobre el modo mock (VITE_MOCK_ERROR=true dice 'Sin conexión')", () => {
    expect(estadoConexion({ hayError: true, modoMock: true, tieneDatos: false })).toEqual({
      clave: "error",
      texto: "Sin conexión",
    });
    expect(estadoConexion({ hayError: true, modoMock: false, tieneDatos: true }).clave).toBe("error");
  });

  it("en modo mock sin error: 'Datos simulados'", () => {
    expect(estadoConexion({ hayError: false, modoMock: true, tieneDatos: true }).texto).toBe("Datos simulados");
    expect(estadoConexion({ hayError: false, modoMock: true, tieneDatos: false }).texto).toBe("Datos simulados");
  });

  it("con backend real: 'TheHive conectado' solo cuando ya llegaron datos", () => {
    expect(estadoConexion({ hayError: false, modoMock: false, tieneDatos: true }).texto).toBe("TheHive conectado");
    expect(estadoConexion({ hayError: false, modoMock: false, tieneDatos: false }).clave).toBe("conectando");
  });
});
