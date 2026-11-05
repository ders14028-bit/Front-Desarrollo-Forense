import type { ReactNode } from "react";
import { formatoEntero } from "../../utils/numeros";
import { EstadoVacio } from "./EstadoVacio";

interface Props {
  titulo: string;
  /** null = no hay dato: se muestra "—" y la frase `vacio`. */
  valor: string | number | null;
  /** Complemento pequeño en la misma línea del valor, por ejemplo "(2,5 %)". */
  sufijo?: string;
  /** Línea secundaria bajo el valor (se ignora si `valor` es null). */
  detalle?: ReactNode;
  /** Frase corta que explica por qué no hay dato (cuando `valor` es null). */
  vacio?: string;
  /** Nota al pie opcional. */
  nota?: ReactNode;
}

/** Tres filas (título · valor · pie) que la rejilla alinea entre tarjetas vecinas. */
export function TarjetaMetrica({ titulo, valor: valorCrudo, sufijo, detalle, vacio, nota }: Props) {
  // Las cifras llevan separador de miles es-CO (23.261); los textos ya formateados se muestran tal cual.
  const valor = typeof valorCrudo === "number" ? formatoEntero(valorCrudo) : valorCrudo;
  return (
    <article className="tarjeta">
      <h3 className="tarjeta__titulo">{titulo}</h3>
      <p className="tarjeta__valor">
        {/* Con complemento, la cifra no se parte ("6 de 40"); es el complemento el que baja de línea. */}
        {valor !== null && sufijo ? <span className="tarjeta__cifra">{valor}</span> : valor === null ? "—" : valor}
        {valor !== null && sufijo && <span className="tarjeta__sufijo"> {sufijo}</span>}
      </p>
      <div className="tarjeta__pie">
        {valor === null ? vacio && <EstadoVacio texto={vacio} /> : detalle && <p className="tarjeta__detalle">{detalle}</p>}
        {nota}
      </div>
    </article>
  );
}

/** Marcador de posición de la primera carga. Sin animación de parpadeo en los refrescos. */
export function TarjetaEsqueleto() {
  return (
    <div className="tarjeta tarjeta--esqueleto" aria-hidden="true">
      <span className="esqueleto esqueleto--titulo" />
      <span className="esqueleto esqueleto--valor" />
      <span className="esqueleto esqueleto--detalle" />
    </div>
  );
}
