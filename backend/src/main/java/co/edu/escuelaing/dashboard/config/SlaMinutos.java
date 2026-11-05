package co.edu.escuelaing.dashboard.config;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * SLA de atención por severidad, en minutos (regla de negocio de CLAUDE.md). Vive en la configuración, no en el
 * código, y se expone en {@code GET /api/dashboard/configuracion}.
 */
@ConfigurationProperties(prefix = "dashboard.sla-minutos")
public record SlaMinutos(int critica, int alta, int media, int baja) {

    /** Minutos de SLA de una severidad de TheHive: 4 crítica, 3 alta, 2 media, 1 baja. */
    public int porSeveridad(int severidad) {
        return switch (severidad) {
            case 4 -> critica;
            case 3 -> alta;
            case 2 -> media;
            case 1 -> baja;
            default -> throw new IllegalArgumentException("Severidad desconocida: " + severidad);
        };
    }

    /** Clave = severidad ("1" baja … "4" crítica), en ese orden. */
    public Map<String, Integer> comoMapa() {
        var mapa = new LinkedHashMap<String, Integer>();
        for (int severidad = 1; severidad <= 4; severidad++) {
            mapa.put(String.valueOf(severidad), porSeveridad(severidad));
        }
        return mapa;
    }
}
