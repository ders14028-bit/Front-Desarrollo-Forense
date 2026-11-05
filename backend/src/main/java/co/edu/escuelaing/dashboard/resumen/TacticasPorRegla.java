package co.edu.escuelaing.dashboard.resumen;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Caché {@code regla de Wazuh → táctica MITRE} (ya en español). Se llena con UNA alerta de muestra por regla: la
 * regla fija su MITRE, así que no hace falta leer las 23.000 alertas. Distingue tres estados:
 * <ul>
 *   <li>no se sabe (nunca se muestreó, o venció);</li>
 *   <li>se sabe que la regla tiene táctica (vigente 6 h);</li>
 *   <li>se sabe que NO tiene (vigente 10 min: la muestra pudo no traer el bloque, se reintenta pronto).</li>
 * </ul>
 */
@Component
public class TacticasPorRegla {

    static final Duration VIGENCIA_CON_TACTICA = Duration.ofHours(6);
    static final Duration VIGENCIA_SIN_TACTICA = Duration.ofMinutes(10);

    private record Entrada(String tactica, long venceMs) {
    }

    private final Map<String, Entrada> cache = new ConcurrentHashMap<>();
    private final Clock reloj;

    public TacticasPorRegla(Clock reloj) {
        this.reloj = reloj;
    }

    /** {@code true} si ya se sabe (con o sin táctica) y sigue vigente. */
    public boolean sabe(String reglaId) {
        Entrada entrada = cache.get(reglaId);
        return entrada != null && reloj.millis() < entrada.venceMs();
    }

    /** La táctica de la regla si se conoce y tiene; vacío si no se sabe o se sabe que no tiene. */
    public Optional<String> tactica(String reglaId) {
        Entrada entrada = cache.get(reglaId);
        if (entrada == null || reloj.millis() >= entrada.venceMs()) {
            return Optional.empty();
        }
        return Optional.ofNullable(entrada.tactica());
    }

    public void guardar(String reglaId, Optional<String> tactica) {
        long vigencia = tactica.isPresent() ? VIGENCIA_CON_TACTICA.toMillis() : VIGENCIA_SIN_TACTICA.toMillis();
        cache.put(reglaId, new Entrada(tactica.orElse(null), reloj.millis() + vigencia));
    }
}
