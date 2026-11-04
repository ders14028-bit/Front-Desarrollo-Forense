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
  type EstadoTabla,
  type FiltrosTabla,
  type Orden,
} from "../../utils/tabla";
import { NotaLaboratorio } from "../ui/NotaLaboratorio";
import { BarraFiltros } from "./filtros/BarraFiltros";
import { Paginacion } from "./Paginacion";
import { TablaAlertas } from "./TablaAlertas";
import { TarjetasAlertas } from "./TarjetasAlertas";

interface Props {
  lista: ListaAlertas;
  /** Se llamará al elegir una alerta (el panel de detalle llega en un paso posterior). */
  onAbrir?: (id: string) => void;
}

/** Cabecera, filtros, tabla (escritorio) o tarjetas (celular), paginación y estados vacíos de las alertas. */
export function ListadoAlertas({ lista, onAbrir }: Props) {
  const [estado, setEstado] = useState<EstadoTabla>(ESTADO_TABLA_INICIAL);
  const [limpiezas, setLimpiezas] = useState(0);
  const raiz = useRef<HTMLElement>(null);

  const vista = useMemo(() => calcularVista(lista.alertas, estado), [lista.alertas, estado]);
  const opciones = useMemo(() => calcularOpciones(lista.alertas, estado.filtros), [lista.alertas, estado.filtros]);
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

  const sinAlertas = lista.alertas.length === 0;
  const sinCoincidencias = !sinAlertas && vista.coincidencias === 0;
  const descripcion = `Alertas de los últimos ${VENTANA_ALERTAS_DIAS} días. Página ${pagina.pagina} de ${pagina.totalPaginas}.`;

  return (
    <section ref={raiz} className="seccion" aria-labelledby="titulo-lista-alertas">
      <div className="lista-cabecera">
        <h2 id="titulo-lista-alertas" className="seccion__titulo">
          Alertas
        </h2>
        <p className="lista-cabecera__resumen">
          {lista.total} {lista.total === 1 ? "alerta" : "alertas"} · últimos {VENTANA_ALERTAS_DIAS} días
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
          ahora={lista.generadoEn}
          onFiltros={cambiarFiltros}
          onOrden={cambiarOrden}
          onLimpiar={limpiarFiltros}
          limpiezas={limpiezas}
        />
      )}

      {sinCoincidencias && (
        <div className="marcador">
          <p>Ninguna alerta coincide con los filtros</p>
          {hayFiltrosActivos(estado.filtros) && (
            <button type="button" className="boton" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {pagina.total > 0 && (
        <>
          <TablaAlertas filas={pagina.items} descripcion={descripcion} onAbrir={onAbrir} />
          <TarjetasAlertas filas={pagina.items} onAbrir={onAbrir} />
          <Paginacion pagina={pagina} onCambiar={irAPagina} />
        </>
      )}
    </section>
  );
}
