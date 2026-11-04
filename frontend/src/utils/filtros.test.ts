import { describe, expect, it } from "vitest";
import type { AlertaFila } from "../types/listaAlertas";
import { calcularOpciones, chipsActivos } from "./filtros";
import { FILTROS_VACIOS, type FiltroFecha, type FiltrosTabla } from "./tabla";

// Datos armados a mano y resultados escritos a mano.

const AHORA = Date.UTC(2026, 10, 3, 15, 0); // 3 nov 2026, 10:00 Bogotá

const fila = (p: Partial<AlertaFila> = {}): AlertaFila => ({
  id: "0",
  creadaEn: AHORA - 3_600_000,
  titulo: "Alerta",
  severidad: 2,
  estado: "New",
  origen: "wazuh",
  tipo: null,
  antiguedadMs: 3_600_000,
  sla: { estado: null, limiteMin: 120, excesoMs: null },
  caso: null,
  ...p,
});

const filtros = (p: Partial<FiltrosTabla>): FiltrosTabla => ({ ...FILTROS_VACIOS, ...p });
const pares = <V>(opciones: { valor: V; etiqueta: string; cantidad: number }[]) =>
  opciones.map((o) => [o.etiqueta, o.cantidad] as const);

const FILAS = [
  fila({ id: "a", severidad: 4, estado: "New", origen: "wazuh", tipo: "phishing", sla: { estado: "fuera", limiteMin: 15, excesoMs: 1 } }),
  fila({ id: "b", severidad: 4, estado: "New", origen: "correo", tipo: "phishing", sla: { estado: "dentro", limiteMin: 15, excesoMs: null } }),
  fila({ id: "c", severidad: 3, estado: "Imported", origen: "wazuh", tipo: "malware", caso: { id: "~c1", numero: 1, etapa: "New", estado: "New" } }),
  fila({ id: "d", severidad: 2, estado: "Ignored", origen: "auditd", tipo: null }),
  fila({ id: "e", severidad: 3, estado: "New", origen: "wazuh", tipo: null }),
];

describe("calcularOpciones: sin filtros", () => {
  const o = calcularOpciones(FILAS, FILTROS_VACIOS, AHORA);

  it("severidades: siempre las cuatro, de Crítica a Baja, con su conteo", () => {
    expect(pares(o.severidades)).toEqual([["Crítica", 2], ["Alta", 2], ["Media", 1], ["Baja", 0]]);
  });

  it("estados: siempre los cuatro, en español", () => {
    expect(pares(o.estados)).toEqual([["Sin atender", 3], ["En progreso", 0], ["Convertida en caso", 1], ["Ignorada", 1]]);
  });

  it("herramientas: salen de los datos, en orden alfabético, con nombre legible", () => {
    expect(pares(o.origenes)).toEqual([["AuditD", 1], ["Correo", 1], ["Wazuh", 3]]);
    expect(o.origenes.map((x) => x.valor)).toEqual(["auditd", "correo", "wazuh"]);
  });

  it("tipos: alfabéticos y 'Sin clasificar' (null) siempre al final", () => {
    expect(pares(o.tipos)).toEqual([["Malware", 1], ["Phishing", 2], ["Sin clasificar", 2]]);
    expect(o.tipos[o.tipos.length - 1].valor).toBeNull();
  });
});

describe("calcularOpciones: el conteo de cada grupo respeta los DEMÁS filtros", () => {
  const o = calcularOpciones(FILAS, filtros({ severidades: [4] }), AHORA);

  it("el grupo filtrado no se afecta a sí mismo: puedes ver cuántas habría al sumar otra severidad", () => {
    expect(pares(o.severidades)).toEqual([["Crítica", 2], ["Alta", 2], ["Media", 1], ["Baja", 0]]);
  });

  it("los demás grupos cuentan solo lo que pasa el filtro de severidad", () => {
    // Críticas: a (wazuh, phishing, New) y b (correo, phishing, New)
    expect(pares(o.origenes)).toEqual([["AuditD", 0], ["Correo", 1], ["Wazuh", 1]]);
    expect(pares(o.tipos)).toEqual([["Malware", 0], ["Phishing", 2], ["Sin clasificar", 0]]);
    expect(pares(o.estados)).toEqual([["Sin atender", 2], ["En progreso", 0], ["Convertida en caso", 0], ["Ignorada", 0]]);
  });

  it("las opciones no desaparecen aunque los filtros dejen su conteo en 0", () => {
    expect(o.origenes).toHaveLength(3);
    expect(o.tipos).toHaveLength(3);
  });
});

describe("calcularOpciones: casos especiales", () => {
  it("combina filtros de varios grupos: herramienta Wazuh + fuera de SLA", () => {
    const o = calcularOpciones(FILAS, filtros({ origenes: ["wazuh"], fueraDeSla: "si" }), AHORA);
    // Con fuera de SLA = sí, solo pasa "a"
    expect(pares(o.severidades)).toEqual([["Crítica", 1], ["Alta", 0], ["Media", 0], ["Baja", 0]]);
    // Herramienta no se afecta a sí misma: con "fuera de SLA" solo "a" (wazuh)
    expect(pares(o.origenes)).toEqual([["AuditD", 0], ["Correo", 0], ["Wazuh", 1]]);
  });

  it("una opción seleccionada que ya no está en los datos se conserva con conteo 0", () => {
    const o = calcularOpciones(FILAS, filtros({ origenes: ["zeek"], tipos: ["ransomware"] }), AHORA);
    expect(o.origenes.find((x) => x.valor === "zeek")).toMatchObject({ etiqueta: "Zeek", cantidad: 0 });
    expect(o.tipos.find((x) => x.valor === "ransomware")).toMatchObject({ etiqueta: "Ransomware", cantidad: 0 });
  });

  it("los presets de fecha se resuelven con el 'ahora' recibido", () => {
    const hoy = fila({ id: "hoy", origen: "wazuh", creadaEn: AHORA - 3_600_000 });
    const hace3Dias = fila({ id: "hace3", origen: "correo", creadaEn: AHORA - 3 * 86_400_000 });
    const filtro = filtros({ fecha: { tipo: "preset", preset: "hoy" } });

    // Hoy (3 nov): solo cuenta la de hoy. Con el "ahora" de hace 3 días (31 oct), cuenta la otra.
    expect(pares(calcularOpciones([hoy, hace3Dias], filtro, AHORA).estados)[0]).toEqual(["Sin atender", 1]);
    expect(pares(calcularOpciones([hoy, hace3Dias], filtro, AHORA - 3 * 86_400_000).estados)[0]).toEqual(["Sin atender", 1]);
    expect(pares(calcularOpciones([hoy, hace3Dias], filtro, AHORA - 3 * 86_400_000).origenes)).toEqual([["Correo", 1], ["Wazuh", 0]]);
    expect(pares(calcularOpciones([hoy, hace3Dias], filtro, AHORA).origenes)).toEqual([["Correo", 0], ["Wazuh", 1]]);
  });

  it("sin alertas: sin herramientas ni tipos, pero con severidades y estados en 0", () => {
    const o = calcularOpciones([], FILTROS_VACIOS, AHORA);
    expect(o.origenes).toEqual([]);
    expect(o.tipos).toEqual([]);
    expect(o.severidades.every((x) => x.cantidad === 0)).toBe(true);
    expect(o.estados).toHaveLength(4);
  });

  it("sin alertas sin clasificar, no aparece 'Sin clasificar'", () => {
    const o = calcularOpciones([fila({ tipo: "phishing" })], FILTROS_VACIOS, AHORA);
    expect(o.tipos.map((x) => x.etiqueta)).toEqual(["Phishing"]);
  });
});

describe("chipsActivos", () => {
  it("sin filtros no hay chips", () => {
    expect(chipsActivos(FILTROS_VACIOS)).toEqual([]);
    expect(chipsActivos(filtros({ busqueda: "   " }))).toEqual([]);
  });

  it("un chip por valor, en el orden de la barra de filtros, con etiquetas en español", () => {
    const chips = chipsActivos(
      filtros({
        busqueda: "  suplantación ",
        severidades: [4, 3],
        estados: ["New"],
        origenes: ["wazuh"],
        tipos: ["fuerza-bruta", null],
        tieneCaso: "si",
        fueraDeSla: "si",
      }),
    );
    expect(chips.map((c) => c.etiqueta)).toEqual([
      "Título: “suplantación”",
      "Severidad: Crítica",
      "Severidad: Alta",
      "Estado: Sin atender",
      "Herramienta: Wazuh",
      "Tipo: Fuerza bruta",
      "Tipo: Sin clasificar",
      "Caso: con caso",
      "SLA: fuera de SLA",
    ]);
    expect(new Set(chips.map((c) => c.id)).size).toBe(chips.length); // ids únicos
  });

  it("las etiquetas de 'no' de caso y de SLA", () => {
    const chips = chipsActivos(filtros({ tieneCaso: "no", fueraDeSla: "no" }));
    expect(chips.map((c) => c.etiqueta)).toEqual(["Caso: sin caso", "SLA: dentro o sin SLA"]);
  });

  it("fecha: presets y rangos", () => {
    const etiqueta = (fecha: FiltroFecha) => chipsActivos(filtros({ fecha }))[0].etiqueta;
    const rango = (desde: string | null, hasta: string | null): FiltroFecha => ({ tipo: "rango", desde, hasta });
    expect(etiqueta({ tipo: "preset", preset: "hoy" })).toBe("Fecha: hoy");
    expect(etiqueta({ tipo: "preset", preset: 7 })).toBe("Fecha: últimos 7 días");
    expect(etiqueta({ tipo: "preset", preset: 14 })).toBe("Fecha: últimos 14 días");
    expect(etiqueta(rango("2026-10-30", "2026-11-01"))).toBe("Fecha: 30 oct – 1 nov");
    expect(etiqueta(rango("2026-10-30", "2026-10-30"))).toBe("Fecha: 30 oct");
    expect(etiqueta(rango("2026-10-30", null))).toBe("Fecha: desde 30 oct");
    expect(etiqueta(rango(null, "2026-10-30"))).toBe("Fecha: hasta 30 oct");
  });

  it("un rango sin ningún extremo no limita nada: no hay chip", () => {
    expect(chipsActivos(filtros({ fecha: { tipo: "rango", desde: null, hasta: null } }))).toEqual([]);
  });

  it("quitar un chip deja los demás filtros intactos", () => {
    const f = filtros({ severidades: [4, 3], estados: ["New"], tipos: [null], fecha: { tipo: "preset", preset: "hoy" } });
    const chips = chipsActivos(f);
    const quitar = (id: string) => chips.find((c) => c.id === id)!.quitar(f);

    expect(quitar("severidad-4").severidades).toEqual([3]);
    expect(quitar("severidad-4").estados).toEqual(["New"]);
    expect(quitar("estado-New").estados).toEqual([]);
    expect(quitar("tipo-sin-clasificar").tipos).toEqual([]);
    expect(quitar("fecha")).toMatchObject({ fecha: null, severidades: [4, 3] });
  });

  it("quitar el chip de búsqueda limpia el texto; quitar todos los chips deja los filtros vacíos", () => {
    const f = filtros({ busqueda: "x", tieneCaso: "no", fueraDeSla: "si", origenes: ["wazuh"] });
    expect(chipsActivos(f)[0].quitar(f).busqueda).toBe("");

    const sinNada = chipsActivos(f).reduce((acumulado, chip) => chip.quitar(acumulado), f);
    expect(sinNada).toEqual(FILTROS_VACIOS);
  });
});
