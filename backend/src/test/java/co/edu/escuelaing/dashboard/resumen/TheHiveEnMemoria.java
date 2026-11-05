package co.edu.escuelaing.dashboard.resumen;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * Un "TheHive" mínimo en memoria, servido por HTTP en 127.0.0.1, que ENTIENDE las consultas que hace el backend:
 * listAlert / listCase / listTask, filter (_eq, _ne, _gt, _gte, _lt, _lte, _like, _and, _or, _not), sort, page, count y
 * aggregation (field y avg). Las cifras salen de los datos, no de respuestas escritas a mano, así que una consulta mal
 * armada da una cifra equivocada y la prueba falla. Un operador desconocido (por ejemplo {@code _has}) responde 400,
 * como TheHive. Registra todas las consultas recibidas.
 */
public final class TheHiveEnMemoria implements AutoCloseable {

    private static final ObjectMapper JSON = new ObjectMapper();

    public final List<ObjectNode> alertas = new CopyOnWriteArrayList<>();
    public final List<ObjectNode> casos = new CopyOnWriteArrayList<>();
    public final List<ObjectNode> tareas = new CopyOnWriteArrayList<>();
    public final List<JsonNode> consultas = new CopyOnWriteArrayList<>();
    /** Si no es 0, todas las consultas responden con ese código HTTP (para simular una caída). */
    public volatile int codigoForzado = 0;
    /** Si es >= 0, las consultas posteriores a esa cantidad responden 500 (para simular una caída a mitad de una carga). */
    public volatile int fallarTrasConsultas = -1;

    private final HttpServer servidor;

    public TheHiveEnMemoria() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        servidor.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        servidor.createContext("/api/v1/query", intercambio -> {
            byte[] cuerpo = intercambio.getRequestBody().readAllBytes();
            int codigo = 200;
            String respuesta;
            try {
                JsonNode consulta = JSON.readTree(cuerpo);
                consultas.add(consulta);
                if (codigoForzado != 0 || (fallarTrasConsultas >= 0 && consultas.size() > fallarTrasConsultas)) {
                    codigo = codigoForzado != 0 ? codigoForzado : 500;
                    respuesta = "{\"type\":\"Error\",\"message\":\"simulado\"}";
                } else {
                    respuesta = JSON.writeValueAsString(evaluar(consulta.path("query")));
                }
            } catch (IllegalArgumentException e) {
                codigo = 400;
                respuesta = JSON.writeValueAsString(Map.of("type", "InvalidFormatAttributeError", "message", e.getMessage()));
            }
            byte[] bytes = respuesta.getBytes(StandardCharsets.UTF_8);
            intercambio.getResponseHeaders().set("Content-Type", "application/json"); // sin charset, como TheHive
            intercambio.sendResponseHeaders(codigo, bytes.length);
            intercambio.getResponseBody().write(bytes);
            intercambio.close();
        });
        servidor.start();
    }

    public String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort();
    }

    @Override
    public void close() {
        servidor.stop(0);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Datos
    // ---------------------------------------------------------------------------------------------------------

    public static ObjectNode alerta(String id, long creadaEn, int severidad, String estado, String origen, String tipo, String descripcion,
                             String... etiquetas) {
        ObjectNode a = JSON.createObjectNode();
        a.put("_id", id);
        a.put("_type", "Alert");
        a.put("_createdAt", creadaEn);
        a.put("type", tipo);
        a.put("source", origen);
        a.put("sourceRef", id + "-ref");
        a.put("title", "Alerta " + id);
        a.put("description", descripcion);
        a.put("severity", severidad);
        a.put("status", estado);
        a.put("stage", estado);
        ArrayNode tags = a.putArray("tags");
        for (String etiqueta : etiquetas) {
            tags.add(etiqueta);
        }
        return a;
    }

    public static ObjectNode caso(String id, long creadoEn, String etapa, String estado, Long cerradoEn, String... etiquetas) {
        ObjectNode c = JSON.createObjectNode();
        c.put("_id", id);
        c.put("_type", "case");
        c.put("_createdAt", creadoEn);
        c.put("number", Math.abs(id.hashCode() % 1000));
        c.put("stage", etapa);
        c.put("status", estado);
        if (cerradoEn != null) {
            c.put("endDate", cerradoEn);
        }
        ArrayNode tags = c.putArray("tags");
        for (String etiqueta : etiquetas) {
            tags.add(etiqueta);
        }
        return c;
    }

    public static ObjectNode tarea(String id, String grupo, String estado) {
        ObjectNode t = JSON.createObjectNode();
        t.put("_id", id);
        t.put("_type", "task");
        t.put("group", grupo);
        t.put("status", estado);
        return t;
    }

    public static ObjectNode tareaDeCaso(String id, String caseId, String grupo, String estado) {
        ObjectNode t = tarea(id, grupo, estado);
        t.put("caseId", caseId);
        return t;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Evaluación
    // ---------------------------------------------------------------------------------------------------------

    private JsonNode evaluar(JsonNode operaciones) {
        List<JsonNode> datos = null;
        for (JsonNode operacion : operaciones) {
            String nombre = operacion.path("_name").asText();
            switch (nombre) {
                case "listAlert" -> datos = new ArrayList<>(alertas);
                case "listCase" -> datos = new ArrayList<>(casos);
                case "listTask" -> datos = new ArrayList<>(tareas);
                case "getAlert", "getCase" -> {
                    // Como TheHive: un id inexistente responde 200 con resultado vacío (no 404).
                    List<ObjectNode> fuente = nombre.equals("getAlert") ? alertas : casos;
                    datos = new ArrayList<>(fuente.stream().filter(d -> d.path("_id").asText().equals(operacion.path("idOrName").asText())).toList());
                }
                case "tasks" -> {
                    List<JsonNode> delCaso = new ArrayList<>();
                    for (JsonNode caso : datos) {
                        tareas.stream().filter(t -> t.path("caseId").asText().equals(caso.path("_id").asText())).forEach(delCaso::add);
                    }
                    datos = delCaso;
                }
                case "filter" -> {
                    List<JsonNode> filtrados = new ArrayList<>();
                    for (JsonNode d : datos) {
                        if (cumpleTodo(operacion, d)) {
                            filtrados.add(d);
                        }
                    }
                    datos = filtrados;
                }
                case "sort" -> {
                    var campo = operacion.path("_fields").get(0).properties().iterator().next();
                    Comparator<JsonNode> orden = Comparator.comparingDouble(d -> d.path(campo.getKey()).asDouble());
                    datos = new ArrayList<>(datos);
                    datos.sort("desc".equals(campo.getValue().asText()) ? orden.reversed() : orden);
                }
                case "page" -> {
                    int desde = Math.min(operacion.path("from").asInt(), datos.size());
                    int hasta = Math.min(operacion.path("to").asInt(), datos.size());
                    datos = new ArrayList<>(datos.subList(desde, hasta));
                }
                case "count" -> {
                    return JSON.getNodeFactory().numberNode((long) datos.size());
                }
                case "aggregation" -> {
                    return agregar(operacion, datos);
                }
                default -> throw new IllegalArgumentException("Operación desconocida: " + nombre);
            }
        }
        ArrayNode lista = JSON.createArrayNode();
        datos.forEach(lista::add);
        return lista;
    }

    private JsonNode agregar(JsonNode operacion, List<JsonNode> datos) {
        String campo = operacion.path("_field").asText();
        if ("avg".equals(operacion.path("_agg").asText())) {
            double media = datos.stream().mapToDouble(d -> d.path(campo).asDouble()).average().orElse(0);
            ObjectNode r = JSON.createObjectNode();
            r.put("avg_" + campo, media);
            return r;
        }
        if (!operacion.has("_size")) {
            throw new IllegalArgumentException("Falta _size");
        }
        Map<String, Long> cuentas = new LinkedHashMap<>();
        for (JsonNode d : datos) {
            JsonNode valor = d.path(campo);
            if (valor.isArray()) {
                valor.forEach(v -> cuentas.merge(v.asText(), 1L, Long::sum));
            } else if (!valor.isMissingNode()) {
                cuentas.merge(valor.asText(), 1L, Long::sum);
            }
        }
        long total = cuentas.values().stream().mapToLong(Long::longValue).sum();
        int tamano = operacion.path("_size").asInt();
        ArrayNode lista = JSON.createArrayNode();
        cuentas.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(tamano).forEach(e -> {
            ObjectNode cubeta = lista.addObject();
            cubeta.put("_key", e.getKey());
            cubeta.put("count", e.getValue());
        });
        ObjectNode ultimo = lista.addObject();
        ultimo.put("_key", "_total");
        ultimo.put("count", total);
        ObjectNode r = JSON.createObjectNode();
        r.set("field_" + campo, lista);
        return r;
    }

    /** El paso {@code filter} trae el filtro en sus propios campos (junto a {@code _name}). */
    private boolean cumpleTodo(JsonNode filtro, JsonNode dato) {
        for (var campo : filtro.properties()) {
            if (campo.getKey().equals("_name")) {
                continue;
            }
            if (!cumple(campo.getKey(), campo.getValue(), dato)) {
                return false;
            }
        }
        return true;
    }

    private boolean cumple(String operador, JsonNode argumento, JsonNode dato) {
        switch (operador) {
            case "_and" -> {
                for (JsonNode f : argumento) {
                    if (!cumpleTodo(f, dato)) {
                        return false;
                    }
                }
                return true;
            }
            case "_or" -> {
                for (JsonNode f : argumento) {
                    if (cumpleTodo(f, dato)) {
                        return true;
                    }
                }
                return false;
            }
            case "_not" -> {
                return !cumpleTodo(argumento, dato);
            }
            case "_eq", "_ne", "_gt", "_gte", "_lt", "_lte", "_like" -> {
                JsonNode valorCampo = dato.path(argumento.path("_field").asText());
                JsonNode esperado = argumento.path("_value");
                return switch (operador) {
                    case "_eq" -> igual(valorCampo, esperado);
                    case "_ne" -> !igual(valorCampo, esperado);
                    case "_gt" -> valorCampo.asDouble() > esperado.asDouble();
                    case "_gte" -> valorCampo.asDouble() >= esperado.asDouble();
                    case "_lt" -> valorCampo.asDouble() < esperado.asDouble();
                    case "_lte" -> valorCampo.asDouble() <= esperado.asDouble();
                    default -> parecido(valorCampo, esperado.asText());
                };
            }
            default -> throw new IllegalArgumentException("Operador desconocido: " + operador);
        }
    }

    private static boolean igual(JsonNode valorCampo, JsonNode esperado) {
        if (valorCampo.isArray()) {
            for (JsonNode v : valorCampo) {
                if (v.asText().equals(esperado.asText())) {
                    return true;
                }
            }
            return false;
        }
        return !valorCampo.isMissingNode() && valorCampo.asText().equals(esperado.asText());
    }

    private static boolean parecido(JsonNode valorCampo, String patron) {
        Pattern regex = Pattern.compile(Pattern.quote(patron).replace("*", "\\E.*\\Q"));
        if (valorCampo.isArray()) {
            for (JsonNode v : valorCampo) {
                if (regex.matcher(v.asText()).matches()) {
                    return true;
                }
            }
            return false;
        }
        return regex.matcher(valorCampo.asText()).matches();
    }

    // ---------------------------------------------------------------------------------------------------------
    // Consultas recibidas
    // ---------------------------------------------------------------------------------------------------------

    public List<String> consultasComoTexto() {
        return consultas.stream().map(JsonNode::toString).toList();
    }

    public long contarConsultas(java.util.function.Predicate<JsonNode> condicion) {
        return consultas.stream().filter(condicion).count();
    }

    /** ¿La consulta usa ese operador sobre ese campo, en cualquier parte de sus filtros? */
    public static boolean usa(JsonNode nodo, String operador, String campo) {
        return usaValor(nodo, operador, campo, null);
    }

    /** ¿La consulta usa ese operador sobre ese campo con ese valor (texto)? {@code valor == null} = cualquiera. */
    public static boolean usaValor(JsonNode nodo, String operador, String campo, String valor) {
        if (nodo.isObject()) {
            JsonNode uso = nodo.get(operador);
            if (uso != null && campo.equals(uso.path("_field").asText()) && (valor == null || valor.equals(uso.path("_value").asText()))) {
                return true;
            }
        }
        for (JsonNode hijo : nodo) {
            if (usaValor(hijo, operador, campo, valor)) {
                return true;
            }
        }
        return false;
    }

    /** TODOS los valores numéricos de un operador sobre un campo, en cualquier parte de la consulta. */
    public static java.util.List<Long> valoresNumericos(JsonNode nodo, String operador, String campo) {
        var valores = new java.util.ArrayList<Long>();
        recolectar(nodo, operador, campo, valores);
        return valores;
    }

    private static void recolectar(JsonNode nodo, String operador, String campo, java.util.List<Long> valores) {
        if (nodo.isObject()) {
            JsonNode uso = nodo.get(operador);
            if (uso != null && campo.equals(uso.path("_field").asText())) {
                valores.add(uso.path("_value").asLong());
            }
        }
        for (JsonNode hijo : nodo) {
            recolectar(hijo, operador, campo, valores);
        }
    }

    /** Valor numérico de un operador sobre un campo (el primero que aparezca), o null. */
    public static Long valorNumerico(JsonNode nodo, String operador, String campo) {
        if (nodo.isObject()) {
            JsonNode uso = nodo.get(operador);
            if (uso != null && campo.equals(uso.path("_field").asText())) {
                return uso.path("_value").asLong();
            }
        }
        for (JsonNode hijo : nodo) {
            Long v = valorNumerico(hijo, operador, campo);
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    public static boolean es(JsonNode consulta, String origen, String ultimaOperacion) {
        JsonNode ops = consulta.path("query");
        return origen.equals(ops.get(0).path("_name").asText())
                && ultimaOperacion.equals(ops.get(ops.size() - 1).path("_name").asText());
    }

    public static boolean esAgregacion(JsonNode consulta) {
        JsonNode ops = consulta.path("query");
        return "aggregation".equals(ops.get(ops.size() - 1).path("_name").asText());
    }
}
