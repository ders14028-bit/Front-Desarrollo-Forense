import { useEffect, useRef } from "react";
import type { ChipFiltro } from "../../../utils/filtros";

interface Props {
  chips: ChipFiltro[];
  onQuitar: (chip: ChipFiltro) => void;
  onLimpiar: () => void;
  /** Dónde poner el foco cuando se quita el último chip. */
  alQuedarVacio: () => void;
}

/** Filtros activos como chips con ✕, y "Limpiar filtros". Al quitar uno, el foco pasa al chip vecino. */
export function ChipsFiltros({ chips, onQuitar, onLimpiar, alQuedarVacio }: Props) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const focoPendiente = useRef<number | null>(null);

  // Tras quitar un chip, el botón que tenía el foco desaparece: se lleva el foco al vecino.
  useEffect(() => {
    const indice = focoPendiente.current;
    if (indice === null) return;
    focoPendiente.current = null;
    if (chips.length === 0) alQuedarVacio();
    else botones.current[Math.min(indice, chips.length - 1)]?.focus();
  }, [chips, alQuedarVacio]);

  if (chips.length === 0) return null;

  return (
    <div className="chips">
      <ul className="chips__lista" aria-label="Filtros activos">
        {chips.map((chip, i) => (
          <li key={chip.id} className="chip">
            <span className="chip__texto">{chip.etiqueta}</span>
            <button
              type="button"
              className="chip__quitar"
              ref={(el) => {
                botones.current[i] = el;
              }}
              aria-label={`Quitar filtro: ${chip.etiqueta}`}
              onClick={() => {
                focoPendiente.current = i;
                onQuitar(chip);
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="chips__limpiar"
        onClick={() => {
          focoPendiente.current = 0;
          onLimpiar();
        }}
      >
        Limpiar filtros
      </button>
    </div>
  );
}
