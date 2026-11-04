import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

export interface OpcionSeleccion<V> {
  valor: V;
  etiqueta: string;
  cantidad: number;
}

interface Props<V> {
  /** Nombre del filtro: "Severidad", "Herramienta"… */
  titulo: string;
  opciones: OpcionSeleccion<V>[];
  seleccion: V[];
  onCambiar: (seleccion: V[]) => void;
}

/**
 * Botón que abre una lista de casillas con el conteo de cada opción ("Wazuh (16)").
 * Se cierra con Esc (el foco vuelve al botón), con un clic fuera o al salir del foco con Tab.
 */
export function SelectorMultiple<V>({ titulo, opciones, seleccion, onCambiar }: Props<V>) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idLista = useId();

  // Clic (o toque) fuera del selector: se cierra.
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", alPresionar);
    return () => document.removeEventListener("pointerdown", alPresionar);
  }, [abierto]);

  function alTeclear(e: KeyboardEvent) {
    if (e.key === "Escape" && abierto) {
      e.stopPropagation();
      setAbierto(false);
      boton.current?.focus();
    }
  }

  function alPerderElFoco(e: FocusEvent) {
    if (!raiz.current?.contains(e.relatedTarget as Node | null)) setAbierto(false);
  }

  const alternar = (valor: V) =>
    onCambiar(seleccion.includes(valor) ? seleccion.filter((v) => v !== valor) : [...seleccion, valor]);

  return (
    <div ref={raiz} className="selector-multiple" onKeyDown={alTeclear} onBlur={alPerderElFoco}>
      <button
        ref={boton}
        type="button"
        className={`boton boton--secundario selector-multiple__boton${seleccion.length > 0 ? " selector-multiple__boton--activo" : ""}`}
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        onClick={() => setAbierto((a) => !a)}
      >
        {titulo}
        {seleccion.length > 0 && ` (${seleccion.length})`}
        <span aria-hidden="true"> {abierto ? "▴" : "▾"}</span>
      </button>

      {abierto && (
        // tabIndex=-1: un clic en el texto o el relleno no debe sacar el foco del selector (y cerrarlo).
        <div id={idLista} className="selector-multiple__lista" role="group" aria-label={titulo} tabIndex={-1}>
          {opciones.length === 0 && <p className="selector-multiple__vacio">No hay opciones</p>}
          {opciones.map((o, i) => (
            <label key={i} className="selector-multiple__opcion">
              <input type="checkbox" checked={seleccion.includes(o.valor)} onChange={() => alternar(o.valor)} />
              <span>
                {o.etiqueta} ({o.cantidad})
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
