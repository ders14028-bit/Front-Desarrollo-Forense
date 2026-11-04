export interface Retraso<T> {
  /** Programa `alTerminar(valor)` para dentro de `ms`; una llamada nueva reinicia la espera. */
  programar(valor: T): void;
  /** Ejecuta ya lo que esté pendiente (por ejemplo, al pulsar Enter). No hace nada si no hay nada pendiente. */
  ejecutarYa(): void;
  /** Descarta lo pendiente. */
  cancelar(): void;
}

/** Espera `ms` sin nuevas llamadas antes de avisar con el último valor (para la búsqueda mientras se escribe). */
export function crearRetraso<T>(ms: number, alTerminar: (valor: T) => void): Retraso<T> {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let pendiente: { valor: T } | null = null;

  const limpiar = () => {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
  };

  const disparar = () => {
    limpiar();
    if (pendiente === null) return;
    const { valor } = pendiente;
    pendiente = null;
    alTerminar(valor);
  };

  return {
    programar(valor) {
      pendiente = { valor };
      limpiar();
      temporizador = setTimeout(disparar, ms);
    },
    ejecutarYa: disparar,
    cancelar() {
      limpiar();
      pendiente = null;
    },
  };
}
