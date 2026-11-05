package co.edu.escuelaing.dashboard.thehive.cliente;

/** TheHive respondió 401 o 403: la key o la organización no son válidas. */
public class TheHiveCredencialesException extends TheHiveException {

    public TheHiveCredencialesException() {
        super("TheHive rechazó las credenciales (revisa THEHIVE_API_KEY y THEHIVE_ORG).");
    }
}
