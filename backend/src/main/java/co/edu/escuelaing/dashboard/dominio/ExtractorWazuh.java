package co.edu.escuelaing.dashboard.dominio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrae el JSON que Wazuh deja dentro de la {@code description} de la alerta
 * ({@code Alerta recibida desde Wazuh Manager.\n\n```json\n{...}\n```}).
 *
 * <p>Nunca lanza excepciones por el contenido: sin bloque, con JSON roto o con campos ausentes devuelve lo que haya
 * (o vacío). Una sola alerta mal formada no puede romper un resumen ni una sincronización.
 */
public final class ExtractorWazuh {

    private static final Pattern BLOQUE = Pattern.compile("```json\\s*([\\s\\S]*?)```");
    private static final ObjectMapper JSON = new ObjectMapper();
    /** Campos de {@code datos} que el dashboard usa; el resto de {@code datos} cambia según la regla y se ignora. */
    private static final List<String> CAMPOS_DATOS = List.of("srcip", "srcport", "srcuser", "dstuser", "dstip", "uid", "euid", "tty");
    private static final List<String> NORMATIVAS = List.of("pci_dss", "nist_800_53", "gdpr", "hipaa", "tsc", "gpg13");

    private ExtractorWazuh() {
    }

    /** {@code Optional.empty()} si la descripción no trae un bloque JSON legible (objeto). */
    public static Optional<DatosWazuh> extraer(String descripcion) {
        if (descripcion == null || descripcion.isBlank()) {
            return Optional.empty();
        }
        Matcher bloque = BLOQUE.matcher(descripcion);
        if (!bloque.find()) {
            return Optional.empty();
        }
        JsonNode raiz;
        try {
            raiz = JSON.readTree(bloque.group(1));
        } catch (JsonProcessingException e) {
            return Optional.empty();
        }
        if (raiz == null || !raiz.isObject()) {
            return Optional.empty();
        }

        JsonNode regla = raiz.path("regla");
        JsonNode mitre = regla.path("mitre");
        JsonNode agente = raiz.path("agente");
        JsonNode datos = raiz.path("datos");

        Map<String, List<String>> cumplimiento = new LinkedHashMap<>();
        for (String normativa : NORMATIVAS) {
            List<String> valores = textos(regla.path(normativa));
            if (!valores.isEmpty()) {
                cumplimiento.put(normativa, valores);
            }
        }
        Map<String, String> datosUsados = new LinkedHashMap<>();
        for (String campo : CAMPOS_DATOS) {
            String valor = texto(datos.path(campo));
            if (valor != null) {
                datosUsados.put(campo, valor);
            }
        }

        return Optional.of(new DatosWazuh(
                texto(raiz.path("fechaWazuh")),
                texto(regla.path("id")),
                regla.path("level").isNumber() ? regla.path("level").asInt() : null,
                texto(regla.path("description")),
                textos(mitre.path("id")),
                textos(mitre.path("tactic")),
                textos(mitre.path("technique")),
                textos(regla.path("groups")),
                cumplimiento,
                texto(agente.path("id")),
                texto(agente.path("name")),
                texto(agente.path("ip")),
                texto(raiz.path("ubicacion")),
                datosUsados));
    }

    /** Valor simple como texto, o null si falta, es null o no es un valor simple. Los espacios sobrantes se quitan. */
    private static String texto(JsonNode nodo) {
        if (nodo == null || !nodo.isValueNode() || nodo.isNull() || nodo.isMissingNode()) {
            return null;
        }
        String valor = nodo.asText().strip();
        return valor.isEmpty() ? null : valor;
    }

    private static List<String> textos(JsonNode nodo) {
        List<String> lista = new ArrayList<>();
        if (nodo != null && nodo.isArray()) {
            for (JsonNode elemento : nodo) {
                String valor = texto(elemento);
                if (valor != null) {
                    lista.add(valor);
                }
            }
        }
        return lista;
    }
}
