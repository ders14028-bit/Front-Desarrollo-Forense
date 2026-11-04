import { describe, expect, it } from "vitest";
import { ESTADO_CONFIRMADO, ESTADO_FALSO_POSITIVO, GRUPO_CONTENCION, SLA_MINUTOS, ZONA_HORARIA } from "../config";
import type { Alerta, Severidad } from "../types/alerta";
import { diaBogota } from "../utils/fechas";
import { generarMocks } from "./generarMocks";

const MIN = 60_000;
const DIA = 86_400_000;

const SEMILLAS = [1, 42, 2026, 987_654];
// 10:00 Bogotá, 23:00 Bogotá justo antes de un cambio de mes, y 00:10 Bogotá.
const AHORAS = [Date.UTC(2026, 10, 3, 15, 0), Date.UTC(2026, 10, 1, 4, 0), Date.UTC(2026, 2, 1, 5, 10)];

const hora = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fueraDeSla = (a: Alerta, ahora: number) => ahora - a._createdAt > SLA_MINUTOS[a.severity] * MIN;

// A media jornada (las 4 recientes caen todas en "hoy"): 10:00 y 23:00 en Bogotá.
describe.each(SEMILLAS.flatMap((s) => [AHORAS[0], AHORAS[1]].map((a) => ({ semilla: s, ahora: a }))))(
  "generarMocks: reparto por día (semilla $semilla, ahora $ahora)",
  ({ semilla, ahora }) => {
    const { alertas } = generarMocks(ahora, semilla);
    const porDia = new Map<string, number>();
    for (const a of alertas) porDia.set(diaBogota(a._createdAt), (porDia.get(diaBogota(a._createdAt)) ?? 0) + 1);

    it("hoy hay 4 alertas", () => {
      expect(porDia.get(diaBogota(ahora))).toBe(4);
    });

    it("ningún otro día pasa de 3 alertas (hoy no es un pico aislado)", () => {
      for (const [dia, cantidad] of porDia) {
        if (dia !== diaBogota(ahora)) expect(cantidad).toBeLessThanOrEqual(3);
      }
    });
  },
);

describe("generarMocks: determinismo", () => {
  it("misma semilla + mismo ahora = mismo resultado", () => {
    const ahora = AHORAS[0];
    expect(generarMocks(ahora, 42)).toEqual(generarMocks(ahora, 42));
  });

  it("otra semilla da otro resultado", () => {
    const ahora = AHORAS[0];
    expect(generarMocks(ahora, 1)).not.toEqual(generarMocks(ahora, 2));
  });

  it("las fechas son relativas a ahora (mover ahora 1 día mueve las fechas 1 día)", () => {
    const ahora = AHORAS[0];
    const a = generarMocks(ahora, 42).alertas;
    const b = generarMocks(ahora + DIA, 42).alertas;
    // La alerta de las 23:30 se ancla al calendario de Bogotá, así que se compara el resto.
    const sinEspecial = (lista: Alerta[]) => lista.filter((x) => hora.format(x._createdAt) !== "23:30");
    const A = sinEspecial(a);
    const B = sinEspecial(b);
    expect(B).toHaveLength(A.length);
    A.forEach((x, i) => expect(B[i]._createdAt - x._createdAt).toBe(DIA));
  });
});

describe.each(SEMILLAS.flatMap((s) => AHORAS.map((a) => ({ semilla: s, ahora: a }))))(
  "generarMocks invariantes (semilla $semilla, ahora $ahora)",
  ({ semilla, ahora }) => {
    const { alertas, casos, tareas } = generarMocks(ahora, semilla);

    it("genera ~40 alertas y ~6 casos, con ids y títulos únicos", () => {
      expect(alertas).toHaveLength(40);
      expect(casos).toHaveLength(6);
      expect(new Set(alertas.map((a) => a._id)).size).toBe(alertas.length);
      expect(new Set(alertas.map((a) => a.title)).size).toBe(alertas.length);
      expect(new Set(casos.map((c) => c._id)).size).toBe(casos.length);
      expect(new Set(tareas.map((t) => t._id)).size).toBe(tareas.length);
    });

    it("todas las alertas llevan el tag simulacion y están en los últimos 30 días", () => {
      for (const a of alertas) {
        expect(a.tags).toContain("simulacion");
        expect(a._createdAt).toBeLessThanOrEqual(ahora);
        expect(a._createdAt).toBeGreaterThan(ahora - 30 * DIA);
      }
    });

    it("severidades: más altas y medias que críticas y bajas; mayoría New", () => {
      const n = (s: Severidad) => alertas.filter((a) => a.severity === s).length;
      expect(n(3) + n(2)).toBeGreaterThan(n(4) + n(1));
      for (const s of [1, 2, 3, 4] as Severidad[]) expect(n(s)).toBeGreaterThan(0);
      expect(alertas.filter((a) => a.status === "New").length).toBeGreaterThan(alertas.length / 2);
      for (const e of ["InProgress", "Imported", "Ignored"]) {
        expect(alertas.some((a) => a.status === e)).toBe(true);
      }
    });

    it("fuentes y escenarios: están todos, y 8 alertas no tienen escenario", () => {
      expect(new Set(alertas.map((a) => a.source))).toEqual(new Set(["wazuh", "sysmon", "auditd", "misp", "correo"]));
      const escenarios = alertas.flatMap((a) => a.tags.filter((t) => t.startsWith("escenario:")));
      expect(new Set(escenarios)).toEqual(
        new Set(
          ["fuerza-bruta", "phishing", "malware", "vulnerabilidad", "escalamiento", "correlacion", "inteligencia-misp"].map(
            (e) => `escenario:${e}`,
          ),
        ),
      );
      expect(alertas.filter((a) => !a.tags.some((t) => t.startsWith("escenario:")))).toHaveLength(8);
      for (const a of alertas) expect(a.tags.filter((t) => t.startsWith("escenario:")).length).toBeLessThanOrEqual(1);
    });

    it("cada caseId de una alerta existe en casos, y esas alertas están en Imported", () => {
      const ids = new Set(casos.map((c) => c._id));
      const conCaso = alertas.filter((a) => a.caseId !== undefined);
      expect(conCaso.length).toBeGreaterThan(0);
      for (const a of conCaso) {
        expect(ids.has(a.caseId!)).toBe(true);
        expect(a.status).toBe("Imported");
      }
      // y al revés: toda Imported tiene su caso
      for (const a of alertas.filter((x) => x.status === "Imported")) expect(a.caseId).toBeDefined();
    });

    it("fechas en orden: caso después de su alerta; endDate después de _createdAt", () => {
      for (const c of casos) {
        const alerta = alertas.find((a) => a.caseId === c._id)!;
        expect(c._createdAt).toBeGreaterThan(alerta._createdAt);
        expect(c._createdAt).toBeLessThan(ahora);
        if (c.stage === "Closed") {
          expect(c.endDate).toBeGreaterThan(c._createdAt);
          expect(c.endDate!).toBeLessThanOrEqual(ahora);
        } else {
          expect(c.endDate).toBeUndefined();
        }
      }
      for (const t of tareas) {
        const caso = casos.find((c) => c._id === t.caseId)!;
        expect(t._createdAt).toBeGreaterThan(caso._createdAt);
        if (t.status === "Completed") {
          expect(t.endDate).toBeGreaterThan(t._createdAt);
          if (caso.endDate) expect(t.endDate!).toBeLessThanOrEqual(caso.endDate);
          expect(t.endDate!).toBeLessThanOrEqual(ahora);
        }
      }
    });

    it("existe una alerta creada a las 23:30 de Bogotá, cuyo día en Bogotá difiere del día en UTC", () => {
      const especial = alertas.filter((a) => hora.format(a._createdAt) === "23:30");
      expect(especial.length).toBeGreaterThanOrEqual(1);
      for (const a of especial) {
        expect(diaBogota(a._createdAt)).not.toBe(new Date(a._createdAt).toISOString().slice(0, 10));
      }
    });

    it("hay alertas New dentro y fuera de SLA, en cada severidad", () => {
      const nuevas = alertas.filter((a) => a.status === "New");
      for (const s of [1, 2, 3, 4] as Severidad[]) {
        const deSeveridad = nuevas.filter((a) => a.severity === s);
        expect(deSeveridad.some((a) => !fueraDeSla(a, ahora))).toBe(true);
        expect(deSeveridad.some((a) => fueraDeSla(a, ahora))).toBe(true);
      }
    });

    it("las únicas alertas de las últimas 24 h son las 4 sin atender dentro de SLA (no hay pico)", () => {
      const recientes = alertas.filter((a) => ahora - a._createdAt < DIA);
      expect(recientes).toHaveLength(4);
      for (const a of recientes) {
        expect(a.status).toBe("New");
        expect(fueraDeSla(a, ahora)).toBe(false);
      }
      expect(new Set(recientes.map((a) => a.severity))).toEqual(new Set([1, 2, 3, 4]));
    });

    it("casos: abiertos, en progreso, ≥2 TruePositive cerrados y un FalsePositive", () => {
      expect(casos.some((c) => c.stage === "New")).toBe(true);
      expect(casos.some((c) => c.stage === "InProgress")).toBe(true);
      const confirmados = casos.filter((c) => c.stage === "Closed" && c.status === ESTADO_CONFIRMADO);
      expect(confirmados.length).toBeGreaterThanOrEqual(2);
      expect(casos.filter((c) => c.stage === "Closed" && c.status === ESTADO_FALSO_POSITIVO)).toHaveLength(1);
    });

    it("tareas: Contención completadas y pendientes, y de otro grupo para no contarlas", () => {
      const contencion = tareas.filter((t) => t.group === GRUPO_CONTENCION);
      expect(contencion.some((t) => t.status === "Completed")).toBe(true);
      expect(contencion.some((t) => t.status !== "Completed")).toBe(true);
      expect(tareas.some((t) => t.group !== GRUPO_CONTENCION && t.status === "Completed")).toBe(true);
    });
  },
);
