package co.edu.escuelaing.dashboard.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * Límites del cliente de TheHive: tiempos de espera, tamaño máximo de una respuesta y consultas simultáneas.
 * Los valores por defecto son los acordados: conexión 5 s, lectura 15 s, respuesta de 20 MB como máximo y 4 consultas
 * a la vez. Una consulta mal armada no debe poder tumbar la aplicación ni saturar a TheHive.
 */
@ConfigurationProperties(prefix = "dashboard.thehive.limites")
public record LimitesTheHive(Duration timeoutConexion, Duration timeoutLectura, DataSize maxRespuesta,
                             Integer maxConsultasSimultaneas) {

    public LimitesTheHive {
        timeoutConexion = timeoutConexion == null ? Duration.ofSeconds(5) : timeoutConexion;
        timeoutLectura = timeoutLectura == null ? Duration.ofSeconds(15) : timeoutLectura;
        maxRespuesta = maxRespuesta == null ? DataSize.ofMegabytes(20) : maxRespuesta;
        maxConsultasSimultaneas = maxConsultasSimultaneas == null ? 4 : maxConsultasSimultaneas;

        if (timeoutConexion.isZero() || timeoutConexion.isNegative() || timeoutLectura.isZero() || timeoutLectura.isNegative()) {
            throw new ConfiguracionInvalidaException(
                    "Los tiempos de espera de TheHive deben ser mayores que cero.",
                    "Corrige dashboard.thehive.limites.timeout-conexion y timeout-lectura en application.yml.");
        }
        if (maxRespuesta.toBytes() <= 0 || maxRespuesta.toBytes() > Integer.MAX_VALUE - 8) {
            throw new ConfiguracionInvalidaException(
                    "El tamaño máximo de una respuesta de TheHive debe estar entre 1 byte y 2 GB.",
                    "Corrige dashboard.thehive.limites.max-respuesta en application.yml.");
        }
        if (maxConsultasSimultaneas < 1 || maxConsultasSimultaneas > 32) {
            throw new ConfiguracionInvalidaException(
                    "El máximo de consultas simultáneas a TheHive debe estar entre 1 y 32.",
                    "Corrige dashboard.thehive.limites.max-consultas-simultaneas en application.yml.");
        }
    }
}
