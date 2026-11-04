import { useEffect, useId, useState } from "react";
import { VENTANA_ALERTAS_DIAS } from "../../../config";
import { ultimosDias } from "../../../utils/fechas";
import { ajustarRango, presetActivo, rangoPreset, type PresetActivo } from "../../../utils/tabla";

interface Props {
  desde: string | null;
  hasta: string | null;
  /** Instante de la lista: define "hoy" y los límites de los calendarios. */
  ahora: number;
  onCambiar: (desde: string | null, hasta: string | null) => void;
}

const OPCIONES: { valor: PresetActivo; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: 7, etiqueta: "7 días" },
  { valor: 14, etiqueta: "14 días" },
  { valor: 30, etiqueta: "30 días" },
  { valor: "rango", etiqueta: "Rango" },
];

/**
 * Fecha: Hoy · 7 · 14 · 30 días · Rango. "30 días" es toda la ventana (sin filtro de fecha).
 * "Rango" muestra dos calendarios; "desde" nunca puede quedar después de "hasta".
 */
export function FiltroFecha({ desde, hasta, ahora, onCambiar }: Props) {
  const nombre = useId();
  const idDesde = useId();
  const idHasta = useId();

  // "Rango" se puede elegir aunque las fechas actuales coincidan con un preset (por ejemplo "Hoy").
  const [modoRango, setModoRango] = useState(false);
  const seleccionado: PresetActivo = modoRango ? "rango" : presetActivo({ desde, hasta }, ahora);
  const primerDia = ultimosDias(VENTANA_ALERTAS_DIAS, ahora)[0];
  const hoy = ultimosDias(1, ahora)[0];

  // Sin ninguna fecha (se quitó el chip, "Limpiar filtros" o se borraron los dos calendarios) no hay rango que editar.
  useEffect(() => {
    if (desde === null && hasta === null) setModoRango(false);
  }, [desde, hasta]);

  function elegir(opcion: PresetActivo) {
    setModoRango(opcion === "rango");
    if (opcion === "rango") {
      // Parte de las fechas actuales, o de toda la ventana si no había ninguna.
      onCambiar(desde ?? primerDia, hasta ?? hoy);
    } else if (opcion === 30) {
      onCambiar(null, null);
    } else {
      const r = rangoPreset(opcion, ahora);
      onCambiar(r.desde, r.hasta);
    }
  }

  function editar(extremo: "desde" | "hasta", valor: string) {
    const r = ajustarRango(desde, hasta, extremo, valor === "" ? null : valor);
    onCambiar(r.desde, r.hasta);
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
