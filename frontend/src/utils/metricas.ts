import { ESTADO_CONFIRMADO, GRUPO_CONTENCION, SLA_MINUTOS, TAG_LABORATORIO } from "../config";
import type { Alerta, Severidad } from "../types/alerta";
import type { Caso } from "../types/caso";
import type { ConteoPorOrigen, ConteoPorTipo, ResumenAlertas, ResumenCasos, ResumenGerencial } from "../types/metricas";
import type { Tarea } from "../types/tarea";
import { diaBogota, ultimosDias } from "./fechas";

const MIN = 60_000;
const PREFIJO_ESCENARIO = "escenario:";
/** Largo de la serie por día; la interfaz la recorta a 7 o 14. */
export const DIAS_SERIE = 30;

/** Tipo de amenaza = etiqueta `escenario:<tipo>`. null si no la tiene (NUNCA se deduce del título ni del source). */
export function tipoAmenaza(alerta: Alerta): string | null {
  for (const tag of alerta.tags) {
    if (tag.startsWith(PREFIJO_ESCENARIO)) {
      const tipo = tag.slice(PREFIJO_ESCENARIO.length).trim();
      if (tipo) return tipo;
    }
  }
  return null;
}

/** Cuenta repeticiones; de mayor a menor y, a igualdad, por nombre (orden estable). */
function contarOrdenado(claves: string[]): { clave: string; cantidad: number }[] {
  const cuenta = new Map<string, number>();
  for (const c of claves) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  return [...cuenta.entries()]
    .map(([clave, cantidad]) => ({ clave, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave, "es"));
}

function promedio(valores: number[]): number | null {
  return valores.length === 0 ? null : valores.reduce((s, v) => s + v, 0) / valores.length;
}

function resumirAlertas(alertas: Alerta[], ahora: number): ResumenAlertas {
  const sinAtender = alertas.filter((a) => a.status === "New");
  const antiguedades = sinAtender.map((a) => Math.max(0, ahora - a._createdAt));

  const tipos = alertas.map(tipoAmenaza);
  const porTipoAmenaza: ConteoPorTipo[] = contarOrdenado(tipos.filter((t): t is string => t !== null)).map(
    ({ clave, cantidad }) => ({ tipo: clave, cantidad }),
  );
  const porOrigen: ConteoPorOrigen[] = contarOrdenado(alertas.map((a) => a.source)).map(({ clave, cantidad }) => ({
    origen: clave,
    cantidad,
  }));

  const cuentaDia = new Map<string, number>();
  for (const a of alertas) {
    const dia = diaBogota(a._createdAt);
    cuentaDia.set(dia, (cuentaDia.get(dia) ?? 0) + 1);
  }

  return {
    recibidas: alertas.length,
    sinAtender: sinAtender.length,
    criticasYAltas: alertas.filter((a) => a.severity >= 3).length,
    masAntiguaSinAtenderMs: antiguedades.length === 0 ? null : Math.max(...antiguedades),
    antiguedadPromedioSinAtenderMs: promedio(antiguedades),
    // Estrictamente mayor: una alerta justo en el límite del SLA todavía está a tiempo.
    fueraDeSla: sinAtender.filter((a) => ahora - a._createdAt > SLA_MINUTOS[a.severity] * MIN).length,
    porSeveridad: ([4, 3, 2, 1] as Severidad[]).map((severidad) => ({
      severidad,
      cantidad: alertas.filter((a) => a.severity === severidad).length,
    })),
    porTipoAmenaza,
    sinClasificar: tipos.filter((t) => t === null).length,
    porOrigen,
    porDia: ultimosDias(DIAS_SERIE, ahora).map((dia) => ({ dia, cantidad: cuentaDia.get(dia) ?? 0 })),
  };
}

function resumirCasos(alertas: Alerta[], casos: Caso[], tareas: Tarea[]): ResumenCasos {
  const cerrados = casos.filter((c) => c.stage === "Closed");
  // Sin fecha de cierre no se puede medir la duración: ese caso no entra en el promedio.
  const duraciones = cerrados.filter((c) => c.endDate !== undefined).map((c) => c.endDate! - c._createdAt);
  const convertidas = alertas.filter((a) => typeof a.caseId === "string" && a.caseId !== "").length;

  return {
    reportados: casos.length,
    abiertos: casos.filter((c) => c.stage === "New").length,
    enProgreso: casos.filter((c) => c.stage === "InProgress").length,
    cerrados: cerrados.length,
    alertasConvertidas: {
      convertidas,
      total: alertas.length,
      porcentaje: alertas.length === 0 ? null : (convertidas / alertas.length) * 100,
    },
    contencionesHechas: tareas.filter((t) => t.group === GRUPO_CONTENCION && t.status === "Completed").length,
    confirmadosYCerrados: cerrados.filter((c) => c.status === ESTADO_CONFIRMADO).length,
    tiempoPromedioCierreMs: promedio(duraciones),
  };
}

/** Calcula el resumen gerencial. Función pura: no lee el reloj; `ahora` (ms) se pasa siempre. */
export function calcularResumen(alertas: Alerta[], casos: Caso[], tareas: Tarea[], ahora: number): ResumenGerencial {
  const esDePrueba = (x: { tags: string[] }) => x.tags.includes(TAG_LABORATORIO);
  return {
    generadoEn: ahora,
    datosDeLaboratorio: alertas.some(esDePrueba) || casos.some(esDePrueba),
    alertas: resumirAlertas(alertas, ahora),
    casos: resumirCasos(alertas, casos, tareas),
  };
}
