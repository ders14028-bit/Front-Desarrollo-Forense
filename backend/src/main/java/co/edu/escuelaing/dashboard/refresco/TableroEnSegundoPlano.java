package co.edu.escuelaing.dashboard.refresco;

import co.edu.escuelaing.dashboard.alertas.AlertasService;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas;
import co.edu.escuelaing.dashboard.refresco.FuenteEnSegundoPlano.Servido;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.resumen.ResumenService;
import java.time.Clock;
import java.util.concurrent.CompletableFuture;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Mantiene el resumen y la lista de alertas al día en segundo plano (cada 30 s, configurable). Las peticiones del
 * frontend se sirven desde memoria y nunca esperan a TheHive; si TheHive falla se sigue sirviendo el último dato bueno
 * con {@code thehive.respondio = false}. Solo si todavía no hubo ningún dato bueno la respuesta es 503.
 *
 * <p>El primer cálculo arranca con la aplicación. Una petición que llega antes espera (hasta
 * {@code esperaPrimeraCarga}) a que termine ese primer intento.
 */
@Component
public class TableroEnSegundoPlano {

    private final FuenteEnSegundoPlano<ResumenGerencial> resumen;
    private final FuenteEnSegundoPlano<ListaAlertas> lista;
    private final ConfiguracionRefresco configuracion;

    public TableroEnSegundoPlano(ResumenService resumenService, AlertasService alertasService, Clock reloj,
                                 ConfiguracionRefresco configuracion) {
        this.resumen = new FuenteEnSegundoPlano<>("Resumen", resumenService::calcular, reloj);
        this.lista = new FuenteEnSegundoPlano<>("Lista de alertas", alertasService::calcularLista, reloj);
        this.configuracion = configuracion;
    }

    /** Recalcula las dos fuentes a la vez. Se programa solo mientras {@code dashboard.refresco.activo} no sea false. */
    @Scheduled(fixedDelayString = "${dashboard.refresco.intervalo:30s}", initialDelay = 0)
    public void refrescar() {
        CompletableFuture<Void> a = CompletableFuture.runAsync(resumen::refrescar, hilo());
        CompletableFuture<Void> b = CompletableFuture.runAsync(lista::refrescar, hilo());
        CompletableFuture.allOf(a, b).join();
    }

    private static java.util.concurrent.Executor hilo() {
        return tarea -> Thread.ofVirtual().start(tarea);
    }

    /** El resumen servido, con el estado de la última consulta a TheHive. */
    public ResumenGerencial resumen() {
        Servido<ResumenGerencial> servido = servido(resumen);
        return servido.valor().conEstado(new EstadoTheHive(servido.respondio(), servido.consultadoEnMs()));
    }

    /** La lista servida, con el estado de la última consulta a TheHive. */
    public ListaAlertas lista() {
        Servido<ListaAlertas> servido = servido(lista);
        return servido.valor().conEstado(new EstadoTheHive(servido.respondio(), servido.consultadoEnMs()));
    }

    private <T> Servido<T> servido(FuenteEnSegundoPlano<T> fuente) {
        if (fuente.actual().isEmpty()) {
            fuente.esperarPrimerIntento(configuracion.esperaPrimeraCarga());
        }
        return fuente.actual().orElseThrow(DatosNoDisponiblesException::new);
    }
}
