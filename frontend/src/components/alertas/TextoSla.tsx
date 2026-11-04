import type { SlaAlerta } from "../../types/listaAlertas";
import { etiquetaSla, textoExcesoSla } from "../../utils/etiquetas";

interface Props {
  sla: SlaAlerta;
  /** Si el SLA no aplica, antepone "SLA:" para que "—" no quede sin contexto (tarjetas). */
  conPrefijo?: boolean;
}

/** "Fuera de SLA +2 d 4 h", "Dentro de SLA" o "—" (no aplica). El texto siempre dice el estado, no solo el color. */
export function TextoSla({ sla, conPrefijo = false }: Props) {
  if (sla.estado === null) {
    return (
      <span className="sla sla--nulo">
        {conPrefijo && "SLA: "}
        <span aria-hidden="true">{etiquetaSla(sla)}</span>
        <span className="solo-lectores">{conPrefijo ? "no aplica" : "SLA no aplica"}</span>
      </span>
    );
  }

  const exceso = textoExcesoSla(sla);
  return (
    <span className={`sla sla--${sla.estado}`}>
      {etiquetaSla(sla)}
      {exceso && <span className="sla__exceso">{exceso}</span>}
    </span>
  );
}
