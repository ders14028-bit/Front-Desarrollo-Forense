package co.edu.escuelaing.dashboard.activos;

import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import java.util.List;

/**
 * Respuesta de {@code GET /api/dashboard/activos}: qué activos y qué componentes se atacaron en la ventana de Wazuh. Sin
 * IPs de origen ni usuarios.
 *
 * <p>Mientras la carga inicial de Wazuh no termina, {@code estado = "cargando"} y {@code activos} y
 * {@code alertasSinActivo} van en {@code null} (nunca una lista vacía que parezca "no hay ataques").
 *
 * @param progreso         el de la sincronización de Wazuh (1–99 mientras carga, null si aún no se sabe; 100 listo)
 * @param ventanaDias      días de la ventana (Bogotá, contando hoy)
 * @param activos          de más a menos alertas; los del inventario salen aunque no tengan alertas
 * @param alertasSinActivo alertas de la ventana que no traen agente (no se pueden asignar a ningún activo)
 * @param ataquesRecientes alertas altas y críticas (severidad 3 o 4) agrupadas por activo + regla, de la más reciente a la
 *                         más antigua, hasta {@link #MAX_ATAQUES_POR_ACTIVO} grupos POR CADA activo; null mientras carga
 */
public record ActivosAtacados(long generadoEn, String estado, Integer progreso, int ventanaDias, String desde,
                              EstadoTheHive thehive, List<Activo> activos, Integer alertasSinActivo,
                              List<AtaqueReciente> ataquesRecientes) {

    /**
     * Tope de grupos en {@code ataquesRecientes} por activo (no global: si no, un equipo con ataques viejos saldría sin
     * ataques al filtrarlo aunque los tenga).
     */
    public static final int MAX_ATAQUES_POR_ACTIVO = 20;

    /**
     * @param agenteId            id de agente de Wazuh (null si se reconoció solo por nombre)
     * @param equipo              nombre técnico del agente
     * @param componentePrincipal el componente con más alertas; null si el activo no tiene alertas
     * @param componentes         de mayor a menor; suman {@code alertas}
     * @param ultimoAtaqueEn      fecha (ms) de su alerta alta o crítica más reciente; null si no tiene
     */
    public record Activo(String agenteId, String equipo, String nombreVisible, String tipo, String sistema, int alertas,
                         int altasYCriticas, String componentePrincipal, List<ConteoComponente> componentes,
                         Long ultimoAtaqueEn) {
    }

    /**
     * Alertas altas y críticas de un mismo activo y una misma regla de Wazuh. Sin IPs de origen ni usuarios.
     *
     * @param agenteId    id de agente de Wazuh (null si se reconoció solo por nombre)
     * @param equipo      nombre técnico del agente
     * @param componente  componente de la última alerta del grupo (clave, como en {@code componentes})
     * @param reglaId     id de la regla de Wazuh (null si la alerta no trae bloque legible)
     * @param nivelWazuh  nivel de la regla (0–15); null si no se sabe
     * @param descripcion descripción de la regla, con las IPs reemplazadas por {@code <ip>}; null si no la trae
     * @param severidad   la mayor del grupo: 3 alta o 4 crítica
     * @param cantidad    alertas del grupo
     * @param primeraEn   fecha (ms) de la más antigua
     * @param ultimaEn    fecha (ms) de la más reciente
     */
    public record AtaqueReciente(String agenteId, String equipo, String nombreVisible, String tipo, String componente,
                                 String reglaId, Integer nivelWazuh, String descripcion, int severidad, int cantidad,
                                 long primeraEn, long ultimaEn) {
    }

    public record ConteoComponente(String clave, int alertas, int altasYCriticas) {
    }
}
