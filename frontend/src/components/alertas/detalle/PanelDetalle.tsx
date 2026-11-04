import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogoModal } from "../../../hooks/useDialogoModal";
import type { AlertaFila } from "../../../types/listaAlertas";
import { urlAlertaTheHive, urlCasoTheHive } from "../../../utils/enlaces";
import { etiquetaEstadoAlerta, etiquetaOrigen } from "../../../utils/etiquetas";
import { InsigniaSeveridad } from "../InsigniaSeveridad";
import { ContenidoDetalle } from "./ContenidoDetalle";

interface Props {
  /** Alerta abierta (se identifica por id, no por posición). */
  id: string;
  /** Lista FILTRADA y ordenada actual (todas las páginas): la recorren "Anterior" y "Siguiente". */
  filas: AlertaFila[];
  onCambiarAlerta: (id: string) => void;
  onCerrar: () => void;
}

function EnlaceTheHive({ href, children }: { href: string; children: string }) {
  return (
    <a className="enlace-externo" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="solo-lectores"> (se abre en una pestaña nueva)</span>
    </a>
  );
}

/**
 * Detalle de una alerta en un diálogo modal: panel lateral de 480 px en escritorio y pantalla completa en
 * celular. Se cierra con ✕ / "← Volver", Esc o clic fuera.
 */
export function PanelDetalle({ id, filas, onCambiarAlerta, onCerrar }: Props) {
  const dialogo = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const pulsadoEnFondo = useRef(false);
  const alTeclear = useDialogoModal({ dialogo, onCerrar });

  const indice = filas.findIndex((f) => f.id === id);
  const enLista = indice >= 0;

  // Si tras un refresco la alerta sale de la lista filtrada, el panel sigue abierto con los últimos datos conocidos.
  const ultimaFila = useRef<AlertaFila | null>(null);
  if (enLista) ultimaFila.current = filas[indice];
  const fila = enLista ? filas[indice] : ultimaFila.current;

  // Sin VITE_THEHIVE_URL no hay enlaces.
  const urlAlerta = fila ? urlAlertaTheHive(fila.id) : null;
  const urlCaso = fila?.caso ? urlCasoTheHive(fila.caso.id) : null;

  const anterior = enLista && indice > 0 ? filas[indice - 1] : null;
  const siguiente = enLista && indice < filas.length - 1 ? filas[indice + 1] : null;

  // Al cambiar de alerta, si el botón que tenía el foco desapareció (por ejemplo "Siguiente" en la última), el foco no se pierde.
  useEffect(() => {
    const el = dialogo.current;
    if (el && !el.contains(document.activeElement)) el.focus();
  }, [id]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="dialogo-fondo"
      onPointerDown={(e) => {
        pulsadoEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pulsadoEnFondo.current && e.target === e.currentTarget) onCerrar();
        pulsadoEnFondo.current = false;
      }}
    >
      <div
        ref={dialogo}
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alTeclear}
      >
        <header className="dialogo__cabecera">
          <div className="dialogo__barra">
            <button type="button" className="dialogo__volver" onClick={onCerrar}>
              <span aria-hidden="true">← </span>Volver
            </button>

            {enLista && (
              <nav className="dialogo__nav" aria-label="Recorrer las alertas">
                {anterior ? (
                  <button type="button" className="dialogo__boton" onClick={() => onCambiarAlerta(anterior.id)}>
                    <span aria-hidden="true">‹ </span>Anterior
                  </button>
                ) : (
                  <span className="dialogo__hueco" aria-hidden="true" />
                )}
                <span className="dialogo__posicion">
                  {indice + 1} de {filas.length}
                </span>
                {siguiente ? (
                  <button type="button" className="dialogo__boton" onClick={() => onCambiarAlerta(siguiente.id)}>
                    Siguiente<span aria-hidden="true"> ›</span>
                  </button>
                ) : (
                  <span className="dialogo__hueco" aria-hidden="true" />
                )}
              </nav>
            )}

            <button type="button" className="dialogo__cerrar" aria-label="Cerrar el detalle" onClick={onCerrar}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          {fila && (
            <>
              <p className="dialogo__estado">
                <InsigniaSeveridad severidad={fila.severidad} />
                <span>{etiquetaEstadoAlerta(fila.estado)}</span>
              </p>
              <h2 id={idTitulo} className="dialogo__titulo">
                {fila.titulo}
              </h2>
              <p className="dialogo__meta">
                ID {fila.id} · {etiquetaOrigen(fila.origen)}
              </p>
              {(urlAlerta !== null || urlCaso !== null) && (
                <p className="dialogo__enlaces">
                  {urlAlerta !== null && <EnlaceTheHive href={urlAlerta}>Abrir alerta en TheHive</EnlaceTheHive>}
                  {urlCaso !== null && <EnlaceTheHive href={urlCaso}>Abrir caso en TheHive</EnlaceTheHive>}
                </p>
              )}
            </>
          )}
          {enLista && (
            <p className="solo-lectores" role="status">
              Alerta {indice + 1} de {filas.length}: {fila?.titulo}
            </p>
          )}
        </header>

        <div className="dialogo__cuerpo">
          {!enLista && (
            <p className="dialogo__aviso" role="status">
              Esta alerta ya no está en la lista filtrada. Sigues viendo su detalle.
            </p>
          )}
          <ContenidoDetalle key={id} id={id} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
