import { useId } from "react";
import type { TresEstados } from "../../../utils/tabla";

interface Props {
  /** Pregunta del filtro: "¿Tiene caso?", "¿Fuera de SLA?". */
  titulo: string;
  valor: TresEstados;
  onCambiar: (valor: TresEstados) => void;
}

const OPCIONES: { valor: TresEstados; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "si", etiqueta: "Sí" },
  { valor: "no", etiqueta: "No" },
];

/** Todos / Sí / No como grupo de botones de opción (con flechas del teclado, de forma nativa). */
export function ControlTresEstados({ titulo, valor, onCambiar }: Props) {
  const nombre = useId();
  return (
    <fieldset className="grupo-opciones">
      <legend className="grupo-opciones__titulo">{titulo}</legend>
      <div className="segmentos">
        {OPCIONES.map((o) => (
          <label key={o.valor} className="segmento">
            <input
              type="radio"
              name={nombre}
              className="segmento__entrada"
              checked={valor === o.valor}
              onChange={() => onCambiar(o.valor)}
            />
            <span className="segmento__texto">{o.etiqueta}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
