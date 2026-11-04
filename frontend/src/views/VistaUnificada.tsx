import { EsqueletoLista } from "../components/alertas/EsqueletoLista";
import { ListadoAlertas } from "../components/alertas/ListadoAlertas";
import { BloqueCarga } from "../components/ui/BloqueCarga";
import type { ResultadoAlertas } from "../hooks/useAlertas";

export function VistaUnificada({ alertas }: { alertas: ResultadoAlertas }) {
  return (
    <BloqueCarga resultado={alertas} esqueleto={<EsqueletoLista />}>
      {(lista) => <ListadoAlertas lista={lista} />}
    </BloqueCarga>
  );
}
