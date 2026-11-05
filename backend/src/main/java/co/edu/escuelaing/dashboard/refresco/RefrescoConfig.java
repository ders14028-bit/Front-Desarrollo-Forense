package co.edu.escuelaing.dashboard.refresco;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Activa la programación del refresco. {@code dashboard.refresco.activo=false} la apaga (las pruebas de la API la apagan
 * para no consultar a TheHive en segundo plano).
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "dashboard.refresco.activo", havingValue = "true", matchIfMissing = true)
public class RefrescoConfig {
}
