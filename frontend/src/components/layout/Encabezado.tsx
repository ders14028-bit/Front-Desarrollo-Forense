import { REFRESCO_MS } from "../../config";
import { formatoHora } from "../../utils/fechas";
import { estadoConexion } from "./estadoConexion";

interface Props {
  /** Instante del último refresco exitoso; null si aún no hay datos. */
  actualizadoEn: number | null;
  hayError: boolean;
  modoMock: boolean;
}

export function Encabezado({ actualizadoEn, hayError, modoMock }: Props) {
  const estado = estadoConexion({ hayError, modoMock, tieneDatos: actualizadoEn !== null });
  const hora = actualizadoEn === null ? "—" : formatoHora(actualizadoEn);

  return (
    <header className="encabezado">
      <div className="encabezado__interior ancho">
        <h1 className="encabezado__titulo">Dashboard SOC</h1>
        <ul className="estado" aria-label="Estado de la actualización">
          <li className="estado__item">Actualizado {hora} (Bogotá)</li>
          <li className="estado__item">cada {REFRESCO_MS / 1000} s</li>
          <li className={`estado__item estado__conexion estado__conexion--${estado.clave}`}>
            <span className="estado__punto" aria-hidden="true" />
            {estado.texto}
          </li>
        </ul>
      </div>
    </header>
  );
}
