import { BarrasHorizontales } from "../components/graficas/BarrasHorizontales";
import { GraficaPorDia } from "../components/graficas/GraficaPorDia";
import { GraficaTipos } from "../components/graficas/GraficaTipos";
import { TarjetaGrafica } from "../components/graficas/TarjetaGrafica";
import type { ResumenGerencial } from "../types/metricas";
import { filasOrigen, filasSeveridad, maximoDe } from "../utils/graficas";

const COLOR_SEVERIDAD = {
  4: "var(--sev-critica)",
  3: "var(--sev-alta)",
  2: "var(--sev-media)",
  1: "var(--sev-baja)",
} as const;

const textoLista = (filas: { etiqueta: string; cantidad: number }[]) =>
  filas.map((f) => `${f.etiqueta} ${f.cantidad}`).join(", ");

export function SeccionGraficas({ resumen }: { resumen: ResumenGerencial }) {
  const a = resumen.alertas;
  const severidades = filasSeveridad(a.porSeveridad).map((f) => ({ ...f, color: COLOR_SEVERIDAD[f.severidad] }));
  const origenes = filasOrigen(a.porOrigen);
  const sinAlertas = a.recibidas === 0 ? "Aún no hay alertas" : undefined;

  return (
    <section className="seccion" aria-labelledby="titulo-graficas">
      <h2 id="titulo-graficas" className="seccion__titulo">
        Tendencias y distribución
      </h2>
      <div className="rejilla-graficas">
        <TarjetaGrafica
          titulo="Alertas por severidad"
          resumen={`Alertas por severidad: ${textoLista(severidades)}.`}
          vacio={sinAlertas}
        >
          <BarrasHorizontales filas={severidades} maximo={maximoDe(severidades.map((f) => f.cantidad))} />
        </TarjetaGrafica>

        <GraficaTipos alertas={a} />

        <TarjetaGrafica
          titulo="Por herramienta de origen"
          resumen={`Alertas por herramienta de origen: ${textoLista(origenes)}.`}
          vacio={sinAlertas}
        >
          <BarrasHorizontales filas={origenes} maximo={maximoDe(origenes.map((f) => f.cantidad))} />
        </TarjetaGrafica>

        <GraficaPorDia alertas={a} ahora={resumen.generadoEn} />
      </div>
    </section>
  );
}
