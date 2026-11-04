import { useId, useState } from "react";
import type { ResumenAlertas } from "../../types/metricas";
import { armarTipos } from "../../utils/graficas";
import { FilaBarra } from "./BarrasHorizontales";
import { TarjetaGrafica } from "./TarjetaGrafica";

/** Top 3 tipos de amenaza, "Otros (N tipos)" desplegable y "Sin clasificar" aparte al final. */
export function GraficaTipos({ alertas }: { alertas: ResumenAlertas }) {
  const [abierto, setAbierto] = useState(false);
  const idHijos = useId();
  const { principales, otros, sinClasificar, maximo } = armarTipos(alertas.porTipoAmenaza, alertas.sinClasificar);

  const partes = principales.map((f) => `${f.etiqueta} ${f.cantidad}`);
  if (otros) partes.push(`${otros.etiqueta} ${otros.cantidad}`);
  partes.push(`Sin clasificar ${sinClasificar}`);
  const resumen = `Alertas por tipo de amenaza: ${partes.join(", ")}.`;

  return (
    <TarjetaGrafica
      titulo="Por tipo de amenaza"
      resumen={resumen}
      vacio={alertas.recibidas === 0 ? "Aún no hay alertas" : undefined}
    >
      <ul className="barras">
        {principales.map((f) => (
          <FilaBarra key={f.clave} etiqueta={f.etiqueta} valor={f.cantidad} maximo={maximo} />
        ))}

        {otros && (
          <FilaBarra
            etiqueta={
              <button
                type="button"
                className="barra-fila__boton"
                aria-expanded={abierto}
                aria-controls={idHijos}
                onClick={() => setAbierto((a) => !a)}
              >
                <span aria-hidden="true">{abierto ? "▾" : "▸"}</span> {otros.etiqueta}
              </button>
            }
            valor={otros.cantidad}
            maximo={maximo}
          >
            {abierto && (
              <ul id={idHijos} className="barras barras--hijos">
                {otros.tipos.map((f) => (
                  <FilaBarra key={f.clave} etiqueta={f.etiqueta} valor={f.cantidad} maximo={maximo} />
                ))}
              </ul>
            )}
          </FilaBarra>
        )}
      </ul>

      <ul className="barras barras--aparte">
        <FilaBarra
          etiqueta="Sin clasificar"
          valor={sinClasificar}
          maximo={maximo}
          color="var(--gris-claro)"
        />
      </ul>
    </TarjetaGrafica>
  );
}
