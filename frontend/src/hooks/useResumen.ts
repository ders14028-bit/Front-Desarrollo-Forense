import { useCallback, useEffect, useRef, useState } from "react";
import { obtenerResumenGerencial } from "../api/cliente";
import { REFRESCO_MS } from "../config";
import { crearControlador, ESTADO_INICIAL, type Controlador, type EstadoResumen } from "./controladorResumen";

export interface ResultadoResumen extends EstadoResumen {
  reintentar: () => void;
}

/** Pide el resumen gerencial al montar y cada REFRESCO_MS. Ver `controladorResumen.ts`. */
export function useResumen(): ResultadoResumen {
  const [estado, setEstado] = useState<EstadoResumen>(ESTADO_INICIAL);
  const controlador = useRef<Controlador | null>(null);

  useEffect(() => {
    const c = crearControlador({
      obtener: obtenerResumenGerencial,
      alCambiar: setEstado,
      intervaloMs: REFRESCO_MS,
    });
    controlador.current = c;
    c.iniciar();
    return () => {
      c.detener();
      controlador.current = null;
    };
  }, []);

  const reintentar = useCallback(() => controlador.current?.reintentar(), []);

  return { ...estado, reintentar };
}
