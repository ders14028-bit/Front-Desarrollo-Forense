import { useId, type ReactNode } from "react";
import { EstadoVacio } from "../ui/EstadoVacio";

interface Props {
  titulo: string;
  /** Resumen en texto para lectores de pantalla (las barras van ocultas para ellos). */
  resumen: string;
  /** Si se pasa, reemplaza al contenido y explica por qué no hay gráfica. */
  vacio?: string;
  /** Ocupa todo el ancho de la rejilla. */
  ancha?: boolean;
  /** Controles junto al título (por ejemplo el selector de días). */
  acciones?: ReactNode;
  children?: ReactNode;
}

export function TarjetaGrafica({ titulo, resumen, vacio, ancha, acciones, children }: Props) {
  const idTitulo = useId();
  return (
    <section className={`grafica${ancha ? " grafica--ancha" : ""}`} aria-labelledby={idTitulo}>
      <div className="grafica__cabecera">
        <h3 id={idTitulo} className="grafica__titulo">
          {titulo}
        </h3>
        {acciones}
      </div>
      <p className="solo-lectores">{resumen}</p>
      {vacio ? <EstadoVacio texto={vacio} /> : children}
    </section>
  );
}

/** Marcador de la primera carga. */
export function GraficaEsqueleto() {
  return <div className="grafica grafica--esqueleto esqueleto" aria-hidden="true" />;
}
