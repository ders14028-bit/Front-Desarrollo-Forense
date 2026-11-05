import { useEffect, useReducer } from "react";
import { modoMock } from "./api/cliente";
import { AvisoLaboratorio } from "./components/layout/AvisoLaboratorio";
import { Encabezado } from "./components/layout/Encabezado";
import { Pestanas, type Pestana } from "./components/layout/Pestanas";
import {
  ESTADO_APP_INICIAL,
  reducirApp,
  refrescaGerencial,
  refrescaUnificada,
  tituloDelDocumento,
  type IdPestana,
} from "./estadoApp";
import { useAlertas } from "./hooks/useAlertas";
import { useResumen } from "./hooks/useResumen";
import { hayDatosDeLaboratorio } from "./utils/laboratorio";
import { VistaGerencial } from "./views/VistaGerencial";
import { VistaUnificada } from "./views/VistaUnificada";

const PESTANAS: Pestana[] = [
  { id: "gerencial", etiqueta: "Vista gerencial" },
  { id: "unificada", etiqueta: "Vista unificada" },
];

export default function App() {
  // La pestaña activa y el estado de la tabla (filtros, búsqueda, orden y página) viven aquí: se conservan al
  // cambiar de pestaña. Ver `estadoApp.ts`.
  const [app, dispatch] = useReducer(reducirApp, ESTADO_APP_INICIAL);

  // Los datos también: cada hook refresca SOLO mientras su vista está activa, y al volver a ella refresca de inmediato.
  const resumen = useResumen(refrescaGerencial(app));
  const alertas = useAlertas(refrescaUnificada(app));

  // El encabezado refleja la vista que se está viendo.
  const visible = app.pestana === "gerencial" ? resumen : alertas;

  useEffect(() => {
    document.title = tituloDelDocumento(app.pestana);
  }, [app.pestana]);

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Encabezado
        actualizadoEn={visible.actualizadoEn}
        hayError={visible.error !== null}
        modoMock={modoMock}
        thehive={visible.datos?.thehive ?? null}
        datosDe={visible.datos?.generadoEn ?? null}
      />
      {hayDatosDeLaboratorio(resumen.datos, alertas.datos) && <AvisoLaboratorio />}
      <Pestanas
        pestanas={PESTANAS}
        activa={app.pestana}
        onCambiar={(id) => dispatch({ tipo: "pestana", pestana: id as IdPestana })}
      />
      <main id="contenido" className="contenido ancho" tabIndex={-1}>
        {/* Un panel por pestaña: así el aria-controls de cada pestaña apunta a un elemento que existe. Solo el activo tiene contenido. */}
        {PESTANAS.map((p) => (
          <div
            key={p.id}
            role="tabpanel"
            id={`panel-${p.id}`}
            aria-labelledby={`pestana-${p.id}`}
            tabIndex={0}
            hidden={app.pestana !== p.id}
          >
            {app.pestana === p.id &&
              (p.id === "gerencial" ? (
                <VistaGerencial resumen={resumen} />
              ) : (
                <VistaUnificada alertas={alertas} tabla={app.tabla} dispatch={dispatch} />
              ))}
          </div>
        ))}
      </main>
    </>
  );
}
