package co.edu.escuelaing.dashboard.dominio;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;

/**
 * Traduce las tácticas de MITRE ATT&CK (en inglés, como las manda Wazuh) a la clave en español que usa el dashboard
 * como "tipo de amenaza". El frontend la muestra con mayúscula inicial y sin guiones ("acceso-a-credenciales" →
 * "Acceso a credenciales").
 */
public final class TacticasMitre {

    private static final Map<String, String> ES = Map.ofEntries(
            Map.entry("reconnaissance", "reconocimiento"),
            Map.entry("resource development", "desarrollo-de-recursos"),
            Map.entry("initial access", "acceso-inicial"),
            Map.entry("execution", "ejecución"),
            Map.entry("persistence", "persistencia"),
            Map.entry("privilege escalation", "escalada-de-privilegios"),
            Map.entry("defense evasion", "evasión-de-defensas"),
            Map.entry("credential access", "acceso-a-credenciales"),
            Map.entry("discovery", "descubrimiento"),
            Map.entry("lateral movement", "movimiento-lateral"),
            Map.entry("collection", "recolección"),
            Map.entry("command and control", "comando-y-control"),
            Map.entry("exfiltration", "exfiltración"),
            Map.entry("impact", "impacto"));

    private TacticasMitre() {
    }

    /**
     * Clave en español de una táctica. Una táctica que no está en la tabla (por ejemplo, una nueva de MITRE) no se
     * inventa: se conserva su nombre original convertido a clave ("Some Tactic" → "some-tactic").
     */
    public static String clave(String tactica) {
        if (tactica == null || tactica.isBlank()) {
            return null;
        }
        String normalizada = tactica.strip().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        String conocida = ES.get(normalizada);
        if (conocida != null) {
            return conocida;
        }
        String sinTildes = Normalizer.normalize(normalizada, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String clave = sinTildes.replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return clave.isEmpty() ? null : clave;
    }
}
