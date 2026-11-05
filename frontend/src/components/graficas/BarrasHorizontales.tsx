import type { ReactNode } from "react";
import { anchoRelativo } from "../../utils/graficas";
import { formatoEntero } from "../../utils/numeros";

interface FilaProps {
  etiqueta: ReactNode;
  valor: number;
  /** Máximo de la gráfica: la barra más larga ocupa el 100 %. */
  maximo: number;
  /** Color de la barra (variable CSS); por defecto el de acento. */
  color?: string;
  /** Contenido bajo la barra, por ejemplo la lista de un grupo desplegado. */
  children?: ReactNode;
}

/**
 * Una fila: etiqueta y número (siempre texto visible) arriba, barra abajo. La barra es
 * decorativa (`aria-hidden`): el dato está en el número, así que se entiende sin colores.
 */
export function FilaBarra({ etiqueta, valor, maximo, color, children }: FilaProps) {
  return (
    <li className="barra-fila">
      <span className="barra-fila__etiqueta">{etiqueta}</span>
      <span className="barra-fila__valor">{formatoEntero(valor)}</span>
      <span className="barra-fila__pista" aria-hidden="true">
        <span
          className="barra-fila__barra"
          style={{ width: `${anchoRelativo(valor, maximo)}%`, ...(color ? { background: color } : {}) }}
        />
      </span>
      {children}
    </li>
  );
}

export interface FilaGrafica {
  clave: string;
  etiqueta: string;
  cantidad: number;
  color?: string;
}

interface Props {
  filas: FilaGrafica[];
  maximo: number;
}

export function BarrasHorizontales({ filas, maximo }: Props) {
  return (
    <ul className="barras">
      {filas.map((f) => (
        <FilaBarra key={f.clave} etiqueta={f.etiqueta} valor={f.cantidad} maximo={maximo} color={f.color} />
      ))}
    </ul>
  );
}
