import { modoMock } from "./api/cliente";
import { AvisoLaboratorio } from "./components/layout/AvisoLaboratorio";
import { Encabezado } from "./components/layout/Encabezado";
import { useResumen } from "./hooks/useResumen";
import { hayDatosDeLaboratorio } from "./utils/laboratorio";
import { VistaGerencial } from "./views/VistaGerencial";

export default function App() {
  // Una sola vista: refresca siempre (el hook ya se pausa con la pestaña del navegador oculta).
  const resumen = useResumen(true);

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Encabezado
        actualizadoEn={resumen.actualizadoEn}
        hayError={resumen.error !== null}
        modoMock={modoMock}
        thehive={resumen.datos?.thehive ?? null}
        datosDe={resumen.datos?.generadoEn ?? null}
      />
      {hayDatosDeLaboratorio(resumen.datos) && <AvisoLaboratorio />}
      <main id="contenido" className="contenido ancho" tabIndex={-1}>
        <VistaGerencial resumen={resumen} />
      </main>
    </>
  );
}
