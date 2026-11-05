import { describe, expect, it } from "vitest";
import { ESTADO_CONFIRMADO, ESTADO_FALSO_POSITIVO, GRUPO_CONTENCION } from "../config";
import type { Alerta } from "../types/alerta";
import type { Caso } from "../types/caso";
import type { Tarea } from "../types/tarea";
import { calcularResumen } from "./metricas";

// Datos armados a mano y resultados escritos a mano: NO se usa generarMocks aquí.

const MIN = 60_000;
const HORA = 60 * MIN;
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
  _createdAt: hace(10_000),
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
  _createdAt: hace(1000),
  title: "Tarea de prueba",
  group: GRUPO_CONTENCION,
  status: "Completed",
  ...p,
});

describe("calcularResumen: listas vacías", () => {
  const r = calcularResumen([], [], [], AHORA);

  it("todo en 0, vacío o null, sin inventar datos", () => {
    expect(r.generadoEn).toBe(AHORA);
    expect(r.datosDeLaboratorio).toBe(false);
    expect(r.alertas).toMatchObject({
      recibidas: 0,
      sinAtender: 0,
      criticasYAltas: 0,
      masAntiguaSinAtenderMs: null,
      antiguedadPromedioSinAtenderMs: null,
      fueraDeSla: 0,
      porTipoAmenaza: [],
      sinClasificar: 0,
      porOrigen: [],
    });
    expect(r.alertas.porSeveridad).toEqual([
      { severidad: 4, cantidad: 0 },
      { severidad: 3, cantidad: 0 },
      { severidad: 2, cantidad: 0 },
      { severidad: 1, cantidad: 0 },
    ]);
    expect(r.casos).toEqual({
      reportados: 0,
      abiertos: 0,
      enProgreso: 0,
      cerrados: 0,
      alertasConvertidas: { convertidas: 0, total: 0, porcentaje: null },
      contencionesHechas: 0,
      confirmadosYCerrados: 0,
      tiempoPromedioCierreMs: null,
    });
  });

  it("la serie por día tiene 30 días terminando hoy (Bogotá), todos en 0", () => {
    expect(r.alertas.porDia).toHaveLength(30);
    expect(r.alertas.porDia[0].dia).toBe("2026-10-05");
    expect(r.alertas.porDia[29].dia).toBe("2026-11-03");
    expect(r.alertas.porDia.every((d) => d.cantidad === 0)).toBe(true);
  });
});

describe("calcularResumen: conteos de alertas", () => {
  it("recibidas, sin atender, críticas y altas, por severidad", () => {
    const r = calcularResumen(
      [
        alerta({ severity: 4, status: "New", _createdAt: hace(10) }), // crítica, a tiempo
        alerta({ severity: 3, status: "New", _createdAt: hace(31) }), // alta, fuera de SLA (30)
        alerta({ severity: 2, status: "InProgress" }),
        alerta({ severity: 1, status: "Ignored" }),
        alerta({ severity: 3, status: "Imported", caseId: "~c1" }),
      ],
      [],
      [],
      AHORA,
    ).alertas;

    expect(r.recibidas).toBe(5);
    expect(r.sinAtender).toBe(2);
    expect(r.criticasYAltas).toBe(3); // severidades 4, 3 y 3
    expect(r.fueraDeSla).toBe(1);
    expect(r.porSeveridad).toEqual([
      { severidad: 4, cantidad: 1 },
      { severidad: 3, cantidad: 2 },
      { severidad: 2, cantidad: 1 },
      { severidad: 1, cantidad: 1 },
    ]);
  });
});

describe("calcularResumen: SLA", () => {
  it("justo en el límite NO cuenta como fuera de SLA; un instante después, sí", () => {
    const r = calcularResumen(
      [
        alerta({ severity: 4, _createdAt: hace(15) }), // exactamente 15 min: a tiempo
        alerta({ severity: 4, _createdAt: hace(15) - 1 }), // 15 min + 1 ms: fuera
        alerta({ severity: 1, _createdAt: hace(240) }), // exactamente 240 min: a tiempo
        alerta({ severity: 2, _createdAt: hace(119) }), // a tiempo (SLA 120)
        alerta({ severity: 2, _createdAt: hace(121) }), // fuera
        alerta({ severity: 3, status: "InProgress", _createdAt: hace(10_000) }), // no es New: no cuenta
      ],
      [],
      [],
      AHORA,
    ).alertas;

    expect(r.sinAtender).toBe(5);
    expect(r.fueraDeSla).toBe(2);
  });
});

describe("calcularResumen: antigüedad de las sin atender", () => {
  it("usa solo las New: más antigua y promedio", () => {
    const r = calcularResumen(
      [
        alerta({ status: "New", _createdAt: hace(60) }),
        alerta({ status: "New", _createdAt: hace(180) }),
        alerta({ status: "InProgress", _createdAt: hace(14_400) }), // 10 días: se ignora
      ],
      [],
      [],
      AHORA,
    ).alertas;

    expect(r.masAntiguaSinAtenderMs).toBe(180 * MIN);
    expect(r.antiguedadPromedioSinAtenderMs).toBe(120 * MIN); // (60 + 180) / 2
  });

  it("sin alertas New, ambas son null", () => {
    const r = calcularResumen([alerta({ status: "Ignored" }), alerta({ status: "Imported" })], [], [], AHORA).alertas;
    expect(r.masAntiguaSinAtenderMs).toBeNull();
    expect(r.antiguedadPromedioSinAtenderMs).toBeNull();
  });
});

describe("calcularResumen: tipo de amenaza y herramienta", () => {
  it("agrupa por etiqueta escenario:, ordena de mayor a menor y deja 'Sin clasificar' aparte", () => {
    const r = calcularResumen(
      [
        alerta({ tags: ["simulacion", "escenario:phishing"] }),
        alerta({ tags: ["escenario:phishing", "otra"] }),
        alerta({ tags: ["escenario:malware"] }),
        alerta({ tags: ["escenario:fuerza-bruta"] }),
        alerta({ tags: ["simulacion"] }), // sin escenario
        // el título y el source dicen phishing, pero NO se deduce el tipo
        alerta({ tags: [], title: "Correo de phishing", source: "correo" }),
      ],
      [],
      [],
      AHORA,
    ).alertas;

    // phishing = 2; fuerza-bruta y malware empatan en 1 y se ordenan por nombre
    expect(r.porTipoAmenaza).toEqual([
      { tipo: "phishing", cantidad: 2 },
      { tipo: "fuerza-bruta", cantidad: 1 },
      { tipo: "malware", cantidad: 1 },
    ]);
    expect(r.sinClasificar).toBe(2);
  });

  it("agrupa por source, de mayor a menor", () => {
    const r = calcularResumen(
      [
        alerta({ source: "wazuh" }),
        alerta({ source: "correo" }),
        alerta({ source: "wazuh" }),
        alerta({ source: "misp" }),
        alerta({ source: "wazuh" }),
        alerta({ source: "correo" }),
      ],
      [],
      [],
      AHORA,
    ).alertas;

    expect(r.porOrigen).toEqual([
      { origen: "wazuh", cantidad: 3 },
      { origen: "correo", cantidad: 2 },
      { origen: "misp", cantidad: 1 },
    ]);
  });
});

describe("calcularResumen: serie por día (Bogotá)", () => {
  it("agrupa por día de Bogotá, con ceros, y deja fuera lo anterior a 30 días", () => {
    const r = calcularResumen(
      [
        alerta({ _createdAt: Date.UTC(2026, 9, 31, 4, 30) }), // 30 oct 23:30 Bogotá
        alerta({ _createdAt: Date.UTC(2026, 9, 31, 5, 30) }), // 31 oct 00:30 Bogotá
        alerta({ _createdAt: hace(30) }), // hoy
        alerta({ _createdAt: hace(90) }), // hoy
        alerta({ _createdAt: AHORA - 40 * 24 * HORA }), // hace 40 días: fuera de la serie
      ],
      [],
      [],
      AHORA,
    ).alertas;

    expect(r.recibidas).toBe(5); // el total sí la cuenta
    expect(r.porDia).toHaveLength(30);
    expect(r.porDia.find((d) => d.dia === "2026-10-30")?.cantidad).toBe(1);
    expect(r.porDia.find((d) => d.dia === "2026-10-31")?.cantidad).toBe(1);
    expect(r.porDia.find((d) => d.dia === "2026-11-03")?.cantidad).toBe(2);
    expect(r.porDia.reduce((suma, d) => suma + d.cantidad, 0)).toBe(4);
  });
});

describe("calcularResumen: casos", () => {
  it("abiertos, en progreso y cerrados; el FalsePositive cuenta como cerrado pero no como confirmado", () => {
    const r = calcularResumen(
      [],
      [
        caso({ stage: "New", status: "New" }),
        caso({ stage: "InProgress", status: "InProgress" }),
        caso({ stage: "InProgress", status: "InProgress" }),
        caso({ stage: "Closed", status: ESTADO_CONFIRMADO, _createdAt: hace(1000), endDate: hace(1000) + 2 * HORA }),
        caso({ stage: "Closed", status: ESTADO_CONFIRMADO, _createdAt: hace(1000), endDate: hace(1000) + 4 * HORA }),
        caso({ stage: "Closed", status: ESTADO_FALSO_POSITIVO, _createdAt: hace(1000), endDate: hace(1000) + 6 * HORA }),
      ],
      [],
      AHORA,
    ).casos;

    expect(r.reportados).toBe(6);
    expect(r.abiertos).toBe(1);
    expect(r.enProgreso).toBe(2);
    expect(r.cerrados).toBe(3);
    expect(r.confirmadosYCerrados).toBe(2);
    expect(r.tiempoPromedioCierreMs).toBe(4 * HORA); // (2 + 4 + 6) / 3, todos los cerrados
  });

  it("confirmado exige estar cerrado; un cerrado sin endDate no entra en el promedio", () => {
    const r = calcularResumen(
      [],
      [
        caso({ stage: "InProgress", status: ESTADO_CONFIRMADO }), // aún no cerrado: no cuenta
        caso({ stage: "Closed", status: ESTADO_CONFIRMADO, _createdAt: hace(1000), endDate: hace(1000) + 2 * HORA }),
        caso({ stage: "Closed", status: ESTADO_FALSO_POSITIVO }), // sin endDate
      ],
      [],
      AHORA,
    ).casos;

    expect(r.cerrados).toBe(2);
    expect(r.confirmadosYCerrados).toBe(1);
    expect(r.tiempoPromedioCierreMs).toBe(2 * HORA);
  });

  it("sin casos cerrados, el tiempo promedio de cierre es null", () => {
    const r = calcularResumen([], [caso({ stage: "New" }), caso({ stage: "InProgress" })], [], AHORA).casos;
    expect(r.cerrados).toBe(0);
    expect(r.tiempoPromedioCierreMs).toBeNull();
  });
});

describe("calcularResumen: alertas convertidas", () => {
  it("cuenta las alertas con caseId y su porcentaje sobre las recibidas", () => {
    const r = calcularResumen(
      [alerta({ caseId: "~c1", status: "Imported" }), alerta(), alerta(), alerta()],
      [],
      [],
      AHORA,
    ).casos.alertasConvertidas;

    expect(r).toEqual({ convertidas: 1, total: 4, porcentaje: 25 });
  });
});

describe("calcularResumen: contenciones", () => {
  it("cuenta solo tareas del grupo Contención en estado Completed", () => {
    const r = calcularResumen(
      [],
      [],
      [
        tarea({ group: GRUPO_CONTENCION, status: "Completed" }),
        tarea({ group: GRUPO_CONTENCION, status: "Completed" }),
        tarea({ group: GRUPO_CONTENCION, status: "InProgress" }),
        tarea({ group: GRUPO_CONTENCION, status: "Cancel" }),
        tarea({ group: "Análisis", status: "Completed" }), // otro grupo: no cuenta
      ],
      AHORA,
    ).casos;

    expect(r.contencionesHechas).toBe(2);
  });
});

describe("calcularResumen: datos de laboratorio", () => {
  it("se marca si hay alertas con type simulacion", () => {
    expect(calcularResumen([alerta({ type: "simulacion" })], [], [], AHORA).datosDeLaboratorio).toBe(true);
  });

  it("una alerta con la etiqueta simulacion pero type wazuh NO se marca (ni un caso con la etiqueta)", () => {
    const real = alerta({ type: "wazuh", tags: ["simulacion"] });
    expect(calcularResumen([real], [caso({ tags: ["simulacion"] })], [], AHORA).datosDeLaboratorio).toBe(false);
  });

  it("no se marca si no hay datos de prueba", () => {
    expect(calcularResumen([alerta({ tags: ["escenario:phishing"] })], [caso()], [], AHORA).datosDeLaboratorio).toBe(
      false,
    );
  });
});
