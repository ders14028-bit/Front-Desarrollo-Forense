package co.edu.escuelaing.dashboard.activos;

import java.util.List;
import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Inventario de activos y tabla de componentes ({@code dashboard.activos} en application.yml).
 *
 * @param inventario      los agentes de Wazuh conocidos. Un agente que no esté aquí sale como {@code sin-clasificar}
 * @param componentes     tabla ORDENADA: a cada alerta se le asigna el PRIMER componente que coincida con alguno de sus
 *                        grupos de regla; si ninguno coincide, {@link #OTROS}
 * @param gruposGenericos grupos que no dicen qué se atacó (syslog, authentication_failed…): nunca definen componente
 */
@ConfigurationProperties(prefix = "dashboard.activos")
public record ConfiguracionActivos(List<Entrada> inventario, List<Componente> componentes, List<String> gruposGenericos) {

    public static final String OTROS = "otros";
    public static final String SIN_CLASIFICAR = "sin-clasificar";
    public static final String WINDOWS = "Windows";
    public static final String LINUX = "Linux";

    /**
     * Un agente del inventario. Se reconoce por {@code agenteId}; si la alerta no trae id (o no coincide con ninguno), por
     * {@code nombre} (sin distinguir mayúsculas).
     *
     * @param nombre        nombre técnico del agente en Wazuh
     * @param tipo          monitoreo, base-de-datos, web, estacion, windows…
     * @param nombreVisible cómo se muestra al gerente
     * @param sistema       Linux o Windows
     */
    public record Entrada(String agenteId, String nombre, String tipo, String nombreVisible, String sistema) {
        public Entrada {
            agenteId = limpio(agenteId);
            nombre = limpio(nombre);
            tipo = limpio(tipo) == null ? SIN_CLASIFICAR : limpio(tipo);
            nombreVisible = limpio(nombreVisible) == null ? nombre : limpio(nombreVisible);
            sistema = limpio(sistema);
        }
    }

    /**
     * @param grupos   grupos de regla exactos (sin distinguir mayúsculas)
     * @param prefijos grupos que empiezan así (p. ej. {@code sysmon_})
     */
    public record Componente(String clave, List<String> grupos, List<String> prefijos) {
        public Componente {
            grupos = minusculas(grupos);
            prefijos = minusculas(prefijos);
        }

        public boolean coincide(String grupoEnMinusculas) {
            return grupos.contains(grupoEnMinusculas) || prefijos.stream().anyMatch(grupoEnMinusculas::startsWith);
        }
    }

    public ConfiguracionActivos {
        inventario = inventario == null ? List.of() : List.copyOf(inventario);
        componentes = componentes == null ? List.of() : List.copyOf(componentes);
        gruposGenericos = minusculas(gruposGenericos);
    }

    /** Claves de los componentes en el orden de la tabla, con {@link #OTROS} al final. */
    public List<String> ordenDeComponentes() {
        var orden = new java.util.ArrayList<String>(componentes.stream().map(Componente::clave).toList());
        if (!orden.contains(OTROS)) {
            orden.add(OTROS);
        }
        return orden;
    }

    private static String limpio(String texto) {
        return texto == null || texto.isBlank() ? null : texto.strip();
    }

    private static List<String> minusculas(List<String> lista) {
        return lista == null ? List.of()
                : lista.stream().map(ConfiguracionActivos::limpio).filter(t -> t != null).map(t -> t.toLowerCase(Locale.ROOT)).toList();
    }
}
