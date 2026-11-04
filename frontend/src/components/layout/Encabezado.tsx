/**
 * Encabezado con el estado de la actualización.
 * Valores FIJOS por ahora; se conectarán al refresco automático en un paso posterior.
 */
export function Encabezado() {
  return (
    <header className="encabezado">
      <h1 className="encabezado__titulo">Dashboard SOC</h1>
      <ul className="estado" aria-label="Estado de la actualización">
        <li className="estado__item">Actualizado 09:41 (Bogotá)</li>
        <li className="estado__item">cada 30 s</li>
        <li className="estado__item estado__conexion">
          <span className="estado__punto" aria-hidden="true" />
          TheHive conectado
        </li>
      </ul>
    </header>
  );
}
