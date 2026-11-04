import { describe, expect, it } from "vitest";
import { hayDatosDeLaboratorio } from "./laboratorio";

describe("hayDatosDeLaboratorio", () => {
  it("sin respuestas todavía: no hay aviso", () => {
    expect(hayDatosDeLaboratorio()).toBe(false);
    expect(hayDatosDeLaboratorio(null, null)).toBe(false);
  });

  it("basta con que una respuesta lo indique", () => {
    expect(hayDatosDeLaboratorio({ datosDeLaboratorio: true }, null)).toBe(true);
    expect(hayDatosDeLaboratorio(null, { datosDeLaboratorio: true })).toBe(true);
    expect(hayDatosDeLaboratorio({ datosDeLaboratorio: false }, { datosDeLaboratorio: true })).toBe(true);
  });

  it("si ninguna lo indica, no hay aviso", () => {
    expect(hayDatosDeLaboratorio({ datosDeLaboratorio: false }, { datosDeLaboratorio: false })).toBe(false);
  });
});
