import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearFuenteMock } from "./api/mock";
import {
  ESTADO_APP_INICIAL,
  reducirApp,
  refrescaGerencial,
  refrescaUnificada,
  tituloDelDocumento,
  type AccionApp,
  type EstadoApp,
} from "./estadoApp";
import { crearControlador, type EstadoRefresco } from "./hooks/controlador";
import type { ListaAlertas } from "./types/listaAlertas";
import type { ResumenGerencial } from "./types/metricas";
import { calcularVista, FILTROS_VACIOS } from "./utils/tabla";

const INTERVALO = 30_000;
const MIN = 60_000;
const AHORA = Date.UTC(2026, 10, 3, 15, 0);

const aplicar = (estado: EstadoApp, ...acciones: AccionApp[]) => acciones.reduce(reducirApp, estado);

describe("estado de App: la tabla sobrevive al cambio de pestaña", () => {
  it("empieza en la vista gerencial y solo ella refresca", () => {
    expect(ESTADO_APP_INICIAL.pestana).toBe("gerencial");
    expect(refrescaGerencial(ESTADO_APP_INICIAL)).toBe(true);
    expect(refrescaUnificada(ESTADO_APP_INICIAL)).toBe(false);
  });

  it("cada vista refresca SOLO mientras está activa", () => {
    const enUnificada = aplicar(ESTADO_APP_INICIAL, { tipo: "pestana", pestana: "unificada" });
    expect(refrescaUnificada(enUnificada)).toBe(true);
    expect(refrescaGerencial(enUnificada)).toBe(false);
  });

  it("cambiar de pestaña no toca la tabla: es el MISMO objeto", () => {
    const antes = aplicar(ESTADO_APP_INICIAL, { tipo: "filtros", cambio: (f) => ({ ...f, severidades: [4] }) });
    const despues = aplicar(antes, { tipo: "pestana", pestana: "unificada" }, { tipo: "pestana", pestana: "gerencial" });
    expect(despues.tabla).toBe(antes.tabla);
  });

  it("filtros, búsqueda, orden y página siguen igual tras ir a la gerencial y volver", () => {
    let app = aplicar(
      ESTADO_APP_INICIAL,
      { tipo: "pestana", pestana: "unificada" },
      { tipo: "filtros", cambio: (f) => ({ ...f, estados: ["New"], busqueda: "phishing", tieneCaso: "no" }) },
      { tipo: "orden", orden: "recientes" },
      { tipo: "pagina", pagina: 2 },
    );
    const tablaAntes = app.tabla;
    expect(tablaAntes).toEqual({
      filtros: { ...FILTROS_VACIOS, estados: ["New"], busqueda: "phishing", tieneCaso: "no" },
      orden: "recientes",
      pagina: 2,
    });

    app = aplicar(app, { tipo: "pestana", pestana: "gerencial" }, { tipo: "pestana", pestana: "unificada" });
    expect(app.pestana).toBe("unificada");
    expect(app.tabla).toBe(tablaAntes);
  });
});

describe("título del documento", () => {
  it("cambia con la vista activa", () => {
    expect(tituloDelDocumento("gerencial")).toBe("Vista gerencial · Dashboard SOC");
    expect(tituloDelDocumento("unificada")).toBe("Vista unificada · Dashboard SOC");
  });
});

describe("estado de App: acciones de la tabla", () => {
  const enPagina3 = aplicar(ESTADO_APP_INICIAL, { tipo: "pagina", pagina: 3 });

  it("cambiar un filtro o el orden vuelve a la página 1; cambiar de página no", () => {
    expect(enPagina3.tabla.pagina).toBe(3);
    expect(aplicar(enPagina3, { tipo: "filtros", cambio: (f) => ({ ...f, origenes: ["wazuh"] }) }).tabla.pagina).toBe(1);
    expect(aplicar(enPagina3, { tipo: "orden", orden: "antiguas" }).tabla.pagina).toBe(1);
    expect(aplicar(enPagina3, { tipo: "pagina", pagina: 4 }).tabla.pagina).toBe(4);
  });

  it("repetir el mismo valor no cambia nada (ni la página): mismo estado", () => {
    expect(reducirApp(enPagina3, { tipo: "orden", orden: "prioridad" })).toBe(enPagina3);
    expect(reducirApp(enPagina3, { tipo: "filtros", cambio: (f) => f })).toBe(enPagina3);
    expect(reducirApp(enPagina3, { tipo: "pagina", pagina: 3 })).toBe(enPagina3);
    expect(reducirApp(enPagina3, { tipo: "pestana", pestana: "gerencial" })).toBe(enPagina3);
  });

  it("la página no baja de 1", () => {
    expect(aplicar(enPagina3, { tipo: "pagina", pagina: 0 }).tabla.pagina).toBe(1);
    expect(aplicar(enPagina3, { tipo: "pagina", pagina: -4 }).tabla.pagina).toBe(1);
  });

  it("limpiar filtros deja los filtros vacíos y vuelve a la página 1, conservando el orden", () => {
    const filtrada = aplicar(
      enPagina3,
      { tipo: "orden", orden: "severidad" },
      { tipo: "filtros", cambio: (f) => ({ ...f, severidades: [4], busqueda: "x" }) },
      { tipo: "pagina", pagina: 2 },
    );
    const limpia = aplicar(filtrada, { tipo: "limpiar-filtros" });
    expect(limpia.tabla).toEqual({ filtros: FILTROS_VACIOS, orden: "severidad", pagina: 1 });
  });
});

describe("estado de App: filtrar, página 2, cambiar a la gerencial y volver (con los datos refrescándose)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("todo sigue igual al volver y la lista se refresca de inmediato", async () => {
    let reloj = AHORA;
    const fuente = crearFuenteMock({ ahora: () => reloj, demoraMs: 0, falla: false });

    const peticiones = { resumen: 0, alertas: 0 };
    let ultimaLista: EstadoRefresco<ListaAlertas> | null = null;
    let app = ESTADO_APP_INICIAL;

    // Los mismos dos controladores que usa App (a través de useRefresco), habilitados según la pestaña activa.
    const resumen = crearControlador<ResumenGerencial>({
      obtener: () => {
        peticiones.resumen += 1;
        return fuente.obtenerResumenGerencial();
      },
      alCambiar: () => {},
      intervaloMs: INTERVALO,
      habilitado: refrescaGerencial(app),
    });
    const alertas = crearControlador<ListaAlertas>({
      obtener: () => {
        peticiones.alertas += 1;
        return fuente.listarAlertas();
      },
      alCambiar: (e) => {
        ultimaLista = e;
      },
      intervaloMs: INTERVALO,
      habilitado: refrescaUnificada(app),
    });
    const despachar = (...acciones: AccionApp[]) => {
      app = aplicar(app, ...acciones);
      resumen.establecerHabilitado(refrescaGerencial(app));
      alertas.establecerHabilitado(refrescaUnificada(app));
    };
    const vistaActual = () => calcularVista(ultimaLista!.datos!.alertas, app.tabla, ultimaLista!.datos!.generadoEn);

    resumen.iniciar();
    alertas.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(peticiones).toEqual({ resumen: 1, alertas: 0 }); // solo la vista visible consulta

    // 1) Abre la vista unificada: la lista carga de inmediato; la gerencial se pausa.
    despachar({ tipo: "pestana", pestana: "unificada" });
    await vi.advanceTimersByTimeAsync(0);
    expect(peticiones).toEqual({ resumen: 1, alertas: 1 });

    // 2) Filtra (26 sin atender), ordena y va a la página 2.
    despachar(
      { tipo: "filtros", cambio: (f) => ({ ...f, estados: ["New"] }) },
      { tipo: "orden", orden: "recientes" },
      { tipo: "pagina", pagina: 2 },
    );
    const tablaAntes = app.tabla;
    const antes = vistaActual();
    expect(antes.coincidencias).toBe(26);
    expect(antes.pagina).toMatchObject({ pagina: 2, totalPaginas: 2, desde: 26, hasta: 26 });
    const generadoAntes = ultimaLista!.datos!.generadoEn;

    // 3) Pasa a la gerencial y se queda 5 minutos: refresca la gerencial; la lista NO se consulta.
    despachar({ tipo: "pestana", pestana: "gerencial" });
    reloj += 5 * MIN;
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(peticiones.alertas).toBe(1);
    expect(peticiones.resumen).toBeGreaterThan(1);

    // 4) Vuelve a la unificada: la lista se refresca DE INMEDIATO y la tabla está exactamente igual.
    despachar({ tipo: "pestana", pestana: "unificada" });
    await vi.advanceTimersByTimeAsync(0);
    expect(peticiones.alertas).toBe(2);
    expect(ultimaLista!.datos!.generadoEn).toBe(generadoAntes + 5 * MIN); // datos nuevos

    expect(app.tabla).toBe(tablaAntes);
    const despues = vistaActual();
    expect(despues.coincidencias).toBe(26);
    expect(despues.pagina.pagina).toBe(2);
    expect(despues.pagina.items.map((f) => f.id)).toEqual(antes.pagina.items.map((f) => f.id));

    resumen.detener();
    alertas.detener();
  });
});
