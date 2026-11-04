import type { AlertaFila } from "../../../types/listaAlertas";
import {
  etiquetaCaso,
  etiquetaSla,
  etiquetaTipo,
  textoExcesoSlaLargo,
  textoLimiteSla,
} from "../../../utils/etiquetas";
import { formatoAntiguedad } from "../../../utils/fechas";

/** Resumen: tipo de amenaza, antigüedad, SLA (con límite y exceso) y caso. */
export function ResumenAlerta({ fila }: { fila: AlertaFila }) {
  const { sla } = fila;
  const limite = textoLimiteSla(sla);
  const exceso = textoExcesoSlaLargo(sla);

  return (
    <section className="detalle-seccion" aria-labelledby="detalle-resumen">
      <h3 id="detalle-resumen" className="detalle-seccion__titulo">
        Resumen
      </h3>
      <dl className="datos">
        <div className="datos__fila">
          <dt>Tipo de amenaza</dt>
          <dd className={fila.tipo === null ? "sin-clasificar" : undefined}>{etiquetaTipo(fila.tipo)}</dd>
        </div>
        <div className="datos__fila">
          <dt>Antigüedad</dt>
          <dd>{formatoAntiguedad(fila.antiguedadMs)}</dd>
        </div>
        <div className="datos__fila">
          <dt>SLA</dt>
          <dd>
            {sla.estado === null ? (
              "No aplica (la alerta no está sin atender)"
            ) : (
              <>
                <span className={`sla sla--${sla.estado}`}>{etiquetaSla(sla)}</span>
                {limite && <span className="datos__secundario"> · {limite}</span>}
                {exceso && <span className="datos__secundario"> · {exceso}</span>}
              </>
            )}
          </dd>
        </div>
        <div className="datos__fila">
          <dt>Caso</dt>
          <dd>{etiquetaCaso(fila.caso)}</dd>
        </div>
      </dl>
    </section>
  );
}
