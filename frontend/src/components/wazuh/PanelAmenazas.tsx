import { DESCRIPCION_MARCOS, DIAS_WAZUH, TOP_WAZUH } from "../../config/wazuh";
import { useWazuh, type ResultadoWazuh } from "../../hooks/useWazuh";
import type { MetricasWazuh } from "../../types/wazuh";
import { formatoHora } from "../../utils/fechas";
import { anchoRelativo, maximoDe } from "../../utils/graficas";
import { formatoEntero } from "../../utils/numeros";
import { describirRegla, filasTacticas, marcosOrdenados, nombreMarco, primeros, textoCargaWazuh } from "../../utils/wazuh";
import { BarrasHorizontales } from "../graficas/BarrasHorizontales";
import { TarjetaGrafica } from "../graficas/TarjetaGrafica";
import { BloqueCarga } from "../ui/BloqueCarga";
import { EstadoVacio } from "../ui/EstadoVacio";

const alertasTexto = (n: number) => `${formatoEntero(n)} ${n === 1 ? "alerta" : "alertas"}`;

/** Sección "Amenazas y cumplimiento": pide sus datos y se refresca solo mientras la Vista gerencial está a la vista. */
export function SeccionAmenazas() {
  const wazuh = useWazuh(true);
  return <PanelAmenazas resultado={wazuh} />;
}

/** Carga inicial del backend: texto con el porcentaje (solo si ya es real) y barra de progreso. */
export function CargaWazuh({ progreso }: { progreso: number | null }) {
  const real = progreso !== null && progreso >= 1;
  return (
    <div className="carga-wazuh" role="status">
      <p className="carga-wazuh__texto">{textoCargaWazuh(progreso)}</p>
      {real && <progress className="carga-wazuh__barra" value={Math.min(99, Math.floor(progreso))} max={100} aria-label="Progreso de la carga de datos de Wazuh" />}
      <p className="carga-wazuh__nota">La primera carga puede tardar unos minutos. Las cifras aparecerán al terminar.</p>
    </div>
  );
}

/** Presentación pura de la sección (se prueba sin navegador). */
export function PanelAmenazas({ resultado }: { resultado: ResultadoWazuh }) {
  const dias = resultado.datos?.dias ?? DIAS_WAZUH;

  return (
    <section className="seccion" aria-labelledby="titulo-amenazas">
      <h2 id="titulo-amenazas" className="seccion__titulo">
        Amenazas y cumplimiento (últimos {dias} días)
      </h2>
      <BloqueCarga resultado={resultado} esqueleto={<CargaWazuh progreso={null} />}>
        {(datos) => (datos.estado === "cargando" ? <CargaWazuh progreso={datos.progreso} /> : <Contenido datos={datos} />)}
      </BloqueCarga>
    </section>
  );
}

function Contenido({ datos }: { datos: MetricasWazuh }) {
  if (datos.alertasAnalizadas === 0) {
    return <EstadoVacio texto={`Aún no hay alertas de Wazuh con detalle en los últimos ${datos.dias} días`} />;
  }

  return (
    <div className="amenazas">
      <p className="amenazas__contexto">
        Basado en {alertasTexto(datos.alertasAnalizadas ?? 0)} de Wazuh de los últimos {datos.dias} días
        {datos.sinBloque ? ` · ${formatoEntero(datos.sinBloque)} sin detalle para analizar` : ""}.
      </p>
      {datos.thehive?.respondio === false && (
        <p className="lista-aviso" role="status">
          TheHive no respondió en la última actualización: se muestran los datos de las {formatoHora(datos.generadoEn)}.
        </p>
      )}
      <Tacticas datos={datos} />
      <Cumplimiento datos={datos} />
      <div className="rejilla-graficas">
        <TopIps datos={datos} />
        <TopUsuarios datos={datos} />
        <TopReglas datos={datos} />
      </div>
    </div>
  );
}

// ---------- 1. Tácticas MITRE en lenguaje de negocio ----------

function Tacticas({ datos }: { datos: MetricasWazuh }) {
  const filas = filasTacticas(datos.mitre?.tacticas ?? []);
  const maximo = maximoDe(filas.map((f) => f.cantidad));
  const resumen = `Tácticas de ataque detectadas: ${filas.map((f) => `${f.etiqueta} ${formatoEntero(f.cantidad)}`).join(", ")}.`;

  return (
    <TarjetaGrafica
      titulo="Qué intentan hacer los atacantes (tácticas MITRE ATT&CK)"
      resumen={resumen}
      vacio={filas.length === 0 ? "Ninguna alerta trae una táctica MITRE" : undefined}
      ancha
    >
      <p className="grafica__nota">Una alerta puede tocar varias tácticas, por eso las cifras no suman el total de alertas.</p>
      <ul className="tacticas">
        {filas.map((f) => (
          <li key={f.clave} className="tactica">
            <div className="barra-fila tactica__dato">
              <span className="barra-fila__etiqueta">{f.etiqueta}</span>
              <span className="barra-fila__valor">{formatoEntero(f.cantidad)}</span>
              <span className="barra-fila__pista" aria-hidden="true">
                <span className="barra-fila__barra" style={{ width: `${anchoRelativo(f.cantidad, maximo)}%` }} />
              </span>
            </div>
            {f.frase && <p className="tactica__frase">{f.frase}</p>}
          </li>
        ))}
      </ul>
    </TarjetaGrafica>
  );
}

// ---------- 2. Cumplimiento ----------

function Cumplimiento({ datos }: { datos: MetricasWazuh }) {
  const marcos = marcosOrdenados(datos.cumplimiento ?? []);
  const resumen = `Alertas que tocan controles de cada marco: ${marcos.map((m) => `${nombreMarco(m.marco)} ${formatoEntero(m.alertas)}`).join(", ")}.`;

  return (
    <TarjetaGrafica
      titulo="Cumplimiento normativo: alertas que tocan controles de cada marco"
      resumen={resumen}
      vacio={marcos.length === 0 ? "Ninguna alerta trae controles de cumplimiento" : undefined}
      ancha
    >
      <ul className="marcos">
        {marcos.map((m) => (
          <li key={m.marco} className="marco">
            <h4 className="marco__nombre">{nombreMarco(m.marco)}</h4>
            <p className="marco__descripcion">{(DESCRIPCION_MARCOS as Record<string, string | undefined>)[m.marco] ?? ""}</p>
            {m.alertas === 0 ? (
              <p className="estado-vacio">Ninguna alerta toca este marco</p>
            ) : (
              <>
                <p className="marco__valor">
                  <span className="marco__cifra">{formatoEntero(m.alertas)}</span> {m.alertas === 1 ? "alerta" : "alertas"}
                </p>
                <p className="marco__subtitulo">Requisitos más afectados</p>
                <ol className="marco__requisitos">
                  {m.requisitos.map((r) => (
                    <li key={r.requisito}>
                      <span className="marco__requisito">{r.requisito}</span>
                      <span className="marco__cantidad">{formatoEntero(r.cantidad)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </li>
        ))}
      </ul>
    </TarjetaGrafica>
  );
}

// ---------- 3. Top 5 IPs y usuarios ----------

function TopIps({ datos }: { datos: MetricasWazuh }) {
  const filas = primeros(datos.topIps ?? []).map((i) => ({ clave: i.ip, etiqueta: i.ip, cantidad: i.cantidad }));
  return (
    <TarjetaGrafica
      titulo={`Top ${TOP_WAZUH} IPs de origen`}
      resumen={`IPs de origen más frecuentes: ${filas.map((f) => `${f.etiqueta} ${formatoEntero(f.cantidad)}`).join(", ")}.`}
      vacio={filas.length === 0 ? "Ninguna alerta trae IP de origen" : undefined}
    >
      <BarrasHorizontales filas={filas} maximo={maximoDe(filas.map((f) => f.cantidad))} />
    </TarjetaGrafica>
  );
}

function TopUsuarios({ datos }: { datos: MetricasWazuh }) {
  const filas = primeros(datos.topUsuarios ?? []).map((u) => ({ clave: u.usuario, etiqueta: u.usuario, cantidad: u.cantidad }));
  return (
    <TarjetaGrafica
      titulo={`Top ${TOP_WAZUH} usuarios intentados`}
      resumen={`Usuarios más intentados: ${filas.map((f) => `${f.etiqueta} ${formatoEntero(f.cantidad)}`).join(", ")}.`}
      vacio={filas.length === 0 ? "Ninguna alerta trae usuario intentado" : undefined}
    >
      <BarrasHorizontales filas={filas} maximo={maximoDe(filas.map((f) => f.cantidad))} />
    </TarjetaGrafica>
  );
}

// ---------- 4. Top 5 reglas ----------

function TopReglas({ datos }: { datos: MetricasWazuh }) {
  const reglas = primeros(datos.topReglas ?? []);
  return (
    <TarjetaGrafica
      titulo={`Top ${TOP_WAZUH} reglas de Wazuh`}
      resumen={`Reglas más activas: ${reglas.map((r) => `${r.id} ${describirRegla(r.id, r.descripcion).texto} ${formatoEntero(r.cantidad)}`).join(", ")}.`}
      vacio={reglas.length === 0 ? "Ninguna alerta trae regla" : undefined}
    >
      <ol className="reglas">
        {reglas.map((r) => {
          const d = describirRegla(r.id, r.descripcion);
          return (
          <li key={r.id} className="regla">
            <p className="regla__cabecera">
              <span className="regla__id">Regla {r.id}</span>
              {r.nivel !== null && <span className="regla__nivel">Nivel {r.nivel}</span>}
              <span className="regla__cantidad">{alertasTexto(r.cantidad)}</span>
            </p>
            <p className="regla__descripcion" lang={d.original === null && r.descripcion ? "en" : undefined}>
              {d.texto}
            </p>
            {d.original !== null && (
              <p className="regla__original" lang="en">
                Original: {d.original}
              </p>
            )}
          </li>
          );
        })}
      </ol>
    </TarjetaGrafica>
  );
}
