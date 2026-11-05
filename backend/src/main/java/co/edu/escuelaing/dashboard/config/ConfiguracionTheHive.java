package co.edu.escuelaing.dashboard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Conexión con TheHive. Todo sale de variables de entorno (ver application.yml).
 *
 * <p>La key NUNCA aparece en {@link #toString()}: este objeto puede acabar en un log o en un mensaje de error.
 * {@code organizacion} (X-Organisation) es fija: ninguna petición del frontend puede cambiarla.
 */
@ConfigurationProperties(prefix = "dashboard.thehive")
public record ConfiguracionTheHive(String url, String apiKey, String organizacion) {

    public boolean hayClave() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public String toString() {
        return "ConfiguracionTheHive[url=" + url + ", apiKey=" + (hayClave() ? "********" : "(sin definir)")
                + ", organizacion=" + organizacion + "]";
    }
}
