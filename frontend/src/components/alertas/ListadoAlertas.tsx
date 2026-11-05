import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { VENTANA_ALERTAS_DIAS } from "../../config";
import type { ListaAlertas } from "../../types/listaAlertas";
import { calcularOpciones } from "../../utils/filtros";
import { calcularVista, hayFiltrosActivos, textoAvisoTruncada, textoResumenLista, type EstadoTabla, type FiltrosTabla, type Orden } from "../../utils/tabla";
import type { AccionApp } from "../../estadoApp";
import { PanelDetalle } from "./detalle/PanelDetalle";
import { BarraFiltros } from "./filtros/BarraFiltros";
import { Paginacion } from "./Paginacion";
import { TablaAlertas } from "./TablaAlertas";
import { TarjetasAlertas } from "./TarjetasAlertas";

interface Props {
  lista: ListaAlertas;
  /** Estado de la tabla (filtros, búsqueda, orden y página). Vive en App: se conserva al cambiar de pestaña. */
  tabla: EstadoTabla;
  dispatch: Dispatch<AccionApp>;
}

/** Cabecera, filtros, tabla (escritorio) o tarjetas (celular), paginación, estados vacíos y panel de detalle. */
export function ListadoAlertas({ lista, tabla: estado, dispatch }: Props) {
  const [limpiezas, setLimpiezas] = useState(0);
  const [abierta, setAbierta] = useState<string | null>(null);
  const raiz = useRef<HTMLElement>(null);
  const origenDelPanel = useRef<string | null>(null);

  // Los presets de fecha ("7 días") se resuelven con el "ahora" de cada refresco.
  const ahora = lista.generadoEn;
  const vista = useMemo(() => calcularVista(lista.alertas, estado, ahora), [lista.alertas, estado, ahora]);
  const opciones = useMemo(() => calcularOpciones(lista.alertas, estado.filtros, ahora), [lista.alertas, estado.filtros, ahora]);
  const { pagina } = vista;

  // Si tras un refresco la lista se achicó y la página pedida ya no existe, `calcularVista` ya muestra
  // la última que existe; aquí el estado se alinea para no "saltar" de vuelta si la lista vuelve a crecer.
  useEffect(() => {
    if (pagina.pagina !== estado.pagina) dispatch({ tipo: "pagina", pagina: pagina.pagina });
  }, [pagina.pagina, estado.pagina, dispatch]);

  const irAPagina = (numero: number) => {
    dispatch({ tipo: "pagina", pagina: numero });
    raiz.current?.scrollIntoView({ block: "start" });
  };

  // Cambiar un filtro o el orden vuelve a la página 1 (lo resuelve el reductor de App).
  const cambiarFiltros = useCallback(
    (cambio: (actuales: FiltrosTabla) => FiltrosTabla) => dispatch({ tipo: "filtros", cambio }),
    [dispatch],
  );
  const cambiarOrden = useCallback((orden: Orden) => dispatch({ tipo: "orden", orden }), [dispatch]);
  const limpiarFiltros = useCallback(() => {
    dispatch({ tipo: "limpiar-filtros" });
    setLimpiezas((n) => n + 1);
  }, [dispatch]);

  // --- Panel de detalle ---
  const abrir = (id: string) => {
    origenDelPanel.current = id;
    setAbierta(id);
  };
  const cerrar = useCallback(() => setAbierta(null), []);

  // Al cerrar el panel, el foco vuelve a la fila (o tarjeta) desde la que se abrió; si ya no está visible, a la lista.
  useEffect(() => {
    if (abierta !== null || origenDelPanel.current === null) return;
    const id = origenDelPanel.current;
    origenDelPanel.current = null;
    const candidatos = Array.from(raiz.current?.querySelectorAll<HTMLElement>("[data-alerta-id]") ?? []);
    const origen = candidatos.find((el) => el.dataset.alertaId === id && el.getClientRects().length > 0);
    (origen ?? raiz.current)?.focus();
  }, [abierta]);

  const hayFiltros = hayFiltrosActivos(estado.filtros);
  const sinAlertas = lista.alertas.length === 0;
  const sinCoincidencias = !sinAlertas && vista.coincidencias === 0;
  const descripcion = `Alertas de los últimos ${VENTANA_ALERTAS_DIAS} días. Página ${pagina.pagina} de ${pagina.totalPaginas}.`;

  return (
    <section ref={raiz} tabIndex={-1} className="seccion lista-alertas" aria-labelledby="titulo-lista-alertas">
      <div className="lista-cabecera">
        <h2 id="titulo-lista-alertas" className="seccion__titulo">
          Alertas
        </h2>
        <p className="lista-cabecera__resumen">
          {textoResumenLista(lista.total, vista.coincidencias, hayFiltros, VENTANA_ALERTAS_DIAS)}
        </p>
      </div>

      {lista.truncado && (
        <p className="lista-aviso" role="status">
          {textoAvisoTruncada(lista.composicion, lista.total, VENTANA_ALERTAS_DIAS)}
        </p>
      )}

      {sinAlertas ? (
        <p className="marcador">No hay alertas en los últimos {VENTANA_ALERTAS_DIAS} días</p>
      ) : (
        <BarraFiltros
          filtros={estado.filtros}
          orden={estado.orden}
          opciones={opciones}
          ahora={ahora}
          onFiltros={cambiarFiltros}
          onOrden={cambiarOrden}
          onLimpiar={limpiarFiltros}
          limpiezas={limpiezas}
        />
      )}

      {sinCoincidencias && (
        <div className="marcador">
          <p>Ninguna alerta coincide con los filtros</p>
          {hayFiltros && (
            <button type="button" className="boton" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {pagina.total > 0 && (
        <>
          <TablaAlertas filas={pagina.items} descripcion={descripcion} onAbrir={abrir} />
          <TarjetasAlertas filas={pagina.items} onAbrir={abrir} />
          <Paginacion pagina={pagina} onCambiar={irAPagina} />
        </>
      )}

      {abierta !== null && <PanelDetalle id={abierta} filas={vista.todas} onCambiarAlerta={setAbierta} onCerrar={cerrar} />}
    </section>
  );
}
