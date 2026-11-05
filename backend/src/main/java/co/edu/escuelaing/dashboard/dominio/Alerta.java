package co.edu.escuelaing.dashboard.dominio;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;

/**
 * Una alerta de TheHive, con solo los campos que usa el dashboard. TheHive NO envía los campos que valen null
 * ({@code caseId}, {@code assignee}…): un campo ausente se trata igual que null, y nunca rompe la lectura.
 *
 * @param severidad 1 baja, 2 media, 3 alta, 4 crítica (un valor ausente o fuera de rango se acota a ese rango)
 * @param casoId    {@code caseId}, o {@code null} si la alerta no se ha convertido en caso
 */
public record Alerta(String id, long creadaEn, String tipo, String origen, String referencia, String titulo,
                     String descripcion, int severidad, String estado, List<String> etiquetas, String casoId) {

    /** {@code status = New}: nadie ha atendido la alerta (regla de negocio de CLAUDE.md). */
    public static final String ESTADO_SIN_ATENDER = "New";
    /** {@code status = Imported}: la alerta ya se convirtió en caso. NO se usa {@code _has case}: devuelve todas. */
    public static final String ESTADO_CONVERTIDA = "Imported";

    public Alerta {
        etiquetas = etiquetas == null ? List.of() : List.copyOf(etiquetas);
        severidad = Math.max(1, Math.min(4, severidad));
    }

    public boolean sinAtender() {
        return ESTADO_SIN_ATENDER.equals(estado);
    }

    public boolean tieneCaso() {
        return casoId != null;
    }

    public static Alerta desde(JsonNode nodo) {
        List<String> etiquetas = new ArrayList<>();
        for (JsonNode etiqueta : nodo.path("tags")) {
            if (etiqueta.isTextual()) {
                etiquetas.add(etiqueta.asText());
            }
        }
        String casoId = nodo.path("caseId").isTextual() && !nodo.path("caseId").asText().isBlank()
                ? nodo.path("caseId").asText() : null;
        return new Alerta(
                nodo.path("_id").asText(""),
                nodo.path("_createdAt").asLong(0),
                nodo.path("type").asText(""),
                nodo.path("source").asText(""),
                nodo.path("sourceRef").asText(""),
                nodo.path("title").asText(""),
                nodo.path("description").asText(""),
                nodo.path("severity").asInt(1),
                nodo.path("status").asText(""),
                etiquetas,
                casoId);
    }
}
