const FILAS = 8;

/** Filas esqueleto de la primera carga. */
export function EsqueletoLista() {
  return (
    <div aria-busy="true">
      <p className="solo-lectores" role="status">
        Cargando alertas…
      </p>
      <div className="esqueleto esqueleto--seccion" aria-hidden="true" />
      <div className="lista-esqueleto" aria-hidden="true">
        {Array.from({ length: FILAS }, (_, i) => (
          <div key={i} className="esqueleto esqueleto--fila" />
        ))}
      </div>
    </div>
  );
}
