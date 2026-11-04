/** Aviso general, debajo del encabezado y visible en las dos vistas, cuando las cifras vienen de alertas simuladas. */
export function AvisoLaboratorio() {
  return (
    <div className="aviso-laboratorio" role="note">
      <p className="aviso-laboratorio__texto ancho">
        <span className="aviso-laboratorio__etiqueta">Datos de laboratorio:</span> las cifras vienen de alertas simuladas
      </p>
    </div>
  );
}
