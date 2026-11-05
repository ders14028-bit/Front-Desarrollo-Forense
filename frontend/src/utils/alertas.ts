import { SLA_MINUTOS, TAG_LABORATORIO, TOPE_ALERTAS, VENTANA_ALERTAS_DIAS } from "../config";
import type { Alerta } from "../types/alerta";
import type { Caso } from "../types/caso";
import type { AlertaFila, CasoDetalle, DetalleAlerta, ListaAlertas } from "../types/listaAlertas";
import type { Tarea } from "../types/tarea";
import { diaBogota, ultimosDias } from "./fechas";
import { tipoAmenaza } from "./metricas";

/**
 * Reglas del contrato de la Vista unificada. Son las mismas que implementará el backend: el mock
 * las usa para producir respuestas con la forma real. Funciones puras: `ahora` se pasa siempre.
 */

const MIN = 60_000;

function filaDesde(alerta: Alerta, casoPorId: Map<string, Caso>, ahora: number): AlertaFila {
  const antiguedadMs = Math.max(0, ahora - alerta._createdAt);
  const limiteMin = SLA_MINUTOS[alerta.severity];
  const sinAtender = alerta.status === "New";
  // Estrictamente mayor: justo en el límite todavía está a tiempo.
  const fuera = sinAtender && antiguedadMs > limiteMin * MIN;

  const caso = typeof alerta.caseId === "string" && alerta.caseId !== "" ? casoPorId.get(alerta.caseId) : undefined;

  return {
    id: alerta._id,
    creadaEn: alerta._createdAt,
    titulo: alerta.title,
    severidad: alerta.severity,
    estado: alerta.status,
    origen: alerta.source,
    tipo: tipoAmenaza(alerta),
    antiguedadMs,
    sla: {
      estado: sinAtender ? (fuera ? "fuera" : "dentro") : null,
      limiteMin,
      excesoMs: fuera ? antiguedadMs - limiteMin * MIN : null,
    },
    caso: alerta.caseId
      ? caso
        ? { id: caso._id, numero: caso.number, etapa: caso.stage, estado: caso.status }
        : { id: alerta.caseId, numero: null, etapa: null, estado: null }
      : null,
  };
}

const indexarCasos = (casos: Caso[]) => new Map(casos.map((c) => [c._id, c]));

export function construirFilaAlerta(alerta: Alerta, casos: Caso[], ahora: number): AlertaFila {
  return filaDesde(alerta, indexarCasos(casos), ahora);
}

interface OpcionesLista {
  ventanaDias?: number;
  tope?: number;
}

/**
 * Lista de los últimos `ventanaDias` días en Bogotá (terminando hoy), de la más reciente a la más
 * antigua: las `tope` más recientes más todas las críticas y altas sin atender. `total` cuenta la ventana completa;
 * `truncado` avisa si quedó alguna fuera.
 */
export function construirListaAlertas(
  alertas: Alerta[],
  casos: Caso[],
  ahora: number,
  { ventanaDias = VENTANA_ALERTAS_DIAS, tope = TOPE_ALERTAS }: OpcionesLista = {},
): ListaAlertas {
  const primerDia = ultimosDias(ventanaDias, ahora)[0];
  const casoPorId = indexarCasos(casos);

  const enVentana = alertas
    .filter((a) => diaBogota(a._createdAt) >= primerDia) // 'YYYY-MM-DD' se compara como texto
    .sort((x, y) => y._createdAt - x._createdAt);

  // Igual que el backend: las `tope` más recientes MÁS todas las críticas y altas sin atender que queden más atrás.
  const recientes = enVentana.slice(0, tope);
  const adicionales = enVentana.slice(tope).filter((a) => a.status === "New" && a.severity >= 3);
  const incluidas = [...recientes, ...adicionales];

  return {
    generadoEn: ahora,
    total: enVentana.length,
    truncado: enVentana.length > incluidas.length,
    composicion: { recientes: recientes.length, criticasYAltasAdicionales: adicionales.length },
    datosDeLaboratorio: enVentana.some((a) => a.tags.includes(TAG_LABORATORIO)) || casos.some((c) => c.tags.includes(TAG_LABORATORIO)),
    alertas: incluidas.map((a) => filaDesde(a, casoPorId, ahora)),
  };
}

/** Detalle de una alerta con su caso y tareas; null si la alerta no existe. */
export function construirDetalle(
  id: string,
  alertas: Alerta[],
  casos: Caso[],
  tareas: Tarea[],
  ahora: number,
): DetalleAlerta | null {
  const alerta = alertas.find((a) => a._id === id);
  if (!alerta) return null;

  const caso = alerta.caseId ? casos.find((c) => c._id === alerta.caseId) : undefined;
  const casoDetalle: CasoDetalle | null = caso ? { ...caso, tareas: tareas.filter((t) => t.caseId === caso._id) } : null;

  return { generadoEn: ahora, alerta, fila: construirFilaAlerta(alerta, casos, ahora), caso: casoDetalle };
}
