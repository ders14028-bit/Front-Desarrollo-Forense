export type ClaveEstado = "error" | "simulado" | "conectando" | "conectado";

export interface EstadoConexion {
  clave: ClaveEstado;
  texto: string;
}

interface Entrada {
  /** El último intento de refresco falló. */
  hayError: boolean;
  /** La app usa datos simulados. */
  modoMock: boolean;
  /** Ya se recibió al menos una respuesta correcta. */
  tieneDatos: boolean;
}

/**
 * Prioridad: error > modo mock > conectado. "Conectando…" solo aparece mientras no hay
 * ninguna respuesta todavía, para no afirmar "TheHive conectado" sin haber comprobado nada.
 */
export function estadoConexion({ hayError, modoMock, tieneDatos }: Entrada): EstadoConexion {
  if (hayError) return { clave: "error", texto: "Sin conexión" };
  if (modoMock) return { clave: "simulado", texto: "Datos simulados" };
  if (!tieneDatos) return { clave: "conectando", texto: "Conectando…" };
  return { clave: "conectado", texto: "TheHive conectado" };
}
