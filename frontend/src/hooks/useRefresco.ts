import { useCallback, useEffect, useRef, useState } from "react";
import { REFRESCO_MS } from "../config";
import { crearControlador, estadoInicial, type Controlador, type EstadoRefresco } from "./controlador";

export interface ResultadoRefresco<T> extends EstadoRefresco<T> {
  reintentar: () => void;
}

/**
 * Pide `obtener()` al montar y cada REFRESCO_MS, SOLO mientras `activo` sea true: si la vista que
 * usa estos datos no está a la vista, no hay peticiones; al volver a estarlo se refresca de
 * inmediato. `obtener` debe ser una función estable (por ejemplo, una importada del cliente).
 * Ver `controlador.ts` para las reglas del refresco.
 */
export function useRefresco<T>(obtener: () => Promise<T>, activo: boolean): ResultadoRefresco<T> {
  const [estado, setEstado] = useState<EstadoRefresco<T>>(estadoInicial);
  const controlador = useRef<Controlador | null>(null);

  // El valor más reciente, para crear el controlador ya con el estado correcto (también en StrictMode).
  const activoActual = useRef(activo);
  activoActual.current = activo;

  useEffect(() => {
    const c = crearControlador<T>({
      obtener,
      alCambiar: setEstado,
      intervaloMs: REFRESCO_MS,
      habilitado: activoActual.current,
    });
    controlador.current = c;
    c.iniciar();
    return () => {
      c.detener();
      controlador.current = null;
    };
  }, [obtener]);

  useEffect(() => {
    controlador.current?.establecerHabilitado(activo);
  }, [activo]);

  const reintentar = useCallback(() => controlador.current?.reintentar(), []);

  return { ...estado, reintentar };
}
