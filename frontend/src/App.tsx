import { useState } from "react";
import { modoMock } from "./api/cliente";
import { Encabezado } from "./components/layout/Encabezado";
import { Pestanas, type Pestana } from "./components/layout/Pestanas";
import { useResumen } from "./hooks/useResumen";
import { VistaGerencial } from "./views/VistaGerencial";
import { VistaUnificada } from "./views/VistaUnificada";

const PESTANAS: Pestana[] = [
  { id: "gerencial", etiqueta: "Vista gerencial" },
  { id: "unificada", etiqueta: "Vista unificada" },
];

export default function App() {
  const [activa, setActiva] = useState("gerencial");
  // El hook vive aquí: el refresco no se reinicia al cambiar de pestaña y el encabezado
  // y la vista comparten el mismo resultado.
  const resumen = useResumen();

  return (
    <>
      <Encabezado actualizadoEn={resumen.actualizadoEn} hayError={resumen.error !== null} modoMock={modoMock} />
      <Pestanas pestanas={PESTANAS} activa={activa} onCambiar={setActiva} />
      <main
        className="contenido ancho"
        role="tabpanel"
        id={`panel-${activa}`}
        aria-labelledby={`pestana-${activa}`}
      >
        {activa === "gerencial" ? <VistaGerencial resumen={resumen} /> : <VistaUnificada />}
      </main>
    </>
  );
}
