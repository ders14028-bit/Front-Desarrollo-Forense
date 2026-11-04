import { useEffect, useRef } from "react";
import { crearRetraso, type Retraso } from "../utils/retraso";

/** `crearRetraso` para componentes: instancia estable que siempre llama a la versión más reciente de `alTerminar`. */
export function useRetraso<T>(ms: number, alTerminar: (valor: T) => void): Retraso<T> {
  const ultimo = useRef(alTerminar);
  ultimo.current = alTerminar;

  const retraso = useRef<Retraso<T> | null>(null);
  if (retraso.current === null) retraso.current = crearRetraso<T>(ms, (valor) => ultimo.current(valor));

  useEffect(() => () => retraso.current?.cancelar(), []);

  return retraso.current;
}
