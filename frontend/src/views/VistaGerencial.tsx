import { GraficaEsqueleto } from "../components/graficas/TarjetaGrafica";
import { AvisoError } from "../components/ui/AvisoError";
import { NotaLaboratorio } from "../components/ui/NotaLaboratorio";
import { TarjetaEsqueleto, TarjetaMetrica } from "../components/ui/TarjetaMetrica";
import type { ResultadoResumen } from "../hooks/useResumen";
import type { ResumenGerencial } from "../types/metricas";
import { formatoAntiguedad, formatoHora } from "../utils/fechas";
import { SeccionGraficas } from "./SeccionGraficas";

const porcentaje = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const plural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

function SeccionAlertas({ resumen }: { resumen: ResumenGerencial }) {
  const a = resumen.alertas;
  const nota = resumen.datosDeLaboratorio ? <NotaLaboratorio /> : undefined;

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
          detalle={a.sinAtender === 0 ? "No hay alertas sin atender" : undefined}
        />
        <TarjetaMetrica titulo="Críticas y altas" valor={a.criticasYAltas} />
        <TarjetaMetrica
          titulo="Fuera de SLA"
          valor={a.fueraDeSla}
          detalle={a.fueraDeSla === 0 ? "Ninguna fuera de plazo" : undefined}
          nota={nota}
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
          nota={nota}
        />
      </div>
    </section>
  );
}

function SeccionCasos({ resumen }: { resumen: ResumenGerencial }) {
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
              : `${plural(c.abiertos, "abierto", "abiertos")} · ${c.enProgreso} en progreso · ${plural(c.cerrados, "cerrado", "cerrados")}`
          }
        />
        <TarjetaMetrica
          titulo="Alertas convertidas en caso"
          valor={conv.porcentaje === null ? null : `${conv.convertidas} de ${conv.total}`}
          detalle={conv.porcentaje === null ? undefined : `${porcentaje.format(conv.porcentaje)} %`}
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
  const { datos, cargando, error, actualizadoEn, reintentar } = resumen;

  if (datos === null) {
    if (error !== null && !cargando) {
      return <AvisoError titulo="No se pudieron cargar los datos" detalle={error.message} onReintentar={reintentar} />;
    }
    return <Esqueleto />;
  }

  return (
    <>
      {error !== null && (
        <AvisoError
          rol="status"
          titulo={`No se pudo actualizar. Mostrando datos de las ${actualizadoEn === null ? "—" : formatoHora(actualizadoEn)}`}
          detalle={error.message}
        />
      )}
      <SeccionAlertas resumen={datos} />
      <SeccionCasos resumen={datos} />
      <SeccionGraficas resumen={datos} />
    </>
  );
}
