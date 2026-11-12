import { describe, expect, it } from "vitest";
import type { Activo } from "../types/activos";
import {
  SIN_FILTRO,
  alternarTipo,
  claveActivo,
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
      "Activo con más alertas altas y críticas: Servidor de base de datos (20 de 500 alertas). " +
        "Componente más atacado: Servidor web (300 alertas).",
    );
  });

  it("sin altas ni críticas usa el de más alertas", () => {
    expect(fraseResumen([WIN1, activo("7", "Otro", "web", [["servidor-web", 5, 0]])])).toBe(
      "Activo con más alertas: Servidor Windows 1 (80 alertas; ninguna alta ni crítica). " +
        "Componente más atacado: Inicio de sesión de Windows (80 alertas).",
    );
  });

  it("si solo hay 'Otros' no nombra componente; separador de miles es-CO", () => {
    expect(fraseResumen([activo("9", "Nuevo", "sin-clasificar", [["otros", 1200, 0]])])).toBe(
      "Activo con más alertas: Nuevo (1.200 alertas; ninguna alta ni crítica).",
    );
  });

  it("sin alertas devuelve null (nunca inventa un activo)", () => {
    expect(fraseResumen([])).toBeNull();
    expect(fraseResumen([VACIO])).toBeNull();
  });
});
