import type { ReactNode } from "react";
import { EstadoVacio } from "./EstadoVacio";

interface Props {
  titulo: string;
  /** null = no hay dato: se muestra "—" y la frase `vacio`. */
  valor: string | number | null;
  /** Línea secundaria bajo el valor (se ignora si `valor` es null). */
  detalle?: ReactNode;
  /** Frase corta que explica por qué no hay dato (cuando `valor` es null). */
  vacio?: string;
  /** Nota al pie, por ejemplo <NotaLaboratorio />. */
  nota?: ReactNode;
}

/** Tres filas (título · valor · pie) que la rejilla alinea entre tarjetas vecinas. */
export function TarjetaMetrica({ titulo, valor, detalle, vacio, nota }: Props) {
  return (
    <article className="tarjeta">
      <h3 className="tarjeta__titulo">{titulo}</h3>
      <p className="tarjeta__valor">{valor === null ? "—" : valor}</p>
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
