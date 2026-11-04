import { describe, expect, it } from "vitest";
import type { Alerta } from "../types/alerta";
import type { CasoDetalle, DetalleAlerta } from "../types/listaAlertas";
import type { Tarea } from "../types/tarea";
import { construirLineaDeTiempo } from "./lineaDeTiempo";

// Datos armados a mano y resultados escritos a mano.

const MIN = 60_000;
const H = 60 * MIN;
const T0 = Date.UTC(2026, 10, 1, 15, 0); // creación de la alerta
const en = (min: number) => T0 + min * MIN;

const alerta = (p: Partial<Alerta> = {}): Alerta => ({
  _id: "~a1",
  _type: "Alert",
  _createdBy: "test",
  _createdAt: T0,
  type: "test",
  source: "wazuh",
  sourceRef: "ref",
  title: "Alerta de prueba",
  description: "",
  severity: 3,
  severityLabel: "HIGH",
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

const caso = (p: Partial<CasoDetalle> = {}): CasoDetalle => ({
  _id: "~c1",
  _type: "case",
  _createdAt: en(80),
  number: 3,
  title: "Troyano en equipo de biblioteca",
  severity: 3,
  status: "InProgress",
  stage: "InProgress",
  tags: [],
  tareas: [],
  ...p,
});

const tarea = (p: Partial<Tarea>): Tarea => ({
  _id: "~t1",
  _type: "task",
  _createdAt: en(90),
  title: "Aislar el equipo",
  group: "Contención",
  status: "Waiting",
  caseId: "~c1",
  ...p,
});

const detalle = (a: Alerta, c: CasoDetalle | null): DetalleAlerta => ({
  generadoEn: en(10_000),
  alerta: a,
  fila: {} as DetalleAlerta["fila"], // la línea de tiempo no usa la fila
  caso: c,
});

describe("construirLineaDeTiempo", () => {
  it("una alerta sin caso solo tiene el evento de creación", () => {
    const e = construirLineaDeTiempo(detalle(alerta(), null));
    expect(e).toEqual([
      {
        id: "alerta-creada",
        tipo: "alerta-creada",
        titulo: "Alerta creada",
        detalle: "Herramienta: Wazuh",
        fecha: T0,
        transcurridoMs: 0,
      },
    ]);
  });

  it("con caso abierto: alerta → caso → tareas completadas por fecha → tareas pendientes sin hora", () => {
    const e = construirLineaDeTiempo(
      detalle(
        alerta(),
        caso({
          tareas: [
            tarea({ _id: "t-tarde", title: "Bloquear la IP", status: "Completed", endDate: en(200) }),
            tarea({ _id: "t-pendiente", title: "Restablecer credenciales", status: "Waiting" }),
            tarea({ _id: "t-temprano", title: "Aislar el equipo", status: "Completed", endDate: en(120) }),
            tarea({ _id: "t-curso", title: "Revisar el DNS", group: "Análisis", status: "InProgress" }),
          ],
        }),
      ),
    );

    expect(e.map((x) => [x.tipo, x.titulo, x.fecha, x.transcurridoMs])).toEqual([
      ["alerta-creada", "Alerta creada", en(0), 0],
      ["caso-creado", "Convertida en caso #3", en(80), 80 * MIN],
      ["tarea-completada", "Tarea completada", en(120), 120 * MIN],
      ["tarea-completada", "Tarea completada", en(200), 200 * MIN],
      ["tarea-pendiente", "Tarea pendiente", null, null],
      ["tarea-pendiente", "Tarea pendiente", null, null],
    ]);
    // las completadas llevan el título y el grupo; las pendientes, además, su estado
    expect(e[2].detalle).toBe("Aislar el equipo · Contención");
    expect(e[4].detalle).toBe("Restablecer credenciales · Contención · En espera");
    expect(e[5].detalle).toBe("Revisar el DNS · Análisis · En curso");
    expect(e[1].detalle).toBe("Troyano en equipo de biblioteca");
  });

  it("caso cerrado: el cierre va al final de los fechados, con su resolución y el tiempo transcurrido", () => {
    const e = construirLineaDeTiempo(
      detalle(
        alerta(),
        caso({
          stage: "Closed",
          status: "TruePositive",
          endDate: en(1000),
          tareas: [tarea({ status: "Completed", endDate: en(150) })],
        }),
      ),
    );

    expect(e.map((x) => x.tipo)).toEqual(["alerta-creada", "caso-creado", "tarea-completada", "caso-cerrado"]);
    const cierre = e[3];
    expect(cierre.titulo).toBe("Caso #3 cerrado");
    expect(cierre.detalle).toBe("Resolución: Confirmado");
    expect(cierre.fecha).toBe(en(1000));
    expect(cierre.transcurridoMs).toBe(1000 * MIN);
  });

  it("solo eventos con fecha real: sin endDate no hay evento de cierre", () => {
    const e = construirLineaDeTiempo(detalle(alerta(), caso({ stage: "Closed", status: "FalsePositive" })));
    expect(e.map((x) => x.tipo)).toEqual(["alerta-creada", "caso-creado"]);
  });

  it("tareas canceladas no aparecen; completadas sin fecha aparecen al final, sin hora y sin inventar una", () => {
    const e = construirLineaDeTiempo(
      detalle(
        alerta(),
        caso({
          tareas: [
            tarea({ _id: "t-cancel", title: "Cancelada", status: "Cancel" }),
            tarea({ _id: "t-sinfecha", title: "Sin fecha", status: "Completed" }),
          ],
        }),
      ),
    );
    expect(e.map((x) => x.tipo)).toEqual(["alerta-creada", "caso-creado", "tarea-sin-fecha"]);
    expect(e[2]).toMatchObject({ fecha: null, transcurridoMs: null });
    expect(e.find((x) => x.detalle?.includes("Cancelada"))).toBeUndefined();
  });

  it("a igualdad de fecha: caso, luego tareas, luego cierre", () => {
    const mismo = en(100);
    const e = construirLineaDeTiempo(
      detalle(
        alerta(),
        caso({
          _createdAt: mismo,
          stage: "Closed",
          status: "TruePositive",
          endDate: mismo,
          tareas: [tarea({ status: "Completed", endDate: mismo })],
        }),
      ),
    );
    expect(e.map((x) => x.tipo)).toEqual(["alerta-creada", "caso-creado", "tarea-completada", "caso-cerrado"]);
  });

  it("los eventos con fecha van ordenados por fecha aunque lleguen desordenados", () => {
    const e = construirLineaDeTiempo(
      detalle(
        alerta(),
        caso({
          _createdAt: en(500), // el caso se creó después de las tareas (datos raros, pero reales)
          tareas: [tarea({ status: "Completed", endDate: en(60) })],
        }),
      ),
    );
    const fechas = e.map((x) => x.fecha!);
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
    expect(e.map((x) => x.tipo)).toEqual(["alerta-creada", "tarea-completada", "caso-creado"]);
  });

  it("el tiempo transcurrido nunca es negativo (un evento 'anterior' a la alerta cuenta 0)", () => {
    const e = construirLineaDeTiempo(detalle(alerta(), caso({ _createdAt: T0 - 5 * H })));
    expect(e.find((x) => x.tipo === "caso-creado")!.transcurridoMs).toBe(0);
  });

  it("todos los ids son únicos y los eventos fechados tienen transcurrido; los demás, null", () => {
    const e = construirLineaDeTiempo(
      detalle(
        alerta(),
        caso({
          stage: "Closed",
          status: "TruePositive",
          endDate: en(900),
          tareas: [
            tarea({ _id: "t1", status: "Completed", endDate: en(100) }),
            tarea({ _id: "t2", status: "Waiting" }),
          ],
        }),
      ),
    );
    expect(new Set(e.map((x) => x.id)).size).toBe(e.length);
    for (const x of e) {
      if (x.fecha === null) expect(x.transcurridoMs).toBeNull();
      else expect(x.transcurridoMs).toBe(Math.max(0, x.fecha - T0));
    }
  });
});
