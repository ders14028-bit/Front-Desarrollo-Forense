import type { Dispatch } from "react";
import { EsqueletoLista } from "../components/alertas/EsqueletoLista";
import { ListadoAlertas } from "../components/alertas/ListadoAlertas";
import { BloqueCarga } from "../components/ui/BloqueCarga";
import type { AccionApp } from "../estadoApp";
import type { ResultadoAlertas } from "../hooks/useAlertas";
import type { EstadoTabla } from "../utils/tabla";

interface Props {
  alertas: ResultadoAlertas;
  /** Estado de la tabla; vive en App para conservarse al cambiar de pestaña. */
  tabla: EstadoTabla;
  dispatch: Dispatch<AccionApp>;
}

export function VistaUnificada({ alertas, tabla, dispatch }: Props) {
  return (
    <BloqueCarga resultado={alertas} esqueleto={<EsqueletoLista />}>
      {(lista) => <ListadoAlertas lista={lista} tabla={tabla} dispatch={dispatch} />}
    </BloqueCarga>
  );
}
