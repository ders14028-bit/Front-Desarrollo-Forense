package co.edu.escuelaing.dashboard.wazuh;

import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import java.util.List;

/**
 * Respuesta de {@code GET /api/dashboard/wazuh}: métricas de las alertas de Wazuh de los últimos N días (7), calculadas
 * desde el bloque JSON de cada alerta (MITRE, cumplimiento, IP de origen, usuario, regla, agente).
 *
 * <p>Mientras la carga inicial no termina, {@code estado = "cargando"}, {@code progreso} (1–99) y TODAS las métricas
 * van en {@code null}: nunca ceros que parezcan datos.
 *
 * @param estado            {@code "cargando"} o {@code "listo"}
 * @param progreso          porcentaje cargado mientras {@code estado = "cargando"} (null si todavía no se sabe); 100 cuando está listo
 * @param dias              tamaño de la ventana
 * @param desde             primer día de la ventana ({@code YYYY-MM-DD}, Bogotá)
 * @param alertasAnalizadas alertas de Wazuh de la ventana con bloque legible (null mientras carga)
 * @param sinBloque         alertas de la ventana sin bloque legible: cuentan, pero no aportan a las métricas (null mientras carga)
 */
public record MetricasWazuh(long generadoEn, String estado, Integer progreso, EstadoTheHive thehive, int dias, String desde,
                            Long alertasAnalizadas, Long sinBloque, Mitre mitre, List<Marco> cumplimiento,
                            List<ConteoIp> topIps, List<ConteoUsuario> topUsuarios, List<ConteoRegla> topReglas,
                            List<ConteoAgente> agentes, List<ConteoNivel> porNivel) {

    public static final String CARGANDO = "cargando";
    public static final String LISTO = "listo";

    /** Cada alerta cuenta una vez por cada táctica / técnica de su regla (una regla puede tener varias). */
    public record Mitre(List<ConteoTactica> tacticas, List<ConteoTecnica> tecnicas) {
    }

    /** @param clave clave ASCII en español de la táctica (por ejemplo {@code acceso-a-credenciales}) */
    public record ConteoTactica(String clave, long cantidad) {
    }

    /** @param nombre puede ser null si Wazuh no lo mandó alineado con el id */
    public record ConteoTecnica(String id, String nombre, long cantidad) {
    }

    /**
     * @param marco      {@code pci_dss}, {@code nist_800_53}, {@code gdpr}, {@code hipaa} o {@code tsc}
     * @param alertas    alertas que tocan al menos un control de ese marco
     * @param requisitos los requisitos (controles) más afectados, de mayor a menor (3)
     */
    public record Marco(String marco, long alertas, List<Requisito> requisitos) {
    }

    public record Requisito(String requisito, long cantidad) {
    }

    public record ConteoIp(String ip, long cantidad) {
    }

    public record ConteoUsuario(String usuario, long cantidad) {
    }

    /** @param nivel nivel original de Wazuh (0–15) de la regla; null si no vino */
    public record ConteoRegla(String id, String descripcion, Integer nivel, long cantidad) {
    }

    public record ConteoAgente(String nombre, long cantidad) {
    }

    public record ConteoNivel(int nivel, long cantidad) {
    }

    /** Estado "cargando": ninguna métrica, y el progreso si ya se sabe. */
    public static MetricasWazuh cargando(long generadoEn, Integer progreso, EstadoTheHive thehive, int dias, String desde) {
        return new MetricasWazuh(generadoEn, CARGANDO, progreso, thehive, dias, desde, null, null, null, null, null, null, null, null, null);
    }

    public MetricasWazuh conEstado(EstadoTheHive estado) {
        return new MetricasWazuh(generadoEn, this.estado, progreso, estado, dias, desde, alertasAnalizadas, sinBloque, mitre,
                cumplimiento, topIps, topUsuarios, topReglas, agentes, porNivel);
    }
}
