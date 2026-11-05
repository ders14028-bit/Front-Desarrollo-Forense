package co.edu.escuelaing.dashboard.thehive.cliente;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;

/**
 * Resultado de una agregación por campo: {@code {"field_source":[{"_key":"wazuh","count":23091}, ...,
 * {"_key":"_total","count":23121}]}}.
 *
 * @param truncada {@code true} si TheHive devolvió tantos valores como se pidieron (el tope): puede haber más y el
 *                 resultado no se debe presentar como completo.
 */
public record ResultadoAgregacion(String campo, List<Cubeta> cubetas, long total, boolean truncada) {

    public record Cubeta(String clave, long cantidad) {
    }

    static ResultadoAgregacion de(JsonNode respuesta, int tamanoPedido) {
        if (respuesta == null || !respuesta.isObject() || respuesta.size() != 1) {
            throw new TheHiveRespuestaInvalidaException("La respuesta de TheHive no tiene la forma de una agregación.");
        }
        var entrada = respuesta.fields().next();
        JsonNode lista = entrada.getValue();
        if (!lista.isArray()) {
            throw new TheHiveRespuestaInvalidaException("La respuesta de TheHive no tiene la forma de una agregación.");
        }
        String nombre = entrada.getKey().startsWith("field_") ? entrada.getKey().substring("field_".length()) : entrada.getKey();

        var cubetas = new ArrayList<Cubeta>();
        long total = -1;
        for (JsonNode elemento : lista) {
            String clave = elemento.path("_key").asText();
            long cantidad = elemento.path("count").asLong();
            if ("_total".equals(clave)) {
                total = cantidad;
            } else {
                cubetas.add(new Cubeta(clave, cantidad));
            }
        }
        boolean truncada = tamanoPedido > 0 && cubetas.size() >= tamanoPedido;
        return new ResultadoAgregacion(nombre, List.copyOf(cubetas), total, truncada);
    }
}
