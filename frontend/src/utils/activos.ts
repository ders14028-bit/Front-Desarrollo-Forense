import { COMPONENTE_OTROS, NOMBRES_COMPONENTES, NOMBRES_TIPOS, ORDEN_TIPOS } from "../config/activos";
import type { Activo, AtaqueReciente } from "../types/activos";
import { fechaHoraCorta, textoHace } from "./fechas";
import { formatoEntero } from "./numeros";
import { describirRegla } from "./wazuh";

/**
 * Reglas puras de la sección "Activos atacados": filtrado, agregados por tipo y por componente y la frase resumen.
 * Todo sale de los datos del backend; nada se inventa.
 */

/** null = sin filtrar por ese criterio. */
export interface FiltroActivos {
  tipo: string | null;
  /** Clave del activo (ver `claveActivo`). */
  equipo: string | null;
}

export const SIN_FILTRO: FiltroActivos = { tipo: null, equipo: null };

export const hayFiltro = (f: FiltroActivos) => f.tipo !== null || f.equipo !== null;

/** Identificador estable de un activo: el id de agente, o su nombre técnico, o el visible. */
export const claveActivo = (a: Activo): string => a.agenteId ?? a.equipo ?? a.nombreVisible;

export const nombreTipo = (tipo: string): string => NOMBRES_TIPOS[tipo] ?? tipo;
export const nombreComponente = (clave: string): string => NOMBRES_COMPONENTES[clave] ?? clave;

export function filtrarActivos(activos: Activo[], filtro: FiltroActivos): Activo[] {
  return activos.filter(
    (a) => (filtro.tipo === null || a.tipo === filtro.tipo) && (filtro.equipo === null || claveActivo(a) === filtro.equipo),
  );
}

/**
 * Clic en un tipo: lo activa, o lo quita si ya estaba. Si el equipo elegido no es de ese tipo, el equipo se quita
 * (si no, el filtro quedaría vacío sin que el usuario lo pidiera).
 */
export function alternarTipo(filtro: FiltroActivos, tipo: string, activos: Activo[]): FiltroActivos {
  if (filtro.tipo === tipo) return { ...filtro, tipo: null };
  const equipo = activos.find((a) => claveActivo(a) === filtro.equipo);
  return { tipo, equipo: equipo && equipo.tipo === tipo ? filtro.equipo : null };
}

/** Elegir un equipo (selector o fila de la tabla). `null` = todos los equipos. */
export function elegirEquipo(filtro: FiltroActivos, equipo: string | null, activos: Activo[]): FiltroActivos {
  if (equipo === null) return { ...filtro, equipo: null };
  const activo = activos.find((a) => claveActivo(a) === equipo);
  // Se conserva el tipo solo si el equipo es de ese tipo.
  return { tipo: activo && activo.tipo === filtro.tipo ? filtro.tipo : null, equipo };
}

export interface ResumenTipo {
  tipo: string;
  nombre: string;
  alertas: number;
  altasYCriticas: number;
  servidores: number;
}

/** Un resumen por tipo presente, en el orden de `ORDEN_TIPOS`; los tipos nuevos al final, por nombre. */
export function resumenPorTipo(activos: Activo[]): ResumenTipo[] {
  const porTipo = new Map<string, ResumenTipo>();
  for (const a of activos) {
    const r = porTipo.get(a.tipo) ?? { tipo: a.tipo, nombre: nombreTipo(a.tipo), alertas: 0, altasYCriticas: 0, servidores: 0 };
    r.alertas += a.alertas;
    r.altasYCriticas += a.altasYCriticas;
    r.servidores += 1;
    porTipo.set(a.tipo, r);
  }
  const posicion = (t: string) => (ORDEN_TIPOS.includes(t) ? ORDEN_TIPOS.indexOf(t) : ORDEN_TIPOS.length);
  return [...porTipo.values()].sort((x, y) => posicion(x.tipo) - posicion(y.tipo) || x.nombre.localeCompare(y.nombre, "es-CO"));
}

export interface ResumenComponente {
  clave: string;
  nombre: string;
  alertas: number;
  altasYCriticas: number;
}

/** Componentes de los activos sumados, de mayor a menor; "Otros" siempre al final. Sin componentes en cero. */
export function componentesAgregados(activos: Activo[]): ResumenComponente[] {
  const suma = new Map<string, ResumenComponente>();
  for (const a of activos) {
    for (const c of a.componentes) {
      const r = suma.get(c.clave) ?? { clave: c.clave, nombre: nombreComponente(c.clave), alertas: 0, altasYCriticas: 0 };
      r.alertas += c.alertas;
      r.altasYCriticas += c.altasYCriticas;
      suma.set(c.clave, r);
    }
  }
  const esOtros = (c: ResumenComponente) => (c.clave === COMPONENTE_OTROS ? 1 : 0);
  return [...suma.values()]
    .filter((c) => c.alertas > 0)
    .sort((x, y) => esOtros(x) - esOtros(y) || y.alertas - x.alertas || y.altasYCriticas - x.altasYCriticas || x.nombre.localeCompare(y.nombre, "es-CO"));
}

/** Suma de alertas y de altas y críticas. */
export function totales(activos: Activo[]): { alertas: number; altasYCriticas: number } {
  return activos.reduce(
    (t, a) => ({ alertas: t.alertas + a.alertas, altasYCriticas: t.altasYCriticas + a.altasYCriticas }),
    { alertas: 0, altasYCriticas: 0 },
  );
}

const alertas = (n: number) => `${formatoEntero(n)} ${n === 1 ? "alerta" : "alertas"}`;

/**
 * Frase de arriba de la sección, con los datos ya filtrados. El activo destacado es el de más alertas altas y críticas;
 * si no hay ninguna alta o crítica, el de más alertas. El componente es el de más alertas, sin contar "Otros" (si solo
 * hay "Otros", esa parte no se dice). null si no hay alertas: la sección muestra entonces su propio mensaje.
 */
export function fraseResumen(activos: Activo[]): string | null {
  const conAlertas = activos.filter((a) => a.alertas > 0);
  if (conAlertas.length === 0) return null;

  const hayAltas = conAlertas.some((a) => a.altasYCriticas > 0);
  const destacado = [...conAlertas].sort((x, y) =>
    hayAltas ? y.altasYCriticas - x.altasYCriticas || y.alertas - x.alertas : y.alertas - x.alertas || y.altasYCriticas - x.altasYCriticas,
  )[0];

  // Sin paréntesis propios: los nombres ya pueden traerlos ("Servidor de monitoreo (Wazuh)").
  const partes = [
    hayAltas
      ? `El activo con más alertas altas y críticas es ${destacado.nombreVisible}: ${formatoEntero(destacado.altasYCriticas)} de ${formatoEntero(destacado.alertas)}.`
      : `El activo con más alertas es ${destacado.nombreVisible}: ${alertas(destacado.alertas)}, ninguna alta ni crítica.`,
  ];
  const componente = componentesAgregados(conAlertas).find((c) => c.clave !== COMPONENTE_OTROS);
  if (componente) partes.push(`Lo más atacado es ${componente.nombre}: ${alertas(componente.alertas)}.`);
  return partes.join(" ");
}

export interface OpcionEquipo {
  clave: string;
  etiqueta: string;
}

/** Opciones del selector de equipo, por nombre visible. Con un tipo elegido, solo los de ese tipo. */
export function opcionesEquipo(activos: Activo[], tipo: string | null): OpcionEquipo[] {
  return activos
    .filter((a) => tipo === null || a.tipo === tipo)
    .map((a) => ({
      clave: claveActivo(a),
      etiqueta: a.equipo && a.equipo !== a.nombreVisible ? `${a.nombreVisible} (${a.equipo})` : a.nombreVisible,
    }))
    .sort((x, y) => x.etiqueta.localeCompare(y.etiqueta, "es-CO"));
}

/** Orden de la tabla: más alertas primero; a igualdad, más altas y críticas; luego por nombre. */
export function ordenarPorAlertas(activos: Activo[]): Activo[] {
  return [...activos].sort(
    (x, y) => y.alertas - x.alertas || y.altasYCriticas - x.altasYCriticas || x.nombreVisible.localeCompare(y.nombreVisible, "es-CO"),
  );
}

// ---------- Último ataque y ataques recientes ----------

/** Cuántos ataques recientes se muestran antes de pulsar "Ver más". */
export const ATAQUES_VISIBLES = 10;

/** Los que se muestran con "Ver más". El backend manda hasta 20 grupos por activo, así que sin filtro puede haber más. */
export const ATAQUES_MAXIMOS = 20;

export interface UltimoAtaque {
  /** "13 nov, 16:20" (Bogotá). */
  fecha: string;
  /** "hace 2 h", contado desde la hora del resumen. */
  hace: string;
}

/**
 * Cuándo fue el último ataque alto o crítico de un activo; null si no tiene. `ahora` es la hora del resumen
 * (`generadoEn`), no el reloj del navegador.
 */
export function ultimoAtaqueDe(activo: Activo, ahora: number): UltimoAtaque | null {
  if (activo.ultimoAtaqueEn === null || activo.ultimoAtaqueEn === undefined) return null;
  return { fecha: fechaHoraCorta(activo.ultimoAtaqueEn), hace: textoHace(ahora - activo.ultimoAtaqueEn) };
}

/** Misma clave que `claveActivo`, para decir a qué activo pertenece un ataque. */
export const claveAtaque = (a: AtaqueReciente): string => a.agenteId ?? a.equipo ?? a.nombreVisible;

/** Los ataques de los activos que pasan el filtro de la sección (tipo y equipo). Conserva el orden del backend. */
export function filtrarAtaques(ataques: AtaqueReciente[], filtro: FiltroActivos): AtaqueReciente[] {
  return ataques.filter(
    (a) => (filtro.tipo === null || a.tipo === filtro.tipo) && (filtro.equipo === null || claveAtaque(a) === filtro.equipo),
  );
}

/**
 * Los más recientes de los ya filtrados: `ATAQUES_VISIBLES`, o `ATAQUES_MAXIMOS` si `verTodos`. Se filtra PRIMERO y se
 * corta DESPUÉS, para que un equipo con ataques viejos no quede sin ellos por culpa de otros más ruidosos.
 */
export const ataquesVisibles = (ataques: AtaqueReciente[], verTodos: boolean): AtaqueReciente[] =>
  ataques.slice(0, verTodos ? ATAQUES_MAXIMOS : ATAQUES_VISIBLES);

/** Severidad en texto: 4 es Crítica; 3 (y cualquier otra) Alta. El color nunca va solo. */
export const textoSeveridadAtaque = (severidad: number): "Crítica" | "Alta" => (severidad >= 4 ? "Crítica" : "Alta");

/** Descripción para mostrar: la traducción del diccionario si existe; si no, la original que manda Wazuh. */
export const descripcionDeAtaque = (a: AtaqueReciente): string => describirRegla(a.reglaId ?? "", a.descripcion).texto;

/** "14 veces desde 13 nov, 09:10"; con una sola alerta, "1 vez" (la fecha ya está arriba). */
export function textoVeces(a: AtaqueReciente): string {
  return a.cantidad === 1 ? "1 vez" : `${formatoEntero(a.cantidad)} veces desde ${fechaHoraCorta(a.primeraEn)}`;
}

/** "hace 2 h" para un ataque, contado desde la hora del resumen. */
export const haceDeAtaque = (a: AtaqueReciente, ahora: number): string => textoHace(ahora - a.ultimaEn);
