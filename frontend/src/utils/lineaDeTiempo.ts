import type { DetalleAlerta } from "../types/listaAlertas";
import { etiquetaEstadoTarea, etiquetaOrigen, etiquetaResolucion } from "./etiquetas";

/**
 * Línea de tiempo de una alerta: alerta creada → convertida en caso → tareas → caso cerrado.
 * Solo incluye eventos con una fecha real. Las únicas excepciones son las tareas que siguen pendientes
 * (se muestran como "pendiente", sin hora) y las completadas sin fecha registrada (sin hora, avisándolo).
 */

export type TipoEvento =
  | "alerta-creada"
  | "caso-creado"
  | "tarea-completada"
  | "caso-cerrado"
  | "tarea-pendiente"
  | "tarea-sin-fecha";

export interface EventoTiempo {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  detalle: string | null;
  /** Instante (ms); null = evento sin fecha (tarea pendiente o sin fecha registrada). */
  fecha: number | null;
  /** Tiempo desde la creación de la alerta (nunca negativo); null si el evento no tiene fecha. */
  transcurridoMs: number | null;
}

// Orden a igualdad de fecha: la alerta, luego el caso, luego las tareas, luego el cierre.
const PRIORIDAD: Record<TipoEvento, number> = {
  "alerta-creada": 0,
  "caso-creado": 1,
  "tarea-completada": 2,
  "caso-cerrado": 3,
  "tarea-pendiente": 4,
  "tarea-sin-fecha": 4,
};

export function construirLineaDeTiempo(detalle: DetalleAlerta): EventoTiempo[] {
  const { alerta, caso } = detalle;
  const inicio = alerta._createdAt;
  const conFecha = (fecha: number) => ({ fecha, transcurridoMs: Math.max(0, fecha - inicio) });

  const fechados: EventoTiempo[] = [
    {
      id: "alerta-creada",
      tipo: "alerta-creada",
      titulo: "Alerta creada",
      detalle: `Herramienta: ${etiquetaOrigen(alerta.source)}`,
      ...conFecha(inicio),
    },
  ];
  const sinFecha: EventoTiempo[] = [];

  if (caso) {
    // PENDIENTE: la fecha exacta de la conversión puede no existir en TheHive; se usa la creación del caso.
    fechados.push({
      id: "caso-creado",
      tipo: "caso-creado",
      titulo: `Convertida en caso${caso.number !== undefined ? ` #${caso.number}` : ""}`,
      detalle: caso.title,
      ...conFecha(caso._createdAt),
    });

    for (const t of caso.tareas) {
      const detalleTarea = `${t.title} · ${t.group}`;
      if (t.status === "Completed" && t.endDate !== undefined) {
        fechados.push({
          id: `tarea-${t._id}`,
          tipo: "tarea-completada",
          titulo: "Tarea completada",
          detalle: detalleTarea,
          ...conFecha(t.endDate),
        });
      } else if (t.status === "Completed") {
        sinFecha.push({
          id: `tarea-${t._id}`,
          tipo: "tarea-sin-fecha",
          titulo: "Tarea completada",
          detalle: detalleTarea,
          fecha: null,
          transcurridoMs: null,
        });
      } else if (t.status === "Waiting" || t.status === "InProgress") {
        sinFecha.push({
          id: `tarea-${t._id}`,
          tipo: "tarea-pendiente",
          titulo: "Tarea pendiente",
          detalle: `${detalleTarea} · ${etiquetaEstadoTarea(t.status)}`,
          fecha: null,
          transcurridoMs: null,
        });
      }
      // Las canceladas no tienen fecha ni están pendientes: no entran en la línea de tiempo.
    }

    if (caso.stage === "Closed" && caso.endDate !== undefined) {
      fechados.push({
        id: "caso-cerrado",
        tipo: "caso-cerrado",
        titulo: `Caso${caso.number !== undefined ? ` #${caso.number}` : ""} cerrado`,
        detalle: caso.status ? `Resolución: ${etiquetaResolucion(caso.status)}` : null,
        ...conFecha(caso.endDate),
      });
    }
  }

  // Por fecha; a igualdad, por prioridad; y a igualdad total se conserva el orden de llegada.
  const ordenados = fechados
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.fecha! - b.e.fecha! || PRIORIDAD[a.e.tipo] - PRIORIDAD[b.e.tipo] || a.i - b.i)
    .map(({ e }) => e);

  return [...ordenados, ...sinFecha];
}
