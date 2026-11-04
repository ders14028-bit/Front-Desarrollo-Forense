/**
 * ¿Se usan datos simulados?
 * - VITE_USE_MOCK definido: "false" = backend real; cualquier otro valor = mock.
 * - Sin definir (o vacío): mock solo en desarrollo; en el build de producción, backend real.
 */
export function decidirModoMock(valor: string | undefined, esProduccion: boolean): boolean {
  if (valor === undefined || valor.trim() === "") return !esProduccion;
  return valor.trim().toLowerCase() !== "false";
}
