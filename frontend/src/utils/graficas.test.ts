import { describe, expect, it } from "vitest";
import type { ConteoPorDia, ConteoPorTipo } from "../types/metricas";
import { ultimosDias } from "./fechas";
import {
  anchoRelativo,
  armarTipos,
  filasOrigen,
  filasSeveridad,
  nombreLegible,
  serieVisible,
} from "./graficas";

// 3 nov 2026, 10:00 en Bogotá. Datos armados a mano.
const AHORA = Date.UTC(2026, 10, 3, 15, 0);

describe("nombreLegible", () => {
  it("escenarios conocidos", () => {
    expect(nombreLegible("fuerza-bruta")).toBe("Fuerza bruta");
    expect(nombreLegible("inteligencia-misp")).toBe("Inteligencia MISP");
    expect(nombreLegible("correlacion")).toBe("Correlación");
    expect(nombreLegible("phishing")).toBe("Phishing");
  });

  it("herramientas y valores desconocidos", () => {
    expect(nombreLegible("auditd")).toBe("AuditD");
    expect(nombreLegible("wazuh")).toBe("Wazuh");
    expect(nombreLegible("correo")).toBe("Correo");
    expect(nombreLegible("misp")).toBe("MISP");
    expect(nombreLegible("nuevo-tipo_raro")).toBe("Nuevo tipo raro");
    expect(nombreLegible("ioc-feed")).toBe("IOC feed");
  });

  it("texto vacío no revienta", () => {
    expect(nombreLegible("")).toBe("");
    expect(nombreLegible("--")).toBe("--");
  });
});

describe("anchoRelativo", () => {
  it("la barra más larga ocupa el 100 %", () => {
    expect(anchoRelativo(10, 10)).toBe(100);
    expect(anchoRelativo(5, 10)).toBe(50);
  });

  it("cero es cero; un valor positivo muy pequeño sigue visible (2 %)", () => {
    expect(anchoRelativo(0, 10)).toBe(0);
    expect(anchoRelativo(1, 1000)).toBe(2);
  });

  it("sin máximo no divide por cero", () => {
    expect(anchoRelativo(3, 0)).toBe(0);
  });
});

describe("filasSeveridad", () => {
  it("siempre Crítica, Alta, Media, Baja, aunque falten o lleguen desordenadas", () => {
    const filas = filasSeveridad([
      { severidad: 2, cantidad: 15 },
      { severidad: 4, cantidad: 5 },
      { severidad: 1, cantidad: 6 },
    ]);
    expect(filas.map((f) => [f.etiqueta, f.cantidad])).toEqual([
      ["Crítica", 5],
      ["Alta", 0],
      ["Media", 15],
      ["Baja", 6],
    ]);
  });
});

describe("filasOrigen", () => {
  it("de mayor a menor, con nombres legibles", () => {
    const filas = filasOrigen([
      { origen: "misp", cantidad: 1 },
      { origen: "wazuh", cantidad: 7 },
      { origen: "auditd", cantidad: 3 },
    ]);
    expect(filas.map((f) => [f.etiqueta, f.cantidad])).toEqual([
      ["Wazuh", 7],
      ["AuditD", 3],
      ["MISP", 1],
    ]);
  });
});

const tipos = (...pares: [string, number][]): ConteoPorTipo[] => pares.map(([tipo, cantidad]) => ({ tipo, cantidad }));

describe("armarTipos", () => {
  it("los 5 mayores por separado; Otros con la suma y los tipos restantes; Sin clasificar aparte", () => {
    const r = armarTipos(
      tipos(
        ["phishing", 6],
        ["malware", 5],
        ["fuerza-bruta", 4],
        ["vulnerabilidad", 3],
        ["escalamiento", 2],
        ["correlacion", 1],
        ["inteligencia-misp", 1],
      ),
      2,
    );

    expect(r.principales.map((f) => [f.etiqueta, f.cantidad])).toEqual([
      ["Phishing", 6],
      ["Malware", 5],
      ["Fuerza bruta", 4],
      ["Vulnerabilidad", 3],
      ["Escalamiento", 2],
    ]);
    expect(r.otros).toEqual({
      etiqueta: "Otros (2 tipos)",
      cantidad: 2,
      tipos: [
        { clave: "correlacion", etiqueta: "Correlación", cantidad: 1 },
        { clave: "inteligencia-misp", etiqueta: "Inteligencia MISP", cantidad: 1 },
      ],
    });
    expect(r.sinClasificar).toBe(2);
    expect(r.maximo).toBe(6);
  });

  it("la escala incluye la suma de Otros cuando supera al tipo mayor", () => {
    const r = armarTipos(
      tipos(["a", 3], ["b", 3], ["c", 3], ["d", 3], ["e", 3], ["f", 2], ["g", 2], ["h", 2]),
      0,
    );
    expect(r.otros?.cantidad).toBe(6);
    expect(r.otros?.etiqueta).toBe("Otros (3 tipos)");
    expect(r.maximo).toBe(6);
  });

  it("Sin clasificar también cuenta para la escala", () => {
    expect(armarTipos(tipos(["a", 1]), 9).maximo).toBe(9);
  });

  it("5 tipos o menos: no hay Otros; con 6, 'Otros (1 tipo)'", () => {
    const cinco = armarTipos(tipos(["a", 5], ["b", 4], ["c", 3], ["d", 2], ["e", 1]), 0);
    expect(cinco.otros).toBeNull();
    expect(cinco.principales).toHaveLength(5);

    const seis = armarTipos(tipos(["a", 6], ["b", 5], ["c", 4], ["d", 3], ["e", 2], ["f", 1]), 0);
    expect(seis.principales).toHaveLength(5);
    expect(seis.otros).toMatchObject({ etiqueta: "Otros (1 tipo)", cantidad: 1 });
  });

  it("los empates se ordenan por nombre, sin importar el orden de entrada", () => {
    const r = armarTipos(
      tipos(
        ["phishing", 2],
        ["x-raro", 2],
        ["malware", 2],
        ["fuerza-bruta", 2],
        ["escalamiento", 2],
        ["correlacion", 2],
      ),
      0,
    );
    expect(r.principales.map((f) => f.clave)).toEqual([
      "correlacion",
      "escalamiento",
      "fuerza-bruta",
      "malware",
      "phishing",
    ]);
    expect(r.otros?.tipos.map((f) => f.clave)).toEqual(["x-raro"]);
  });

  it("sin datos: todo vacío y escala 0", () => {
    expect(armarTipos([], 0)).toEqual({ principales: [], otros: null, sinClasificar: 0, maximo: 0 });
  });

  it("el número de tipos principales se puede cambiar", () => {
    const r = armarTipos(tipos(["a", 3], ["b", 2], ["c", 1]), 0, 1);
    expect(r.principales).toHaveLength(1);
    expect(r.otros?.etiqueta).toBe("Otros (2 tipos)");
  });
});

describe("serieVisible", () => {
  // 30 días terminando hoy; la cantidad de cada día es su posición (0 = 5 oct … 29 = 3 nov)
  const porDia: ConteoPorDia[] = ultimosDias(30, AHORA).map((dia, i) => ({ dia, cantidad: i }));

  it("14 días: termina en 'Hoy' y marca el 1 de noviembre", () => {
    const s = serieVisible(porDia, 14, AHORA);
    expect(s.map((d) => d.etiqueta)).toEqual([
      "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "1 nov", "2", "Hoy",
    ]);
    expect(s.map((d) => d.cantidad)).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
    expect(s.filter((d) => d.esHoy)).toHaveLength(1);
    expect(s[13]).toMatchObject({ dia: "2026-11-03", fecha: "3 nov", esHoy: true });
  });

  it("7 días", () => {
    expect(serieVisible(porDia, 7, AHORA).map((d) => d.etiqueta)).toEqual(["28", "29", "30", "31", "1 nov", "2", "Hoy"]);
  });

  it("30 días son todos; pedir más no inventa días", () => {
    expect(serieVisible(porDia, 30, AHORA)).toHaveLength(30);
    expect(serieVisible(porDia, 30, AHORA)[0].etiqueta).toBe("5");
    expect(serieVisible(porDia, 100, AHORA)).toHaveLength(30);
  });

  it("n = 0 devuelve vacío (y no la serie completa)", () => {
    expect(serieVisible(porDia, 0, AHORA)).toEqual([]);
  });

  it("los días en 0 se conservan", () => {
    const ceros = ultimosDias(30, AHORA).map((dia) => ({ dia, cantidad: 0 }));
    const s = serieVisible(ceros, 7, AHORA);
    expect(s).toHaveLength(7);
    expect(s.every((d) => d.cantidad === 0)).toBe(true);
  });
});
