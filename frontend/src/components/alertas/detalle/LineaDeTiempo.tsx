import { textoTranscurrido } from "../../../utils/etiquetas";
import { formatoFechaHora } from "../../../utils/fechas";
import type { EventoTiempo } from "../../../utils/lineaDeTiempo";

/** Línea de tiempo vertical. Los eventos sin fecha (tareas pendientes) se muestran como "pendiente", sin hora. */
export function LineaDeTiempo({ eventos }: { eventos: EventoTiempo[] }) {
  return (
    <section className="detalle-seccion" aria-labelledby="detalle-tiempo">
      <h3 id="detalle-tiempo" className="detalle-seccion__titulo">
        Línea de tiempo
      </h3>
      <ol className="linea-tiempo">
        {eventos.map((e) => (
          <li key={e.id} className={`linea-tiempo__evento linea-tiempo__evento--${e.fecha === null ? "sin-fecha" : "fechado"}`}>
            <span className="linea-tiempo__marca" aria-hidden="true" />
            <div>
              <p className="linea-tiempo__titulo">{e.titulo}</p>
              {e.detalle && <p className="linea-tiempo__detalle">{e.detalle}</p>}
              <p className="linea-tiempo__fecha">
                {e.fecha !== null ? (
                  <>
                    <time dateTime={new Date(e.fecha).toISOString()}>{formatoFechaHora(e.fecha)}</time>
                    {e.transcurridoMs !== null && textoTranscurrido(e.transcurridoMs) && (
                      <span> · {textoTranscurrido(e.transcurridoMs)} desde la alerta</span>
                    )}
                  </>
                ) : e.tipo === "tarea-pendiente" ? (
                  <em>pendiente</em>
                ) : (
                  <em>sin fecha registrada</em>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
