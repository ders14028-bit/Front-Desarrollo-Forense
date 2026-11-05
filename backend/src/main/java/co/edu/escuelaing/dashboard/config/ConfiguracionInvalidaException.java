package co.edu.escuelaing.dashboard.config;

/**
 * La configuración es inválida y la aplicación no debe arrancar. El texto NUNCA incluye valores secretos
 * (ni la API key ni credenciales dentro de una URL): solo dice qué falta y cómo arreglarlo.
 */
public class ConfiguracionInvalidaException extends RuntimeException {

    private final String accion;

    public ConfiguracionInvalidaException(String problema, String accion) {
        super(problema);
        this.accion = accion;
    }

    public String getProblema() {
        return getMessage();
    }

    public String getAccion() {
        return accion;
    }
}
