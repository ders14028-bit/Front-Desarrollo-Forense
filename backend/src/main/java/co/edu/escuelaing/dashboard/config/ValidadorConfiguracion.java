package co.edu.escuelaing.dashboard.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;

/**
 * Comprueba la configuración al arrancar y, si algo falta o es inválido, impide el arranque con un mensaje
 * claro. Nunca incluye la API key ni credenciales de una URL en los mensajes.
 */
@Component
public class ValidadorConfiguracion implements InitializingBean {

    private final ConfiguracionTheHive theHive;
    private final OrigenesPermitidos cors;
    private final SlaMinutos sla;

    public ValidadorConfiguracion(ConfiguracionTheHive theHive, OrigenesPermitidos cors, SlaMinutos sla) {
        this.theHive = theHive;
        this.cors = cors;
        this.sla = sla;
    }

    @Override
    public void afterPropertiesSet() {
        validar();
    }

    void validar() {
        if (!theHive.hayClave()) {
            throw new ConfiguracionInvalidaException(
                    "Falta la variable de entorno THEHIVE_API_KEY: sin ella no se puede consultar TheHive.",
                    "Define THEHIVE_API_KEY en el entorno antes de arrancar. Nunca la escribas en el código ni en un "
                            + "archivo versionado.");
        }
        if (theHive.url() == null || theHive.url().isBlank()) {
            throw new ConfiguracionInvalidaException(
                    "Falta la variable de entorno THEHIVE_URL (la dirección de TheHive).",
                    "Define THEHIVE_URL con la URL base de TheHive, por ejemplo https://servidor:puerto.");
        }
        if (!esUrlHttp(theHive.url())) {
            // No se imprime el valor: una URL podría traer usuario y contraseña.
            throw new ConfiguracionInvalidaException(
                    "THEHIVE_URL no es una URL http o https válida (sin usuario ni contraseña incrustados).",
                    "Corrige THEHIVE_URL: debe ser algo como https://servidor:puerto.");
        }
        if (theHive.organizacion() == null || theHive.organizacion().isBlank()) {
            throw new ConfiguracionInvalidaException(
                    "THEHIVE_ORG está vacía: es la organización fija que se envía en X-Organisation.",
                    "Define THEHIVE_ORG (por ejemplo, escuelaing) o quita la variable para usar el valor por defecto.");
        }

        List<String> invalidos = new ArrayList<>();
        for (String origen : cors.origenes()) {
            if (!esOrigenValido(origen)) {
                invalidos.add(origen);
            }
        }
        if (cors.origenes().isEmpty() || !invalidos.isEmpty()) {
            throw new ConfiguracionInvalidaException(
                    cors.origenes().isEmpty()
                            ? "DASHBOARD_ORIGINS no define ningún origen del frontend."
                            : "DASHBOARD_ORIGINS tiene orígenes inválidos: " + invalidos
                                    + ". Cada uno debe ser esquema://host[:puerto], sin ruta y sin comodines.",
                    "Corrige DASHBOARD_ORIGINS (varios orígenes separados por comas), por ejemplo "
                            + "http://localhost:5173.");
        }

        if (sla.critica() <= 0 || sla.alta() <= 0 || sla.media() <= 0 || sla.baja() <= 0) {
            throw new ConfiguracionInvalidaException(
                    "El SLA de cada severidad debe ser un número de minutos mayor que cero.",
                    "Corrige dashboard.sla-minutos en application.yml.");
        }
    }

    static boolean esUrlHttp(String valor) {
        try {
            URI uri = new URI(valor.trim());
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null
                    && uri.getUserInfo() == null;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    /** esquema://host[:puerto] (con o sin barra final): sin ruta, sin consulta, sin comodines y sin usuario. */
    static boolean esOrigenValido(String valor) {
        if (valor.contains("*")) {
            return false;
        }
        try {
            URI uri = new URI(valor);
            boolean esquemaOk = "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
            // Una barra final ("http://localhost:5173/") es habitual y Spring la normaliza; cualquier otra ruta, no.
            boolean sinRuta = uri.getRawPath() == null || uri.getRawPath().isEmpty() || uri.getRawPath().equals("/");
            return esquemaOk && uri.getHost() != null && uri.getUserInfo() == null && sinRuta
                    && uri.getRawQuery() == null && uri.getRawFragment() == null;
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
