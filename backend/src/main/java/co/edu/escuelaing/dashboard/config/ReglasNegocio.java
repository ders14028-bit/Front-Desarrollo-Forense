package co.edu.escuelaing.dashboard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Nombres de TheHive que usan las reglas de negocio. Varios están PENDIENTES de confirmar con el grupo de TheHive
 * (CLAUDE.md), por eso viven aquí y en application.yml y no repetidos por el código.
 *
 * @param grupoContencion         grupo de las tareas de contención (PENDIENTE confirmar)
 * @param estadoCasoConfirmado    {@code status} de un caso confirmado como incidente real (PENDIENTE confirmar)
 * @param estadoTareaCompletada   {@code status} de una tarea terminada (PENDIENTE confirmar)
 * @param etapaCasoNuevo          {@code stage} de un caso abierto (PENDIENTE confirmar)
 * @param etapaCasoEnProgreso     {@code stage} de un caso en progreso (PENDIENTE confirmar)
 * @param etapaCasoCerrado        {@code stage} de un caso cerrado (PENDIENTE confirmar)
 * @param tipoSimulacion          {@code type} de las alertas simuladas por los playbooks
 * @param incluirSimulaciones     {@code false} (por defecto): las alertas con {@code type = tipoSimulacion} se excluyen de todo
 */
@ConfigurationProperties(prefix = "dashboard.negocio")
public record ReglasNegocio(String grupoContencion, String estadoCasoConfirmado, String estadoTareaCompletada,
                            String etapaCasoNuevo, String etapaCasoEnProgreso, String etapaCasoCerrado,
                            String tipoSimulacion, boolean incluirSimulaciones) {

    public ReglasNegocio {
        grupoContencion = valor(grupoContencion, "Contención");
        estadoCasoConfirmado = valor(estadoCasoConfirmado, "TruePositive");
        estadoTareaCompletada = valor(estadoTareaCompletada, "Completed");
        etapaCasoNuevo = valor(etapaCasoNuevo, "New");
        etapaCasoEnProgreso = valor(etapaCasoEnProgreso, "InProgress");
        etapaCasoCerrado = valor(etapaCasoCerrado, "Closed");
        tipoSimulacion = valor(tipoSimulacion, "simulacion");
    }

    private static String valor(String texto, String pordefecto) {
        return texto == null || texto.isBlank() ? pordefecto : texto.strip();
    }
}
