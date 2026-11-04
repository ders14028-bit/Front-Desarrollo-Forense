import { describe, expect, it } from "vitest";
import type { AlertaFila } from "../types/listaAlertas";
import {
  calcularVista,
  conFiltros,
  conOrden,
  conPagina,
  ESTADO_TABLA_INICIAL,
  FILTROS_VACIOS,
  filtrarAlertas,
  hayFiltrosActivos,
  normalizarTexto,
  ordenarAlertas,
  paginar,
  rangoPreset,
  textoMostrando,
  type FiltrosTabla,
} from "./tabla";

// Datos armados a mano y resultados escritos a mano: NO se usa generarMocks aquí.

// Instante de una hora de Bogotá (UTC−5, sin horario de verano): 2026, mes, día, hora, minuto, segundo.
const bog = (mes: number, dia: number, h: number, min = 0, s = 0) => Date.UTC(2026, mes - 1, dia, h + 5, min, s);
const AHORA = bog(11, 3, 10, 0);

const fila = (p: Partial<AlertaFila> = {}): AlertaFila => ({
  id: "0",
  creadaEn: AHORA - 3_600_000,
  titulo: "Alerta de prueba",
  severidad: 2,
  estado: "New",
  origen: "wazuh",
  tipo: null,
  antiguedadMs: 3_600_000,
  sla: { estado: null, limiteMin: 120, excesoMs: null },
  caso: null,
  ...p,
});

const ids = (filas: AlertaFila[]) => filas.map((f) => f.id);
const filtros = (p: Partial<FiltrosTabla>): FiltrosTabla => ({ ...FILTROS_VACIOS, ...p });

// Seis alertas para probar los filtros
const F1 = fila({
  id: "1", titulo: "Correo de suplantación de identidad", severidad: 4, estado: "New", origen: "wazuh",
  tipo: "phishing", creadaEn: bog(10, 30, 23, 30), // 23:30 en Bogotá = 04:30 UTC del día siguiente
  sla: { estado: "fuera", limiteMin: 15, excesoMs: 1000 },
});
const F2 = fila({
  id: "2", titulo: "Phishing al área de nómina", severidad: 3, estado: "New", origen: "correo",
  tipo: "phishing", creadaEn: bog(11, 3, 10, 0),
  sla: { estado: "dentro", limiteMin: 30, excesoMs: null },
});
const F3 = fila({
  id: "3", titulo: "Troyano en equipo de biblioteca", severidad: 3, estado: "Imported", origen: "wazuh",
  tipo: "malware", creadaEn: bog(11, 1, 0, 0), // justo las 00:00 de Bogotá
  caso: { id: "~c1", numero: 1, etapa: "Closed", estado: "TruePositive" },
});
const F4 = fila({
  id: "4", titulo: "Evento MISP sin clasificar", severidad: 2, estado: "Imported", origen: "misp",
  tipo: null, creadaEn: bog(10, 31, 23, 59, 59), // último segundo del 31 oct
  caso: { id: "~c9", numero: null, etapa: null, estado: null }, // tiene caseId, pero el caso no tiene datos
});
const F5 = fila({ id: "5", titulo: "Proceso inusual", severidad: 1, estado: "Ignored", origen: "sysmon", tipo: null, creadaEn: bog(10, 20, 12, 0) });
const F6 = fila({
  id: "6", titulo: "Ransomware en carpeta compartida", severidad: 4, estado: "InProgress", origen: "wazuh",
  tipo: "malware", creadaEn: bog(11, 2, 15, 0),
});
const TODAS = [F1, F2, F3, F4, F5, F6];

describe("normalizarTexto", () => {
  it("quita mayúsculas, tildes y espacios de los extremos", () => {
    expect(normalizarTexto("  SuplantaciÓN  ")).toBe("suplantacion");
    expect(normalizarTexto("área de nómina")).toBe("area de nomina");
    expect(normalizarTexto("Ñandú")).toBe("nandu");
  });
});

describe("filtrarAlertas: sin filtros y búsqueda", () => {
  it("sin filtros devuelve todas, en el mismo orden", () => {
    expect(ids(filtrarAlertas(TODAS, FILTROS_VACIOS))).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("la búsqueda no distingue mayúsculas ni tildes: 'suplantacion' encuentra 'suplantación'", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ busqueda: "suplantacion" })))).toEqual(["1"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ busqueda: "SUPLANTACIÓN" })))).toEqual(["1"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ busqueda: "area" })))).toEqual(["2"]); // 'área' sin tilde
    expect(ids(filtrarAlertas(TODAS, filtros({ busqueda: "PHISHING" })))).toEqual(["2"]);
  });

  it("se recortan los espacios; solo espacios equivale a no buscar", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ busqueda: "   troyano  " })))).toEqual(["3"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ busqueda: "   " })))).toHaveLength(6);
  });

  it("busca solo en el título", () => {
    expect(filtrarAlertas(TODAS, filtros({ busqueda: "wazuh" }))).toEqual([]); // 'wazuh' es el origen, no está en ningún título
    expect(filtrarAlertas(TODAS, filtros({ busqueda: "no-existe" }))).toEqual([]);
  });
});

describe("filtrarAlertas: selección múltiple (O) y combinación (Y)", () => {
  it("dentro de una selección múltiple basta con coincidir con una: Crítica o Alta", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ severidades: [4, 3] })))).toEqual(["1", "2", "3", "6"]);
  });

  it("entre filtros distintos es Y: (Crítica o Alta) y además Fuera de SLA", () => {
    const r = filtrarAlertas(TODAS, filtros({ severidades: [4, 3], fueraDeSla: "si" }));
    expect(ids(r)).toEqual(["1"]);
  });

  it("estado y herramienta también son O dentro de su lista y Y entre sí", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ estados: ["New", "InProgress"] })))).toEqual(["1", "2", "6"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ origenes: ["wazuh", "misp"] })))).toEqual(["1", "3", "4", "6"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ estados: ["New", "InProgress"], origenes: ["wazuh"] })))).toEqual(["1", "6"]);
  });
});

describe("filtrarAlertas: tipo", () => {
  it("elegir un tipo", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ tipos: ["phishing"] })))).toEqual(["1", "2"]);
  });

  it("el filtro de tipo incluye 'Sin clasificar' (tipo null)", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ tipos: [null] })))).toEqual(["4", "5"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ tipos: ["malware", null] })))).toEqual(["3", "4", "5", "6"]);
  });
});

describe("filtrarAlertas: ¿tiene caso?", () => {
  it("Sí incluye las alertas con caseId aunque el caso no tenga datos (F4)", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ tieneCaso: "si" })))).toEqual(["3", "4"]);
  });

  it("No deja solo las que no tienen caseId", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ tieneCaso: "no" })))).toEqual(["1", "2", "5", "6"]);
  });
});

describe("filtrarAlertas: ¿fuera de SLA?", () => {
  it("Sí: solo las fuera de SLA", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ fueraDeSla: "si" })))).toEqual(["1"]);
  });

  it("No = dentro de SLA O sin SLA aplicable (las que no están sin atender)", () => {
    // F2 está dentro de SLA; F3, F4, F5 y F6 no están sin atender (sla.estado null). Todas cuentan como "No".
    expect(ids(filtrarAlertas(TODAS, filtros({ fueraDeSla: "no" })))).toEqual(["2", "3", "4", "5", "6"]);
  });
});

describe("filtrarAlertas: fecha (días de Bogotá, inclusiva en los dos extremos)", () => {
  it("la alerta de las 23:30 de Bogotá cuenta en su día de Bogotá, no en el de UTC", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ desde: "2026-10-30", hasta: "2026-10-30" })))).toEqual(["1"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ desde: "2026-10-31", hasta: "2026-10-31" })))).toEqual(["4"]);
  });

  it("ambos extremos son inclusivos: 23:59:59 del 31 oct y 00:00 del 1 nov", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ desde: "2026-10-31", hasta: "2026-11-01" })))).toEqual(["3", "4"]);
  });

  it("solo desde, o solo hasta, deja el otro extremo abierto", () => {
    expect(ids(filtrarAlertas(TODAS, filtros({ desde: "2026-11-02" })))).toEqual(["2", "6"]);
    expect(ids(filtrarAlertas(TODAS, filtros({ hasta: "2026-10-30" })))).toEqual(["1", "5"]);
  });

  it("un rango invertido (desde después de hasta) no deja pasar nada", () => {
    expect(filtrarAlertas(TODAS, filtros({ desde: "2026-11-03", hasta: "2026-10-01" }))).toEqual([]);
  });
});

describe("hayFiltrosActivos", () => {
  it("sin filtros, o con una búsqueda de solo espacios, no hay filtros activos", () => {
    expect(hayFiltrosActivos(FILTROS_VACIOS)).toBe(false);
    expect(hayFiltrosActivos(filtros({ busqueda: "   " }))).toBe(false);
  });

  it("cualquier filtro aplicado cuenta", () => {
    expect(hayFiltrosActivos(filtros({ busqueda: "x" }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ severidades: [4] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ estados: ["New"] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ origenes: ["wazuh"] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ tipos: [null] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ tieneCaso: "no" }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ fueraDeSla: "si" }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ desde: "2026-11-01" }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ hasta: "2026-11-01" }))).toBe(true);
  });
});

describe("rangoPreset", () => {
  it("'Hoy' va desde las 00:00 de Bogotá de hoy: un solo día", () => {
    expect(rangoPreset("hoy", AHORA)).toEqual({ desde: "2026-11-03", hasta: "2026-11-03" });
    const hoy = filtrarAlertas(TODAS, filtros(rangoPreset("hoy", AHORA)));
    expect(ids(hoy)).toEqual(["2"]);
  });

  it("'Hoy' no incluye el último segundo de ayer, sí incluye las 00:00 de hoy", () => {
    const ayer = fila({ id: "ayer", creadaEn: bog(11, 2, 23, 59, 59) });
    const medianoche = fila({ id: "medianoche", creadaEn: bog(11, 3, 0, 0) });
    const r = filtrarAlertas([ayer, medianoche], filtros(rangoPreset("hoy", AHORA)));
    expect(ids(r)).toEqual(["medianoche"]);
  });

  it("7, 14 y 30 días terminan hoy (inclusive)", () => {
    expect(rangoPreset(7, AHORA)).toEqual({ desde: "2026-10-28", hasta: "2026-11-03" });
    expect(rangoPreset(14, AHORA)).toEqual({ desde: "2026-10-21", hasta: "2026-11-03" });
    expect(rangoPreset(30, AHORA)).toEqual({ desde: "2026-10-05", hasta: "2026-11-03" });
  });
});

describe("ordenarAlertas: prioridad (tres niveles)", () => {
  const sla = (estado: "dentro" | "fuera" | null) => ({ estado, limiteMin: 30, excesoMs: estado === "fuera" ? 1 : null });
  const A = fila({ id: "A", severidad: 2, creadaEn: 1000, sla: sla("fuera") });
  const B = fila({ id: "B", severidad: 4, creadaEn: 5000, sla: sla("fuera") });
  const C = fila({ id: "C", severidad: 4, creadaEn: 2000, sla: sla("fuera") }); // más antigua que B, misma severidad
  const D = fila({ id: "D", severidad: 4, creadaEn: 100, sla: sla("dentro") }); // crítica, pero dentro de SLA
  const E = fila({ id: "E", severidad: 4, creadaEn: 50, estado: "Imported", sla: sla(null) });
  const F = fila({ id: "F", severidad: 1, creadaEn: 10, estado: "Ignored", sla: sla(null) });

  it("1) sin atender fuera de SLA, 2) sin atender dentro de SLA, 3) el resto; luego severidad y la más antigua", () => {
    // Fuera de SLA: C y B (sev 4, C más antigua primero), luego A (sev 2). Después D (dentro). Después E (sev 4) y F (sev 1).
    expect(ids(ordenarAlertas([A, B, C, D, E, F], "prioridad"))).toEqual(["C", "B", "A", "D", "E", "F"]);
  });

  it("una crítica dentro de SLA va después de una baja fuera de SLA", () => {
    const bajaFuera = fila({ id: "baja", severidad: 1, sla: sla("fuera") });
    const criticaDentro = fila({ id: "critica", severidad: 4, sla: sla("dentro") });
    expect(ids(ordenarAlertas([criticaDentro, bajaFuera], "prioridad"))).toEqual(["baja", "critica"]);
  });

  it("el empate total se resuelve por id, sin importar el orden de entrada (no salta entre refrescos)", () => {
    const x = fila({ id: "~10", severidad: 3, creadaEn: 1, sla: sla("fuera") });
    const y = fila({ id: "~2", severidad: 3, creadaEn: 1, sla: sla("fuera") });
    const z = fila({ id: "~9", severidad: 3, creadaEn: 1, sla: sla("fuera") });
    // Orden por texto: "~10" < "~2" < "~9"
    expect(ids(ordenarAlertas([x, y, z], "prioridad"))).toEqual(["~10", "~2", "~9"]);
    expect(ids(ordenarAlertas([z, y, x], "prioridad"))).toEqual(["~10", "~2", "~9"]);
    expect(ids(ordenarAlertas([y, z, x], "prioridad"))).toEqual(["~10", "~2", "~9"]);
  });

  it("no modifica la lista original", () => {
    const entrada = [F, E, D];
    ordenarAlertas(entrada, "prioridad");
    expect(ids(entrada)).toEqual(["F", "E", "D"]);
  });
});

describe("ordenarAlertas: recientes, antiguas y severidad (con desempate por id)", () => {
  it("más recientes primero", () => {
    expect(ids(ordenarAlertas(TODAS, "recientes"))).toEqual(["2", "6", "3", "4", "1", "5"]);
  });

  it("más antiguas primero", () => {
    expect(ids(ordenarAlertas(TODAS, "antiguas"))).toEqual(["5", "1", "4", "3", "6", "2"]);
  });

  it("severidad de mayor a menor; a igualdad, la más antigua primero", () => {
    // sev 4: F1 (30 oct) y F6 (2 nov) · sev 3: F3 (1 nov) y F2 (3 nov) · sev 2: F4 · sev 1: F5
    expect(ids(ordenarAlertas(TODAS, "severidad"))).toEqual(["1", "6", "3", "2", "4", "5"]);
    expect(ids(ordenarAlertas([...TODAS].reverse(), "severidad"))).toEqual(["1", "6", "3", "2", "4", "5"]);
  });

  it("severidad: con misma severidad y misma fecha, desempata por id", () => {
    const p = fila({ id: "~2", severidad: 3, creadaEn: 500 });
    const q = fila({ id: "~10", severidad: 3, creadaEn: 500 });
    const r = fila({ id: "~5", severidad: 3, creadaEn: 100 }); // más antigua: va primero
    expect(ids(ordenarAlertas([p, q, r], "severidad"))).toEqual(["~5", "~10", "~2"]);
    expect(ids(ordenarAlertas([r, q, p], "severidad"))).toEqual(["~5", "~10", "~2"]);
  });

  it("con la misma fecha, recientes y antiguas desempatan por id (ascendente en ambos)", () => {
    const p = fila({ id: "~2", creadaEn: 500 });
    const q = fila({ id: "~10", creadaEn: 500 });
    expect(ids(ordenarAlertas([p, q], "recientes"))).toEqual(["~10", "~2"]);
    expect(ids(ordenarAlertas([q, p], "antiguas"))).toEqual(["~10", "~2"]);
  });
});

describe("paginar", () => {
  const lista = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it("25 por página: 112 elementos son 5 páginas", () => {
    const p1 = paginar(lista(112), 1);
    expect(p1).toMatchObject({ pagina: 1, totalPaginas: 5, total: 112, desde: 1, hasta: 25 });
    expect(p1.items).toHaveLength(25);

    const p2 = paginar(lista(112), 2);
    expect(p2).toMatchObject({ pagina: 2, desde: 26, hasta: 50 });
    expect(p2.items[0]).toBe(26);
    expect(p2.items[24]).toBe(50);

    const p5 = paginar(lista(112), 5);
    expect(p5).toMatchObject({ pagina: 5, desde: 101, hasta: 112 });
    expect(p5.items).toHaveLength(12);
  });

  it("texto 'Mostrando 26–50 de 112'", () => {
    expect(textoMostrando(paginar(lista(112), 1))).toBe("Mostrando 1–25 de 112");
    expect(textoMostrando(paginar(lista(112), 2))).toBe("Mostrando 26–50 de 112");
    expect(textoMostrando(paginar(lista(112), 5))).toBe("Mostrando 101–112 de 112");
  });

  it("un solo elemento en la última página; lista vacía", () => {
    expect(textoMostrando(paginar(lista(101), 5))).toBe("Mostrando 101 de 101");
    const vacia = paginar([], 1);
    expect(vacia).toMatchObject({ items: [], pagina: 1, totalPaginas: 1, total: 0, desde: 0, hasta: 0 });
    expect(textoMostrando(vacia)).toBe("No hay alertas que mostrar");
  });

  it("límites: 25 caben en una página, 26 necesitan dos", () => {
    expect(paginar(lista(25), 1).totalPaginas).toBe(1);
    expect(paginar(lista(26), 1).totalPaginas).toBe(2);
  });

  it("si la lista se achica y la página ya no existe, va a la última que exista (no queda vacía)", () => {
    // estaba en la página 5 de 112; tras el refresco quedan 60 → 3 páginas
    const p = paginar(lista(60), 5);
    expect(p.pagina).toBe(3);
    expect(p.totalPaginas).toBe(3);
    expect(p.items).toHaveLength(10);
    expect(textoMostrando(p)).toBe("Mostrando 51–60 de 60");

    // si queda en 0 elementos, la página 1 (vacía pero válida)
    expect(paginar([], 4).pagina).toBe(1);
  });

  it("páginas inválidas se ajustan a la primera", () => {
    expect(paginar(lista(60), 0).pagina).toBe(1);
    expect(paginar(lista(60), -3).pagina).toBe(1);
    expect(paginar(lista(60), Number.NaN).pagina).toBe(1);
    expect(paginar(lista(60), 2.9).pagina).toBe(2);
  });

  it("el tamaño de página se puede cambiar", () => {
    expect(paginar(lista(10), 2, 4).items).toEqual([5, 6, 7, 8]);
  });
});

describe("estado de la tabla", () => {
  it("cambiar un filtro vuelve a la página 1", () => {
    const e = conPagina(ESTADO_TABLA_INICIAL, 4);
    expect(e.pagina).toBe(4);
    const nuevo = conFiltros(e, filtros({ severidades: [4] }));
    expect(nuevo.pagina).toBe(1);
    expect(nuevo.filtros.severidades).toEqual([4]);
    expect(nuevo.orden).toBe(e.orden);
  });

  it("cambiar el orden vuelve a la página 1", () => {
    const e = conFiltros(conPagina(ESTADO_TABLA_INICIAL, 3), filtros({ busqueda: "x" }));
    const e2 = conPagina(e, 3);
    const nuevo = conOrden(e2, "recientes");
    expect(nuevo.pagina).toBe(1);
    expect(nuevo.orden).toBe("recientes");
    expect(nuevo.filtros.busqueda).toBe("x");
  });

  it("cambiar de página conserva filtros y orden; no baja de 1; no modifica el estado anterior", () => {
    const base = conOrden(ESTADO_TABLA_INICIAL, "antiguas");
    const siguiente = conPagina(base, 3);
    expect(siguiente).toEqual({ filtros: FILTROS_VACIOS, orden: "antiguas", pagina: 3 });
    expect(conPagina(base, 0).pagina).toBe(1);
    expect(conPagina(base, -2).pagina).toBe(1);
    expect(conPagina(base, Number.NaN).pagina).toBe(1);
    expect(base.pagina).toBe(1);
  });

  it("estado inicial: sin filtros, orden por prioridad, página 1", () => {
    expect(ESTADO_TABLA_INICIAL).toEqual({ filtros: FILTROS_VACIOS, orden: "prioridad", pagina: 1 });
  });
});

describe("calcularVista (filtrar → ordenar → paginar)", () => {
  // 60 alertas: id 001..060; las pares son críticas (30) y las impares bajas; cada una es 1 min más reciente que la anterior.
  const sesenta = Array.from({ length: 60 }, (_, k) => {
    const i = k + 1;
    return fila({ id: String(i).padStart(3, "0"), severidad: i % 2 === 0 ? 4 : 1, creadaEn: AHORA - (61 - i) * 60_000 });
  });

  it("aplica filtro, orden y página", () => {
    const e = conOrden(conFiltros(ESTADO_TABLA_INICIAL, filtros({ severidades: [4] })), "recientes");
    const v = calcularVista(sesenta, e);
    expect(v.coincidencias).toBe(30);
    expect(v.pagina).toMatchObject({ pagina: 1, totalPaginas: 2, total: 30, desde: 1, hasta: 25 });
    expect(v.pagina.items[0].id).toBe("060"); // la más reciente primero
    expect(v.pagina.items[24].id).toBe("012");
  });

  it("si la página pedida ya no existe tras filtrar o refrescar, muestra la última", () => {
    const e = conPagina(conOrden(conFiltros(ESTADO_TABLA_INICIAL, filtros({ severidades: [4] })), "recientes"), 9);
    const v = calcularVista(sesenta, { ...e, pagina: 9 });
    expect(v.pagina.pagina).toBe(2);
    expect(ids(v.pagina.items)).toEqual(["010", "008", "006", "004", "002"]);
    expect(textoMostrando(v.pagina)).toBe("Mostrando 26–30 de 30");
  });

  it("sin coincidencias: página vacía pero válida", () => {
    const v = calcularVista(sesenta, conFiltros(ESTADO_TABLA_INICIAL, filtros({ busqueda: "zzz" })));
    expect(v.coincidencias).toBe(0);
    expect(v.pagina).toMatchObject({ items: [], pagina: 1, totalPaginas: 1, total: 0 });
  });
});
