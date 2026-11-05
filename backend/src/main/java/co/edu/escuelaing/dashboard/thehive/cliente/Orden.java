package co.edu.escuelaing.dashboard.thehive.cliente;

/** Sentido de un {@code sort}. */
public enum Orden {
    ASCENDENTE("asc"),
    DESCENDENTE("desc");

    private final String valor;

    Orden(String valor) {
        this.valor = valor;
    }

    public String valor() {
        return valor;
    }
}
