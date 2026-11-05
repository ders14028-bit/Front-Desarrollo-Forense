package co.edu.escuelaing.dashboard.dominio;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Un caso de TheHive, con lo que usa el dashboard.
 *
 * <p>PENDIENTE: confirmar con datos reales (TheHive tiene 0 casos): nombres de {@code stage}/{@code status} y si
 * {@code endDate} es la fecha de cierre.
 *
 * @param etapa    {@code stage} (New, InProgress, Closed), o null
 * @param estado   {@code status} (TruePositive, FalsePositive…), o null
 * @param cerradoEn {@code endDate}, o null si no está cerrado
 */
public record Caso(String id, Integer numero, long creadoEn, String etapa, String estado, Long cerradoEn) {

    public static Caso desde(JsonNode nodo) {
        return new Caso(
                nodo.path("_id").asText(""),
                nodo.path("number").isNumber() ? nodo.path("number").asInt() : null,
                nodo.path("_createdAt").asLong(0),
                textoOpcional(nodo.path("stage")),
                textoOpcional(nodo.path("status")),
                nodo.path("endDate").isNumber() ? nodo.path("endDate").asLong() : null);
    }

    /** Duración hasta el cierre, o null si no tiene fecha de cierre o es anterior a la creación (dato incoherente). */
    public Long duracionMs() {
        if (cerradoEn == null || cerradoEn < creadoEn) {
            return null;
        }
        return cerradoEn - creadoEn;
    }

    private static String textoOpcional(JsonNode nodo) {
        return nodo.isTextual() && !nodo.asText().isBlank() ? nodo.asText() : null;
    }
}
