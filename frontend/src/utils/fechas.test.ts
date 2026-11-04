import { describe, expect, it } from "vitest";
import { diaBogota, etiquetaDia, formatoAntiguedad, ultimosDias } from "./fechas";

// Bogotá es UTC−5 todo el año (sin horario de verano).
const bogota = (a: number, m: number, d: number, h = 12, min = 0) => Date.UTC(a, m - 1, d, h + 5, min);

describe("diaBogota", () => {
  it("una alerta a las 23:30 de Bogotá (04:30 UTC del día siguiente) cae en el día de Bogotá", () => {
    const ms = Date.UTC(2026, 9, 31, 4, 30); // 31 oct 04:30 UTC = 30 oct 23:30 Bogotá
    expect(new Date(ms).toISOString()).toBe("2026-10-31T04:30:00.000Z");
    expect(diaBogota(ms)).toBe("2026-10-30");
  });

  it("el cambio de día ocurre a las 05:00 UTC (medianoche en Bogotá)", () => {
    expect(diaBogota(Date.UTC(2026, 9, 31, 4, 59, 59))).toBe("2026-10-30");
    expect(diaBogota(Date.UTC(2026, 9, 31, 5, 0, 0))).toBe("2026-10-31");
  });
});

describe("ultimosDias", () => {
  it("devuelve n días ordenados que terminan hoy (Bogotá)", () => {
    const ahora = bogota(2026, 11, 3, 9, 0);
    const dias = ultimosDias(14, ahora);
    expect(dias).toHaveLength(14);
    expect(dias[13]).toBe("2026-11-03");
    expect(dias[0]).toBe("2026-10-21");
  });

  it("cruza de mes: 31 oct → 1 nov", () => {
    const dias = ultimosDias(5, bogota(2026, 11, 2));
    expect(dias).toEqual(["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("'hoy' se decide en Bogotá, no en UTC", () => {
    // 03:00 UTC del 2 nov = 22:00 del 1 nov en Bogotá
    const dias = ultimosDias(2, Date.UTC(2026, 10, 2, 3, 0));
    expect(dias).toEqual(["2026-10-31", "2026-11-01"]);
  });
});

describe("etiquetaDia", () => {
  const ahora = bogota(2026, 11, 3);

  it("muestra 'Hoy' para el día actual", () => {
    expect(etiquetaDia("2026-11-03", ahora)).toBe("Hoy");
  });

  it("muestra solo el número en días normales", () => {
    expect(etiquetaDia("2026-10-28", ahora)).toBe("28");
    expect(etiquetaDia("2026-11-02", ahora)).toBe("2");
  });

  it("muestra '1 nov' el primer día del mes (y '1 oct', etc.)", () => {
    expect(etiquetaDia("2026-11-01", ahora)).toBe("1 nov");
    expect(etiquetaDia("2026-10-01", ahora)).toBe("1 oct");
  });

  it("'Hoy' tiene prioridad aunque sea día 1", () => {
    expect(etiquetaDia("2026-11-01", bogota(2026, 11, 1))).toBe("Hoy");
  });
});

describe("formatoAntiguedad", () => {
  const MIN = 60_000;
  const H = 60 * MIN;
  const D = 24 * H;

  it("días y horas", () => {
    expect(formatoAntiguedad(7 * D + 6 * H + 30 * MIN)).toBe("7 d 6 h");
  });

  it("horas y minutos", () => {
    expect(formatoAntiguedad(3 * H + 20 * MIN)).toBe("3 h 20 min");
  });

  it("solo minutos", () => {
    expect(formatoAntiguedad(45 * MIN)).toBe("45 min");
  });

  it("casos límite", () => {
    expect(formatoAntiguedad(0)).toBe("< 1 min");
    expect(formatoAntiguedad(-5 * MIN)).toBe("< 1 min");
    expect(formatoAntiguedad(59 * MIN + 59_000)).toBe("59 min");
    expect(formatoAntiguedad(H)).toBe("1 h");
    expect(formatoAntiguedad(D)).toBe("1 d");
    expect(formatoAntiguedad(2 * D + 5 * MIN)).toBe("2 d");
    expect(formatoAntiguedad(2 * H + 5 * MIN)).toBe("2 h 5 min");
  });
});
