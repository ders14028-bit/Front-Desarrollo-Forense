package co.edu.escuelaing.dashboard.resumen;

import co.edu.escuelaing.dashboard.dominio.DiasBogota;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Caché de "alertas por día" (Bogotá). Un día que ya terminó no cambia, así que su recuento se guarda hasta la
 * medianoche siguiente y no se vuelve a pedir a TheHive en cada refresco (solo se recuenta HOY).
 *
 * <p>Excepción: "ayer" se recuenta en los primeros {@link #GRACIA} del día nuevo, por si todavía llegan alertas con
 * fecha de ayer; pasada la gracia se guarda. A medianoche todo se recuenta una vez (la ventana avanzó un día).
 */
@Component
public class ConteosPorDia {

    /** Cuánto después de la medianoche se sigue recontando el día que acaba de terminar. */
    public static final Duration GRACIA = Duration.ofMinutes(10);

    private record Entrada(long cantidad, long validoHastaMs) {
    }

    private final Map<LocalDate, Entrada> cache = new ConcurrentHashMap<>();

    /** Recuento guardado y todavía vigente de un día pasado, si lo hay. */
    public Optional<Long> guardado(LocalDate dia, long ahoraMs) {
        Entrada entrada = cache.get(dia);
        if (entrada == null || ahoraMs >= entrada.validoHastaMs()) {
            return Optional.empty();
        }
        return Optional.of(entrada.cantidad());
    }

    /** Guarda el recuento de un día solo si ya terminó (y pasó la gracia). Hoy y, al inicio, "ayer" no se guardan. */
    public void guardar(LocalDate dia, long cantidad, long ahoraMs) {
        LocalDate hoy = DiasBogota.dia(ahoraMs);
        if (!dia.isBefore(hoy)) {
            return;
        }
        long finDelDia = DiasBogota.inicio(dia.plusDays(1));
        if (ahoraMs < finDelDia + GRACIA.toMillis()) {
            return;
        }
        cache.put(dia, new Entrada(cantidad, DiasBogota.inicio(hoy.plusDays(1))));
    }

    /** Olvida los días que salieron de la ventana. */
    public void podar(LocalDate primerDiaDeLaVentana) {
        cache.keySet().removeIf(dia -> dia.isBefore(primerDiaDeLaVentana));
    }

    int tamano() {
        return cache.size();
    }
}
