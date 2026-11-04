import { ErrorApi } from "../api/tipos";
import type { ResumenGerencial } from "../types/metricas";

export interface EstadoResumen {
  /** Últimos datos recibidos con éxito; se CONSERVAN si un refresco falla. */
  datos: ResumenGerencial | null;
  /** true solo hasta la primera respuesta (con éxito o con error). */
  cargando: boolean;
  /** Error del último intento; null si el último intento salió bien. */
  error: ErrorApi | null;
  /** Instante (ms) del último refresco exitoso. */
  actualizadoEn: number | null;
}

export const ESTADO_INICIAL: EstadoResumen = { datos: null, cargando: true, error: null, actualizadoEn: null };

/** Abstracción de la visibilidad de la pestaña, para poder probar sin navegador. */
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

export interface OpcionesControlador {
  obtener: () => Promise<ResumenGerencial>;
  alCambiar: (estado: EstadoResumen) => void;
  intervaloMs: number;
  ahora?: () => number;
  visibilidad?: Visibilidad;
}

export interface Controlador {
  iniciar(): void;
  detener(): void;
  /** Pide ya, sin esperar el intervalo (si no hay otra petición en curso). */
  reintentar(): void;
}

/**
 * Lógica del refresco automático, sin React. El siguiente intento se programa cuando TERMINA
 * el anterior, así nunca hay dos peticiones a la vez. Con la pestaña oculta no se pide;
 * al volver a verse se refresca de inmediato.
 */
export function crearControlador(opciones: OpcionesControlador): Controlador {
  const ahora = opciones.ahora ?? Date.now;
  const visibilidad = opciones.visibilidad ?? visibilidadDelNavegador;

  let estado = ESTADO_INICIAL;
  let activo = false;
  let enCurso = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let cancelarSuscripcion: (() => void) | null = null;

  const emitir = (parcial: Partial<EstadoResumen>) => {
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
    if (!activo || !visibilidad.esVisible()) return;
    temporizador = setTimeout(() => {
      temporizador = null;
      void pedir();
    }, opciones.intervaloMs);
  };

  async function pedir(): Promise<void> {
    if (!activo || enCurso || !visibilidad.esVisible()) return;
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
      programar(); // sigue intentando cada intervalo aunque falle
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
    reintentar() {
      void pedir();
    },
  };
}
