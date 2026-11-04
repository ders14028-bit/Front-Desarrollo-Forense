import { etiquetaOrigen, etiquetaTipo } from "../../utils/etiquetas";

/** "Wazuh · Fuerza bruta". "Sin clasificar" va en gris, como en la gráfica de tipos de amenaza. */
export function OrigenYTipo({ origen, tipo }: { origen: string; tipo: string | null }) {
  return (
    <>
      {etiquetaOrigen(origen)} ·{" "}
      {tipo === null ? <span className="sin-clasificar">{etiquetaTipo(null)}</span> : etiquetaTipo(tipo)}
    </>
  );
}
