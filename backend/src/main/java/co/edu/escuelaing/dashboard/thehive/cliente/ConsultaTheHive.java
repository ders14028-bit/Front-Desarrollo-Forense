package co.edu.escuelaing.dashboard.thehive.cliente;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Consulta de LECTURA a {@code POST /api/v1/query}: una lista de operaciones encadenadas.
 *
 * <p>Solo se aceptan las operaciones de la lista blanca {@link #OPERACIONES_PERMITIDAS}. Cualquier otra se rechaza con
 * {@link ConsultaNoPermitidaException} antes de enviar nada. La consulta es inmutable: cada método devuelve otra.
 */
public final class ConsultaTheHive {

    /** Lista blanca de operaciones de consulta (todas de lectura). */
    public static final Set<String> OPERACIONES_PERMITIDAS = Set.of(
            "listAlert", "listCase", "listTask", "getAlert", "getCase", "tasks", "observables",
            "filter", "sort", "page", "count", "aggregation");

    /** Operaciones con las que puede EMPEZAR una consulta. */
    private static final Set<String> ORIGENES = Set.of("listAlert", "listCase", "listTask", "getAlert", "getCase");

    /** Tamaño ({@code _size}) con el que se piden las agregaciones por campo. Sin él TheHive devuelve solo 100. */
    public static final int TAMANO_AGREGACION = 1000;
    /** Máximo de elementos por página. */
    public static final int MAX_PAGINA = 1000;

    private static final Set<String> AGREGACIONES = Set.of("field", "avg");
    private static final Set<String> AGREGACIONES_INTERNAS = Set.of("count", "avg", "min", "max");
    private static final Pattern ID = Pattern.compile("^~?[A-Za-z0-9_-]{1,64}$");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final List<Map<String, Object>> operaciones;

    private ConsultaTheHive(List<Map<String, Object>> operaciones) {
        this.operaciones = operaciones;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Origen de la consulta
    // ---------------------------------------------------------------------------------------------------------

    public static ConsultaTheHive listAlert() {
        return new ConsultaTheHive(List.of(Map.of("_name", "listAlert")));
    }

    public static ConsultaTheHive listCase() {
        return new ConsultaTheHive(List.of(Map.of("_name", "listCase")));
    }

    public static ConsultaTheHive listTask() {
        return new ConsultaTheHive(List.of(Map.of("_name", "listTask")));
    }

    public static ConsultaTheHive getAlert(String id) {
        return new ConsultaTheHive(List.of(conId("getAlert", id)));
    }

    public static ConsultaTheHive getCase(String id) {
        return new ConsultaTheHive(List.of(conId("getCase", id)));
    }

    /**
     * Arma una consulta a partir de operaciones ya escritas como mapas (por ejemplo, desde una prueba). Se valida
     * exactamente igual que las demás: la lista blanca se aplica siempre.
     */
    public static ConsultaTheHive deOperaciones(List<? extends Map<String, Object>> operaciones) {
        var copia = new ArrayList<Map<String, Object>>();
        for (Map<String, Object> operacion : operaciones) {
            copia.add(new LinkedHashMap<>(operacion));
        }
        validar(copia);
        return new ConsultaTheHive(List.copyOf(copia));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Pasos
    // ---------------------------------------------------------------------------------------------------------

    public ConsultaTheHive filter(Filtro filtro) {
        var operacion = new LinkedHashMap<String, Object>();
        operacion.put("_name", "filter");
        operacion.putAll(filtro.comoMapa());
        return con(operacion);
    }

    public ConsultaTheHive sort(String campo, Orden orden) {
        Filtro.validarCampo(campo);
        return con(Map.of("_name", "sort", "_fields", List.of(Map.of(campo, orden.valor()))));
    }

    /** Página {@code [desde, hasta)}. */
    public ConsultaTheHive page(int desde, int hasta) {
        return con(Map.of("_name", "page", "from", desde, "to", hasta));
    }

    public ConsultaTheHive count() {
        return con(Map.of("_name", "count"));
    }

    public ConsultaTheHive tasks() {
        return con(Map.of("_name", "tasks"));
    }

    public ConsultaTheHive observables() {
        return con(Map.of("_name", "observables"));
    }

    /** Agrupa por un campo y cuenta; SIEMPRE con {@code _size} explícito. */
    public ConsultaTheHive agregarPorCampo(String campo, int tamano) {
        Filtro.validarCampo(campo);
        var operacion = new LinkedHashMap<String, Object>();
        operacion.put("_name", "aggregation");
        operacion.put("_agg", "field");
        operacion.put("_field", campo);
        operacion.put("_size", tamano);
        operacion.put("_select", List.of(Map.of("_agg", "count")));
        return con(operacion);
    }

    /** Agrupa por un campo con el tamaño por defecto ({@link #TAMANO_AGREGACION}). */
    public ConsultaTheHive agregarPorCampo(String campo) {
        return agregarPorCampo(campo, TAMANO_AGREGACION);
    }

    /** Promedio de un campo numérico o de fecha (por ejemplo {@code _createdAt}). */
    public ConsultaTheHive promedioDe(String campo) {
        Filtro.validarCampo(campo);
        return con(Map.of("_name", "aggregation", "_agg", "avg", "_field", campo));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Uso
    // ---------------------------------------------------------------------------------------------------------

    /** Cuerpo de la petición: {@code {"query":[...]}}. */
    public Map<String, Object> cuerpo() {
        return Map.of("query", operaciones);
    }

    /** Vuelve a validar la consulta (el cliente lo hace siempre antes de enviarla). */
    void validar() {
        validar(operaciones);
    }

    /** Texto JSON de la consulta, solo para registrarla en nivel DEBUG. */
    public String comoJson() {
        try {
            return JSON.writeValueAsString(cuerpo());
        } catch (JsonProcessingException e) {
            return "(consulta no serializable)";
        }
    }

    /** Nombre del campo de la primera agregación por campo, si la hay. */
    String campoAgregado() {
        for (var operacion : operaciones) {
            if ("aggregation".equals(operacion.get("_name")) && "field".equals(operacion.get("_agg"))) {
                return String.valueOf(operacion.get("_field"));
            }
        }
        return null;
    }

    /** Tamaño ({@code _size}) de la primera agregación por campo, o -1. */
    int tamanoAgregado() {
        for (var operacion : operaciones) {
            if ("aggregation".equals(operacion.get("_name")) && "field".equals(operacion.get("_agg"))
                    && operacion.get("_size") instanceof Number n) {
                return n.intValue();
            }
        }
        return -1;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Validación
    // ---------------------------------------------------------------------------------------------------------

    private ConsultaTheHive con(Map<String, Object> operacion) {
        var nuevas = new ArrayList<>(operaciones);
        nuevas.add(operacion);
        validar(nuevas);
        return new ConsultaTheHive(List.copyOf(nuevas));
    }

    private static Map<String, Object> conId(String operacion, String id) {
        if (id == null || !ID.matcher(id).matches()) {
            throw new ConsultaNoPermitidaException("Identificador no válido para " + operacion + ".");
        }
        return Map.of("_name", operacion, "idOrName", id);
    }

    @SuppressWarnings("unchecked")
    private static void validar(List<Map<String, Object>> operaciones) {
        if (operaciones.isEmpty()) {
            throw new ConsultaNoPermitidaException("La consulta no tiene operaciones.");
        }
        for (int i = 0; i < operaciones.size(); i++) {
            Map<String, Object> operacion = operaciones.get(i);
            Object nombre = operacion.get("_name");
            if (!(nombre instanceof String texto) || !OPERACIONES_PERMITIDAS.contains(texto)) {
                throw new ConsultaNoPermitidaException(
                        "Operación no permitida (el backend es de solo lectura): " + limpio(nombre));
            }
            boolean esOrigen = ORIGENES.contains(texto);
            if (i == 0 && !esOrigen) {
                throw new ConsultaNoPermitidaException("La consulta debe empezar con listAlert, listCase, listTask, getAlert o getCase.");
            }
            if (i > 0 && esOrigen) {
                throw new ConsultaNoPermitidaException("Una consulta solo puede empezar con " + texto + ", no continuar con él.");
            }
            switch (texto) {
                case "filter" -> Filtro.validarMapa(operacion);
                case "page" -> validarPagina(operacion);
                case "sort" -> validarOrden(operacion);
                case "aggregation" -> validarAgregacion(operacion);
                case "getAlert", "getCase" -> {
                    if (!(operacion.get("idOrName") instanceof String id) || !ID.matcher(id).matches()) {
                        throw new ConsultaNoPermitidaException("Identificador no válido para " + texto + ".");
                    }
                }
                default -> { /* sin parámetros */ }
            }
        }
    }

    private static void validarPagina(Map<String, Object> operacion) {
        if (!(operacion.get("from") instanceof Integer desde) || !(operacion.get("to") instanceof Integer hasta)
                || desde < 0 || hasta <= desde || hasta - desde > MAX_PAGINA) {
            throw new ConsultaNoPermitidaException(
                    "page necesita 0 <= from < to y no más de " + MAX_PAGINA + " elementos por página.");
        }
    }

    private static void validarOrden(Map<String, Object> operacion) {
        if (!(operacion.get("_fields") instanceof List<?> campos) || campos.size() != 1
                || !(campos.get(0) instanceof Map<?, ?> uno) || uno.size() != 1) {
            throw new ConsultaNoPermitidaException("sort necesita exactamente un campo.");
        }
        var entrada = uno.entrySet().iterator().next();
        Filtro.validarCampo(entrada.getKey());
        if (!("asc".equals(entrada.getValue()) || "desc".equals(entrada.getValue()))) {
            throw new ConsultaNoPermitidaException("El orden debe ser asc o desc.");
        }
    }

    private static void validarAgregacion(Map<String, Object> operacion) {
        Object tipo = operacion.get("_agg");
        if (!(tipo instanceof String t) || !AGREGACIONES.contains(t)) {
            throw new ConsultaNoPermitidaException("Agregación no permitida: " + limpio(tipo));
        }
        Filtro.validarCampo(operacion.get("_field"));
        if (t.equals("field")) {
            // Sin _size TheHive devuelve solo 100 valores y nadie se entera: se exige siempre.
            if (!(operacion.get("_size") instanceof Integer tamano) || tamano < 1 || tamano > TAMANO_AGREGACION) {
                throw new ConsultaNoPermitidaException(
                        "Una agregación por campo necesita _size explícito entre 1 y " + TAMANO_AGREGACION
                                + " (sin él TheHive devuelve solo 100 valores).");
            }
            if (operacion.get("_select") instanceof List<?> internas) {
                for (Object interna : internas) {
                    if (!(interna instanceof Map<?, ?> m) || !(m.get("_agg") instanceof String a)
                            || !AGREGACIONES_INTERNAS.contains(a)) {
                        throw new ConsultaNoPermitidaException("Agregación interna no permitida.");
                    }
                }
            }
        }
    }

    /** Texto seguro para un mensaje de error: corto y sin caracteres de control. */
    static String limpio(Object valor) {
        String texto = String.valueOf(valor).replaceAll("\\p{Cntrl}", " ");
        return texto.length() > 40 ? texto.substring(0, 40) + "…" : texto;
    }
}
