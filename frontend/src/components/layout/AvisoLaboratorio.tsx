/**
 * Aviso general, debajo del encabezado y visible en las dos vistas, cuando las cifras vienen de alertas simuladas.
 * Va dentro del mismo ancho (`.ancho`) que el encabezado y el contenido, no de borde a borde.
 */
export function AvisoLaboratorio() {
  return (
    <div className="aviso-laboratorio ancho">
      <p className="aviso-laboratorio__texto" role="note">
        <span className="aviso-laboratorio__etiqueta">Datos de laboratorio:</span> las cifras vienen de alertas simuladas
      </p>
    </div>
  );
}
