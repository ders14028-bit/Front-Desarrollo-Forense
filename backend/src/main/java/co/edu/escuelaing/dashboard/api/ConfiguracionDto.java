package co.edu.escuelaing.dashboard.api;

import java.util.Map;

/** Respuesta de {@code GET /api/dashboard/configuracion}: SLA en minutos por severidad (clave "1" baja … "4" crítica). */
public record ConfiguracionDto(Map<String, Integer> slaMinutos) {
}
