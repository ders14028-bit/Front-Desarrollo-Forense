import type { DetalleAlerta } from "../../../types/listaAlertas";
import type { Tarea } from "../../../types/tarea";
import { separarTareas } from "../../../utils/caso";
import { etiquetaEstadoTarea, etiquetaEtapaCaso, etiquetaResolucion } from "../../../utils/etiquetas";
import { formatoFechaHora } from "../../../utils/fechas";

function ItemTarea({ tarea, conGrupo }: { tarea: Tarea; conGrupo: boolean }) {
  return (
    <li className="tareas__item">
      <span className={`tareas__estado tareas__estado--${tarea.status}`}>{etiquetaEstadoTarea(tarea.status)}</span>
      <span className="tareas__texto">
        {tarea.title}
        {conGrupo && <span className="datos__secundario"> · {tarea.group}</span>}
        {tarea.endDate !== undefined && (
          <span className="datos__secundario"> · {formatoFechaHora(tarea.endDate)}</span>
        )}
      </span>
    </li>
  );
}

/** Caso al que se convirtió la alerta: estado, resolución, asignado y tareas (contención primero). */
export function SeccionCaso({ detalle }: { detalle: DetalleAlerta }) {
  const { caso, fila } = detalle;

  if (caso === null) {
    return (
      <section className="detalle-seccion" aria-labelledby="detalle-caso">
        <h3 id="detalle-caso" className="detalle-seccion__titulo">
          Caso
        </h3>
        <p className="detalle-vacio">
          {fila.caso !== null ? "El caso de esta alerta no está disponible." : "Esta alerta no se ha convertido en caso."}
        </p>
      </section>
    );
  }

  const cerrado = caso.stage === "Closed";
  const { contencion, otras } = separarTareas(caso.tareas);

  return (
    <section className="detalle-seccion" aria-labelledby="detalle-caso">
      <h3 id="detalle-caso" className="detalle-seccion__titulo">
        Caso #{caso.number}
      </h3>
      <p className="detalle-caso__titulo">{caso.title}</p>

      <dl className="datos">
        <div className="datos__fila">
          <dt>Estado</dt>
          <dd>{etiquetaEtapaCaso(caso.stage)}</dd>
        </div>
        <div className="datos__fila">
          <dt>Resolución</dt>
          <dd>{cerrado ? etiquetaResolucion(caso.status) : "Aún sin resolver"}</dd>
        </div>
        <div className="datos__fila">
          <dt>Asignado a</dt>
          <dd>{caso.assignee ?? "Sin asignar"}</dd>
        </div>
        <div className="datos__fila">
          <dt>Creado</dt>
          <dd>{formatoFechaHora(caso._createdAt)}</dd>
        </div>
        {cerrado && (
          <div className="datos__fila">
            <dt>Cerrado</dt>
            <dd>{caso.endDate !== undefined ? formatoFechaHora(caso.endDate) : "Sin fecha registrada"}</dd>
          </div>
        )}
      </dl>

      <h4 className="detalle-subtitulo">Tareas de contención</h4>
      {contencion.length === 0 ? (
        <p className="detalle-vacio">Sin tareas de contención.</p>
      ) : (
        <ul className="tareas">
          {contencion.map((t) => (
            <ItemTarea key={t._id} tarea={t} conGrupo={false} />
          ))}
        </ul>
      )}

      {otras.length > 0 && (
        <details className="plegable">
          <summary>Otras tareas ({otras.length})</summary>
          <ul className="tareas">
            {otras.map((t) => (
              <ItemTarea key={t._id} tarea={t} conGrupo />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
