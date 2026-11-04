import type { Alerta } from "../../../types/alerta";
import { camposDeAlerta } from "../../../utils/camposAlerta";

/** Todos los campos de la alerta, plegado. Fechas en hora de Bogotá y etiquetas como chips. */
export function TodosLosCampos({ alerta }: { alerta: Alerta }) {
  return (
    <details className="plegable plegable--seccion">
      <summary>Todos los campos</summary>
      <dl className="datos datos--campos">
        {camposDeAlerta(alerta).map((c) => (
          <div key={c.clave} className="datos__fila">
            <dt>
              {c.etiqueta}
              <span className="datos__clave">{c.clave}</span>
            </dt>
            <dd>
              {c.valor.tipo === "texto" && c.valor.texto}
              {c.valor.tipo === "json" && <pre className="datos__json">{c.valor.texto}</pre>}
              {c.valor.tipo === "etiquetas" &&
                (c.valor.etiquetas.length === 0 ? (
                  "—"
                ) : (
                  <ul className="etiquetas">
                    {c.valor.etiquetas.map((t) => (
                      <li key={t} className="etiqueta">
                        {t}
                      </li>
                    ))}
                  </ul>
                ))}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
