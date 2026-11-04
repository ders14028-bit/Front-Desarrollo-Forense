import { ErrorApi } from "../api/tipos";

export interface EstadoRefresco<T> {
  /** Últimos datos recibidos con éxito; se CONSERVAN si un refresco falla. */
  datos: T | null;
  /** true solo hasta la primera respuesta (con éxito o con error). */
  cargando: boolean;
  /** Error del último intento; null si el último intento salió bien. */
  error: ErrorApi | null;
  /** Instante (ms) del último refresco exitoso. */
  actualizadoEn: number | null;
}

export const estadoInicial = <T>(): EstadoRefresco<T> => ({ datos: null, cargando: true, error: null, actualizadoEn: null });

/** Abstracción de la visibilidad de la pestaña del navegador, para poder probar sin navegador. */
export interface Visibilidad {
  esVisible(): boolean;
  /** Devuelve la función que cancela la suscripción. */
  suscribir(alCambiar: () => void): () => void;
}

export const visibilidadDelNavegador: Visibilidad = {
  esVisible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
  suscribir: (alCambiar) => {
    if (typeof document === "undefined") return () => {};
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  },
};

export interface OpcionesControlador<T> {
  obtener: () => Promise<T>;
  alCambiar: (estado: EstadoRefresco<T>) => void;
  intervaloMs: number;
  /** ¿La vista que usa estos datos está activa? Por defecto sí. Ver `establecerHabilitado`. */
  habilitado?: boolean;
  ahora?: () => number;
  visibilidad?: Visibilidad;
}

export interface Controlador {
  iniciar(): void;
  detener(): void;
  /**
   * Activa o pausa el refresco según la vista esté a la vista (pestaña activa de la app). Al
   * activarla se refresca de inmediato; al pausarla no se programa ninguna petición más.
   */
  establecerHabilitado(habilitado: boolean): void;
  /** Pide ya, sin esperar el intervalo (si no hay otra petición en curso). */
  reintentar(): void;
}

/**
 * Lógica del refresco automático, sin React. Pide solo si el controlador está iniciado, la vista
 * está habilitada Y la pestaña del navegador es visible. El siguiente intento se programa cuando
 * TERMINA el anterior, así nunca hay dos peticiones a la vez. Al volver a poder pedir (pestaña del
 * navegador visible o vista activada) refresca de inmediato.
 */
export function crearControlador<T>(opciones: OpcionesControlador<T>): Controlador {
  const ahora = opciones.ahora ?? Date.now;
  const visibilidad = opciones.visibilidad ?? visibilidadDelNavegador;

  let estado = estadoInicial<T>();
  let activo = false;
  let habilitado = opciones.habilitado ?? true;
  let enCurso = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let cancelarSuscripcion: (() => void) | null = null;

  const puedePedir = () => activo && habilitado && visibilidad.esVisible();

  const emitir = (parcial: Partial<EstadoRefresco<T>>) => {
    estado = { ...estado, ...parcial };
    opciones.alCambiar(estado);
  };

  const limpiarTemporizador = () => {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  };

  const programar = () => {
    limpiarTemporizador();
    if (!puedePedir()) return;
    temporizador = setTimeout(() => {
      temporizador = null;
      void pedir();
    }, opciones.intervaloMs);
  };

  async function pedir(): Promise<void> {
    if (enCurso || !puedePedir()) return;
    enCurso = true;
    limpiarTemporizador();
    // Reintento manual sin datos previos: se vuelve a mostrar la carga.
    if (estado.datos === null && !estado.cargando) emitir({ cargando: true, error: null });

    try {
      const datos = await opciones.obtener();
      if (!activo) return;
      emitir({ datos, cargando: false, error: null, actualizadoEn: ahora() });
    } catch (e) {
      if (!activo) return;
      const error = e instanceof ErrorApi ? e : new ErrorApi("Ocurrió un error inesperado al obtener los datos.");
      emitir({ cargando: false, error }); // `datos` y `actualizadoEn` se conservan
    } finally {
      enCurso = false;
      programar(); // sigue intentando cada intervalo aunque falle (mientras pueda pedir)
    }
  }

  const alCambiarVisibilidad = () => {
    if (!activo) return;
    if (visibilidad.esVisible()) void pedir();
    else limpiarTemporizador();
  };

  return {
    iniciar() {
      if (activo) return;
      activo = true;
      cancelarSuscripcion = visibilidad.suscribir(alCambiarVisibilidad);
      void pedir();
    },
    detener() {
      activo = false;
      limpiarTemporizador();
      cancelarSuscripcion?.();
      cancelarSuscripcion = null;
    },
    establecerHabilitado(valor) {
      if (valor === habilitado) return;
      habilitado = valor;
      if (!activo) return;
      if (habilitado) void pedir();
      else limpiarTemporizador();
    },
    reintentar() {
      void pedir();
    },
  };
}
