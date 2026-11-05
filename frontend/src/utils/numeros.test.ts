import { describe, expect, it } from "vitest";
import { formatoDecimal, formatoEntero, textoPorcentaje } from "./numeros";

describe("formatoEntero (es-CO)", () => {
  it("punto como separador de miles, también con cuatro cifras", () => {
    expect(formatoEntero(23261)).toBe("23.261");
    expect(formatoEntero(1500)).toBe("1.500");
    expect(formatoEntero(1234567)).toBe("1.234.567");
  });

  it("sin separador por debajo de mil, y el cero", () => {
    expect(formatoEntero(999)).toBe("999");
    expect(formatoEntero(0)).toBe("0");
  });
});

describe("formatoDecimal (es-CO)", () => {
  it("coma decimal y como máximo un decimal", () => {
    expect(formatoDecimal(12.5)).toBe("12,5");
    expect(formatoDecimal(99.46)).toBe("99,5");
    expect(formatoDecimal(12)).toBe("12");
  });
});

describe("textoPorcentaje", () => {
  it("un decimal como máximo, con coma", () => {
    expect(textoPorcentaje(23148, 23261)).toBe("99,5 %");
    expect(textoPorcentaje(1, 8)).toBe("12,5 %");
    expect(textoPorcentaje(50, 100)).toBe("50 %");
  });

  it("100 % solo si es todo", () => {
    expect(textoPorcentaje(23261, 23261)).toBe("100 %");
    expect(textoPorcentaje(23260, 23261)).toBe("99,9 %"); // 99,9957 no se redondea a 100
  });

  it("0 % solo si no hay nada", () => {
    expect(textoPorcentaje(0, 100)).toBe("0 %");
    expect(textoPorcentaje(1, 23261)).toBe("menos de 0,1 %");
  });

  it("sin total no hay porcentaje", () => {
    expect(textoPorcentaje(0, 0)).toBeNull();
    expect(textoPorcentaje(5, 0)).toBeNull();
  });
});
