/** Frase corta que explica por qué no hay un dato (nunca se inventan datos). */
export function EstadoVacio({ texto }: { texto: string }) {
  return <p className="estado-vacio">{texto}</p>;
}
