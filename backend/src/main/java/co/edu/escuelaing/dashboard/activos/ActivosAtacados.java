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
 */
public record ActivosAtacados(long generadoEn, String estado, Integer progreso, int ventanaDias, String desde,
                              EstadoTheHive thehive, List<Activo> activos, Integer alertasSinActivo) {

    /**
     * @param agenteId            id de agente de Wazuh (null si se reconoció solo por nombre)
     * @param equipo              nombre técnico del agente
     * @param componentePrincipal el componente con más alertas; null si el activo no tiene alertas
     * @param componentes         de mayor a menor; suman {@code alertas}
     */
    public record Activo(String agenteId, String equipo, String nombreVisible, String tipo, String sistema, int alertas,
                         int altasYCriticas, String componentePrincipal, List<ConteoComponente> componentes) {
    }

    public record ConteoComponente(String clave, int alertas, int altasYCriticas) {
    }
}
