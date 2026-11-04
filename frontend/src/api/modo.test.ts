import { describe, expect, it } from "vitest";
import { decidirModoMock } from "./modo";

describe("decidirModoMock", () => {
  it("sin definir: mock en desarrollo, backend real en producción", () => {
    expect(decidirModoMock(undefined, false)).toBe(true);
    expect(decidirModoMock(undefined, true)).toBe(false);
    expect(decidirModoMock("", true)).toBe(false);
  });

  it("definido: manda el valor, también en producción", () => {
    expect(decidirModoMock("false", false)).toBe(false);
    expect(decidirModoMock("true", false)).toBe(true);
    expect(decidirModoMock("true", true)).toBe(true);
    expect(decidirModoMock("false", true)).toBe(false);
  });
});
