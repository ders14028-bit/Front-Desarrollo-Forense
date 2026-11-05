package co.edu.escuelaing.dashboard.wazuh;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Sincronización de las alertas de Wazuh ({@code dashboard.wazuh} en application.yml).
 *
 * @param diasVentana  días (Bogotá, contando hoy) que se guardan en memoria
 * @param tamanoPagina alertas por página al pedirlas a TheHive (máximo 1000)
 * @param solape       cuánto se retrocede desde la última alerta vista en cada sincronización incremental: cubre las que
 *                     TheHive tarda en dejar consultables; las repetidas se descartan por {@code _id}
 * @param topN         cuántos elementos tienen los rankings (IPs, usuarios, reglas…)
 * @param tipoAlerta   {@code type} de las alertas que vienen de Wazuh
 */
@ConfigurationProperties(prefix = "dashboard.wazuh")
public record ConfiguracionWazuh(Integer diasVentana, Integer tamanoPagina, Duration solape, Integer topN, String tipoAlerta) {

    public ConfiguracionWazuh {
        diasVentana = diasVentana == null || diasVentana < 1 || diasVentana > 30 ? 7 : diasVentana;
        tamanoPagina = tamanoPagina == null || tamanoPagina < 1 || tamanoPagina > 1000 ? 500 : tamanoPagina;
        solape = solape == null || solape.isNegative() ? Duration.ofSeconds(60) : solape;
        topN = topN == null || topN < 1 || topN > 100 ? 10 : topN;
        tipoAlerta = tipoAlerta == null || tipoAlerta.isBlank() ? "wazuh" : tipoAlerta.strip();
    }
}
