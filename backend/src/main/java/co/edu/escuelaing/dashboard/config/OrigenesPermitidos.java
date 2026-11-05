package co.edu.escuelaing.dashboard.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Orígenes del frontend a los que se les permite llamar a la API (CORS). Variable DASHBOARD_ORIGINS. */
@ConfigurationProperties(prefix = "dashboard.cors")
public record OrigenesPermitidos(List<String> origenes) {

    public OrigenesPermitidos {
        origenes = origenes == null ? List.of() : origenes.stream().map(String::trim).filter(o -> !o.isEmpty()).toList();
    }
}
