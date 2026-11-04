import type { AlertaFila } from "../../types/listaAlertas";
import { etiquetaAntiguedad, etiquetaCaso, etiquetaEstadoAlerta } from "../../utils/etiquetas";
import { InsigniaSeveridad } from "./InsigniaSeveridad";
import { OrigenYTipo } from "./OrigenYTipo";
import { TextoSla } from "./TextoSla";

interface Props {
  filas: AlertaFila[];
  /** Se llamará al elegir una alerta (el panel de detalle llega en un paso posterior). */
  onAbrir?: (id: string) => void;
}

/** Lista de tarjetas para celular (< 720 px): los mismos datos que la tabla. */
export function TarjetasAlertas({ filas, onAbrir }: Props) {
  return (
    <ul className="tarjetas-alertas">
      {filas.map((f) => (
        <li key={f.id}>
          <button type="button" className={`tarjeta-alerta sev-${f.severidad}`} onClick={() => onAbrir?.(f.id)}>
            <span className="tarjeta-alerta__cabecera">
              <InsigniaSeveridad severidad={f.severidad} />
              <span className="tarjeta-alerta__estado">{etiquetaEstadoAlerta(f.estado)}</span>
            </span>
            <span className="tarjeta-alerta__titulo">{f.titulo}</span>
            <span className="tarjeta-alerta__sub">
              <OrigenYTipo origen={f.origen} tipo={f.tipo} />
            </span>
            <span className="tarjeta-alerta__dato">{etiquetaAntiguedad(f.antiguedadMs)}</span>
            <span className="tarjeta-alerta__dato">
              <TextoSla sla={f.sla} conPrefijo />
            </span>
            <span className="tarjeta-alerta__dato">{etiquetaCaso(f.caso)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
