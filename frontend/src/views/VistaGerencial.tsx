import { GraficaEsqueleto } from "../components/graficas/TarjetaGrafica";
import { BloqueCarga } from "../components/ui/BloqueCarga";
import { TarjetaEsqueleto, TarjetaMetrica } from "../components/ui/TarjetaMetrica";
import type { ResultadoResumen } from "../hooks/useResumen";
import type { ResumenGerencial } from "../types/metricas";
import { formatoAntiguedad } from "../utils/fechas";
import { SeccionAmenazas } from "../components/wazuh/PanelAmenazas";
import { SeccionGraficas } from "./SeccionGraficas";

import { formatoDecimal, formatoEntero, textoPorcentaje } from "../utils/numeros";

const plural = (n: number, singular: string, plural: string) => `${formatoEntero(n)} ${n === 1 ? singular : plural}`;

/** "99,5 % del total" (el total son las alertas recibidas); undefined si no hay alertas. */
const delTotal = (parte: number, total: number): string | undefined => {
  const texto = textoPorcentaje(parte, total);
  return texto === null ? undefined : `${texto} del total`;
};

export function SeccionAlertas({ resumen }: { resumen: ResumenGerencial }) {
  const a = resumen.alertas;
  const criticas = a.porSeveridad.find((s) => s.severidad === 4)?.cantidad ?? 0;

  return (
    <section className="seccion" aria-labelledby="titulo-alertas">
      <h2 id="titulo-alertas" className="seccion__titulo">
        Alertas
      </h2>
      <div className="rejilla">
        <TarjetaMetrica
          titulo="Alertas recibidas"
          valor={a.recibidas}
          detalle={a.recibidas === 0 ? "Aún no hay alertas" : undefined}
        />
        <TarjetaMetrica
          titulo="Sin atender"
          valor={a.sinAtender}
          detalle={a.sinAtender === 0 ? "No hay alertas sin atender" : delTotal(a.sinAtender, a.recibidas)}
        />
        <TarjetaMetrica
          titulo="Críticas y altas"
          valor={a.criticasYAltas}
          detalle={a.criticasYAltas === 0 ? "No hay alertas críticas ni altas" : plural(criticas, "crítica", "críticas")}
        />
        <TarjetaMetrica
          titulo="Fuera de SLA"
          valor={a.fueraDeSla}
          detalle={a.fueraDeSla === 0 ? "Ninguna fuera de plazo" : delTotal(a.fueraDeSla, a.recibidas)}
        />
        <TarjetaMetrica
          titulo="Sin atender más antigua"
          valor={a.masAntiguaSinAtenderMs === null ? null : formatoAntiguedad(a.masAntiguaSinAtenderMs)}
          detalle={
            a.antiguedadPromedioSinAtenderMs === null
              ? undefined
              : `Promedio: ${formatoAntiguedad(a.antiguedadPromedioSinAtenderMs)}`
          }
          vacio="No hay alertas sin atender"
        />
      </div>
    </section>
  );
}

export function SeccionCasos({ resumen }: { resumen: ResumenGerencial }) {
  const c = resumen.casos;
  const conv = c.alertasConvertidas;

  return (
    <section className="seccion" aria-labelledby="titulo-casos">
      <h2 id="titulo-casos" className="seccion__titulo">
        Respuesta a incidentes
      </h2>
      <div className="rejilla">
        <TarjetaMetrica
          titulo="Incidentes reportados"
          valor={c.reportados}
          detalle={
            c.reportados === 0
              ? "Aún no hay incidentes"
              : `${plural(c.abiertos, "abierto", "abiertos")} · ${formatoEntero(c.enProgreso)} en progreso · ${plural(c.cerrados, "cerrado", "cerrados")}`
          }
        />
        <TarjetaMetrica
          titulo="Alertas convertidas en caso"
          valor={conv.porcentaje === null ? null : `${formatoEntero(conv.convertidas)} de ${formatoEntero(conv.total)}`}
          sufijo={conv.porcentaje === null ? undefined : `(${formatoDecimal(conv.porcentaje)} %)`}
          vacio="Aún no hay alertas"
        />
        <TarjetaMetrica
          titulo="Contenciones hechas"
          valor={c.contencionesHechas}
          detalle={c.contencionesHechas === 0 ? "Aún no hay contenciones completadas" : undefined}
        />
        <TarjetaMetrica
          titulo="Incidentes confirmados y cerrados"
          valor={c.confirmadosYCerrados}
          detalle={c.confirmadosYCerrados === 0 ? "Aún no hay incidentes confirmados" : undefined}
        />
        <TarjetaMetrica
          titulo="Tiempo promedio de cierre"
          valor={c.tiempoPromedioCierreMs === null ? null : formatoAntiguedad(c.tiempoPromedioCierreMs)}
          vacio="Aún no hay casos cerrados"
        />
      </div>
    </section>
  );
}

function Esqueleto() {
  return (
    <div aria-busy="true">
      <p className="solo-lectores" role="status">
        Cargando datos…
      </p>
      {[0, 1].map((i) => (
        <section className="seccion" key={i}>
          <div className="esqueleto esqueleto--seccion" aria-hidden="true" />
          <div className="rejilla">
            {Array.from({ length: 5 }, (_, k) => (
              <TarjetaEsqueleto key={k} />
            ))}
          </div>
        </section>
      ))}
      <section className="seccion">
        <div className="esqueleto esqueleto--seccion" aria-hidden="true" />
        <div className="rejilla-graficas">
          {Array.from({ length: 3 }, (_, k) => (
            <GraficaEsqueleto key={k} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function VistaGerencial({ resumen }: { resumen: ResultadoResumen }) {
  return (
    <BloqueCarga resultado={resumen} esqueleto={<Esqueleto />}>
      {(datos) => (
        <>
          <SeccionAlertas resumen={datos} />
          <SeccionCasos resumen={datos} />
          <SeccionGraficas resumen={datos} />
          <SeccionAmenazas />
        </>
      )}
    </BloqueCarga>
  );
}
