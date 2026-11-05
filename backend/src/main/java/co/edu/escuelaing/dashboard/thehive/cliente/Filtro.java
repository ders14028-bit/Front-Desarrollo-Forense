package co.edu.escuelaing.dashboard.thehive.cliente;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Filtro de una consulta de TheHive. Solo existen los operadores que el sondeo del 4–5 nov. 2026 comprobó que
 * funcionan en este TheHive.
 *
 * <p><b>NO agregar un operador {@code _has}.</b> En este TheHive {@code {"_has":"case"}} devuelve TODAS las alertas
 * aunque no haya ningún caso, así que sirve para nada y engaña. Las alertas convertidas en caso se cuentan con
 * {@code status = Imported}. Hay un test que documenta esto ({@code FiltroTest}).
 *
 * <p>{@code _between} tampoco tiene constructor: es {@code _from} inclusivo y {@code _to} exclusivo, y para los días
 * de Bogotá se usa el par {@code gte} + {@code lt}, que no deja dudas.
 */
public final class Filtro {

    /** Operadores de comparación: llevan {@code {_field, _value}}. */
    static final Set<String> COMPARACIONES = Set.of("_eq", "_ne", "_gt", "_gte", "_lt", "_lte", "_like");
    /** Operadores lógicos. */
    static final Set<String> LOGICOS = Set.of("_and", "_or", "_not");
    /** Todos los operadores admitidos. */
    static final Set<String> OPERADORES;

    static {
        var todos = new java.util.HashSet<String>(COMPARACIONES);
        todos.addAll(LOGICOS);
        OPERADORES = Set.copyOf(todos);
    }

    private static final Pattern CAMPO = Pattern.compile("^[A-Za-z_][A-Za-z0-9_.]{0,63}$");

    private final Map<String, Object> contenido;

    private Filtro(Map<String, Object> contenido) {
        this.contenido = contenido;
    }

    public static Filtro eq(String campo, Object valor) {
        return comparar("_eq", campo, valor);
    }

    public static Filtro ne(String campo, Object valor) {
        return comparar("_ne", campo, valor);
    }

    public static Filtro gt(String campo, Object valor) {
        return comparar("_gt", campo, valor);
    }

    public static Filtro gte(String campo, Object valor) {
        return comparar("_gte", campo, valor);
    }

    public static Filtro lt(String campo, Object valor) {
        return comparar("_lt", campo, valor);
    }

    public static Filtro lte(String campo, Object valor) {
        return comparar("_lte", campo, valor);
    }

    /** Comodín {@code *}: por ejemplo {@code like("tags", "regla:*")}. */
    public static Filtro like(String campo, String patron) {
        return comparar("_like", campo, patron);
    }

    public static Filtro and(Filtro... filtros) {
        return logico("_and", filtros);
    }

    public static Filtro or(Filtro... filtros) {
        return logico("_or", filtros);
    }

    public static Filtro not(Filtro filtro) {
        if (filtro == null) {
            throw new ConsultaNoPermitidaException("not() necesita un filtro.");
        }
        return new Filtro(Map.of("_not", filtro.contenido));
    }

    /** Estructura lista para serializar a JSON. */
    Map<String, Object> comoMapa() {
        return contenido;
    }

    private static Filtro comparar(String operador, String campo, Object valor) {
        validarCampo(campo);
        validarValor(valor);
        var interno = new LinkedHashMap<String, Object>();
        interno.put("_field", campo);
        interno.put("_value", valor);
        return new Filtro(Map.of(operador, interno));
    }

    private static Filtro logico(String operador, Filtro[] filtros) {
        if (filtros == null || filtros.length == 0) {
            throw new ConsultaNoPermitidaException(operador + " necesita al menos un filtro.");
        }
        return new Filtro(Map.of(operador, java.util.Arrays.stream(filtros).map(f -> f.contenido).toList()));
    }

    static void validarCampo(Object campo) {
        if (!(campo instanceof String texto) || !CAMPO.matcher(texto).matches()) {
            throw new ConsultaNoPermitidaException("Nombre de campo no válido en el filtro.");
        }
    }

    static void validarValor(Object valor) {
        if (!(valor instanceof String || valor instanceof Number || valor instanceof Boolean)) {
            throw new ConsultaNoPermitidaException("El valor de un filtro debe ser texto, número o booleano.");
        }
    }

    /** Valida un filtro ya armado como mapa (por ejemplo, el de una consulta construida con {@code deOperaciones}). */
    @SuppressWarnings("unchecked")
    static void validarMapa(Map<String, Object> filtro) {
        for (var entrada : filtro.entrySet()) {
            String operador = entrada.getKey();
            if (operador.equals("_name")) {
                continue;
            }
            if (operador.equals("_has")) {
                throw new ConsultaNoPermitidaException(
                        "El operador _has no se usa: en este TheHive devuelve TODAS las alertas aunque no haya casos. "
                                + "Las alertas convertidas se cuentan con status = Imported.");
            }
            if (!OPERADORES.contains(operador)) {
                throw new ConsultaNoPermitidaException("Operador de filtro no admitido: " + ConsultaTheHive.limpio(operador));
            }
            Object valor = entrada.getValue();
            if (COMPARACIONES.contains(operador)) {
                if (!(valor instanceof Map<?, ?> par)) {
                    throw new ConsultaNoPermitidaException("El operador " + operador + " necesita {_field, _value}.");
                }
                validarCampo(par.get("_field"));
                validarValor(par.get("_value"));
            } else if (operador.equals("_not")) {
                if (!(valor instanceof Map<?, ?> interno)) {
                    throw new ConsultaNoPermitidaException("_not necesita un filtro.");
                }
                validarMapa((Map<String, Object>) interno);
            } else { // _and, _or
                if (!(valor instanceof List<?> lista) || lista.isEmpty()) {
                    throw new ConsultaNoPermitidaException(operador + " necesita una lista de filtros.");
                }
                for (Object elemento : lista) {
                    if (!(elemento instanceof Map<?, ?> interno)) {
                        throw new ConsultaNoPermitidaException(operador + " solo admite filtros.");
                    }
                    validarMapa((Map<String, Object>) interno);
                }
            }
        }
    }
}
