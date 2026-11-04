import { useEffect, useMemo, useRef, useState } from "react";
import { VENTANA_ALERTAS_DIAS } from "../../config";
import type { ListaAlertas } from "../../types/listaAlertas";
import {
  calcularVista,
  conFiltros,
  conPagina,
  ESTADO_TABLA_INICIAL,
  FILTROS_VACIOS,
  hayFiltrosActivos,
  type EstadoTabla,
} from "../../utils/tabla";
import { NotaLaboratorio } from "../ui/NotaLaboratorio";
import { Paginacion } from "./Paginacion";
import { TablaAlertas } from "./TablaAlertas";
import { TarjetasAlertas } from "./TarjetasAlertas";

interface Props {
  lista: ListaAlertas;
  /** Se llamará al elegir una alerta (el panel de detalle llega en un paso posterior). */
  onAbrir?: (id: string) => void;
}

/** Cabecera, tabla (escritorio) o tarjetas (celular), paginación y estados vacíos de las alertas. */
export function ListadoAlertas({ lista, onAbrir }: Props) {
  const [estado, setEstado] = useState<EstadoTabla>(ESTADO_TABLA_INICIAL);
  const raiz = useRef<HTMLElement>(null);

  const vista = useMemo(() => calcularVista(lista.alertas, estado), [lista.alertas, estado]);
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

  const limpiarFiltros = () => setEstado((e) => conFiltros(e, FILTROS_VACIOS));

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

      {sinAlertas && <p className="marcador">No hay alertas en los últimos {VENTANA_ALERTAS_DIAS} días</p>}

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
