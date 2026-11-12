package co.edu.escuelaing.dashboard.wazuh;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * Diagnóstico de qué datos de activos hay en la caché de Wazuh: SOLO nombres y conteos. No incluye IPs ni usuarios; si
 * un nombre trae una IP (p. ej. una {@code ubicacion} de syslog remoto), la IP se reemplaza por {@code <ip>}.
 *
 * @param alertasEnCache    alertas en memoria (ventana de días de {@code dashboard.wazuh})
 * @param cargaInicialLista false = la carga inicial aún no termina y los conteos están incompletos
 * @param sinBloque         alertas sin bloque JSON legible (no aportan agente, equipo, grupos ni ubicación)
 * @param agentes           id y nombre de agente, con su cantidad de alertas, de mayor a menor
 * @param equiposWindows    {@code datos.win.system.computer} con su cantidad
 * @param gruposRegla       top 40 de {@code regla.groups}
 * @param ubicaciones       top 20 de {@code ubicacion} (solo alertas con bloque)
 * @param porOrigen         por {@code source} de TheHive: cuántas traen agente o equipo y cuántas no
 * @param gruposPorAgente   cruce agente × grupo de regla: cada agente (mismo orden que {@code agentes}) con sus 15 grupos
 *                          más frecuentes
 * @param otros             lo que cae en el componente "otros" de Activos atacados (solo alertas con agente, como allí)
 */
public record DiagnosticoActivos(int alertasEnCache, boolean cargaInicialLista, int sinBloque, List<Agente> agentes,
                                 List<Conteo> equiposWindows, List<Conteo> gruposRegla, List<Conteo> ubicaciones,
                                 List<Origen> porOrigen, List<GruposDeAgente> gruposPorAgente,
                                 Otros otros) {

    public static final int TOP_GRUPOS = 40;
    public static final int TOP_GRUPOS_POR_AGENTE = 15;
    public static final int TOP_REGLAS_OTROS = 10;
    public static final int TOP_UBICACIONES = 20;
    static final String SIN_VALOR = "(sin valor)";

    private static final Pattern IPV4 = Pattern.compile("\\b\\d{1,3}(?:\\.\\d{1,3}){3}\\b");
    private static final Pattern IPV6 = Pattern.compile("(?i)(?<![0-9a-z])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![0-9a-z])");

    public record Conteo(String nombre, int cantidad) {
    }

    public record Agente(String id, String nombre, int cantidad) {
    }

    public record Origen(String origen, int total, int conAgenteOEquipo, int sinAgenteNiEquipo) {
    }

    /**
     * Lo que cae en "otros". Una alerta cuenta una vez por cada grupo que trae, así que los grupos no suman {@code alertas}.
     *
     * @param grupos todos sus grupos de regla, de mayor a menor; {@code generico = true} si no puede definir componente
     * @param reglas las 10 reglas más frecuentes
     */
    public record Otros(int alertas, int altasYCriticas, List<GrupoOtros> grupos, List<ReglaOtros> reglas) {
        static final Otros VACIO = new Otros(0, 0, List.of(), List.of());
    }

    public record GrupoOtros(String nombre, int cantidad, int altasYCriticas, boolean generico) {
    }

    /** @param nivel nivel original de Wazuh (0–15) */
    public record ReglaOtros(String id, Integer nivel, String descripcion, int cantidad, int altasYCriticas) {
    }

    /** @param cantidad alertas del agente (todas, tengan o no grupos) */
    public record GruposDeAgente(String id, String nombre, int cantidad, List<Conteo> grupos) {
    }

    /** Sin el desglose de "otros" (las pruebas que no lo necesitan). */
    public static DiagnosticoActivos calcular(Collection<AlertaWazuh> alertas, boolean cargaInicialLista) {
        return calcular(alertas, cargaInicialLista, a -> false, Set.of());
    }

    /**
     * @param enOtros         si la alerta cae en el componente "otros" (la regla de Activos atacados)
     * @param gruposGenericos grupos que no definen componente, en minúsculas (para marcarlos)
     */
    public static DiagnosticoActivos calcular(Collection<AlertaWazuh> alertas, boolean cargaInicialLista,
                                              Predicate<AlertaWazuh> enOtros, Set<String> gruposGenericos) {
        int sinBloque = 0;
        Map<List<String>, Integer> agentes = new HashMap<>();
        Map<String, Integer> equipos = new HashMap<>();
        Map<String, Integer> grupos = new HashMap<>();
        Map<String, Integer> ubicaciones = new HashMap<>();
        Map<String, int[]> origenes = new HashMap<>();   // [total, con agente o equipo]
        Map<List<String>, Map<String, Integer>> gruposDeAgente = new HashMap<>();
        int otrosAlertas = 0;
        int otrosAltas = 0;
        Map<String, int[]> otrosGrupos = new HashMap<>();             // [cantidad, altas y críticas]
        Map<String, int[]> otrosReglas = new HashMap<>();
        Map<String, AlertaWazuh> ejemploRegla = new HashMap<>();

        for (AlertaWazuh a : alertas) {
            AlertaWazuh.Activo activo = a.activo();
            if (!a.conBloque()) {
                sinBloque++;
            }
            boolean hayAgente = a.agente() != null || activo.agenteId() != null;
            if (hayAgente) {
                List<String> clave = List.of(valor(activo.agenteId()), valor(a.agente()));
                agentes.merge(clave, 1, Integer::sum);
                Map<String, Integer> suyos = gruposDeAgente.computeIfAbsent(clave, k -> new HashMap<>());
                for (String grupo : activo.grupos()) {
                    suyos.merge(valor(grupo), 1, Integer::sum);
                }
                if (enOtros.test(a)) {
                    boolean alta = activo.altaOCritica();
                    otrosAlertas++;
                    if (alta) {
                        otrosAltas++;
                    }
                    for (String grupo : activo.grupos()) {
                        sumar(otrosGrupos, valor(grupo), alta);
                    }
                    String regla = valor(a.reglaId());
                    sumar(otrosReglas, regla, alta);
                    ejemploRegla.putIfAbsent(regla, a);
                }
            }
            if (activo.equipo() != null) {
                equipos.merge(valor(activo.equipo()), 1, Integer::sum);
            }
            for (String grupo : activo.grupos()) {
                grupos.merge(valor(grupo), 1, Integer::sum);
            }
            if (a.conBloque()) {
                ubicaciones.merge(valor(activo.ubicacion()), 1, Integer::sum);
            }
            int[] cuenta = origenes.computeIfAbsent(valor(activo.origen()), k -> new int[2]);
            cuenta[0]++;
            if (hayAgente || activo.equipo() != null) {
                cuenta[1]++;
            }
        }

        List<Agente> listaAgentes = agentes.entrySet().stream()
                .map(e -> new Agente(e.getKey().get(0), e.getKey().get(1), e.getValue()))
                .sorted(Comparator.comparingInt(Agente::cantidad).reversed()
                        .thenComparing(Agente::id).thenComparing(Agente::nombre))
                .toList();
        List<Origen> listaOrigenes = origenes.entrySet().stream()
                .map(e -> new Origen(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[0] - e.getValue()[1]))
                .sorted(Comparator.comparingInt(Origen::total).reversed().thenComparing(Origen::origen))
                .toList();

        List<GruposDeAgente> cruce = listaAgentes.stream()
                .map(ag -> new GruposDeAgente(ag.id(), ag.nombre(), ag.cantidad(),
                        top(gruposDeAgente.get(List.of(ag.id(), ag.nombre())), TOP_GRUPOS_POR_AGENTE)))
                .toList();

        List<GrupoOtros> gruposOtros = otrosGrupos.entrySet().stream()
                .map(e -> new GrupoOtros(e.getKey(), e.getValue()[0], e.getValue()[1],
                        gruposGenericos.contains(e.getKey().toLowerCase(java.util.Locale.ROOT))))
                .sorted(Comparator.comparingInt(GrupoOtros::cantidad).reversed().thenComparing(GrupoOtros::nombre))
                .toList();
        List<ReglaOtros> reglasOtros = otrosReglas.entrySet().stream()
                .map(e -> {
                    AlertaWazuh ej = ejemploRegla.get(e.getKey());
                    return new ReglaOtros(e.getKey(), ej.reglaNivel(), ej.reglaDescripcion() == null ? null : valor(ej.reglaDescripcion()),
                            e.getValue()[0], e.getValue()[1]);
                })
                .sorted(Comparator.comparingInt(ReglaOtros::cantidad).reversed().thenComparing(ReglaOtros::id))
                .limit(TOP_REGLAS_OTROS)
                .toList();
        Otros otros = otrosAlertas == 0 ? Otros.VACIO : new Otros(otrosAlertas, otrosAltas, gruposOtros, reglasOtros);

        return new DiagnosticoActivos(alertas.size(), cargaInicialLista, sinBloque, listaAgentes,
                top(equipos, Integer.MAX_VALUE), top(grupos, TOP_GRUPOS), top(ubicaciones, TOP_UBICACIONES), listaOrigenes,
                cruce, otros);
    }

    private static void sumar(Map<String, int[]> conteos, String clave, boolean alta) {
        int[] c = conteos.computeIfAbsent(clave, k -> new int[2]);
        c[0]++;
        if (alta) {
            c[1]++;
        }
    }

    private static List<Conteo> top(Map<String, Integer> conteos, int limite) {
        return conteos.entrySet().stream()
                .map(e -> new Conteo(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(Conteo::cantidad).reversed().thenComparing(Conteo::nombre))
                .limit(limite)
                .toList();
    }

    /** El nombre sin IPs, o "(sin valor)". */
    static String valor(String texto) {
        if (texto == null || texto.isBlank()) {
            return SIN_VALOR;
        }
        String sinIpv4 = IPV4.matcher(texto.strip()).replaceAll("<ip>");
        return IPV6.matcher(sinIpv4).replaceAll("<ip>");
    }
}
