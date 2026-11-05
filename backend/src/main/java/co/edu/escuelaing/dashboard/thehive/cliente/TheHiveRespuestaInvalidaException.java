package co.edu.escuelaing.dashboard.thehive.cliente;

/** La respuesta de TheHive no es utilizable: JSON inválido, demasiado grande, redirección o un código inesperado. */
public class TheHiveRespuestaInvalidaException extends TheHiveException {

    public TheHiveRespuestaInvalidaException(String mensaje) {
        super(mensaje);
    }
}
