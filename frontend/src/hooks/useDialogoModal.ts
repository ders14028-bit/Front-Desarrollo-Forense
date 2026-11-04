import { useLayoutEffect, type KeyboardEvent, type RefObject } from "react";

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const esVisible = (el: HTMLElement) => el.getClientRects().length > 0;

interface Opciones {
  dialogo: RefObject<HTMLElement>;
  onCerrar: () => void;
}

/**
 * Comportamiento de un diálogo modal accesible mientras está montado:
 * - el resto de la página queda inerte (`inert` en #root) y sin scroll;
 * - el foco entra al diálogo y queda atrapado dentro (Tab y Mayús+Tab dan la vuelta);
 * - Esc lo cierra.
 * Devuelve el manejador de teclado que hay que poner en el diálogo (`onKeyDown`).
 * Devolver el foco al elemento de origen es responsabilidad de quien abre el diálogo.
 */
export function useDialogoModal({ dialogo, onCerrar }: Opciones) {
  useLayoutEffect(() => {
    const raiz = document.getElementById("root");
    const { body } = document;
    const overflowAntes = body.style.overflow;
    const rellenoAntes = body.style.paddingRight;
    // Al ocultar la barra de scroll, la página se ensancharía y saltaría: se compensa.
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (anchoBarra > 0) body.style.paddingRight = `${anchoBarra}px`;
    raiz?.setAttribute("inert", "");
    dialogo.current?.focus();

    return () => {
      body.style.overflow = overflowAntes;
      body.style.paddingRight = rellenoAntes;
      raiz?.removeAttribute("inert");
    };
  }, [dialogo]);

  return function alTeclear(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCerrar();
      return;
    }
    if (e.key !== "Tab") return;

    const contenedor = dialogo.current;
    if (!contenedor) return;
    const enfocables = Array.from(contenedor.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(esVisible);
    if (enfocables.length === 0) {
      e.preventDefault();
      contenedor.focus();
      return;
    }

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === contenedor)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };
}
