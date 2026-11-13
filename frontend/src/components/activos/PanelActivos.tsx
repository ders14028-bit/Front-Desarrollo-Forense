import { useId, useState } from "react";
import { COMPONENTE_OTROS } from "../../config/activos";
import { useActivos, type ResultadoActivos } from "../../hooks/useActivos";
import type { Activo, ActivosAtacados, AtaqueReciente } from "../../types/activos";
import {
  ATAQUES_MAXIMOS,
  ATAQUES_VISIBLES,
  SIN_FILTRO,
  alternarTipo,
  ataquesVisibles,
  claveActivo,
  claveAtaque,
  componentesAgregados,
  descripcionDeAtaque,
  elegirEquipo,
  filtrarActivos,
  filtrarAtaques,
  fraseResumen,
  haceDeAtaque,
  hayFiltro,
  nombreComponente,
  nombreTipo,
  opcionesEquipo,
  ordenarPorAlertas,
  resumenPorTipo,
  textoSeveridadAtaque,
  textoVeces,
  ultimoAtaqueDe,
  type FiltroActivos,
} from "../../utils/activos";
import { fechaHoraCorta, formatoHora, textoUltimosDias, tituloConVentana } from "../../utils/fechas";
import { anchoRelativo, maximoDe } from "../../utils/graficas";
import { formatoEntero } from "../../utils/numeros";
import { TarjetaGrafica } from "../graficas/TarjetaGrafica";
import { BloqueCarga } from "../ui/BloqueCarga";
import { EstadoVacio } from "../ui/EstadoVacio";
import { CargaWazuh } from "../wazuh/PanelAmenazas";

const plural = (n: number, singular: string, varios: string) => `${formatoEntero(n)} ${n === 1 ? singular : varios}`;

/** Sección "Activos atacados": pide sus datos y se refresca cada 30 s por su cuenta. */
export function SeccionActivos() {
  const activos = useActivos(true);
  return <PanelActivos resultado={activos} />;
}

/** Presentación de la sección (se prueba sin navegador). `filtroInicial` solo lo usan las pruebas. */
export function PanelActivos({ resultado, filtroInicial = SIN_FILTRO }: { resultado: ResultadoActivos; filtroInicial?: FiltroActivos }) {
  return (
    <section className="seccion" aria-labelledby="titulo-activos">
      <h2 id="titulo-activos" className="seccion__titulo">
        {tituloConVentana("Activos atacados", resultado.datos?.ventanaDias)}
      </h2>
      <BloqueCarga resultado={resultado} esqueleto={<CargaWazuh progreso={null} />}>
        {(datos) =>
          datos.estado === "cargando" || datos.activos === null ? (
            <CargaWazuh progreso={datos.progreso} />
          ) : (
            <Contenido datos={datos} activos={datos.activos} filtroInicial={filtroInicial} />
          )
        }
      </BloqueCarga>
    </section>
  );
}

function Contenido({ datos, activos, filtroInicial }: { datos: ActivosAtacados; activos: Activo[]; filtroInicial: FiltroActivos }) {
  const [filtro, setFiltro] = useState<FiltroActivos>(filtroInicial);
  const idSelector = useId();

  if (activos.length === 0) {
    return <EstadoVacio texto={`Aún no hay activos con alertas de Wazuh en los ${textoUltimosDias(datos.ventanaDias)}`} />;
  }

  const filtrados = ordenarPorAlertas(filtrarActivos(activos, filtro));
  const tipos = resumenPorTipo(activos);
  const limpiar = () => setFiltro(SIN_FILTRO);
  const elegirFila = (a: Activo) =>
    setFiltro(filtro.equipo === claveActivo(a) ? elegirEquipo(filtro, null, activos) : elegirEquipo(filtro, claveActivo(a), activos));

  return (
    <div className="activos">
      {datos.thehive?.respondio === false && (
        <p className="lista-aviso" role="status">
          TheHive no respondió en la última actualización: se muestran los datos de las {formatoHora(datos.generadoEn)}.
        </p>
      )}

      <div className="activos-filtro" role="group" aria-label="Filtrar activos atacados">
        <div className="activos-filtro__tipos">
          {tipos.map((t) => (
            <button
              key={t.tipo}
              type="button"
              className="activos-filtro__boton"
              aria-pressed={filtro.tipo === t.tipo}
              onClick={() => setFiltro(alternarTipo(filtro, t.tipo, activos))}
            >
              {t.nombre} · {formatoEntero(t.servidores)}
            </button>
          ))}
        </div>
        <div className="activos-filtro__equipo">
          <label htmlFor={idSelector} className="activos-filtro__etiqueta">
            Equipo
          </label>
          <select
            id={idSelector}
            className="campo"
            value={filtro.equipo ?? ""}
            onChange={(e) => setFiltro(elegirEquipo(filtro, e.target.value === "" ? null : e.target.value, activos))}
          >
            <option value="">Todos los equipos</option>
            {opcionesEquipo(activos, filtro.tipo).map((o) => (
              <option key={o.clave} value={o.clave}>
                {o.etiqueta}
              </option>
            ))}
          </select>
          <button type="button" className="boton boton--secundario" onClick={limpiar} disabled={!hayFiltro(filtro)}>
            Limpiar
          </button>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="activos-vacio" role="status">
          <EstadoVacio texto="Ningún activo coincide con el filtro." />
          <button type="button" className="boton" onClick={limpiar}>
            Limpiar filtro
          </button>
        </div>
      ) : (
        <>
          <p className="activos-frase" aria-live="polite">
            {fraseResumen(filtrados) ?? `Ninguno de estos activos tiene alertas en los ${textoUltimosDias(datos.ventanaDias)}.`}
          </p>
          <TarjetasTipo activos={activos} filtro={filtro} alElegir={(tipo) => setFiltro(alternarTipo(filtro, tipo, activos))} />
          <TablaActivos activos={filtrados} filtro={filtro} alElegir={elegirFila} ahora={datos.generadoEn} />
          {datos.ataquesRecientes !== null && datos.ataquesRecientes !== undefined && (
            <AtaquesRecientes
              ataques={filtrarAtaques(datos.ataquesRecientes, filtro)}
              ventanaDias={datos.ventanaDias}
              hayFiltro={hayFiltro(filtro) && datos.ataquesRecientes.length > 0}
              ahora={datos.generadoEn}
            />
          )}
          <Componentes activos={filtrados} />
          {datos.alertasSinActivo ? (
            <p className="grafica__nota">
              {plural(datos.alertasSinActivo, "alerta no trae", "alertas no traen")} el equipo de origen y no se cuentan en ningún activo.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------- Tarjetas por tipo de servidor ----------

function TarjetasTipo({ activos, filtro, alElegir }: { activos: Activo[]; filtro: FiltroActivos; alElegir: (tipo: string) => void }) {
  return (
    <ul className="activos-tipos" aria-label="Alertas por tipo de servidor">
      {resumenPorTipo(activos).map((t) => (
        <li key={t.tipo}>
          <button
            type="button"
            className="activos-tipo"
            aria-pressed={filtro.tipo === t.tipo}
            aria-label={`${t.nombre}: ${plural(t.alertas, "alerta", "alertas")}, ${formatoEntero(t.altasYCriticas)} altas y críticas, ${plural(t.servidores, "servidor", "servidores")}. Filtrar por este tipo`}
            onClick={() => alElegir(t.tipo)}
          >
            <span className="activos-tipo__nombre">{t.nombre}</span>
            <span className="activos-tipo__valor">{formatoEntero(t.alertas)}</span>
            <span className="activos-tipo__detalle">{formatoEntero(t.altasYCriticas)} altas y críticas</span>
            <span className="activos-tipo__detalle">{plural(t.servidores, "servidor", "servidores")}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- Tabla "Activos más atacados" (tarjetas en pantallas angostas) ----------

function TablaActivos({
  activos,
  filtro,
  alElegir,
  ahora,
}: {
  activos: Activo[];
  filtro: FiltroActivos;
  alElegir: (a: Activo) => void;
  /** Hora del resumen: el "hace N" se cuenta desde aquí, no desde el reloj del navegador. */
  ahora: number;
}) {
  const idTitulo = useId();
  const elegido = (a: Activo) => filtro.equipo === claveActivo(a);
  const principal = (a: Activo) => (a.componentePrincipal === null ? "—" : nombreComponente(a.componentePrincipal));

  return (
    <section className="activos-mas" aria-labelledby={idTitulo}>
      <h3 id={idTitulo} className="grafica__titulo">
        Activos más atacados
      </h3>
      <p className="grafica__nota">Elige un equipo para ver solo sus datos.</p>

      <div className="tabla-contenedor activos-tabla">
        <table className="tabla-alertas">
          <thead>
            <tr>
              <th scope="col">Equipo</th>
              <th scope="col">Tipo</th>
              <th scope="col">Sistema</th>
              <th scope="col" className="num">
                Alertas
              </th>
              <th scope="col" className="num">
                Altas y críticas
              </th>
              <th scope="col">Componente principal</th>
              <th scope="col">Último ataque</th>
            </tr>
          </thead>
          <tbody>
            {activos.map((a) => (
              <tr key={claveActivo(a)} className={elegido(a) ? "activos-fila activos-fila--elegida" : "activos-fila"} onClick={() => alElegir(a)}>
                <th scope="row">
                  <button
                    type="button"
                    className="activos-fila__boton"
                    aria-pressed={elegido(a)}
                    onClick={(e) => {
                      e.stopPropagation();
                      alElegir(a);
                    }}
                  >
                    {a.nombreVisible}
                  </button>
                  {a.equipo && a.equipo !== a.nombreVisible && <span className="activos-tecnico">{a.equipo}</span>}
                </th>
                <td>{nombreTipo(a.tipo)}</td>
                <td>{a.sistema}</td>
                <td className="num">{formatoEntero(a.alertas)}</td>
                <td className="num">{formatoEntero(a.altasYCriticas)}</td>
                <td>{principal(a)}</td>
                <td>
                  <UltimoAtaque activo={a} ahora={ahora} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="activos-lista">
        {activos.map((a) => (
          <li key={claveActivo(a)}>
            <button type="button" className="activos-tarjeta" aria-pressed={elegido(a)} onClick={() => alElegir(a)}>
              <span className="activos-tarjeta__nombre">{a.nombreVisible}</span>
              {a.equipo && a.equipo !== a.nombreVisible && <span className="activos-tecnico">{a.equipo}</span>}
              <span className="activos-tarjeta__dato">
                {nombreTipo(a.tipo)} · {a.sistema}
              </span>
              <span className="activos-tarjeta__dato">
                <strong>{plural(a.alertas, "alerta", "alertas")}</strong> · {formatoEntero(a.altasYCriticas)} altas y críticas
              </span>
              <span className="activos-tarjeta__dato">Componente principal: {principal(a)}</span>
              <span className="activos-tarjeta__dato">
                Último ataque: <UltimoAtaque activo={a} ahora={ahora} enLinea />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "13 nov, 16:20" y debajo "hace 2 h" (en línea, en la tarjeta); "—" si el activo no tiene ataques altos o críticos. */
function UltimoAtaque({ activo, ahora, enLinea = false }: { activo: Activo; ahora: number; enLinea?: boolean }) {
  const ultimo = ultimoAtaqueDe(activo, ahora);
  if (ultimo === null) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="solo-lectores">Sin ataques altos o críticos</span>
      </>
    );
  }
  return (
    <>
      <span className="activos-ultimo__fecha">{ultimo.fecha}</span>
      {enLinea ? <> ({ultimo.hace})</> : <span className="activos-tecnico">{ultimo.hace}</span>}
    </>
  );
}

// ---------- Bloque "Ataques recientes" ----------

/**
 * Altas y críticas agrupadas por activo y regla, de la más reciente a la más antigua. Muestra 10 y, si hay más, un botón
 * "Ver más" para llegar a los 20 que manda el backend. Ya viene filtrado por tipo y equipo.
 */
function AtaquesRecientes({
  ataques,
  ventanaDias,
  hayFiltro: conFiltro,
  ahora,
}: {
  ataques: AtaqueReciente[];
  ventanaDias: number;
  /** true = el vacío se debe al filtro de la sección (había ataques sin filtrar). */
  hayFiltro: boolean;
  ahora: number;
}) {
  const [verTodos, setVerTodos] = useState(false);
  const idTitulo = useId();
  const idLista = useId();
  const visibles = ataquesVisibles(ataques, verTodos);
  const ocultos = Math.min(ataques.length, ATAQUES_MAXIMOS) - ATAQUES_VISIBLES;

  return (
    <section className="ataques" aria-labelledby={idTitulo}>
      <h3 id={idTitulo} className="grafica__titulo">
        Ataques recientes
      </h3>
      {ataques.length === 0 ? (
        <EstadoVacio
          texto={`No hay ataques altos o críticos en los ${textoUltimosDias(ventanaDias)}${conFiltro ? " con el filtro elegido" : ""}`}
        />
      ) : (
        <>
          <p className="grafica__nota">Alertas altas y críticas agrupadas por activo y regla de Wazuh, de la más reciente a la más antigua.</p>
          <ul id={idLista} className="ataques__lista">
            {visibles.map((a) => (
              <li key={`${claveAtaque(a)}|${a.reglaId ?? ""}`} className={`ataque sev-${a.severidad >= 4 ? 4 : 3}`}>
                <p className="ataque__cuando">
                  <strong>{fechaHoraCorta(a.ultimaEn)}</strong> <span className="ataque__hace">{haceDeAtaque(a, ahora)}</span>
                </p>
                <p className="ataque__donde">
                  {a.nombreVisible} · {nombreComponente(a.componente)}
                </p>
                <p className="ataque__regla">
                  <span className="ataque__severidad">{textoSeveridadAtaque(a.severidad)}</span> {descripcionDeAtaque(a)}
                </p>
                <p className="ataque__veces">{textoVeces(a)}</p>
              </li>
            ))}
          </ul>
          {ocultos > 0 && (
            <button
              type="button"
              className="boton boton--secundario ataques__mas"
              aria-expanded={verTodos}
              aria-controls={idLista}
              onClick={() => setVerTodos(!verTodos)}
            >
              {verTodos ? "Ver menos" : `Ver más (${formatoEntero(ocultos)} más)`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Gráfica "Componentes atacados" ----------

function Componentes({ activos }: { activos: Activo[] }) {
  const filas = componentesAgregados(activos);
  const maximo = maximoDe(filas.map((f) => f.alertas));
  const resumen = `Componentes atacados: ${filas
    .map((f) => `${f.nombre} ${formatoEntero(f.alertas)} alertas, ${formatoEntero(f.altasYCriticas)} altas y críticas`)
    .join("; ")}.`;

  return (
    <TarjetaGrafica
      titulo="Componentes atacados"
      resumen={resumen}
      vacio={filas.length === 0 ? "Estos activos no tienen alertas en la ventana" : undefined}
      ancha
    >
      <p className="grafica__nota">
        <span className="activos-leyenda activos-leyenda--alertas" aria-hidden="true" /> Alertas{" "}
        <span className="activos-leyenda activos-leyenda--altas" aria-hidden="true" /> Altas y críticas. Cada alerta cuenta en un solo componente.
      </p>
      <ul className="barras" aria-hidden="true">
        {filas.map((f) => (
          <li key={f.clave} className={`barra-fila${f.clave === COMPONENTE_OTROS ? " activos-componente--otros" : ""}`}>
            <span className="barra-fila__etiqueta">{f.nombre}</span>
            <span className="barra-fila__valor">
              {formatoEntero(f.alertas)} <span className="activos-componente__altas">· {formatoEntero(f.altasYCriticas)} altas y críticas</span>
            </span>
            <span className="barra-fila__pista activos-componente__pista">
              <span className="barra-fila__barra activos-componente__barra" style={{ width: `${anchoRelativo(f.alertas, maximo)}%` }} />
              <span className="activos-componente__barra-altas" style={{ width: `${anchoRelativo(f.altasYCriticas, maximo)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </TarjetaGrafica>
  );
}
