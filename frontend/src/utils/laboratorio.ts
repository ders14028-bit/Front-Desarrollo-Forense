/**
 * ¿Hay que avisar de que las cifras vienen de datos de prueba? Sí si CUALQUIERA de las respuestas ya recibidas
 * (el resumen gerencial o la lista de alertas) lo indica. Las que todavía no llegaron (null) no cuentan.
 */
export function hayDatosDeLaboratorio(...respuestas: ({ datosDeLaboratorio: boolean } | null)[]): boolean {
  return respuestas.some((r) => r !== null && r.datosDeLaboratorio);
}
