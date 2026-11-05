import { describe, expect, it } from "vitest";
import type { AlertaFila } from "../types/listaAlertas";
import {
  ajustarRango,
  calcularVista,
  conFiltros,
  conOrden,
  conPagina,
  contarFiltrosActivos,
  fechaActiva,
  ESTADO_TABLA_INICIAL,
  FILTROS_VACIOS,
  filtrarAlertas,
  hayFiltrosActivos,
  normalizarTexto,
  opcionFecha,
  ordenarAlertas,
  paginar,
  rangoPreset,
  resolverFecha,
  textoAvisoTruncada,
  textoMostrando,
  textoResumenLista,
  type FiltroFecha,
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
const filtrar = (filas: AlertaFila[], f: FiltrosTabla) => filtrarAlertas(filas, f, AHORA);
const rango = (desde: string | null, hasta: string | null): FiltroFecha => ({ tipo: "rango", desde, hasta });
const preset = (p: "hoy" | 7 | 14): FiltroFecha => ({ tipo: "preset", preset: p });
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
    expect(ids(filtrar(TODAS, FILTROS_VACIOS))).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("la búsqueda no distingue mayúsculas ni tildes: 'suplantacion' encuentra 'suplantación'", () => {
    expect(ids(filtrar(TODAS, filtros({ busqueda: "suplantacion" })))).toEqual(["1"]);
    expect(ids(filtrar(TODAS, filtros({ busqueda: "SUPLANTACIÓN" })))).toEqual(["1"]);
    expect(ids(filtrar(TODAS, filtros({ busqueda: "area" })))).toEqual(["2"]); // 'área' sin tilde
    expect(ids(filtrar(TODAS, filtros({ busqueda: "PHISHING" })))).toEqual(["2"]);
  });

  it("se recortan los espacios; solo espacios equivale a no buscar", () => {
    expect(ids(filtrar(TODAS, filtros({ busqueda: "   troyano  " })))).toEqual(["3"]);
    expect(ids(filtrar(TODAS, filtros({ busqueda: "   " })))).toHaveLength(6);
  });

  it("busca solo en el título", () => {
    expect(filtrar(TODAS, filtros({ busqueda: "wazuh" }))).toEqual([]); // 'wazuh' es el origen, no está en ningún título
    expect(filtrar(TODAS, filtros({ busqueda: "no-existe" }))).toEqual([]);
  });
});

describe("filtrarAlertas: selección múltiple (O) y combinación (Y)", () => {
  it("dentro de una selección múltiple basta con coincidir con una: Crítica o Alta", () => {
    expect(ids(filtrar(TODAS, filtros({ severidades: [4, 3] })))).toEqual(["1", "2", "3", "6"]);
  });

  it("entre filtros distintos es Y: (Crítica o Alta) y además Fuera de SLA", () => {
    const r = filtrar(TODAS, filtros({ severidades: [4, 3], fueraDeSla: "si" }));
    expect(ids(r)).toEqual(["1"]);
  });

  it("estado y herramienta también son O dentro de su lista y Y entre sí", () => {
    expect(ids(filtrar(TODAS, filtros({ estados: ["New", "InProgress"] })))).toEqual(["1", "2", "6"]);
    expect(ids(filtrar(TODAS, filtros({ origenes: ["wazuh", "misp"] })))).toEqual(["1", "3", "4", "6"]);
    expect(ids(filtrar(TODAS, filtros({ estados: ["New", "InProgress"], origenes: ["wazuh"] })))).toEqual(["1", "6"]);
  });
});

describe("filtrarAlertas: tipo", () => {
  it("elegir un tipo", () => {
    expect(ids(filtrar(TODAS, filtros({ tipos: ["phishing"] })))).toEqual(["1", "2"]);
  });

  it("el filtro de tipo incluye 'Sin clasificar' (tipo null)", () => {
    expect(ids(filtrar(TODAS, filtros({ tipos: [null] })))).toEqual(["4", "5"]);
    expect(ids(filtrar(TODAS, filtros({ tipos: ["malware", null] })))).toEqual(["3", "4", "5", "6"]);
  });
});

describe("filtrarAlertas: ¿tiene caso?", () => {
  it("Sí incluye las alertas con caseId aunque el caso no tenga datos (F4)", () => {
    expect(ids(filtrar(TODAS, filtros({ tieneCaso: "si" })))).toEqual(["3", "4"]);
  });

  it("No deja solo las que no tienen caseId", () => {
    expect(ids(filtrar(TODAS, filtros({ tieneCaso: "no" })))).toEqual(["1", "2", "5", "6"]);
  });
});

describe("filtrarAlertas: ¿fuera de SLA?", () => {
  it("Sí: solo las fuera de SLA", () => {
    expect(ids(filtrar(TODAS, filtros({ fueraDeSla: "si" })))).toEqual(["1"]);
  });

  it("No = dentro de SLA O sin SLA aplicable (las que no están sin atender)", () => {
    // F2 está dentro de SLA; F3, F4, F5 y F6 no están sin atender (sla.estado null). Todas cuentan como "No".
    expect(ids(filtrar(TODAS, filtros({ fueraDeSla: "no" })))).toEqual(["2", "3", "4", "5", "6"]);
  });
});

describe("filtrarAlertas: fecha (días de Bogotá, inclusiva en los dos extremos)", () => {
  it("la alerta de las 23:30 de Bogotá cuenta en su día de Bogotá, no en el de UTC", () => {
    expect(ids(filtrar(TODAS, filtros({ fecha: rango("2026-10-30", "2026-10-30") })))).toEqual(["1"]);
    expect(ids(filtrar(TODAS, filtros({ fecha: rango("2026-10-31", "2026-10-31") })))).toEqual(["4"]);
  });

  it("ambos extremos son inclusivos: 23:59:59 del 31 oct y 00:00 del 1 nov", () => {
    expect(ids(filtrar(TODAS, filtros({ fecha: rango("2026-10-31", "2026-11-01") })))).toEqual(["3", "4"]);
  });

  it("solo desde, o solo hasta, deja el otro extremo abierto", () => {
    expect(ids(filtrar(TODAS, filtros({ fecha: rango("2026-11-02", null) })))).toEqual(["2", "6"]);
    expect(ids(filtrar(TODAS, filtros({ fecha: rango(null, "2026-10-30") })))).toEqual(["1", "5"]);
  });

  it("un rango invertido (desde después de hasta) no deja pasar nada", () => {
    expect(filtrar(TODAS, filtros({ fecha: rango("2026-11-03", "2026-10-01") }))).toEqual([]);
  });

  it("un rango sin ningún extremo no filtra", () => {
    expect(filtrar(TODAS, filtros({ fecha: rango(null, null) }))).toHaveLength(6);
  });
});

describe("filtros de fecha con preset (se resuelven con el 'ahora' de cada refresco)", () => {
  it("'Hoy' = desde las 00:00 de Bogotá de hoy", () => {
    expect(ids(filtrar(TODAS, filtros({ fecha: preset("hoy") })))).toEqual(["2"]);
  });

  it("'Hoy' no incluye el último segundo de ayer, sí las 00:00 de hoy", () => {
    const ayer = fila({ id: "ayer", creadaEn: bog(11, 2, 23, 59, 59) });
    const medianoche = fila({ id: "medianoche", creadaEn: bog(11, 3, 0, 0) });
    expect(ids(filtrar([ayer, medianoche], filtros({ fecha: preset("hoy") })))).toEqual(["medianoche"]);
  });

  it("7 días = hoy y los 6 anteriores (28 oct a 3 nov); 14 días = desde el 21 oct", () => {
    const del25 = fila({ id: "del25", creadaEn: bog(10, 25, 12, 0) }); // 9 días atrás: fuera de 7, dentro de 14
    const todas = [...TODAS, del25];
    expect(ids(filtrar(todas, filtros({ fecha: preset(7) })))).toEqual(["1", "2", "3", "4", "6"]);
    expect(ids(filtrar(todas, filtros({ fecha: preset(14) })))).toEqual(["1", "2", "3", "4", "6", "del25"]);
  });

  it("un '7 días' elegido ayer sigue siendo '7 días' hoy, con las fechas corridas", () => {
    const filtro = filtros({ fecha: preset(7) }); // el MISMO filtro guardado, sin recalcular nada

    const ayer = AHORA - 86_400_000;
    expect(resolverFecha(filtro.fecha, ayer)).toEqual({ desde: "2026-10-27", hasta: "2026-11-02" });
    expect(resolverFecha(filtro.fecha, AHORA)).toEqual({ desde: "2026-10-28", hasta: "2026-11-03" });

    // ayer entraba la del 27 oct y no la del 3 nov; hoy es al revés
    const del27 = fila({ id: "del27", creadaEn: bog(10, 27, 12, 0) });
    const del3 = fila({ id: "del3", creadaEn: bog(11, 3, 9, 0) });
    expect(ids(filtrarAlertas([del27, del3], filtro, ayer))).toEqual(["del27"]);
    expect(ids(filtrarAlertas([del27, del3], filtro, AHORA))).toEqual(["del3"]);
  });

  it("el filtro sigue siendo un preset: sin fechas guardadas", () => {
    const f = filtros({ fecha: preset(7) });
    expect(f.fecha).toEqual({ tipo: "preset", preset: 7 });
    expect(opcionFecha(f.fecha)).toBe(7);
  });

  it("un rango, en cambio, guarda fechas fijas y NO se corre con el tiempo", () => {
    const f = filtros({ fecha: rango("2026-10-28", "2026-11-03") });
    expect(resolverFecha(f.fecha, AHORA)).toEqual({ desde: "2026-10-28", hasta: "2026-11-03" });
    expect(resolverFecha(f.fecha, AHORA + 5 * 86_400_000)).toEqual({ desde: "2026-10-28", hasta: "2026-11-03" });
  });
});

describe("opcionFecha y fechaActiva", () => {
  it("sin filtro = 30 días; preset; o rango", () => {
    expect(opcionFecha(null)).toBe(30);
    expect(opcionFecha(preset("hoy"))).toBe("hoy");
    expect(opcionFecha(preset(14))).toBe(14);
    expect(opcionFecha(rango("2026-10-30", "2026-11-01"))).toBe("rango");
    // un rango con las mismas fechas que un preset sigue siendo "rango"
    expect(opcionFecha(rango("2026-10-28", "2026-11-03"))).toBe("rango");
  });

  it("solo limita si hay preset o algún extremo del rango", () => {
    expect(fechaActiva(null)).toBe(false);
    expect(fechaActiva(rango(null, null))).toBe(false);
    expect(fechaActiva(rango("2026-10-30", null))).toBe(true);
    expect(fechaActiva(preset(7))).toBe(true);
  });
});

describe("hayFiltrosActivos", () => {
  it("sin filtros, o con una búsqueda de solo espacios, no hay filtros activos", () => {
    expect(hayFiltrosActivos(FILTROS_VACIOS)).toBe(false);
    expect(hayFiltrosActivos(filtros({ busqueda: "   " }))).toBe(false);
    expect(hayFiltrosActivos(filtros({ fecha: rango(null, null) }))).toBe(false);
  });

  it("cualquier filtro aplicado cuenta", () => {
    expect(hayFiltrosActivos(filtros({ busqueda: "x" }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ severidades: [4] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ estados: ["New"] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ origenes: ["wazuh"] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ tipos: [null] }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ tieneCaso: "no" }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ fueraDeSla: "si" }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ fecha: rango("2026-11-01", null) }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ fecha: rango(null, "2026-11-01") }))).toBe(true);
    expect(hayFiltrosActivos(filtros({ fecha: preset(7) }))).toBe(true);
  });
});

describe("rangoPreset", () => {
  it("'Hoy' es un solo día; 7, 14 y 30 días terminan hoy (inclusive)", () => {
    expect(rangoPreset("hoy", AHORA)).toEqual({ desde: "2026-11-03", hasta: "2026-11-03" });
    expect(rangoPreset(7, AHORA)).toEqual({ desde: "2026-10-28", hasta: "2026-11-03" });
    expect(rangoPreset(14, AHORA)).toEqual({ desde: "2026-10-21", hasta: "2026-11-03" });
    expect(rangoPreset(30, AHORA)).toEqual({ desde: "2026-10-05", hasta: "2026-11-03" });
  });
});

describe("textoResumenLista", () => {
  it("sin filtros: 'N alertas · últimos 30 días'", () => {
    expect(textoResumenLista(40, 40, false, 30)).toBe("40 alertas · últimos 30 días");
    expect(textoResumenLista(1, 1, false, 30)).toBe("1 alerta · últimos 30 días");
    expect(textoResumenLista(0, 0, false, 30)).toBe("0 alertas · últimos 30 días");
  });

  it("con filtros activos: '7 de 40 alertas · últimos 30 días'", () => {
    expect(textoResumenLista(40, 7, true, 30)).toBe("7 de 40 alertas · últimos 30 días");
    expect(textoResumenLista(40, 0, true, 30)).toBe("0 de 40 alertas · últimos 30 días");
    expect(textoResumenLista(1, 1, true, 30)).toBe("1 de 1 alerta · últimos 30 días");
  });
});

describe("ajustarRango", () => {
  it("un rango válido se acepta tal cual", () => {
    expect(ajustarRango("2026-10-01", "2026-10-10", "desde", "2026-10-05")).toEqual({ desde: "2026-10-05", hasta: "2026-10-10" });
    expect(ajustarRango("2026-10-01", "2026-10-10", "hasta", "2026-10-20")).toEqual({ desde: "2026-10-01", hasta: "2026-10-20" });
  });

  it("'desde' no puede quedar después de 'hasta': 'hasta' se iguala", () => {
    expect(ajustarRango("2026-10-01", "2026-10-10", "desde", "2026-10-15")).toEqual({ desde: "2026-10-15", hasta: "2026-10-15" });
  });

  it("'hasta' no puede quedar antes de 'desde': 'desde' se iguala", () => {
    expect(ajustarRango("2026-10-05", "2026-10-10", "hasta", "2026-10-01")).toEqual({ desde: "2026-10-01", hasta: "2026-10-01" });
  });

  it("el mismo día en los dos extremos es válido", () => {
    expect(ajustarRango("2026-10-05", "2026-10-10", "hasta", "2026-10-05")).toEqual({ desde: "2026-10-05", hasta: "2026-10-05" });
  });

  it("borrar un extremo (null) o editar con el otro vacío no toca nada más", () => {
    expect(ajustarRango("2026-10-05", "2026-10-10", "desde", null)).toEqual({ desde: null, hasta: "2026-10-10" });
    expect(ajustarRango(null, "2026-10-10", "desde", "2026-10-20")).toEqual({ desde: "2026-10-20", hasta: "2026-10-20" });
    expect(ajustarRango("2026-10-05", null, "hasta", "2026-10-01")).toEqual({ desde: "2026-10-01", hasta: "2026-10-01" });
    expect(ajustarRango(null, null, "hasta", "2026-10-01")).toEqual({ desde: null, hasta: "2026-10-01" });
  });
});

describe("contarFiltrosActivos (para 'Filtros (N)')", () => {
  it("cuenta grupos, no valores, y no cuenta la búsqueda", () => {
    expect(contarFiltrosActivos(FILTROS_VACIOS)).toBe(0);
    expect(contarFiltrosActivos(filtros({ busqueda: "algo" }))).toBe(0);
    expect(contarFiltrosActivos(filtros({ severidades: [4, 3, 2] }))).toBe(1);
    expect(contarFiltrosActivos(filtros({ severidades: [4], estados: ["New"], tipos: [null], origenes: ["wazuh"] }))).toBe(4);
    expect(contarFiltrosActivos(filtros({ tieneCaso: "si", fueraDeSla: "no" }))).toBe(2);
    expect(contarFiltrosActivos(filtros({ fecha: rango("2026-10-01", "2026-10-02") }))).toBe(1); // el rango es un solo filtro
    expect(contarFiltrosActivos(filtros({ fecha: rango(null, "2026-10-02") }))).toBe(1);
    expect(contarFiltrosActivos(filtros({ fecha: preset(14) }))).toBe(1);
    expect(contarFiltrosActivos(filtros({ fecha: rango(null, null) }))).toBe(0);
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
    const v = calcularVista(sesenta, e, AHORA);
    expect(v.coincidencias).toBe(30);
    expect(v.pagina).toMatchObject({ pagina: 1, totalPaginas: 2, total: 30, desde: 1, hasta: 25 });
    expect(v.pagina.items[0].id).toBe("060"); // la más reciente primero
    expect(v.pagina.items[24].id).toBe("012");
  });

  it("si la página pedida ya no existe tras filtrar o refrescar, muestra la última", () => {
    const e = conPagina(conOrden(conFiltros(ESTADO_TABLA_INICIAL, filtros({ severidades: [4] })), "recientes"), 9);
    const v = calcularVista(sesenta, { ...e, pagina: 9 }, AHORA);
    expect(v.pagina.pagina).toBe(2);
    expect(ids(v.pagina.items)).toEqual(["010", "008", "006", "004", "002"]);
    expect(textoMostrando(v.pagina)).toBe("Mostrando 26–30 de 30");
  });

  it("sin coincidencias: página vacía pero válida", () => {
    const v = calcularVista(sesenta, conFiltros(ESTADO_TABLA_INICIAL, filtros({ busqueda: "zzz" })), AHORA);
    expect(v.coincidencias).toBe(0);
    expect(v.pagina).toMatchObject({ items: [], pagina: 1, totalPaginas: 1, total: 0 });
  });
});

describe("textoAvisoTruncada", () => {
  it("solo las más recientes", () => {
    expect(textoAvisoTruncada({ recientes: 1000, criticasYAltasAdicionales: 0 }, 1500, 30)).toBe(
      "Mostrando las 1000 más recientes de 1500 en los últimos 30 días",
    );
  });

  it("con críticas y altas añadidas, en plural y singular", () => {
    expect(textoAvisoTruncada({ recientes: 1000, criticasYAltasAdicionales: 613 }, 23000, 30)).toBe(
      "Mostrando las 1000 alertas más recientes y, además, 613 críticas o altas sin atender más antiguas (de 23000 en los últimos 30 días)",
    );
    expect(textoAvisoTruncada({ recientes: 1000, criticasYAltasAdicionales: 1 }, 1500, 30)).toContain("1 crítica o alta sin atender más antigua");
  });
});
