import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/tipos";
import { crearControlador, type EstadoRefresco, type Visibilidad } from "./controlador";

const INTERVALO = 30_000;

// El controlador es genérico: aquí los "datos" son simples objetos.
interface Dato {
  n: number;
}
const dato = (n: number): Dato => ({ n });

/** Pestaña falsa del navegador: se puede ocultar y mostrar a voluntad. */
function pestanaFalsa() {
  let visible = true;
  const oyentes = new Set<() => void>();
  const visibilidad: Visibilidad = {
    esVisible: () => visible,
    suscribir: (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
  };
  return {
    visibilidad,
    poner(v: boolean) {
      visible = v;
      oyentes.forEach((cb) => cb());
    },
    oyentes: () => oyentes.size,
  };
}

function preparar(obtener: () => Promise<Dato>, pestana = pestanaFalsa(), habilitado?: boolean) {
  const estados: EstadoRefresco<Dato>[] = [];
  let reloj = 1000;
  const controlador = crearControlador<Dato>({
    obtener,
    alCambiar: (e) => estados.push(e),
    intervaloMs: INTERVALO,
    ahora: () => (reloj += 1),
    visibilidad: pestana.visibilidad,
    habilitado,
  });
  return { controlador, estados, pestana, ultimo: () => estados[estados.length - 1] };
}

/** Promesa que se resuelve o rechaza a mano. */
function diferida() {
  let resolver!: (r: Dato) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<Dato>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("crearControlador: frecuencia", () => {
  it("pide al iniciar y luego cada 30 s", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INTERVALO - 1);
    expect(obtener).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(obtener).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(3);
    controlador.detener();
  });

  it("no lanza otra petición mientras la anterior no termina", async () => {
    const d = diferida();
    const obtener = vi.fn().mockReturnValueOnce(d.promesa).mockResolvedValue(dato(2));
    const { controlador } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(5 * INTERVALO); // pasan 2.5 minutos con la petición colgada
    controlador.reintentar(); // tampoco el reintento manual
    expect(obtener).toHaveBeenCalledTimes(1);

    d.resolver(dato(1));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INTERVALO); // el siguiente se cuenta desde que terminó
    expect(obtener).toHaveBeenCalledTimes(2);
    controlador.detener();
  });
});

describe("crearControlador: pestaña oculta del navegador", () => {
  it("se pausa con la pestaña oculta y refresca de inmediato al volver", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador, pestana } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(1);

    pestana.poner(false);
    await vi.advanceTimersByTimeAsync(10 * INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(1); // pausado

    pestana.poner(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(2); // refresco inmediato

    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(3); // y retoma el ritmo
    controlador.detener();
  });

  it("si la petición termina con la pestaña oculta, no programa la siguiente hasta volver", async () => {
    const d = diferida();
    const obtener = vi.fn().mockReturnValueOnce(d.promesa).mockResolvedValue(dato(2));
    const { controlador, pestana } = preparar(obtener);

    controlador.iniciar();
    pestana.poner(false);
    d.resolver(dato(1));
    await vi.advanceTimersByTimeAsync(10 * INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(1);

    pestana.poner(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(2);
    controlador.detener();
  });

  it("si arranca con la pestaña oculta, espera a que se vea", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const pestana = pestanaFalsa();
    pestana.poner(false);
    const { controlador } = preparar(obtener, pestana);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(3 * INTERVALO);
    expect(obtener).not.toHaveBeenCalled();

    pestana.poner(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(1);
    controlador.detener();
  });
});

describe("crearControlador: vista activa o no (pestañas de la app)", () => {
  it("si la vista no está activa, no pide nada; al activarla pide de inmediato", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador } = preparar(obtener, undefined, false);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(5 * INTERVALO);
    expect(obtener).not.toHaveBeenCalled();

    controlador.establecerHabilitado(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(2);
    controlador.detener();
  });

  it("al desactivar la vista se pausa; al volver refresca de inmediato", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(1);

    controlador.establecerHabilitado(false);
    await vi.advanceTimersByTimeAsync(10 * INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(1); // sin consultas mientras no se ve

    controlador.establecerHabilitado(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(2); // refresco inmediato al volver

    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(3);
    controlador.detener();
  });

  it("dos controladores: solo consulta el de la vista activa", async () => {
    const a = vi.fn().mockResolvedValue(dato(1));
    const b = vi.fn().mockResolvedValue(dato(2));
    const vistaA = preparar(a, undefined, true).controlador;
    const vistaB = preparar(b, undefined, false).controlador;
    vistaA.iniciar();
    vistaB.iniciar();

    await vi.advanceTimersByTimeAsync(3 * INTERVALO);
    expect(a).toHaveBeenCalledTimes(4); // al iniciar + una cada 30 s
    expect(b).not.toHaveBeenCalled();

    // se cambia de vista
    vistaA.establecerHabilitado(false);
    vistaB.establecerHabilitado(true);
    await vi.advanceTimersByTimeAsync(2 * INTERVALO);
    expect(a).toHaveBeenCalledTimes(4);
    expect(b).toHaveBeenCalledTimes(3); // inmediato + 2 más
    vistaA.detener();
    vistaB.detener();
  });

  it("repetir el mismo valor no provoca otra petición", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    controlador.establecerHabilitado(true);
    controlador.establecerHabilitado(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(1);
    controlador.detener();
  });

  it("si la petición termina cuando la vista ya se desactivó, guarda el resultado pero no programa más", async () => {
    const d = diferida();
    const obtener = vi.fn().mockReturnValueOnce(d.promesa).mockResolvedValue(dato(2));
    const { controlador, ultimo } = preparar(obtener);

    controlador.iniciar();
    controlador.establecerHabilitado(false);
    d.resolver(dato(1));
    await vi.advanceTimersByTimeAsync(10 * INTERVALO);

    expect(ultimo().datos).toEqual(dato(1)); // el dato que llegó se conserva
    expect(obtener).toHaveBeenCalledTimes(1); // y no se pidió nada más

    controlador.establecerHabilitado(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(2);
    controlador.detener();
  });

  it("vista activa pero pestaña del navegador oculta: no pide; vista inactiva y pestaña visible: tampoco", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador, pestana } = preparar(obtener, undefined, true);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(obtener).toHaveBeenCalledTimes(1);

    pestana.poner(false);
    controlador.establecerHabilitado(false);
    pestana.poner(true); // el navegador vuelve, pero la vista sigue inactiva
    await vi.advanceTimersByTimeAsync(5 * INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(1);
    controlador.detener();
  });
});

describe("crearControlador: estado", () => {
  it("`cargando` es true solo la primera vez", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador, estados } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(3 * INTERVALO);

    expect(estados.length).toBeGreaterThanOrEqual(3);
    expect(estados.every((e) => e.cargando === false)).toBe(true); // el estado inicial lo pone el hook
    expect(estados[0]).toMatchObject({ datos: dato(1), error: null });
    expect(estados[0].actualizadoEn).not.toBeNull();
    controlador.detener();
  });

  it("si un refresco falla, CONSERVA los datos y marca el error; al recuperarse lo limpia", async () => {
    const obtener = vi
      .fn()
      .mockResolvedValueOnce(dato(1))
      .mockRejectedValueOnce(new ErrorApi("El servidor tuvo un error interno (500)."))
      .mockResolvedValue(dato(3));
    const { controlador, ultimo } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    const primero = ultimo();
    expect(primero).toMatchObject({ datos: dato(1), error: null });

    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(ultimo().datos).toEqual(dato(1)); // conserva
    expect(ultimo().actualizadoEn).toBe(primero.actualizadoEn); // la hora no avanza
    expect(ultimo().error?.message).toMatch(/error interno/);
    expect(ultimo().cargando).toBe(false);

    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(ultimo()).toMatchObject({ datos: dato(3), error: null });
    expect(ultimo().actualizadoEn).toBeGreaterThan(primero.actualizadoEn!);
    controlador.detener();
  });

  it("un error que no es ErrorApi se convierte en un mensaje claro en español", async () => {
    const { controlador, ultimo } = preparar(vi.fn().mockRejectedValue(new TypeError("boom")));
    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo().error).toBeInstanceOf(ErrorApi);
    expect(ultimo().error?.message).toMatch(/error inesperado/);
    controlador.detener();
  });

  it("primer fallo: sin datos, sin cargando; sigue reintentando cada 30 s", async () => {
    const obtener = vi
      .fn()
      .mockRejectedValueOnce(new ErrorApi("No se pudo conectar."))
      .mockRejectedValueOnce(new ErrorApi("No se pudo conectar."))
      .mockResolvedValue(dato(1));
    const { controlador, ultimo } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo()).toMatchObject({ datos: null, cargando: false });
    expect(ultimo().error).not.toBeNull();

    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(ultimo().datos).toBeNull();

    await vi.advanceTimersByTimeAsync(INTERVALO);
    expect(ultimo()).toMatchObject({ datos: dato(1), error: null });
    controlador.detener();
  });

  it("reintentar sin datos vuelve a mostrar la carga y pide de inmediato", async () => {
    const d = diferida();
    const obtener = vi.fn().mockRejectedValueOnce(new ErrorApi("Falló.")).mockReturnValueOnce(d.promesa);
    const { controlador, ultimo } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo()).toMatchObject({ datos: null, cargando: false });

    controlador.reintentar();
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(ultimo()).toMatchObject({ cargando: true, error: null });

    d.resolver(dato(7));
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo()).toMatchObject({ datos: dato(7), cargando: false, error: null });
    controlador.detener();
  });
});

describe("crearControlador: detener", () => {
  it("cancela el temporizador y la suscripción, y descarta respuestas tardías", async () => {
    const d = diferida();
    const obtener = vi.fn().mockReturnValueOnce(d.promesa).mockResolvedValue(dato(2));
    const { controlador, estados, pestana } = preparar(obtener);

    controlador.iniciar();
    expect(pestana.oyentes()).toBe(1);
    controlador.detener();
    expect(pestana.oyentes()).toBe(0);

    d.resolver(dato(1)); // llega tarde
    await vi.advanceTimersByTimeAsync(5 * INTERVALO);

    expect(estados).toHaveLength(0);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it("después de detener no vuelve a pedir", async () => {
    const obtener = vi.fn().mockResolvedValue(dato(1));
    const { controlador } = preparar(obtener);

    controlador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    controlador.detener();
    await vi.advanceTimersByTimeAsync(5 * INTERVALO);
    controlador.reintentar();
    controlador.establecerHabilitado(false);
    controlador.establecerHabilitado(true);

    expect(obtener).toHaveBeenCalledTimes(1);
  });
});
