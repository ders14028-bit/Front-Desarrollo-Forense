import { describe, expect, it } from "vitest";
import type { Alerta } from "../types/alerta";
import type { Caso } from "../types/caso";
import type { Tarea } from "../types/tarea";
import { construirDetalle, construirFilaAlerta, construirListaAlertas } from "./alertas";

// Datos armados a mano y resultados escritos a mano: NO se usa generarMocks aquí.

const MIN = 60_000;
const DIA = 86_400_000;
// 3 nov 2026, 10:00 en Bogotá (15:00 UTC)
const AHORA = Date.UTC(2026, 10, 3, 15, 0);
const hace = (min: number) => AHORA - min * MIN;

const alerta = (p: Partial<Alerta> = {}): Alerta => ({
  _id: "~1",
  _type: "Alert",
  _createdBy: "test",
  _createdAt: hace(60),
  type: "test",
  source: "wazuh",
  sourceRef: "ref",
  title: "Alerta de prueba",
  description: "",
  severity: 2,
  severityLabel: "MEDIUM",
  date: 0,
  tags: [],
  tlp: 2,
  tlpLabel: "AMBER",
  pap: 2,
  papLabel: "AMBER",
  follow: true,
  customFields: [],
  observableCount: 0,
  status: "New",
  stage: "New",
  extraData: {},
  newDate: 0,
  timeToDetect: 0,
  ...p,
});

const caso = (p: Partial<Caso> = {}): Caso => ({
  _id: "~c1",
  _type: "case",
  _createdAt: hace(1000),
  number: 1,
  title: "Caso de prueba",
  severity: 2,
  status: "New",
  stage: "New",
  tags: [],
  ...p,
});

const tarea = (p: Partial<Tarea> = {}): Tarea => ({
  _id: "~t1",
  _type: "task",
  _createdAt: hace(900),
  title: "Tarea de prueba",
  group: "Contención",
  status: "Waiting",
  ...p,
});

describe("construirFilaAlerta: campos y SLA", () => {
  it("una sin atender fuera de SLA: antigüedad, tipo, exceso", () => {
    const fila = construirFilaAlerta(
      alerta({
        _id: "~9",
        title: "Correo sospechoso",
        source: "correo",
        severity: 3,
        _createdAt: hace(31),
        tags: ["simulacion", "escenario:phishing"],
      }),
      [],
      AHORA,
    );

    expect(fila).toEqual({
      id: "~9",
      creadaEn: hace(31),
      titulo: "Correo sospechoso",
      severidad: 3,
      estado: "New",
      origen: "correo",
      tipo: "phishing",
      antiguedadMs: 31 * MIN,
      sla: { estado: "fuera", limiteMin: 30, excesoMs: 1 * MIN },
      caso: null,
    });
  });

  it("justo en el límite del SLA todavía está a tiempo; 1 ms después, fuera", () => {
    const enElLimite = construirFilaAlerta(alerta({ severity: 4, _createdAt: hace(15) }), [], AHORA);
    expect(enElLimite.sla).toEqual({ estado: "dentro", limiteMin: 15, excesoMs: null });

    const pasado = construirFilaAlerta(alerta({ severity: 4, _createdAt: hace(15) - 1 }), [], AHORA);
    expect(pasado.sla).toEqual({ estado: "fuera", limiteMin: 15, excesoMs: 1 });
  });

  it("si no está sin atender, el SLA no aplica (null) aunque sea muy antigua", () => {
    for (const status of ["InProgress", "Imported", "Ignored"] as const) {
      const fila = construirFilaAlerta(alerta({ severity: 2, status, stage: status, _createdAt: hace(20_000) }), [], AHORA);
      expect(fila.sla).toEqual({ estado: null, limiteMin: 120, excesoMs: null });
    }
  });

  it("sin etiqueta escenario: el tipo es null (no se deduce del título)", () => {
    const fila = construirFilaAlerta(alerta({ title: "Intento de phishing", tags: ["simulacion"] }), [], AHORA);
    expect(fila.tipo).toBeNull();
  });

  it("una alerta con fecha futura tiene antigüedad 0, nunca negativa", () => {
    expect(construirFilaAlerta(alerta({ _createdAt: AHORA + 5 * MIN }), [], AHORA).antiguedadMs).toBe(0);
  });
});

describe("construirFilaAlerta: caso", () => {
  const casos = [
    caso({ _id: "~c1", number: 3, stage: "InProgress", status: "InProgress" }),
    caso({ _id: "~c2", number: 5, stage: "Closed", status: "TruePositive" }),
  ];

  it("resume el caso (número, etapa y estado)", () => {
    expect(construirFilaAlerta(alerta({ status: "Imported", caseId: "~c1" }), casos, AHORA).caso).toEqual({
      id: "~c1",
      numero: 3,
      etapa: "InProgress",
      estado: "InProgress",
    });
    expect(construirFilaAlerta(alerta({ status: "Imported", caseId: "~c2" }), casos, AHORA).caso).toEqual({
      id: "~c2",
      numero: 5,
      etapa: "Closed",
      estado: "TruePositive",
    });
  });

  it("con caseId pero sin el caso disponible: sí tiene caso, con datos en null", () => {
    expect(construirFilaAlerta(alerta({ status: "Imported", caseId: "~c9" }), casos, AHORA).caso).toEqual({
      id: "~c9",
      numero: null,
      etapa: null,
      estado: null,
    });
  });

  it("sin caseId: no tiene caso", () => {
    expect(construirFilaAlerta(alerta(), casos, AHORA).caso).toBeNull();
  });
});

describe("construirListaAlertas", () => {
  it("incluye los últimos 30 días en Bogotá (desde el 5 oct) y deja fuera lo anterior", () => {
    const lista = construirListaAlertas(
      [
        alerta({ _id: "hoy", _createdAt: hace(60) }),
        alerta({ _id: "5oct", _createdAt: Date.UTC(2026, 9, 6, 4, 59) }), // 5 oct 23:59 Bogotá: dentro
        alerta({ _id: "4oct", _createdAt: Date.UTC(2026, 9, 5, 4, 59) }), // 4 oct 23:59 Bogotá: fuera
        alerta({ _id: "viejo", _createdAt: AHORA - 40 * DIA }),
      ],
      [],
      AHORA,
    );

    expect(lista.alertas.map((f) => f.id)).toEqual(["hoy", "5oct"]);
    expect(lista.total).toBe(2);
    expect(lista.truncado).toBe(false);
    expect(lista.composicion).toEqual({ recientes: 2, criticasYAltasAdicionales: 0 });
    expect(lista.generadoEn).toBe(AHORA);
  });

  it("ordena de la más reciente a la más antigua", () => {
    const lista = construirListaAlertas(
      [
        alerta({ _id: "b", _createdAt: hace(500) }),
        alerta({ _id: "a", _createdAt: hace(10) }),
        alerta({ _id: "c", _createdAt: hace(3000) }),
      ],
      [],
      AHORA,
    );
    expect(lista.alertas.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("aplica el tope: conserva las más recientes, total cuenta todas y truncado avisa", () => {
    const tres = [
      alerta({ _id: "a", _createdAt: hace(10) }),
      alerta({ _id: "b", _createdAt: hace(20) }),
      alerta({ _id: "c", _createdAt: hace(30) }),
    ];

    const cortada = construirListaAlertas(tres, [], AHORA, { tope: 2 });
    expect(cortada.alertas.map((f) => f.id)).toEqual(["a", "b"]);
    expect(cortada.total).toBe(3);
    expect(cortada.truncado).toBe(true);
    expect(cortada.composicion).toEqual({ recientes: 2, criticasYAltasAdicionales: 0 });

    const completa = construirListaAlertas(tres, [], AHORA, { tope: 3 });
    expect(completa.alertas).toHaveLength(3);
    expect(completa.truncado).toBe(false);
  });

  it("con tope, añade TODAS las críticas y altas sin atender más antiguas, y solo esas", () => {
    const lista = construirListaAlertas(
      [
        alerta({ _id: "r1", _createdAt: hace(10), severity: 1 }),
        alerta({ _id: "r2", _createdAt: hace(20), severity: 1 }),
        alerta({ _id: "critica-vieja", _createdAt: hace(300), severity: 4, status: "New" }),
        alerta({ _id: "alta-vieja", _createdAt: hace(400), severity: 3, status: "New" }),
        alerta({ _id: "alta-atendida", _createdAt: hace(500), severity: 3, status: "InProgress" }),
        alerta({ _id: "media-vieja", _createdAt: hace(600), severity: 2, status: "New" }),
      ],
      [],
      AHORA,
      { tope: 2 },
    );

    expect(lista.alertas.map((f) => f.id)).toEqual(["r1", "r2", "critica-vieja", "alta-vieja"]);
    expect(lista.total).toBe(6);
    expect(lista.truncado).toBe(true);
    expect(lista.composicion).toEqual({ recientes: 2, criticasYAltasAdicionales: 2 });
  });

  it("si todas las que quedan fuera del tope son críticas o altas sin atender, no hay truncado", () => {
    const lista = construirListaAlertas(
      [
        alerta({ _id: "r1", _createdAt: hace(10), severity: 1 }),
        alerta({ _id: "vieja", _createdAt: hace(300), severity: 4, status: "New" }),
      ],
      [],
      AHORA,
      { tope: 1 },
    );

    expect(lista.alertas).toHaveLength(2);
    expect(lista.truncado).toBe(false);
    expect(lista.composicion).toEqual({ recientes: 1, criticasYAltasAdicionales: 1 });
  });

  it("marca datos de laboratorio solo si hay alertas con type simulacion", () => {
    expect(construirListaAlertas([alerta({ type: "simulacion" })], [], AHORA).datosDeLaboratorio).toBe(true);
    expect(construirListaAlertas([alerta()], [caso()], AHORA).datosDeLaboratorio).toBe(false);
  });

  it("una alerta con la etiqueta simulacion pero type wazuh NO es de laboratorio", () => {
    const real = alerta({ type: "wazuh", tags: ["simulacion"] });
    expect(construirListaAlertas([real], [caso({ tags: ["simulacion"] })], AHORA).datosDeLaboratorio).toBe(false);
  });

  it("sin alertas: lista vacía y sin truncar", () => {
    expect(construirListaAlertas([], [], AHORA)).toEqual({
      generadoEn: AHORA,
      total: 0,
      truncado: false,
      composicion: { recientes: 0, criticasYAltasAdicionales: 0 },
      datosDeLaboratorio: false,
      alertas: [],
    });
  });

  it("cada fila lleva su caso", () => {
    const lista = construirListaAlertas(
      [alerta({ _id: "a", status: "Imported", caseId: "~c1" })],
      [caso({ _id: "~c1", number: 7, stage: "New", status: "New" })],
      AHORA,
    );
    expect(lista.alertas[0].caso).toEqual({ id: "~c1", numero: 7, etapa: "New", estado: "New" });
  });
});

describe("construirDetalle", () => {
  const casos = [caso({ _id: "~c1", number: 3 }), caso({ _id: "~c2", number: 4 })];
  const tareas = [
    tarea({ _id: "t1", caseId: "~c1" }),
    tarea({ _id: "t2", caseId: "~c2" }),
    tarea({ _id: "t3", caseId: "~c1", status: "Completed" }),
  ];

  it("devuelve la alerta completa, su fila y su caso con SOLO sus tareas", () => {
    const a = alerta({ _id: "a", status: "Imported", caseId: "~c1" });
    const d = construirDetalle("a", [alerta({ _id: "otra" }), a], casos, tareas, AHORA)!;

    expect(d.alerta).toBe(a);
    expect(d.generadoEn).toBe(AHORA);
    expect(d.fila.caso?.numero).toBe(3);
    expect(d.caso?._id).toBe("~c1");
    expect(d.caso?.tareas.map((t) => t._id)).toEqual(["t1", "t3"]);
  });

  it("sin caso: caso null", () => {
    const d = construirDetalle("a", [alerta({ _id: "a" })], casos, tareas, AHORA)!;
    expect(d.caso).toBeNull();
    expect(d.fila.caso).toBeNull();
  });

  it("con caseId pero sin el caso disponible: caso null, y la fila lo indica con datos null", () => {
    const d = construirDetalle("a", [alerta({ _id: "a", status: "Imported", caseId: "~c9" })], casos, tareas, AHORA)!;
    expect(d.caso).toBeNull();
    expect(d.fila.caso).toEqual({ id: "~c9", numero: null, etapa: null, estado: null });
  });

  it("una alerta que no existe devuelve null", () => {
    expect(construirDetalle("no-existe", [alerta({ _id: "a" })], casos, tareas, AHORA)).toBeNull();
  });
});
