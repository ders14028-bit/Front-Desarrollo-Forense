package co.edu.escuelaing.dashboard.dominio;

import co.edu.escuelaing.dashboard.config.SlaMinutos;

/**
 * SLA de una alerta, con la forma del contrato ({@code AlertaFila.sla}).
 *
 * @param estado    {@code "dentro"}, {@code "fuera"}, o {@code null} si no aplica (la alerta no está {@code New})
 * @param limiteMin SLA de su severidad, siempre presente
 * @param excesoMs  antigüedad − límite, solo si {@code estado = "fuera"}
 */
public record EstadoSla(String estado, int limiteMin, Long excesoMs) {

    private static final long MS_POR_MINUTO = 60_000L;

    /**
     * Fuera de SLA = sin atender cuya antigüedad es ESTRICTAMENTE mayor que el SLA de su severidad: justo en el
     * límite todavía está a tiempo.
     */
    public static EstadoSla evaluar(Alerta alerta, long ahora, SlaMinutos sla) {
        int limite = sla.porSeveridad(alerta.severidad());
        if (!alerta.sinAtender()) {
            return new EstadoSla(null, limite, null);
        }
        long antiguedad = antiguedadMs(alerta, ahora);
        long limiteMs = limite * MS_POR_MINUTO;
        if (antiguedad > limiteMs) {
            return new EstadoSla("fuera", limite, antiguedad - limiteMs);
        }
        return new EstadoSla("dentro", limite, null);
    }

    /** {@code max(0, ahora − creadaEn)}: una alerta con fecha futura (reloj desfasado) no tiene antigüedad negativa. */
    public static long antiguedadMs(Alerta alerta, long ahora) {
        return Math.max(0, ahora - alerta.creadaEn());
    }
}
