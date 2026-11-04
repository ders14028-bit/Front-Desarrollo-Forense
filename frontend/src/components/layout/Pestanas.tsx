import { useRef, type KeyboardEvent } from "react";

export interface Pestana {
  id: string;
  etiqueta: string;
}

interface Props {
  pestanas: Pestana[];
  activa: string;
  onCambiar: (id: string) => void;
}

/** Pestañas accesibles (patrón WAI-ARIA): flechas, Inicio y Fin cambian de pestaña. */
export function Pestanas({ pestanas, activa, onCambiar }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const interior = useRef<HTMLDivElement>(null);

  function alPresionar(e: KeyboardEvent<HTMLButtonElement>, indice: number) {
    let destino: number | null = null;
    if (e.key === "ArrowRight") destino = (indice + 1) % pestanas.length;
    else if (e.key === "ArrowLeft") destino = (indice - 1 + pestanas.length) % pestanas.length;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = pestanas.length - 1;
    if (destino === null) return;

    e.preventDefault();
    const siguiente = pestanas[destino];
    onCambiar(siguiente.id);
    refs.current[siguiente.id]?.focus();
  }

  return (
    <div className="pestanas">
      <div
        ref={interior}
        className="pestanas__interior ancho"
        role="tablist"
        aria-label="Vistas del dashboard"
        onPointerDownCapture={() => interior.current?.setAttribute("data-puntero", "")}
        onKeyDownCapture={() => interior.current?.removeAttribute("data-puntero")}
      >
        {pestanas.map((p, i) => {
          const seleccionada = p.id === activa;
          return (
            <button
              key={p.id}
              ref={(el) => {
                refs.current[p.id] = el;
              }}
              type="button"
              role="tab"
              id={`pestana-${p.id}`}
              aria-selected={seleccionada}
              aria-controls={`panel-${p.id}`}
              tabIndex={seleccionada ? 0 : -1}
              className="pestana"
              onClick={() => onCambiar(p.id)}
              onKeyDown={(e) => alPresionar(e, i)}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>
    </div>
  );
}
