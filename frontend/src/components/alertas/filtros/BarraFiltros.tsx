import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRetraso } from "../../../hooks/useRetraso";
import { chipsActivos, type ChipFiltro, type OpcionesFiltro } from "../../../utils/filtros";
import { contarFiltrosActivos, ETIQUETA_ORDEN, ORDENES, type FiltrosTabla, type Orden } from "../../../utils/tabla";
import { ChipsFiltros } from "./ChipsFiltros";
import { ControlTresEstados } from "./ControlTresEstados";
import { FiltroFecha } from "./FiltroFecha";
import { SelectorMultiple } from "./SelectorMultiple";

/** Espera, en ms, desde la última tecla antes de filtrar por el texto de la búsqueda. */
export const ESPERA_BUSQUEDA_MS = 300;

interface Props {
  filtros: FiltrosTabla;
  orden: Orden;
  opciones: OpcionesFiltro;
  /** Instante de la lista (define "hoy" para las fechas). */
  ahora: number;
  /** Recibe una función que calcula los filtros nuevos a partir de los actuales. */
  onFiltros: (cambio: (actuales: FiltrosTabla) => FiltrosTabla) => void;
  onOrden: (orden: Orden) => void;
  onLimpiar: () => void;
  /** Sube cada vez que se limpian los filtros desde fuera de esta barra: vacía el cuadro de búsqueda. */
  limpiezas: number;
}

/**
 * Búsqueda y orden (siempre visibles) más el panel de filtros. En pantallas angostas el panel se
 * despliega con el botón "Filtros (N)"; en anchas está siempre a la vista.
 */
export function BarraFiltros({ filtros, orden, opciones, ahora, onFiltros, onOrden, onLimpiar, limpiezas }: Props) {
  const idBusqueda = useId();
  const idOrden = useId();
  const idPanel = useId();
  const [panelAbierto, setPanelAbierto] = useState(false);
  const entradaBusqueda = useRef<HTMLInputElement>(null);

  // --- Búsqueda: el texto se ve al instante; el filtro se aplica tras 300 ms sin escribir ---
  const [texto, setTexto] = useState(filtros.busqueda);
  const ultimoAplicado = useRef(filtros.busqueda);
  const retraso = useRetraso<string>(ESPERA_BUSQUEDA_MS, (valor) => {
    ultimoAplicado.current = valor;
    onFiltros((f) => (f.busqueda === valor ? f : { ...f, busqueda: valor }));
  });

  // Si la búsqueda cambia desde fuera (chip, "Limpiar filtros"), el cuadro de texto la sigue.
  useEffect(() => {
    if (filtros.busqueda !== ultimoAplicado.current) {
      ultimoAplicado.current = filtros.busqueda;
      retraso.cancelar();
      setTexto(filtros.busqueda);
    }
  }, [filtros.busqueda, retraso]);

  useEffect(() => {
    if (limpiezas > 0) {
      retraso.cancelar();
      setTexto("");
    }
  }, [limpiezas, retraso]);

  // --- Chips ---
  const chips = useMemo(() => chipsActivos(filtros), [filtros]);
  const quitarChip = (chip: ChipFiltro) => onFiltros(chip.quitar);
  const enfocarBusqueda = useCallback(() => entradaBusqueda.current?.focus(), []);

  const activos = contarFiltrosActivos(filtros);
  const cambiar = (parcial: Partial<FiltrosTabla>) => onFiltros((f) => ({ ...f, ...parcial }));

  return (
    <div className="filtros">
      <div className="filtros__fila">
        <div className="filtros__busqueda">
          <label className="solo-lectores" htmlFor={idBusqueda}>
            Buscar por título
          </label>
          <input
            ref={entradaBusqueda}
            id={idBusqueda}
            type="search"
            className="campo"
            placeholder="Buscar por título…"
            autoComplete="off"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              retraso.programar(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") retraso.ejecutarYa(); // sin esperar los 300 ms
            }}
          />
        </div>

        <div className="filtros__orden">
          <label htmlFor={idOrden}>Ordenar por</label>
          <select id={idOrden} className="campo" value={orden} onChange={(e) => onOrden(e.target.value as Orden)}>
            {ORDENES.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORDEN[o]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="boton boton--secundario filtros__boton"
          aria-expanded={panelAbierto}
          aria-controls={idPanel}
          onClick={() => setPanelAbierto((a) => !a)}
        >
          Filtros{activos > 0 && ` (${activos})`}
        </button>
      </div>

      <div id={idPanel} className={`filtros__panel${panelAbierto ? " filtros__panel--abierto" : ""}`}>
        <div className="filtros__selectores">
          <SelectorMultiple
            titulo="Severidad"
            opciones={opciones.severidades}
            seleccion={filtros.severidades}
            onCambiar={(severidades) => cambiar({ severidades })}
          />
          <SelectorMultiple
            titulo="Estado"
            opciones={opciones.estados}
            seleccion={filtros.estados}
            onCambiar={(estados) => cambiar({ estados })}
          />
          <SelectorMultiple
            titulo="Herramienta"
            opciones={opciones.origenes}
            seleccion={filtros.origenes}
            onCambiar={(origenes) => cambiar({ origenes })}
          />
          <SelectorMultiple
            titulo="Tipo de amenaza"
            opciones={opciones.tipos}
            seleccion={filtros.tipos}
            onCambiar={(tipos) => cambiar({ tipos })}
          />
        </div>

        <div className="filtros__grupos">
          <ControlTresEstados titulo="¿Tiene caso?" valor={filtros.tieneCaso} onCambiar={(tieneCaso) => cambiar({ tieneCaso })} />
          <ControlTresEstados titulo="¿Fuera de SLA?" valor={filtros.fueraDeSla} onCambiar={(fueraDeSla) => cambiar({ fueraDeSla })} />
          <FiltroFecha fecha={filtros.fecha} ahora={ahora} onCambiar={(fecha) => cambiar({ fecha })} />
        </div>
      </div>

      <ChipsFiltros chips={chips} onQuitar={quitarChip} onLimpiar={onLimpiar} alQuedarVacio={enfocarBusqueda} />
    </div>
  );
}
