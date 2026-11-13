import { describe, expect, it } from "vitest";
import type { Activo, AtaqueReciente } from "../types/activos";
import {
  ATAQUES_MAXIMOS,
  ATAQUES_VISIBLES,
  SIN_FILTRO,
  alternarTipo,
  ataquesVisibles,
  claveActivo,
  claveAtaque,
  descripcionDeAtaque,
  filtrarAtaques,
  haceDeAtaque,
  textoSeveridadAtaque,
  textoVeces,
  ultimoAtaqueDe,
  componentesAgregados,
  elegirEquipo,
  filtrarActivos,
  fraseResumen,
  hayFiltro,
  opcionesEquipo,
  ordenarPorAlertas,
  resumenPorTipo,
  totales,
} from "./activos";

/** Un activo armado a mano; alertas y altas salen de sus componentes (como en el backend). */
function activo(id: string, nombreVisible: string, tipo: string, componentes: Array<[string, number, number]>, equipo = `tec-${id}`): Activo {
  const lista = componentes.map(([clave, alertas, altasYCriticas]) => ({ clave, alertas, altasYCriticas }));
  return {
    agenteId: id,
    equipo,
    nombreVisible,
    tipo,
    sistema: tipo === "windows" ? "Windows" : "Linux",
    alertas: lista.reduce((s, c) => s + c.alertas, 0),
    altasYCriticas: lista.reduce((s, c) => s + c.altasYCriticas, 0),
    componentePrincipal: lista[0]?.clave ?? null,
    componentes: lista,
    ultimoAtaqueEn: null,
  };
}

const WEB = activo("4", "Servidor web", "web", [["servidor-web", 300, 5], ["ssh", 50, 0]]);
const DB = activo("3", "Servidor de base de datos", "base-de-datos", [["base-de-datos", 100, 20], ["otros", 400, 0]]);
const WIN1 = activo("2", "Servidor Windows 1", "windows", [["inicio-sesion-windows", 80, 0]]);
const WIN2 = activo("5", "Servidor Windows 2", "windows", [["sistema-windows", 10, 1]]);
const VACIO = activo("1", "Estación de trabajo Linux", "estacion", []);
const TODOS = [WEB, DB, WIN1, WIN2, VACIO];

describe("filtrarActivos", () => {
  it("sin filtro devuelve todos", () => {
    expect(filtrarActivos(TODOS, SIN_FILTRO)).toEqual(TODOS);
    expect(hayFiltro(SIN_FILTRO)).toBe(false);
  });

  it("por tipo, por equipo y por los dos", () => {
    expect(filtrarActivos(TODOS, { tipo: "windows", equipo: null })).toEqual([WIN1, WIN2]);
    expect(filtrarActivos(TODOS, { tipo: null, equipo: "3" })).toEqual([DB]);
    expect(filtrarActivos(TODOS, { tipo: "windows", equipo: "5" })).toEqual([WIN2]);
    expect(filtrarActivos(TODOS, { tipo: "web", equipo: "5" })).toEqual([]);
  });

  it("la clave del activo es el id de agente, o el nombre técnico, o el visible", () => {
    expect(claveActivo(WEB)).toBe("4");
    expect(claveActivo({ ...WEB, agenteId: null })).toBe("tec-4");
    expect(claveActivo({ ...WEB, agenteId: null, equipo: null })).toBe("Servidor web");
  });
});

describe("alternarTipo y elegirEquipo", () => {
  it("un tipo se activa y, si se vuelve a pulsar, se quita", () => {
    const f = alternarTipo(SIN_FILTRO, "windows", TODOS);
    expect(f).toEqual({ tipo: "windows", equipo: null });
    expect(alternarTipo(f, "windows", TODOS)).toEqual({ tipo: null, equipo: null });
  });

  it("al cambiar a un tipo que no es el del equipo elegido, el equipo se quita", () => {
    expect(alternarTipo({ tipo: null, equipo: "5" }, "windows", TODOS)).toEqual({ tipo: "windows", equipo: "5" });
    expect(alternarTipo({ tipo: null, equipo: "5" }, "web", TODOS)).toEqual({ tipo: "web", equipo: null });
  });

  it("elegir un equipo conserva el tipo solo si es el suyo; null vuelve a todos", () => {
    expect(elegirEquipo({ tipo: "windows", equipo: null }, "2", TODOS)).toEqual({ tipo: "windows", equipo: "2" });
    expect(elegirEquipo({ tipo: "web", equipo: null }, "2", TODOS)).toEqual({ tipo: null, equipo: "2" });
    expect(elegirEquipo({ tipo: "windows", equipo: "2" }, null, TODOS)).toEqual({ tipo: "windows", equipo: null });
  });
});

describe("agregados", () => {
  it("por tipo: en el orden fijo, con alertas, altas y servidores", () => {
    const r = resumenPorTipo(TODOS);
    expect(r.map((t) => t.tipo)).toEqual(["base-de-datos", "web", "windows", "estacion"]);
    expect(r.find((t) => t.tipo === "windows")).toEqual({ tipo: "windows", nombre: "Windows", alertas: 90, altasYCriticas: 1, servidores: 2 });
    expect(r.find((t) => t.tipo === "estacion")?.nombre).toBe("Estación de trabajo");
  });

  it("un tipo nuevo va al final con su clave como nombre", () => {
    const r = resumenPorTipo([activo("9", "x", "impresora", [["otros", 1, 0]]), WEB]);
    expect(r.map((t) => t.nombre)).toEqual(["Web", "impresora"]);
  });

  it("componentes: de mayor a menor, 'Otros' al final aunque sea el mayor, sin ceros", () => {
    const filas = componentesAgregados([...TODOS, activo("8", "y", "web", [["ssh", 0, 0]])]);
    expect(filas.map((f) => f.clave)).toEqual(["servidor-web", "base-de-datos", "inicio-sesion-windows", "ssh", "sistema-windows", "otros"]);
    expect(filas[0]).toEqual({ clave: "servidor-web", nombre: "Servidor web", alertas: 300, altasYCriticas: 5 });
    expect(filas.at(-1)?.nombre).toBe("Otros");
  });

  it("totales y orden de la tabla por alertas", () => {
    expect(totales(TODOS)).toEqual({ alertas: 940, altasYCriticas: 26 });
    expect(ordenarPorAlertas(TODOS).map((a) => a.agenteId)).toEqual(["3", "4", "2", "5", "1"]);
  });

  it("opciones del selector por nombre visible; con tipo, solo las de ese tipo", () => {
    expect(opcionesEquipo(TODOS, "windows")).toEqual([
      { clave: "2", etiqueta: "Servidor Windows 1 (tec-2)" },
      { clave: "5", etiqueta: "Servidor Windows 2 (tec-5)" },
    ]);
    expect(opcionesEquipo(TODOS, null)).toHaveLength(5);
  });
});

describe("fraseResumen", () => {
  it("destaca el de más altas y críticas y el componente con más alertas (sin contar 'Otros')", () => {
    expect(fraseResumen(TODOS)).toBe(
      "El activo con más alertas altas y críticas es Servidor de base de datos: 20 de 500. " +
        "Lo más atacado es Servidor web: 300 alertas.",
    );
  });

  it("sin altas ni críticas usa el de más alertas", () => {
    expect(fraseResumen([WIN1, activo("7", "Otro", "web", [["servidor-web", 5, 0]])])).toBe(
      "El activo con más alertas es Servidor Windows 1: 80 alertas, ninguna alta ni crítica. " +
        "Lo más atacado es Inicio de sesión de Windows: 80 alertas.",
    );
  });

  it("si solo hay 'Otros' no nombra componente; separador de miles es-CO", () => {
    expect(fraseResumen([activo("9", "Nuevo", "sin-clasificar", [["otros", 1200, 0]])])).toBe(
      "El activo con más alertas es Nuevo: 1.200 alertas, ninguna alta ni crítica.",
    );
  });

  it("sin paréntesis dobles aunque el nombre visible traiga paréntesis", () => {
    const monitoreo = activo("0", "Servidor de monitoreo (Wazuh)", "monitoreo", [["ssh", 11968, 1000], ["monitoreo-wazuh", 6584, 396]]);
    const frase = fraseResumen([monitoreo])!;
    expect(frase).toBe(
      "El activo con más alertas altas y críticas es Servidor de monitoreo (Wazuh): 1.396 de 18.552. " +
        "Lo más atacado es Acceso remoto (SSH): 11.968 alertas.",
    );
    expect(frase).not.toMatch(/\([^()]*\(/);
  });

  it("sin alertas devuelve null (nunca inventa un activo)", () => {
    expect(fraseResumen([])).toBeNull();
    expect(fraseResumen([VACIO])).toBeNull();
  });
});

// ---------- Último ataque y ataques recientes ----------

// 3 nov 2026, 20:42 UTC = 15:42 en Bogotá
const AHORA = Date.UTC(2026, 10, 3, 20, 42);
const HORA = 3_600_000;

function ataque(sobre: Partial<AtaqueReciente> = {}): AtaqueReciente {
  return {
    agenteId: "4",
    equipo: "tec-4",
    nombreVisible: "Servidor web",
    tipo: "web",
    componente: "ssh",
    reglaId: "999",
    nivelWazuh: 10,
    descripcion: "Some rule",
    severidad: 3,
    cantidad: 5,
    primeraEn: AHORA - 5 * HORA,
    ultimaEn: AHORA - 2 * HORA,
    ...sobre,
  };
}

describe("ultimoAtaqueDe", () => {
  it("fecha y hora de Bogotá y 'hace N' contado desde la hora del resumen", () => {
    const a = { ...WEB, ultimoAtaqueEn: AHORA - 2 * HORA };
    expect(ultimoAtaqueDe(a, AHORA)).toEqual({ fecha: "3 nov, 13:42", hace: "hace 2 h" });
    // otro reloj, otro "hace": depende solo de `ahora`
    expect(ultimoAtaqueDe(a, AHORA + 24 * HORA)?.hace).toBe("hace 1 día");
    expect(ultimoAtaqueDe({ ...WEB, ultimoAtaqueEn: AHORA - 90_000 }, AHORA)?.hace).toBe("hace 1 min");
  });

  it("la medianoche de Bogotá no se corre por la zona del equipo", () => {
    const a = { ...WEB, ultimoAtaqueEn: Date.UTC(2026, 10, 4, 4, 59) }; // 3 nov, 23:59 en Bogotá
    expect(ultimoAtaqueDe(a, AHORA + 10 * HORA)?.fecha).toBe("3 nov, 23:59");
  });

  it("sin ataques altos o críticos: null (la tabla muestra '—')", () => {
    expect(ultimoAtaqueDe(WEB, AHORA)).toBeNull();
    expect(ultimoAtaqueDe({ ...WEB, ultimoAtaqueEn: undefined as unknown as null }, AHORA)).toBeNull();
  });
});

describe("filtrarAtaques", () => {
  const A = ataque({ agenteId: "4", tipo: "web" });
  const B = ataque({ agenteId: "3", equipo: "tec-3", nombreVisible: "BD", tipo: "base-de-datos" });
  const C = ataque({ agenteId: "2", equipo: "tec-2", nombreVisible: "Windows 1", tipo: "windows" });
  const D = ataque({ agenteId: null, equipo: null, nombreVisible: "agente-raro", tipo: "sin-clasificar" });
  const TODOS_ATAQUES = [A, B, C, D];

  it("sin filtro devuelve todos, en el mismo orden", () => {
    expect(filtrarAtaques(TODOS_ATAQUES, SIN_FILTRO)).toEqual(TODOS_ATAQUES);
  });

  it("por tipo, por equipo y por los dos; la clave es la misma que la del activo", () => {
    expect(filtrarAtaques(TODOS_ATAQUES, { tipo: "windows", equipo: null })).toEqual([C]);
    expect(filtrarAtaques(TODOS_ATAQUES, { tipo: null, equipo: claveActivo(DB) })).toEqual([B]);
    expect(filtrarAtaques(TODOS_ATAQUES, { tipo: "web", equipo: "3" })).toEqual([]);
    expect(claveAtaque(D)).toBe("agente-raro");
    expect(filtrarAtaques(TODOS_ATAQUES, { tipo: null, equipo: "agente-raro" })).toEqual([D]);
  });

  it("un filtro que no coincide con nada da lista vacía", () => {
    expect(filtrarAtaques(TODOS_ATAQUES, { tipo: null, equipo: "no-existe" })).toEqual([]);
    expect(filtrarAtaques([], SIN_FILTRO)).toEqual([]);
  });
});

describe("ataquesVisibles", () => {
  const veinte = Array.from({ length: 20 }, (_, i) => ataque({ reglaId: `r${i}` }));

  it("muestra 10 y con 'Ver más' los 20", () => {
    expect(ATAQUES_VISIBLES).toBe(10);
    expect(ataquesVisibles(veinte, false)).toHaveLength(10);
    expect(ataquesVisibles(veinte, false)[9].reglaId).toBe("r9");
    expect(ataquesVisibles(veinte, true)).toHaveLength(20);
  });

  it("sin filtro puede haber más de 20 (hasta 20 por activo): se muestran 10 y, con 'Ver más', 20", () => {
    const muchos = Array.from({ length: 120 }, (_, i) => ataque({ reglaId: `r${i}` }));
    expect(ATAQUES_MAXIMOS).toBe(20);
    expect(ataquesVisibles(muchos, false)).toHaveLength(10);
    expect(ataquesVisibles(muchos, true)).toHaveLength(20);
  });

  it("se filtra primero y se corta después: un equipo con ataques viejos aparece aunque otros tengan muchos más recientes", () => {
    const ruidosos = Array.from({ length: 40 }, (_, i) =>
      ataque({ agenteId: "4", reglaId: `nueva-${i}`, ultimaEn: AHORA - i * 60_000 }),
    );
    const viejo = ataque({ agenteId: "3", equipo: "tec-3", nombreVisible: "BD", tipo: "base-de-datos", reglaId: "vieja", ultimaEn: AHORA - 9 * 24 * HORA });
    const todos = [...ruidosos, viejo]; // el orden del backend: la más reciente primero
    // sin filtro el viejo queda fuera de los 20 que se muestran...
    expect(ataquesVisibles(filtrarAtaques(todos, SIN_FILTRO), true).map((a) => a.reglaId)).not.toContain("vieja");
    // ...pero al filtrar por su equipo o su tipo aparece
    expect(ataquesVisibles(filtrarAtaques(todos, { tipo: null, equipo: "3" }), false).map((a) => a.reglaId)).toEqual(["vieja"]);
    expect(ataquesVisibles(filtrarAtaques(todos, { tipo: "base-de-datos", equipo: null }), false).map((a) => a.reglaId)).toEqual(["vieja"]);
  });

  it("con 10 o menos no hay nada que ocultar", () => {
    expect(ataquesVisibles(veinte.slice(0, 4), false)).toHaveLength(4);
    expect(ataquesVisibles([], true)).toEqual([]);
  });
});

describe("textos de un ataque", () => {
  it("severidad con texto: 4 Crítica, 3 Alta", () => {
    expect(textoSeveridadAtaque(4)).toBe("Crítica");
    expect(textoSeveridadAtaque(3)).toBe("Alta");
  });

  it("descripción: la traducción si existe (por id o por texto); si no, la original; nunca inventa", () => {
    expect(descripcionDeAtaque(ataque({ reglaId: "5712", descripcion: "sshd: brute force" }))).toBe(
      "sshd: ataque de fuerza bruta para entrar al sistema (usuario que no existe)",
    );
    expect(
      descripcionDeAtaque(ataque({ reglaId: "92213", descripcion: "Executable file dropped in folder commonly used by malware" })),
    ).toBe("Archivo ejecutable creado en una carpeta que el malware suele usar");
    expect(descripcionDeAtaque(ataque({ reglaId: "1", descripcion: "Untranslated rule" }))).toBe("Untranslated rule");
    expect(descripcionDeAtaque(ataque({ reglaId: null, descripcion: null }))).toBe("Sin descripción");
  });

  it("'N veces desde <primera fecha>' en Bogotá; una sola alerta, '1 vez'", () => {
    expect(textoVeces(ataque({ cantidad: 14, primeraEn: Date.UTC(2026, 10, 3, 14, 10) }))).toBe("14 veces desde 3 nov, 09:10");
    expect(textoVeces(ataque({ cantidad: 1 }))).toBe("1 vez");
    expect(textoVeces(ataque({ cantidad: 1234, primeraEn: AHORA }))).toContain("1.234 veces");
  });

  it("'hace N' del ataque se cuenta desde la hora del resumen", () => {
    expect(haceDeAtaque(ataque({ ultimaEn: AHORA - 25 * 60_000 }), AHORA)).toBe("hace 25 min");
    expect(haceDeAtaque(ataque({ ultimaEn: AHORA - 3 * 24 * HORA }), AHORA)).toBe("hace 3 días");
  });
});
