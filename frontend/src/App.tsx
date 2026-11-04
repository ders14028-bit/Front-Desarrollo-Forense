import { useState } from "react";
import { modoMock } from "./api/cliente";
import { Encabezado } from "./components/layout/Encabezado";
import { Pestanas, type Pestana } from "./components/layout/Pestanas";
import { useAlertas } from "./hooks/useAlertas";
import { useResumen } from "./hooks/useResumen";
import { VistaGerencial } from "./views/VistaGerencial";
import { VistaUnificada } from "./views/VistaUnificada";

const PESTANAS: Pestana[] = [
  { id: "gerencial", etiqueta: "Vista gerencial" },
  { id: "unificada", etiqueta: "Vista unificada" },
];

export default function App() {
  const [activa, setActiva] = useState("gerencial");

  // Los hooks viven aquí: los datos se conservan al cambiar de pestaña. Cada uno refresca SOLO
  // mientras su vista está activa; al volver a ella refresca de inmediato.
  const resumen = useResumen(activa === "gerencial");
  const alertas = useAlertas(activa === "unificada");

  // El encabezado refleja la vista que se está viendo.
  const visible = activa === "gerencial" ? resumen : alertas;

  return (
    <>
      <Encabezado actualizadoEn={visible.actualizadoEn} hayError={visible.error !== null} modoMock={modoMock} />
      <Pestanas pestanas={PESTANAS} activa={activa} onCambiar={setActiva} />
      <main
        className="contenido ancho"
        role="tabpanel"
        id={`panel-${activa}`}
        aria-labelledby={`pestana-${activa}`}
      >
        {activa === "gerencial" ? <VistaGerencial resumen={resumen} /> : <VistaUnificada alertas={alertas} />}
      </main>
    </>
  );
}
