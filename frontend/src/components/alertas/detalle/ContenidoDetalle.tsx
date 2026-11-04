import { useCallback } from "react";
import { obtenerDetalleAlerta } from "../../../api/cliente";
import { useRefresco } from "../../../hooks/useRefresco";
import type { DetalleAlerta } from "../../../types/listaAlertas";
import { construirLineaDeTiempo } from "../../../utils/lineaDeTiempo";
import { BloqueCarga } from "../../ui/BloqueCarga";
import { LineaDeTiempo } from "./LineaDeTiempo";
import { ResumenAlerta } from "./ResumenAlerta";
import { SeccionCaso } from "./SeccionCaso";
import { TodosLosCampos } from "./TodosLosCampos";

function EsqueletoDetalle() {
  return (
    <div aria-busy="true">
      <p className="solo-lectores" role="status">
        Cargando el detalle de la alerta…
      </p>
      <div className="lista-esqueleto" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto esqueleto--fila" />
        ))}
      </div>
    </div>
  );
}

export function DetalleCompleto({ detalle }: { detalle: DetalleAlerta }) {
  return (
    <>
      <ResumenAlerta fila={detalle.fila} />
      <LineaDeTiempo eventos={construirLineaDeTiempo(detalle)} />
      <SeccionCaso detalle={detalle} />
      <TodosLosCampos alerta={detalle.alerta} />
    </>
  );
}

/**
 * Carga el detalle de UNA alerta (por id) con sus propios estados de carga y de error, y lo refresca cada
 * 30 s mientras está abierto. Se monta con `key={id}`: al cambiar de alerta empieza de cero.
 */
export function ContenidoDetalle({ id }: { id: string }) {
  const obtener = useCallback(() => obtenerDetalleAlerta(id), [id]);
  const resultado = useRefresco(obtener, true);

  return (
    <BloqueCarga resultado={resultado} esqueleto={<EsqueletoDetalle />}>
      {(detalle) => <DetalleCompleto detalle={detalle} />}
    </BloqueCarga>
  );
}
