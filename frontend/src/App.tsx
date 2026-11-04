import { useState } from "react";
import { Encabezado } from "./components/layout/Encabezado";
import { Pestanas, type Pestana } from "./components/layout/Pestanas";
import { VistaGerencial } from "./views/VistaGerencial";
import { VistaUnificada } from "./views/VistaUnificada";

const PESTANAS: Pestana[] = [
  { id: "gerencial", etiqueta: "Vista gerencial" },
  { id: "unificada", etiqueta: "Vista unificada" },
];

export default function App() {
  const [activa, setActiva] = useState("gerencial");

  return (
    <>
      <Encabezado />
      <Pestanas pestanas={PESTANAS} activa={activa} onCambiar={setActiva} />
      <main
        className="contenido"
        role="tabpanel"
        id={`panel-${activa}`}
        aria-labelledby={`pestana-${activa}`}
      >
        {activa === "gerencial" ? <VistaGerencial /> : <VistaUnificada />}
      </main>
    </>
  );
}
