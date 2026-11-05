package co.edu.escuelaing.dashboard.alertas;

import co.edu.escuelaing.dashboard.alertas.ListaAlertas.AlertaFila;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Respuesta de {@code GET /api/dashboard/alertas/{id}}.
 *
 * @param alerta la alerta tal como la da TheHive (campos crudos)
 * @param fila   la misma fila que en la lista, calculada en {@code generadoEn}
 * @param caso   el caso con sus tareas (campos crudos de TheHive más {@code tareas}); null si la alerta no tiene caso o el
 *               caso no está disponible
 */
public record DetalleAlerta(long generadoEn, JsonNode alerta, AlertaFila fila, JsonNode caso) {
}
