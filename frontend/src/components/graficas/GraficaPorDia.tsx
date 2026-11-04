import { useLayoutEffect, useRef, useState } from "react";
import type { ResumenAlertas } from "../../types/metricas";
import { anchoRelativo, maximoDe, RANGO_POR_DEFECTO, RANGOS_DIAS, serieVisible, type RangoDias } from "../../utils/graficas";
import { EstadoVacio } from "../ui/EstadoVacio";
import { TarjetaGrafica } from "./TarjetaGrafica";

interface Props {
  alertas: ResumenAlertas;
  /** Instante del resumen: define cuál es "Hoy". */
  ahora: number;
}

const alertasTexto = (n: number) => `${n} ${n === 1 ? "alerta" : "alertas"}`;

/** Barras verticales por día (hora de Bogotá). El número de cada día va encima de su barra. */
export function GraficaPorDia({ alertas, ahora }: Props) {
  const [rango, setRango] = useState<RangoDias>(RANGO_POR_DEFECTO);
  const desplazable = useRef<HTMLDivElement>(null);

  const dias = serieVisible(alertas.porDia, rango, ahora);
  const maximo = maximoDe(dias.map((d) => d.cantidad));
  const total = dias.reduce((suma, d) => suma + d.cantidad, 0);

  // Si no cabe (por ejemplo 30 días en un celular), el scroll es solo de este contenedor y
  // arranca en el extremo derecho, donde está "Hoy". Solo al montar y al cambiar el rango.
  useLayoutEffect(() => {
    const el = desplazable.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [rango]);

  const resumen = `Alertas por día en los últimos ${rango} días, hora de Bogotá. Total: ${alertasTexto(total)}. Hoy: ${alertasTexto(dias[dias.length - 1]?.cantidad ?? 0)}.`;

  const selector = (
    <div className="selector" role="group" aria-label="Rango de días">
      {RANGOS_DIAS.map((r) => (
        <button
          key={r}
          type="button"
          className="selector__opcion"
          aria-pressed={r === rango}
          onClick={() => setRango(r)}
        >
          {r} días
        </button>
      ))}
    </div>
  );

  return (
    <TarjetaGrafica titulo="Alertas por día (hora de Bogotá)" resumen={resumen} ancha acciones={selector}>
      {/* tabIndex: un contenedor con scroll debe poder enfocarse para desplazarlo con el teclado */}
      <div className="dias" ref={desplazable} tabIndex={0} role="group" aria-label={`Alertas por día, últimos ${rango} días`}>
        <ul className="dias__lista" style={{ ["--columnas" as string]: dias.length }}>
          {dias.map((d) => (
            <li
              key={d.dia}
              className={`dia${d.esHoy ? " dia--hoy" : ""}`}
              aria-label={`${d.fecha}${d.esHoy ? " (hoy)" : ""}: ${alertasTexto(d.cantidad)}`}
            >
              <span className="dia__valor" aria-hidden="true">
                {d.cantidad}
              </span>
              <span className="dia__pista" aria-hidden="true">
                <span className="dia__barra" style={{ height: `${anchoRelativo(d.cantidad, maximo)}%` }} />
              </span>
              <span className="dia__etiqueta" aria-hidden="true">
                {d.etiqueta}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {total === 0 && <EstadoVacio texto="Sin alertas en este período" />}
    </TarjetaGrafica>
  );
}
