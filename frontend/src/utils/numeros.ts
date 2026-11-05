/** Cifras en español de Colombia: punto para los miles y coma para los decimales ("23.261", "99,5"). */

const entero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** 23261 → "23.261". También agrupa los de cuatro cifras ("1.500"). */
export const formatoEntero = (n: number): string => entero.format(n);

/** Hasta un decimal: 99.46 → "99,5"; 12 → "12". */
export const formatoDecimal = (n: number): string => decimal.format(n);

/**
 * "N %" de `parte` sobre `total`, con un decimal como máximo. Nunca miente en los extremos: si no es todo, no dice
 * "100 %" (99,96 → "99,9 %") y si hay algo, no dice "0 %" ("menos de 0,1 %"). Null si no hay total.
 */
export function textoPorcentaje(parte: number, total: number): string | null {
  if (total <= 0) return null;
  const crudo = (parte / total) * 100;
  let redondeado = Math.round(crudo * 10) / 10;
  if (parte < total && redondeado >= 100) redondeado = 99.9;
  if (parte > 0 && redondeado === 0) return "menos de 0,1 %";
  return `${formatoDecimal(redondeado)} %`;
}
