/** Generador pseudoaleatorio con semilla: devuelve números en [0, 1). Misma semilla = misma secuencia. */
export type Aleatorio = () => number;

/** mulberry32: PRNG pequeño y determinista. Nunca usar Math.random en los mocks. */
export function mulberry32(semilla: number): Aleatorio {
  let a = semilla | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [min, max], ambos incluidos. */
export function entero(rng: Aleatorio, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function elegir<T>(rng: Aleatorio, lista: readonly T[]): T {
  return lista[Math.floor(rng() * lista.length)];
}

/** Copia de la lista en orden aleatorio (Fisher-Yates). */
export function barajar<T>(rng: Aleatorio, lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function hexa(rng: Aleatorio, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

/** Identificador con forma de UUID v4 (no es seguro; solo para datos ficticios). */
export function uuid(rng: Aleatorio): string {
  return `${hexa(rng, 8)}-${hexa(rng, 4)}-4${hexa(rng, 3)}-a${hexa(rng, 3)}-${hexa(rng, 12)}`;
}
