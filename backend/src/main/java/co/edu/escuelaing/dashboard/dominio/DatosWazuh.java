package co.edu.escuelaing.dashboard.dominio;

import java.util.List;
import java.util.Map;

/**
 * Lo que trae el bloque {@code ```json} de la descripción de una alerta de Wazuh. Todo es opcional: cualquier campo
 * puede faltar (los textos quedan en {@code null} y las listas, vacías).
 *
 * @param reglaNivel    nivel original de Wazuh (0–15), o {@code null}
 * @param cumplimiento  normativas por nombre ({@code pci_dss}, {@code nist_800_53}, {@code gdpr}, {@code hipaa},
 *                      {@code tsc}, {@code gpg13}); solo las que vienen
 * @param datos         campos de {@code datos} que usa el dashboard (srcip, srcport, srcuser, dstuser…); el resto se ignora
 */
public record DatosWazuh(String fechaWazuh, String reglaId, Integer reglaNivel, String reglaDescripcion,
                         List<String> idsMitre, List<String> tacticas, List<String> tecnicas, List<String> grupos,
                         Map<String, List<String>> cumplimiento, String agenteId, String agenteNombre,
                         String agenteIp, String ubicacion, Map<String, String> datos) {

    public DatosWazuh {
        idsMitre = copia(idsMitre);
        tacticas = copia(tacticas);
        tecnicas = copia(tecnicas);
        grupos = copia(grupos);
        cumplimiento = cumplimiento == null ? Map.of() : Map.copyOf(cumplimiento);
        datos = datos == null ? Map.of() : Map.copyOf(datos);
    }

    private static List<String> copia(List<String> lista) {
        return lista == null ? List.of() : List.copyOf(lista);
    }

    /** Primera táctica MITRE de la regla, si tiene. */
    public String primeraTactica() {
        return tacticas.isEmpty() ? null : tacticas.get(0);
    }
}
