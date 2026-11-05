package co.edu.escuelaing.dashboard.thehive.cliente;

/**
 * No se pudo establecer la conexión TLS con TheHive: el certificado no es confiable para Java (típico de un JDK que no
 * reconoce la cadena nueva de Let's Encrypt). Nunca se arregla desactivando la validación: ver el README.
 */
public class TheHiveCertificadoException extends TheHiveNoRespondeException {

    public static final String MENSAJE = "TheHive no es alcanzable: certificado no confiable. "
            + "Si tu JDK no reconoce la cadena nueva de Let's Encrypt, arranca con Windows-ROOT "
            + "o actualiza el JDK 21 (ver README).";

    public TheHiveCertificadoException() {
        super(MENSAJE);
    }

    public TheHiveCertificadoException(String mensaje) {
        super(mensaje);
    }
}
