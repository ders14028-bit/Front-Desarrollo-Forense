package co.edu.escuelaing.dashboard.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS: solo los orígenes configurados (DASHBOARD_ORIGINS, por defecto http://localhost:5173), solo el método GET
 * y sin credenciales. La API es de solo lectura: no se permite ningún otro método.
 */
@Configuration
public class ConfiguracionWeb implements WebMvcConfigurer {

    private final OrigenesPermitidos origenes;

    public ConfiguracionWeb(OrigenesPermitidos origenes) {
        this.origenes = origenes;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(origenes.origenes().toArray(String[]::new))
                .allowedMethods("GET")
                .allowedHeaders("Accept", "Content-Type")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
