import type { AlertaFila } from "../../types/listaAlertas";
import { etiquetaCaso, etiquetaEstadoAlerta, etiquetaOrigen, etiquetaTipo } from "../../utils/etiquetas";
import { formatoAntiguedad } from "../../utils/fechas";
import { InsigniaSeveridad } from "./InsigniaSeveridad";
import { TextoSla } from "./TextoSla";

interface Props {
  filas: AlertaFila[];
  /** Texto oculto (<caption>) que describe la tabla a los lectores de pantalla. */
  descripcion: string;
  /** Se llamará al elegir una alerta (el panel de detalle llega en un paso posterior). */
  onAbrir?: (id: string) => void;
}

/** Tabla de escritorio (≥ 720 px). En celular se muestra `TarjetasAlertas` con los mismos datos. */
export function TablaAlertas({ filas, descripcion, onAbrir }: Props) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla-alertas">
        <caption className="solo-lectores">{descripcion}</caption>
        <thead>
          <tr>
            <th scope="col">Severidad</th>
            <th scope="col">Título</th>
            <th scope="col">Estado</th>
            <th scope="col">Antigüedad</th>
            <th scope="col">SLA</th>
            <th scope="col">Caso</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td>
                <InsigniaSeveridad severidad={f.severidad} />
              </td>
              <th scope="row" className="celda-titulo">
                <button type="button" className="fila-boton" onClick={() => onAbrir?.(f.id)}>
                  {f.titulo}
                </button>
                <span className="fila-sub">
                  {etiquetaOrigen(f.origen)} · {etiquetaTipo(f.tipo)}
                </span>
              </th>
              <td>{etiquetaEstadoAlerta(f.estado)}</td>
              <td>{formatoAntiguedad(f.antiguedadMs)}</td>
              <td>
                <TextoSla sla={f.sla} />
              </td>
              <td>{etiquetaCaso(f.caso)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
