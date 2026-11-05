package co.edu.escuelaing.dashboard.thehive.cliente;

/** TheHive respondió 400: no entendió la consulta. El mensaje incluye el tipo y el texto de error de TheHive. */
public class TheHiveConsultaInvalidaException extends TheHiveException {

    public TheHiveConsultaInvalidaException(String detalle) {
        super("TheHive rechazó la consulta (HTTP 400): " + detalle);
    }
}
