package co.edu.escuelaing.dashboard.alertas;

import co.edu.escuelaing.dashboard.dominio.EstadoSla;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import java.util.List;

/**
 * Respuesta de {@code GET /api/dashboard/alertas}: las 1000 alertas más recientes de los últimos 30 días (Bogotá) MÁS
 * todas las críticas y altas sin atender de esa ventana, aunque sean más antiguas. Así una alerta crítica sin atender
 * nunca queda fuera de la lista por el tope. Forma de {@code ListaAlertas} de {@code docs/contrato-api.md}, más
 * {@code composicion} y {@code thehive}.
 *
 * @param total          alertas de la ventana, contadas con {@code count} (no es el largo de {@code alertas})
 * @param truncado       {@code true} si {@code total} es mayor que las alertas que vienen
 * @param composicion    de qué se compone la lista (para el aviso de la Vista unificada)
 * @param alertas        la más reciente primero
 */
public record ListaAlertas(long generadoEn, long total, boolean truncado, boolean datosDeLaboratorio,
                           Composicion composicion, EstadoTheHive thehive, List<AlertaFila> alertas) {

    /**
     * @param recientes                  las más recientes de la ventana (hasta 1000)
     * @param criticasYAltasAdicionales  críticas y altas sin atender MÁS ANTIGUAS que esas, añadidas aparte
     */
    public record Composicion(long recientes, long criticasYAltasAdicionales) {
    }

    /** Una fila de la tabla; el backend calcula tipo, SLA y caso. */
    public record AlertaFila(String id, long creadaEn, String titulo, int severidad, String estado, String origen,
                             String tipo, long antiguedadMs, EstadoSla sla, CasoResumen caso) {
    }

    /** Si la alerta tiene {@code caseId} pero el caso no está disponible, solo {@code id} viene con valor. */
    public record CasoResumen(String id, Integer numero, String etapa, String estado) {
    }

    public ListaAlertas conEstado(EstadoTheHive estado) {
        return new ListaAlertas(generadoEn, total, truncado, datosDeLaboratorio, composicion, estado, alertas);
    }
}
