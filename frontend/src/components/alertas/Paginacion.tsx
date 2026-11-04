import { textoMostrando, type Pagina } from "../../utils/tabla";

interface Props {
  pagina: Pagina<unknown>;
  onCambiar: (pagina: number) => void;
}

/**
 * "Mostrando 26–50 de 112" y botones Anterior / Siguiente. En la primera página no se muestra
 * "Anterior", y en la última no se muestra "Siguiente" (en vez de botones deshabilitados).
 */
export function Paginacion({ pagina: p, onCambiar }: Props) {
  return (
    <nav className="paginacion" aria-label="Paginación de alertas">
      <p className="paginacion__texto" aria-live="polite">
        {textoMostrando(p)}
      </p>

      {p.totalPaginas > 1 && (
        <div className="paginacion__botones">
          {p.pagina > 1 ? (
            <button type="button" className="boton boton--secundario" onClick={() => onCambiar(p.pagina - 1)}>
              <span aria-hidden="true">‹ </span>Anterior
            </button>
          ) : (
            <span className="paginacion__hueco" aria-hidden="true" />
          )}

          {/* En pantallas angostas se muestra "10/12"; los lectores de pantalla siguen leyendo "Página 10 de 12". */}
          <span className="paginacion__pagina">
            <span className="paginacion__pagina-larga">
              Página {p.pagina} de {p.totalPaginas}
            </span>
            <span className="paginacion__pagina-corta" aria-hidden="true">
              {p.pagina}/{p.totalPaginas}
            </span>
          </span>

          {p.pagina < p.totalPaginas ? (
            <button type="button" className="boton boton--secundario" onClick={() => onCambiar(p.pagina + 1)}>
              Siguiente<span aria-hidden="true"> ›</span>
            </button>
          ) : (
            <span className="paginacion__hueco" aria-hidden="true" />
          )}
        </div>
      )}
    </nav>
  );
}
