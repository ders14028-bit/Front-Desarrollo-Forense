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
    await expect(fuente.obtenerMetricasWazuh()).rejects.toThrow(/Error simulado/);
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

  it("un 404 dice que el servicio no existe en el servidor", async () => {
    const fuente = crearFuenteHttp("http://b", { fetchFn: vi.fn().mockResolvedValue(json({}, 404)) });
    await expect(fuente.obtenerResumenGerencial()).rejects.toThrow(/no existe.*404/);
  });

  it("errores HTTP, de red y de formato salen con mensajes claros en español", async () => {
    const con = (fetchFn: typeof fetch) => crearFuenteHttp("http://b", { fetchFn }).obtenerResumenGerencial();

    await expect(con(vi.fn().mockResolvedValue(json({}, 500)))).rejects.toThrow(/error interno \(500\)/);
    await expect(con(vi.fn().mockRejectedValue(new TypeError("fetch failed")))).rejects.toThrow(/No se pudo conectar/);
    await expect(con(vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })))).rejects.toThrow(/formato esperado/);
    await expect(con(vi.fn().mockResolvedValue(json({ otra: "cosa" })))).rejects.toThrow(/formato esperado/);

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
