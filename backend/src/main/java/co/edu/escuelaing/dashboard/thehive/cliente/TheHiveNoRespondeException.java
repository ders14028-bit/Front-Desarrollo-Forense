package co.edu.escuelaing.dashboard.thehive.cliente;

/** TheHive no respondió: sin red, tiempo de espera agotado o un error del servidor (5xx). */
public class TheHiveNoRespondeException extends TheHiveException {

    public TheHiveNoRespondeException(String mensaje) {
        super(mensaje);
    }
}
