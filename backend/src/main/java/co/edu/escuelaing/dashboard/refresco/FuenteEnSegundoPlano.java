package co.edu.escuelaing.dashboard.refresco;

import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveException;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Un dato que se recalcula en segundo plano y se sirve desde memoria: las peticiones del frontend NUNCA esperan a
 * TheHive. Si un recálculo falla, se conserva el último dato bueno y se anota que la última consulta falló
 * ({@code respondio = false}) para que el frontend lo muestre.
 *
 * @param <T> el dato calculado
 */
public final class FuenteEnSegundoPlano<T> {

    private static final Logger log = LoggerFactory.getLogger(FuenteEnSegundoPlano.class);

    /**
     * Lo que se sirve: el último dato bueno y el estado de la ÚLTIMA consulta.
     *
     * @param consultadoEnMs instante del último intento de consultar a TheHive (bueno o malo)
     */
    public record Servido<T>(T valor, boolean respondio, long consultadoEnMs) {
    }

    private final String nombre;
    private final Supplier<T> calculo;
    private final Clock reloj;
    private final CompletableFuture<Void> primerIntento = new CompletableFuture<>();

    private volatile T ultimoBueno;
    private volatile boolean ultimoIntentoBueno;
    private volatile long ultimoIntentoMs;

    public FuenteEnSegundoPlano(String nombre, Supplier<T> calculo, Clock reloj) {
        this.nombre = nombre;
        this.calculo = calculo;
        this.reloj = reloj;
    }

    /** Recalcula. Nunca lanza: un fallo deja el dato anterior y {@code respondio = false}. */
    public void refrescar() {
        boolean estabaBien = ultimoIntentoBueno;
        try {
            T nuevo = calculo.get();
            ultimoBueno = nuevo;
            ultimoIntentoBueno = true;
            ultimoIntentoMs = reloj.millis();
            if (!estabaBien && primerIntento.isDone()) {
                log.info("{}: TheHive volvió a responder.", nombre);
            }
        } catch (TheHiveException e) {
            ultimoIntentoBueno = false;
            ultimoIntentoMs = reloj.millis();
            log.warn("{}: no se pudo actualizar ({}); se sigue sirviendo {}.", nombre, e.getMessage(),
                    ultimoBueno == null ? "nada todavía" : "el último dato bueno");
        } catch (RuntimeException e) {
            // Error inesperado (un bug): no se registra el mensaje, que podría traer datos; solo el tipo.
            ultimoIntentoBueno = false;
            ultimoIntentoMs = reloj.millis();
            log.error("{}: error inesperado al actualizar ({}); se sigue sirviendo {}.", nombre, e.getClass().getSimpleName(),
                    ultimoBueno == null ? "nada todavía" : "el último dato bueno");
        } finally {
            primerIntento.complete(null);
        }
    }

    /** Lo servido ahora, o vacío si todavía no hay ningún dato bueno. */
    public Optional<Servido<T>> actual() {
        T valor = ultimoBueno;
        if (valor == null) {
            return Optional.empty();
        }
        return Optional.of(new Servido<>(valor, ultimoIntentoBueno, ultimoIntentoMs));
    }

    /** Espera (como máximo {@code maximo}) a que termine el primer intento; sirve para el arranque en frío. */
    public void esperarPrimerIntento(Duration maximo) {
        try {
            primerIntento.get(maximo.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException | ExecutionException e) {
            // se responde con lo que haya (nada, y entonces 503)
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
