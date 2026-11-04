import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VENTANA_ALERTAS_DIAS } from "../../config";
import type { ListaAlertas } from "../../types/listaAlertas";
import { calcularOpciones } from "../../utils/filtros";
import {
  calcularVista,
  conFiltros,
  conOrden,
  conPagina,
  ESTADO_TABLA_INICIAL,
  FILTROS_VACIOS,
  hayFiltrosActivos,
  textoResumenLista,
  type EstadoTabla,
  type FiltrosTabla,
  type Orden,
} from "../../utils/tabla";
import { NotaLaboratorio } from "../ui/NotaLaboratorio";
import { PanelDetalle } from "./detalle/PanelDetalle";
import { BarraFiltros } from "./filtros/BarraFiltros";
import { Paginacion } from "./Paginacion";
import { TablaAlertas } from "./TablaAlertas";
import { TarjetasAlertas } from "./TarjetasAlertas";

/** Cabecera, filtros, tabla (escritorio) o tarjetas (celular), paginación, estados vacíos y panel de detalle. */
export function ListadoAlertas({ lista }: { lista: ListaAlertas }) {
  const [estado, setEstado] = useState<EstadoTabla>(ESTADO_TABLA_INICIAL);
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
    if (pagina.pagina !== estado.pagina) setEstado((e) => conPagina(e, pagina.pagina));
  }, [pagina.pagina, estado.pagina]);

  const irAPagina = (numero: number) => {
    setEstado((e) => conPagina(e, numero));
    raiz.current?.scrollIntoView({ block: "start" });
  };

  // Cambiar un filtro vuelve a la página 1. Si la función devuelve el mismo objeto, no hay cambio.
  const cambiarFiltros = useCallback((cambio: (actuales: FiltrosTabla) => FiltrosTabla) => {
    setEstado((e) => {
      const nuevos = cambio(e.filtros);
      return nuevos === e.filtros ? e : conFiltros(e, nuevos);
    });
  }, []);
  const cambiarOrden = useCallback((orden: Orden) => setEstado((e) => (e.orden === orden ? e : conOrden(e, orden))), []);
  const limpiarFiltros = useCallback(() => {
    setEstado((e) => conFiltros(e, FILTROS_VACIOS));
    setLimpiezas((n) => n + 1);
  }, []);

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

      {lista.datosDeLaboratorio && (
        <div className="lista-nota">
          <NotaLaboratorio />
        </div>
      )}
      {lista.truncado && (
        <p className="lista-aviso" role="status">
          Mostrando las {lista.alertas.length} más recientes
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
