package co.edu.escuelaing.dashboard.activos;

import co.edu.escuelaing.dashboard.activos.ActivosAtacados.Activo;
import co.edu.escuelaing.dashboard.activos.ActivosAtacados.ConteoComponente;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos.Componente;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos.Entrada;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Agrupa las alertas de Wazuh por activo (agente) y por componente atacado. Funciones puras: no habla con TheHive.
 *
 * <ul>
 *   <li>Activo: el agente del inventario por id (o por nombre como respaldo). Un agente que no está en el inventario sale
 *       como {@code sin-clasificar}, con su nombre técnico y el sistema deducido de sus alertas: no se pierde ninguno.</li>
 *   <li>Componente: el PRIMERO de la tabla que coincida con algún grupo de regla de la alerta, sin contar los grupos
 *       genéricos; si ninguno coincide, {@code otros}. Cada alerta cuenta en un solo componente, así que los componentes de
 *       un activo suman sus alertas.</li>
 * </ul>
 */
public final class CalculoActivos {

    private CalculoActivos() {
    }

    public record Resultado(List<Activo> activos, int alertasSinActivo) {
    }

    /** Acumulador de un activo mientras se recorren las alertas. */
    private static final class Acumulado {
        final Entrada entrada;
        String agenteId;
        String nombre;
        boolean pareceWindows;
        int alertas;
        int altas;
        final Map<String, int[]> componentes = new HashMap<>();   // clave → [alertas, altas y críticas]

        Acumulado(Entrada entrada) {
            this.entrada = entrada;
        }
    }

    public static Resultado calcular(Collection<AlertaWazuh> alertas, ConfiguracionActivos config) {
        Map<String, Entrada> porId = new HashMap<>();
        Map<String, Entrada> porNombre = new HashMap<>();
        Map<Object, Acumulado> activos = new LinkedHashMap<>();
        for (Entrada e : config.inventario()) {
            if (e.agenteId() != null) {
                porId.putIfAbsent(e.agenteId(), e);
            }
            if (e.nombre() != null) {
                porNombre.putIfAbsent(e.nombre().toLowerCase(Locale.ROOT), e);
            }
            activos.putIfAbsent(e, new Acumulado(e));   // los del inventario salen aunque no tengan alertas
        }

        int sinActivo = 0;
        for (AlertaWazuh a : alertas) {
            String id = a.activo().agenteId();
            String nombre = a.agente();
            if (id == null && nombre == null) {
                sinActivo++;
                continue;
            }
            Entrada entrada = id == null ? null : porId.get(id);
            if (entrada == null && nombre != null) {
                entrada = porNombre.get(nombre.toLowerCase(Locale.ROOT));
            }
            Object clave = entrada != null ? entrada
                    : List.of(id == null ? "" : id, nombre == null ? "" : nombre.toLowerCase(Locale.ROOT));
            Entrada e = entrada;
            Acumulado acc = activos.computeIfAbsent(clave, k -> new Acumulado(e));
            if (acc.agenteId == null) {
                acc.agenteId = id;
            }
            if (nombre != null) {
                acc.nombre = nombre;
            }
            acc.pareceWindows |= pareceWindows(a);
            boolean alta = a.activo().altaOCritica();
            acc.alertas++;
            if (alta) {
                acc.altas++;
            }
            int[] cuenta = acc.componentes.computeIfAbsent(componenteDe(a.activo().grupos(), config), k -> new int[2]);
            cuenta[0]++;
            if (alta) {
                cuenta[1]++;
            }
        }

        List<String> orden = config.ordenDeComponentes();
        List<Activo> lista = new ArrayList<>();
        for (Acumulado acc : activos.values()) {
            lista.add(aActivo(acc, orden));
        }
        lista.sort(Comparator.comparingInt(Activo::alertas).reversed()
                .thenComparing(Comparator.comparingInt(Activo::altasYCriticas).reversed())
                .thenComparing(Activo::nombreVisible, String.CASE_INSENSITIVE_ORDER));
        return new Resultado(List.copyOf(lista), sinActivo);
    }

    /** El primer componente de la tabla que coincide con algún grupo no genérico; si ninguno, {@code otros}. */
    public static String componenteDe(List<String> grupos, ConfiguracionActivos config) {
        List<String> utiles = grupos.stream()
                .map(g -> g.strip().toLowerCase(Locale.ROOT))
                .filter(g -> !g.isEmpty() && !config.gruposGenericos().contains(g))
                .toList();
        for (Componente c : config.componentes()) {
            if (utiles.stream().anyMatch(c::coincide)) {
                return c.clave();
            }
        }
        return ConfiguracionActivos.OTROS;
    }

    /** Grupos {@code windows…}/{@code sysmon…}, log {@code EventChannel} o un equipo de Windows en el evento. */
    private static boolean pareceWindows(AlertaWazuh a) {
        if (a.activo().equipo() != null || "eventchannel".equalsIgnoreCase(a.activo().ubicacion())) {
            return true;
        }
        return a.activo().grupos().stream()
                .map(g -> g.toLowerCase(Locale.ROOT))
                .anyMatch(g -> g.equals("windows") || g.startsWith("windows_") || g.startsWith("sysmon"));
    }

    private static Activo aActivo(Acumulado acc, List<String> orden) {
        List<ConteoComponente> componentes = acc.componentes.entrySet().stream()
                .map(e -> new ConteoComponente(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .sorted(Comparator.comparingInt(ConteoComponente::alertas).reversed()
                        .thenComparingInt(c -> posicion(orden, c.clave())))
                .toList();
        String principal = componentes.isEmpty() ? null : componentes.get(0).clave();

        Entrada e = acc.entrada;
        if (e != null) {
            String sistema = e.sistema() != null ? e.sistema() : (acc.pareceWindows ? ConfiguracionActivos.WINDOWS : ConfiguracionActivos.LINUX);
            return new Activo(e.agenteId() != null ? e.agenteId() : acc.agenteId, e.nombre() != null ? e.nombre() : acc.nombre,
                    e.nombreVisible() != null ? e.nombreVisible() : nombreDe(acc), e.tipo(), sistema,
                    acc.alertas, acc.altas, principal, componentes);
        }
        return new Activo(acc.agenteId, acc.nombre, nombreDe(acc), ConfiguracionActivos.SIN_CLASIFICAR,
                acc.pareceWindows ? ConfiguracionActivos.WINDOWS : ConfiguracionActivos.LINUX,
                acc.alertas, acc.altas, principal, componentes);
    }

    private static String nombreDe(Acumulado acc) {
        return acc.nombre != null ? acc.nombre : "Agente " + acc.agenteId;
    }

    private static int posicion(List<String> orden, String clave) {
        int i = orden.indexOf(clave);
        return i < 0 ? Integer.MAX_VALUE : i;
    }
}
