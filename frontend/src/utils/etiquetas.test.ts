import { describe, expect, it } from "vitest";
import type { CasoResumen } from "../types/listaAlertas";
import {
  etiquetaAntiguedad,
  etiquetaCaso,
  etiquetaEstadoAlerta,
  etiquetaOrigen,
  etiquetaSeveridad,
  etiquetaSla,
  etiquetaTipo,
  nombreLegible,
  textoExcesoSla,
} from "./etiquetas";

const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

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

describe("etiquetaTipo y etiquetaOrigen", () => {
  it("el tipo null es 'Sin clasificar'", () => {
    expect(etiquetaTipo(null)).toBe("Sin clasificar");
    expect(etiquetaTipo("fuerza-bruta")).toBe("Fuerza bruta");
  });

  it("la herramienta usa el nombre legible", () => {
    expect(etiquetaOrigen("auditd")).toBe("AuditD");
    expect(etiquetaOrigen("sysmon")).toBe("Sysmon");
  });
});

describe("severidad y estado de la alerta", () => {
  it("severidades", () => {
    expect([4, 3, 2, 1].map((s) => etiquetaSeveridad(s as 1 | 2 | 3 | 4))).toEqual(["Crítica", "Alta", "Media", "Baja"]);
  });

  it("estados", () => {
    expect(etiquetaEstadoAlerta("New")).toBe("Sin atender");
    expect(etiquetaEstadoAlerta("InProgress")).toBe("En progreso");
    expect(etiquetaEstadoAlerta("Imported")).toBe("Convertida en caso");
    expect(etiquetaEstadoAlerta("Ignored")).toBe("Ignorada");
  });
});

describe("SLA", () => {
  it("etiqueta según el estado", () => {
    expect(etiquetaSla({ estado: "fuera", limiteMin: 30, excesoMs: D })).toBe("Fuera de SLA");
    expect(etiquetaSla({ estado: "dentro", limiteMin: 30, excesoMs: null })).toBe("Dentro de SLA");
    expect(etiquetaSla({ estado: null, limiteMin: 30, excesoMs: null })).toBe("—");
  });

  it("el exceso solo se muestra fuera de SLA", () => {
    expect(textoExcesoSla({ estado: "fuera", limiteMin: 15, excesoMs: 2 * D + 4 * H })).toBe("+2 d 4 h");
    expect(textoExcesoSla({ estado: "fuera", limiteMin: 15, excesoMs: 20 * MIN })).toBe("+20 min");
    expect(textoExcesoSla({ estado: "fuera", limiteMin: 15, excesoMs: 1 })).toBe("+menos de 1 min");
    expect(textoExcesoSla({ estado: "dentro", limiteMin: 15, excesoMs: null })).toBeNull();
    expect(textoExcesoSla({ estado: null, limiteMin: 15, excesoMs: null })).toBeNull();
  });
});

describe("etiquetaAntiguedad", () => {
  it("'Hace …' con el formato de antigüedad", () => {
    expect(etiquetaAntiguedad(3 * D + 4 * H)).toBe("Hace 3 d 4 h");
    expect(etiquetaAntiguedad(45 * MIN)).toBe("Hace 45 min");
    expect(etiquetaAntiguedad(0)).toBe("Hace menos de 1 min");
    expect(etiquetaAntiguedad(59_999)).toBe("Hace menos de 1 min");
  });
});

describe("etiquetaCaso", () => {
  const caso = (p: Partial<CasoResumen>): CasoResumen => ({ id: "~c", numero: 1, etapa: "New", estado: "New", ...p });

  it("sin caso", () => {
    expect(etiquetaCaso(null)).toBe("Sin caso");
  });

  it("abierto y en progreso muestran número y etapa", () => {
    expect(etiquetaCaso(caso({ numero: 4, etapa: "New", estado: "New" }))).toBe("#4 · Abierto");
    expect(etiquetaCaso(caso({ numero: 3, etapa: "InProgress", estado: "InProgress" }))).toBe("#3 · En progreso");
  });

  it("cerrado muestra la resolución", () => {
    expect(etiquetaCaso(caso({ numero: 2, etapa: "Closed", estado: "TruePositive" }))).toBe("#2 · Cerrado · Confirmado");
    expect(etiquetaCaso(caso({ numero: 5, etapa: "Closed", estado: "FalsePositive" }))).toBe("#5 · Cerrado · Falso positivo");
    expect(etiquetaCaso(caso({ numero: 6, etapa: "Closed", estado: "Indeterminate" }))).toBe("#6 · Cerrado · Indeterminado");
  });

  it("una resolución desconocida se muestra tal cual; sin resolución, solo 'Cerrado'", () => {
    expect(etiquetaCaso(caso({ numero: 7, etapa: "Closed", estado: "Rara" }))).toBe("#7 · Cerrado · Rara");
    expect(etiquetaCaso(caso({ numero: 7, etapa: "Closed", estado: null }))).toBe("#7 · Cerrado");
  });

  it("el estado solo se muestra como resolución si el caso está cerrado", () => {
    expect(etiquetaCaso(caso({ numero: 8, etapa: "InProgress", estado: "TruePositive" }))).toBe("#8 · En progreso");
  });

  it("tiene caseId pero el caso no está disponible", () => {
    expect(etiquetaCaso({ id: "~c9", numero: null, etapa: null, estado: null })).toBe("Caso no disponible");
  });
});
