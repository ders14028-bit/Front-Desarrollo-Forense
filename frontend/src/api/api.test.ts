import { describe, expect, it, vi } from "vitest";
import { crearFuenteHttp } from "./http";
import { crearFuenteMock } from "./mock";
import { ErrorApi } from "./tipos";

const HORA = 3_600_000;
const AHORA = Date.UTC(2026, 10, 3, 15, 0);

describe("fuente mock", () => {
  it("calcula el resumen con la hora de CADA llamada: las antigüedades avanzan", async () => {
    let reloj = AHORA;
    const fuente = crearFuenteMock({ ahora: () => reloj, demoraMs: 0, falla: false });

    const antes = await fuente.obtenerResumenGerencial();
    reloj += 2 * HORA;
    const despues = await fuente.obtenerResumenGerencial();

    expect(despues.generadoEn - antes.generadoEn).toBe(2 * HORA);
    expect(despues.alertas.masAntiguaSinAtenderMs! - antes.alertas.masAntiguaSinAtenderMs!).toBe(2 * HORA);
    // los datos crudos se generaron una sola vez: el total no cambia
    expect(despues.alertas.recibidas).toBe(antes.alertas.recibidas);
  });

  it("con falla=true toda llamada rechaza con un ErrorApi en español", async () => {
    const fuente = crearFuenteMock({ demoraMs: 0, falla: true });
    await expect(fuente.obtenerResumenGerencial()).rejects.toBeInstanceOf(ErrorApi);
    await expect(fuente.listarAlertas()).rejects.toThrow(/Error simulado/);
    await expect(fuente.obtenerDetalleAlerta("~1")).rejects.toThrow(/Error simulado/);
  });

  it("listarAlertas devuelve la lista de 30 días con la forma del contrato", async () => {
    const fuente = crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false });
    const lista = await fuente.listarAlertas();

    expect(lista.generadoEn).toBe(AHORA);
    expect(lista.alertas).toHaveLength(40);
    expect(lista.total).toBe(40);
    expect(lista.truncado).toBe(false);
    expect(lista.datosDeLaboratorio).toBe(true);
    expect(lista.alertas.filter((f) => f.tipo === null)).toHaveLength(8); // sin etiqueta escenario
    expect(lista.alertas[0].creadaEn).toBeGreaterThanOrEqual(lista.alertas[39].creadaEn);
    expect(lista.alertas.filter((f) => f.sla.estado === "fuera").length).toBeGreaterThan(0);
    expect(lista.alertas.filter((f) => f.caso !== null)).toHaveLength(6);
  });

  it("obtenerDetalleAlerta devuelve la alerta con su caso y tareas", async () => {
    const fuente = crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false });
    const lista = await fuente.listarAlertas();
    const conCaso = lista.alertas.find((f) => f.caso !== null)!;

    const detalle = await fuente.obtenerDetalleAlerta(conCaso.id);
    expect(detalle.alerta._id).toBe(conCaso.id);
    expect(detalle.fila).toEqual(conCaso);
    expect(detalle.caso?._id).toBe(conCaso.caso?.id);
    expect(detalle.caso?.tareas.length).toBeGreaterThan(0);
    expect(detalle.caso?.tareas.every((t) => t.caseId === detalle.caso?._id)).toBe(true);
  });

  it("una alerta sin caso trae caso null; un id inexistente rechaza", async () => {
    const fuente = crearFuenteMock({ ahora: () => AHORA, demoraMs: 0, falla: false });
    const lista = await fuente.listarAlertas();
    const sinCaso = lista.alertas.find((f) => f.caso === null)!;

    expect((await fuente.obtenerDetalleAlerta(sinCaso.id)).caso).toBeNull();
    await expect(fuente.obtenerDetalleAlerta("~no-existe")).rejects.toThrow(/No se encontró la alerta/);
  });
});

describe("fuente http", () => {
  const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

  it("pide a /api/dashboard/resumen sin enviar credenciales", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ alertas: {}, casos: {} }));
    const fuente = crearFuenteHttp("http://backend:8080/", { fetchFn });

    await fuente.obtenerResumenGerencial();

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://backend:8080/api/dashboard/resumen");
    expect(Object.keys(init.headers as object)).toEqual(["Accept"]);
    expect(init.credentials).toBeUndefined();
  });

  it("pide la lista a /api/dashboard/alertas, sin filtros en la URL", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ generadoEn: 1, alertas: [] }));
    const lista = await crearFuenteHttp("http://b", { fetchFn }).listarAlertas();
    expect(fetchFn.mock.calls[0][0]).toBe("http://b/api/dashboard/alertas");
    expect(lista.alertas).toEqual([]);
  });

  it("pide el detalle a /api/dashboard/alertas/{id}, codificando el id", async () => {
    // una respuesta nueva por llamada: el cuerpo de un Response solo se puede leer una vez
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(json({ alerta: {}, fila: {} })));
    await crearFuenteHttp("http://b", { fetchFn }).obtenerDetalleAlerta("~4513920");
    expect(fetchFn.mock.calls[0][0]).toBe("http://b/api/dashboard/alertas/~4513920");

    await crearFuenteHttp("http://b", { fetchFn }).obtenerDetalleAlerta("a/b c");
    expect(fetchFn.mock.calls[1][0]).toBe("http://b/api/dashboard/alertas/a%2Fb%20c");
  });

  it("un 404 del detalle dice que no se encontró la alerta; el de otras rutas, que el servicio no existe", async () => {
    const detalle = crearFuenteHttp("http://b", { fetchFn: vi.fn().mockResolvedValue(json({}, 404)) });
    await expect(detalle.obtenerDetalleAlerta("~1")).rejects.toThrow(/No se encontró la alerta/);
    await expect(detalle.obtenerResumenGerencial()).rejects.toThrow(/no existe.*404/);
  });

  it("errores HTTP, de red y de formato salen con mensajes claros en español", async () => {
    const con = (fetchFn: typeof fetch) => crearFuenteHttp("http://b", { fetchFn }).obtenerResumenGerencial();

    await expect(con(vi.fn().mockResolvedValue(json({}, 500)))).rejects.toThrow(/error interno \(500\)/);
    await expect(con(vi.fn().mockRejectedValue(new TypeError("fetch failed")))).rejects.toThrow(/No se pudo conectar/);
    await expect(con(vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })))).rejects.toThrow(/formato esperado/);
    await expect(con(vi.fn().mockResolvedValue(json({ otra: "cosa" })))).rejects.toThrow(/formato esperado/);

    const lista = (cuerpo: unknown) =>
      crearFuenteHttp("http://b", { fetchFn: vi.fn().mockResolvedValue(json(cuerpo)) }).listarAlertas();
    await expect(lista([])).rejects.toThrow(/formato esperado/); // el formato anterior (arreglo) ya no vale
    await expect(lista({ alertas: "no" })).rejects.toThrow(/formato esperado/);
  });

  it("corta con un mensaje de timeout si el servidor no responde", async () => {
    const colgado = ((_url: string, init: RequestInit) =>
      new Promise((_, rechazar) => {
        init.signal!.addEventListener("abort", () => rechazar(new DOMException("abortado", "AbortError")));
      })) as unknown as typeof fetch;

    const fuente = crearFuenteHttp("http://b", { fetchFn: colgado, timeoutMs: 20 });
    await expect(fuente.obtenerResumenGerencial()).rejects.toThrow(/no respondió en 1 s/);
  });
});
