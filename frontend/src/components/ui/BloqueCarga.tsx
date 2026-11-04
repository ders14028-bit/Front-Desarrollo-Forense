import type { ReactNode } from "react";
import type { ResultadoRefresco } from "../../hooks/useRefresco";
import { formatoHora } from "../../utils/fechas";
import { AvisoError } from "./AvisoError";

interface Props<T> {
  resultado: ResultadoRefresco<T>;
  /** Marcador que se muestra en la primera carga. */
  esqueleto: ReactNode;
  /** Contenido con los datos ya cargados. */
  children: (datos: T) => ReactNode;
}

/**
 * Estados comunes de las vistas con datos que se refrescan:
 * - primera carga → esqueleto;
 * - error sin datos previos → mensaje claro y "Reintentar";
 * - error con datos previos → los datos siguen visibles con un aviso encima.
 */
export function BloqueCarga<T>({ resultado, esqueleto, children }: Props<T>) {
  const { datos, cargando, error, actualizadoEn, reintentar } = resultado;

  if (datos === null) {
    if (error !== null && !cargando) {
      return <AvisoError titulo="No se pudieron cargar los datos" detalle={error.message} onReintentar={reintentar} />;
    }
    return <>{esqueleto}</>;
  }

  return (
    <>
      {error !== null && (
        <AvisoError
          rol="status"
          titulo={`No se pudo actualizar. Mostrando datos de las ${actualizadoEn === null ? "—" : formatoHora(actualizadoEn)}`}
          detalle={error.message}
        />
      )}
      {children(datos)}
    </>
  );
}
