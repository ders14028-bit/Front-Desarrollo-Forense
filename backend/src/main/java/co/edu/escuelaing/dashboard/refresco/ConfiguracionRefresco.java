package co.edu.escuelaing.dashboard.refresco;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Refresco en segundo plano ({@code dashboard.refresco} en application.yml).
 *
 * @param intervalo           tiempo entre el fin de un refresco y el inicio del siguiente (30 s)
 * @param esperaPrimeraCarga  cuánto espera una petición que llega antes de que haya un primer dato (arranque en frío)
 * @param listaEnSegundoPlano si es true, el refresco también calcula la lista de alertas (consulta extra a TheHive en
 *                            cada ciclo); por defecto false: la lista se calcula bajo demanda en {@code GET /alertas}
 */
@ConfigurationProperties(prefix = "dashboard.refresco")
public record ConfiguracionRefresco(Duration intervalo, Duration esperaPrimeraCarga, Boolean listaEnSegundoPlano) {

    public ConfiguracionRefresco {
        intervalo = intervalo == null || intervalo.isNegative() || intervalo.isZero() ? Duration.ofSeconds(30) : intervalo;
        esperaPrimeraCarga = esperaPrimeraCarga == null || esperaPrimeraCarga.isNegative() ? Duration.ofSeconds(20) : esperaPrimeraCarga;
        listaEnSegundoPlano = listaEnSegundoPlano != null && listaEnSegundoPlano;
    }
}
