import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { crearFuenteHttp } from "../../api/http";
import { crearFuenteMock } from "../../api/mock";
import { ErrorApi } from "../../api/tipos";
import type { ResultadoActivos } from "../../hooks/useActivos";
import { generarActivos } from "../../mocks/activos";
import type { FiltroActivos } from "../../utils/activos";
import { PanelActivos } from "./PanelActivos";

const AHORA = Date.UTC(2026, 10, 3, 20, 42); // 15:42 en Bogotá

function html(resultado: Partial<ResultadoActivos>, filtroInicial?: FiltroActivos): string {
  const completo: ResultadoActivos = {
    datos: null,
    cargando: false,
    error: null,
    actualizadoEn: AHORA,
    reintentar: () => {},
    ...resultado,
  };
  return renderToStaticMarkup(createElement(PanelActivos, { resultado: completo, filtroInicial }));
}

const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("PanelActivos: estados", () => {
  it("primera carga: título y 'Cargando…' sin porcentaje", () => {
    const h = html({ cargando: true });
    // sin respuesta aún no se sabe la ventana: el título va solo, sin inventar el número
    expect(texto(h)).toContain("Activos atacados");
    expect(texto(h)).not.toContain("últimos");
    expect(texto(h)).toContain("Cargando datos de Wazuh…");
    expect(texto(h)).not.toContain("%");
  });

  it("el backend cargando: progreso real y ninguna cifra; nunca '0 %'", () => {
    const h = html({ datos: generarActivos(AHORA, { cargando: true }) });
    expect(texto(h)).toContain("Cargando datos de Wazuh… 40 %");
    expect(h).not.toContain("activos-tipo");
    for (const progreso of [null, 0]) {
      expect(texto(html({ datos: { ...generarActivos(AHORA, { cargando: true }), progreso } }))).not.toContain("%");
    }
  });

  it("error sin datos: mensaje y 'Reintentar'; error con datos: los datos siguen con aviso", () => {
    const sin = html({ error: new ErrorApi("No se pudo conectar") });
    expect(texto(sin)).toContain("No se pudieron cargar los datos");
    expect(texto(sin)).toContain("Reintentar");

    const con = html({ datos: generarActivos(AHORA), error: new ErrorApi("No se pudo conectar") });
    expect(texto(con)).toContain("No se pudo actualizar. Mostrando datos de las");
    expect(texto(con)).toContain("Activos más atacados");
  });

  it("sin activos: frase que explica por qué, sin tabla", () => {
    const h = html({ datos: { ...generarActivos(AHORA), activos: [] } });
    expect(texto(h)).toContain("Aún no hay activos con alertas de Wazuh en los últimos 14 días");
    expect(h).not.toContain("<table");
  });

  it("filtro sin resultados: 'Limpiar filtro'", () => {
    const h = html({ datos: generarActivos(AHORA) }, { tipo: null, equipo: "no-existe" });
    expect(texto(h)).toContain("Ningún activo coincide con el filtro.");
    expect(texto(h)).toContain("Limpiar filtro");
    expect(h).not.toContain("<table");
  });
});

describe("PanelActivos: contenido", () => {
  const datos = generarActivos(AHORA);

  it("los días del título y de los textos salen de la respuesta", () => {
    expect(texto(html({ datos }))).toContain("Activos atacados (últimos 14 días)");
    expect(texto(html({ datos: { ...datos, ventanaDias: 30 } }))).toContain("Activos atacados (últimos 30 días)");
    expect(texto(html({ datos: { ...generarActivos(AHORA, { cargando: true }), ventanaDias: 21 } }))).toContain("(últimos 21 días)");
    const vacio = texto(html({ datos: { ...datos, ventanaDias: 30, activos: [] } }));
    expect(vacio).toContain("en los últimos 30 días");
    expect(vacio).not.toContain("14");
  });

  it("frase, tarjetas por tipo, tabla y componentes con los datos", () => {
    const t = texto(html({ datos }));
    expect(t).toContain("El activo con más alertas altas y críticas es Servidor web: 45 de 543. Lo más atacado es Servidor web: 412 alertas.");
    expect(t).toContain("Base de datos · 1");
    expect(t).toContain("Windows · 2");
    expect(t).toContain("2 servidores");
    expect(t).toContain("Activos más atacados");
    expect(t).toContain("Componentes atacados");
    expect(t).toContain("Acceso remoto (SSH)");
    expect(t).toContain("3 alertas no traen el equipo de origen");
  });

  it("los filtros son accesibles: aria-pressed y selector con etiqueta", () => {
    const h = html({ datos });
    expect(h).toMatch(/<button type="button" class="activos-filtro__boton" aria-pressed="false">/);
    const id = /<label for="([^"]+)" class="activos-filtro__etiqueta">Equipo<\/label>/.exec(h)?.[1];
    expect(id).toBeTruthy();
    expect(h).toContain(`<select id="${id}"`);
    expect(h).toMatch(/<button type="button" class="boton boton--secundario" disabled="">Limpiar<\/button>/);
  });

  it("con un tipo elegido: su botón y su tarjeta quedan marcados y solo salen sus activos", () => {
    const h = html({ datos }, { tipo: "windows", equipo: null });
    expect(h).toMatch(/aria-pressed="true">Windows · 2</);
    expect(h).toMatch(/class="activos-tipo" aria-pressed="true" aria-label="Windows:/);
    const t = texto(h);
    expect(t).toContain("El activo con más alertas altas y críticas es Servidor Windows 1:");
    expect(t).not.toContain("Servidor de base de datos 188");
    expect(h).not.toContain("srv-web-demo");
  });

  it("la fila muestra el nombre visible y debajo el técnico; el componente principal en español", () => {
    const h = html({ datos }, { tipo: null, equipo: "102" });
    expect(h).toContain("Servidor de base de datos</button><span class=\"activos-tecnico\">srv-datos-demo</span>");
    expect(texto(h)).toContain("Base de datos");
    expect(h).toContain("activos-fila--elegida");
  });

  it("'Otros' va al final de la gráfica y en gris", () => {
    const h = html({ datos });
    const otros = h.indexOf("activos-componente--otros");
    expect(otros).toBeGreaterThan(h.lastIndexOf("Monitoreo (Wazuh)"));
  });

  it("nunca muestra IPs ni usuarios", () => {
    expect(html({ datos })).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  });
});

describe("obtenerActivos", () => {
  it("el mock devuelve la misma forma; los componentes suman las alertas", async () => {
    const r = await crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false }).obtenerActivos();
    expect(r.estado).toBe("listo");
    for (const a of r.activos!) {
      expect(a.componentes.reduce((s, c) => s + c.alertas, 0)).toBe(a.alertas);
    }
  });

  it("http pide /api/dashboard/activos y rechaza respuestas sin la forma esperada", async () => {
    const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(json(generarActivos(AHORA)));
    await crearFuenteHttp("http://b/", { fetchFn }).obtenerActivos();
    expect(fetchFn.mock.calls[0][0]).toBe("http://b/api/dashboard/activos");

    const malo = crearFuenteHttp("http://b", { fetchFn: vi.fn().mockResolvedValue(json({ estado: "listo", activos: null })) });
    await expect(malo.obtenerActivos()).rejects.toThrow(/formato esperado/);
  });
});
