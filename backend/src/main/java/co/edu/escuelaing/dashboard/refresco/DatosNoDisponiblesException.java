package co.edu.escuelaing.dashboard.refresco;

/** Todavía no hay ningún dato bueno que servir (TheHive no ha respondido desde que arrancó el backend). */
public class DatosNoDisponiblesException extends RuntimeException {

    public DatosNoDisponiblesException() {
        super("Todavía no hay datos de TheHive.");
    }
}
