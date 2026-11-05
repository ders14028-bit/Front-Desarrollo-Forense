package co.edu.escuelaing.dashboard.dominio;

import java.util.List;
import java.util.Optional;
import java.util.function.Function;

/**
 * Tipo de amenaza de una alerta, por orden de prioridad:
 * <ol>
 *   <li>la etiqueta {@code escenario:<tipo>} (la primera con valor);</li>
 *   <li>la primera táctica MITRE de su regla de Wazuh ({@code regla:<id>}), en español;</li>
 *   <li>sin clasificar ({@code null}).</li>
 * </ol>
 * NUNCA se deduce del título ni del {@code source}.
 */
public final class TipoAmenaza {

    public static final String PREFIJO_ESCENARIO = "escenario:";
    public static final String PREFIJO_REGLA = "regla:";

    private TipoAmenaza() {
    }

    /** Valor de la primera etiqueta {@code escenario:<tipo>} con valor, o null. */
    public static String escenarioDe(List<String> etiquetas) {
        for (String etiqueta : etiquetas) {
            if (etiqueta != null && etiqueta.startsWith(PREFIJO_ESCENARIO)) {
                String valor = etiqueta.substring(PREFIJO_ESCENARIO.length()).strip();
                if (!valor.isEmpty()) {
                    return valor;
                }
            }
        }
        return null;
    }

    /** Id de la primera etiqueta {@code regla:<id>}, o null. */
    public static String reglaDe(List<String> etiquetas) {
        for (String etiqueta : etiquetas) {
            if (etiqueta != null && etiqueta.startsWith(PREFIJO_REGLA)) {
                String valor = etiqueta.substring(PREFIJO_REGLA.length()).strip();
                if (!valor.isEmpty()) {
                    return valor;
                }
            }
        }
        return null;
    }

    /**
     * @param tacticaDeRegla clave de la táctica (ya en español) de una regla, si se conoce
     * @return el tipo de la alerta, o null si queda sin clasificar
     */
    public static String tipoDe(Alerta alerta, Function<String, Optional<String>> tacticaDeRegla) {
        String escenario = escenarioDe(alerta.etiquetas());
        if (escenario != null) {
            return escenario;
        }
        String regla = reglaDe(alerta.etiquetas());
        if (regla != null) {
            return tacticaDeRegla.apply(regla).orElse(null);
        }
        return null;
    }

    /** Clave en español de la primera táctica MITRE que traiga la descripción de la alerta (bloque de Wazuh). */
    public static Optional<String> tacticaDe(String descripcion) {
        return ExtractorWazuh.extraer(descripcion)
                .map(DatosWazuh::primeraTactica)
                .map(TacticasMitre::clave);
    }
}
