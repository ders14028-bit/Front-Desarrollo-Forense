import { useId } from "react";
import { VENTANA_ALERTAS_DIAS } from "../../../config";
import { ultimosDias } from "../../../utils/fechas";
import {
  ajustarRango,
  opcionFecha,
  resolverFecha,
  type FiltroFecha as FiltroFechaTipo,
  type PresetActivo,
} from "../../../utils/tabla";

interface Props {
  fecha: FiltroFechaTipo | null;
  /** Instante de la lista: define "hoy" y los límites de los calendarios. */
  ahora: number;
  onCambiar: (fecha: FiltroFechaTipo | null) => void;
}

const OPCIONES: { valor: PresetActivo; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: 7, etiqueta: "7 días" },
  { valor: 14, etiqueta: "14 días" },
  { valor: 30, etiqueta: "30 días" },
  { valor: "rango", etiqueta: "Rango" },
];

/**
 * Fecha: Hoy · 7 · 14 · 30 días · Rango. Los presets se guardan como preset (se recalculan con el "ahora" de
 * cada refresco); solo "Rango" guarda fechas fijas. "30 días" es toda la ventana (sin filtro de fecha).
 * "Rango" muestra dos calendarios; "desde" nunca puede quedar después de "hasta".
 */
export function FiltroFecha({ fecha, ahora, onCambiar }: Props) {
  const nombre = useId();
  const idDesde = useId();
  const idHasta = useId();

  const seleccionado = opcionFecha(fecha);
  const primerDia = ultimosDias(VENTANA_ALERTAS_DIAS, ahora)[0];
  const hoy = ultimosDias(1, ahora)[0];
  const { desde, hasta } = resolverFecha(fecha, ahora);

  function elegir(opcion: PresetActivo) {
    if (opcion === "rango") {
      // Se empieza a editar fechas: parte de las que se estaban viendo, o de toda la ventana si no había ninguna.
      onCambiar({ tipo: "rango", desde: desde ?? primerDia, hasta: hasta ?? hoy });
    } else if (opcion === 30) {
      onCambiar(null);
    } else {
      onCambiar({ tipo: "preset", preset: opcion });
    }
  }

  function editar(extremo: "desde" | "hasta", valor: string) {
    const r = ajustarRango(desde, hasta, extremo, valor === "" ? null : valor);
    // Sin ninguna fecha ya no hay rango que editar: vuelve a "30 días".
    onCambiar(r.desde === null && r.hasta === null ? null : { tipo: "rango", desde: r.desde, hasta: r.hasta });
  }

  return (
    <fieldset className="grupo-opciones grupo-opciones--fecha">
      <legend className="grupo-opciones__titulo">Fecha</legend>
      <div className="segmentos">
        {OPCIONES.map((o) => (
          <label key={String(o.valor)} className="segmento">
            <input
              type="radio"
              name={nombre}
              className="segmento__entrada"
              checked={seleccionado === o.valor}
              onChange={() => elegir(o.valor)}
            />
            <span className="segmento__texto">{o.etiqueta}</span>
          </label>
        ))}
      </div>

      {seleccionado === "rango" && (
        <div className="rango-fechas">
          <label className="rango-fechas__campo" htmlFor={idDesde}>
            Desde
            <input
              id={idDesde}
              className="campo"
              type="date"
              value={desde ?? ""}
              min={primerDia}
              max={hasta ?? hoy}
              onChange={(e) => editar("desde", e.target.value)}
            />
          </label>
          <label className="rango-fechas__campo" htmlFor={idHasta}>
            Hasta
            <input
              id={idHasta}
              className="campo"
              type="date"
              value={hasta ?? ""}
              min={desde ?? primerDia}
              max={hoy}
              onChange={(e) => editar("hasta", e.target.value)}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
