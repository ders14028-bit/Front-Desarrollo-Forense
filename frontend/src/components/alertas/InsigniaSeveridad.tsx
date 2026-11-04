import type { Severidad } from "../../types/alerta";
import { etiquetaSeveridad } from "../../utils/etiquetas";

/** Severidad con texto y una banda de color: se entiende también sin ver los colores. */
export function InsigniaSeveridad({ severidad }: { severidad: Severidad }) {
  return (
    <span className={`sev sev-${severidad}`}>
      <span className="sev__banda" aria-hidden="true" />
      {etiquetaSeveridad(severidad)}
    </span>
  );
}
