import type { EstadoAlerta, Severidad } from "../types/alerta";
import type { AlertaFila } from "../types/listaAlertas";
import { etiquetaEstadoAlerta, etiquetaOrigen, etiquetaSeveridad, etiquetaTipo } from "./etiquetas";
import { diaCorto } from "./fechas";
import { fechaActiva, filtrarAlertas, type FiltroFecha, type FiltrosTabla } from "./tabla";

/** Opciones y chips de los filtros de la Vista unificada. Funciones puras. */

// ---------- Opciones con conteo ----------

export interface OpcionFiltro<V> {
  valor: V;
  etiqueta: string;
  cantidad: number;
}

export interface OpcionesFiltro {
  severidades: OpcionFiltro<Severidad>[];
  estados: OpcionFiltro<EstadoAlerta>[];
  origenes: OpcionFiltro<string>[];
  /** `null` = "Sin clasificar", siempre al final. */
  tipos: OpcionFiltro<string | null>[];
}

const SEVERIDADES: Severidad[] = [4, 3, 2, 1];
const ESTADOS: EstadoAlerta[] = ["New", "InProgress", "Imported", "Ignored"];

const porEtiqueta = <V>(a: OpcionFiltro<V>, b: OpcionFiltro<V>) => a.etiqueta.localeCompare(b.etiqueta, "es");

/**
 * Opciones de cada filtro con el conteo de alertas que dejaría pasar. El conteo de cada grupo
 * respeta los DEMÁS filtros activos (no el suyo propio), así "Wazuh (3)" dice cuántas alertas verías
 * si marcaras Wazuh con los otros filtros tal como están. Las opciones salen de los datos (más las ya
 * seleccionadas, para que no desaparezcan); herramientas y tipos van en orden alfabético y "Sin
 * clasificar" al final. `ahora` (ms) resuelve los presets de fecha.
 */
export function calcularOpciones(filas: AlertaFila[], filtros: FiltrosTabla, ahora: number): OpcionesFiltro {
  const sin = (parcial: Partial<FiltrosTabla>) => filtrarAlertas(filas, { ...filtros, ...parcial }, ahora);

  const baseSeveridad = sin({ severidades: [] });
  const baseEstado = sin({ estados: [] });
  const baseOrigen = sin({ origenes: [] });
  const baseTipo = sin({ tipos: [] });

  const origenes = [...new Set([...filas.map((f) => f.origen), ...filtros.origenes])];
  const tipos = [...new Set([...filas.map((f) => f.tipo), ...filtros.tipos])];

  return {
    severidades: SEVERIDADES.map((valor) => ({
      valor,
      etiqueta: etiquetaSeveridad(valor),
      cantidad: baseSeveridad.filter((f) => f.severidad === valor).length,
    })),
    estados: ESTADOS.map((valor) => ({
      valor,
      etiqueta: etiquetaEstadoAlerta(valor),
      cantidad: baseEstado.filter((f) => f.estado === valor).length,
    })),
    origenes: origenes
      .map((valor) => ({
        valor,
        etiqueta: etiquetaOrigen(valor),
        cantidad: baseOrigen.filter((f) => f.origen === valor).length,
      }))
      .sort(porEtiqueta),
    tipos: [
      ...tipos
        .filter((t): t is string => t !== null)
        .map((valor) => ({
          valor: valor as string | null,
          etiqueta: etiquetaTipo(valor),
          cantidad: baseTipo.filter((f) => f.tipo === valor).length,
        }))
        .sort(porEtiqueta),
      ...(tipos.includes(null)
        ? [{ valor: null, etiqueta: etiquetaTipo(null), cantidad: baseTipo.filter((f) => f.tipo === null).length }]
        : []),
    ],
  };
}

// ---------- Chips de filtros activos ----------

export interface ChipFiltro {
  /** Identificador estable (por ejemplo "severidad-4"). */
  id: string;
  /** "Severidad: Crítica". */
  etiqueta: string;
  /** Devuelve los filtros sin este chip. */
  quitar: (f: FiltrosTabla) => FiltrosTabla;
}

/** Un chip por cada valor seleccionado, en el orden de la barra de filtros. */
export function chipsActivos(f: FiltrosTabla): ChipFiltro[] {
  const chips: ChipFiltro[] = [];

  const texto = f.busqueda.trim();
  if (texto !== "") {
    chips.push({ id: "busqueda", etiqueta: `Título: “${texto}”`, quitar: (x) => ({ ...x, busqueda: "" }) });
  }
  for (const v of f.severidades) {
    chips.push({
      id: `severidad-${v}`,
      etiqueta: `Severidad: ${etiquetaSeveridad(v)}`,
      quitar: (x) => ({ ...x, severidades: x.severidades.filter((s) => s !== v) }),
    });
  }
  for (const v of f.estados) {
    chips.push({
      id: `estado-${v}`,
      etiqueta: `Estado: ${etiquetaEstadoAlerta(v)}`,
      quitar: (x) => ({ ...x, estados: x.estados.filter((s) => s !== v) }),
    });
  }
  for (const v of f.origenes) {
    chips.push({
      id: `origen-${v}`,
      etiqueta: `Herramienta: ${etiquetaOrigen(v)}`,
      quitar: (x) => ({ ...x, origenes: x.origenes.filter((s) => s !== v) }),
    });
  }
  for (const v of f.tipos) {
    chips.push({
      id: `tipo-${v ?? "sin-clasificar"}`,
      etiqueta: `Tipo: ${etiquetaTipo(v)}`,
      quitar: (x) => ({ ...x, tipos: x.tipos.filter((s) => s !== v) }),
    });
  }
  if (f.tieneCaso !== "todos") {
    chips.push({
      id: "caso",
      etiqueta: `Caso: ${f.tieneCaso === "si" ? "con caso" : "sin caso"}`,
      quitar: (x) => ({ ...x, tieneCaso: "todos" }),
    });
  }
  if (f.fueraDeSla !== "todos") {
    chips.push({
      id: "sla",
      etiqueta: `SLA: ${f.fueraDeSla === "si" ? "fuera de SLA" : "dentro o sin SLA"}`,
      quitar: (x) => ({ ...x, fueraDeSla: "todos" }),
    });
  }
  if (f.fecha !== null && fechaActiva(f.fecha)) {
    chips.push({ id: "fecha", etiqueta: `Fecha: ${textoFecha(f.fecha)}`, quitar: (x) => ({ ...x, fecha: null }) });
  }

  return chips;
}

function textoFecha(fecha: FiltroFecha): string {
  if (fecha.tipo === "preset") return fecha.preset === "hoy" ? "hoy" : `últimos ${fecha.preset} días`;
  const { desde, hasta } = fecha;
  if (desde !== null && hasta !== null) return desde === hasta ? diaCorto(desde) : `${diaCorto(desde)} – ${diaCorto(hasta)}`;
  return desde !== null ? `desde ${diaCorto(desde)}` : `hasta ${diaCorto(hasta!)}`;
}
