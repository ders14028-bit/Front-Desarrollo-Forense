package co.edu.escuelaing.dashboard.wazuh;

import co.edu.escuelaing.dashboard.dominio.TacticasMitre;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoAgente;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoIp;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoNivel;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoRegla;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoTactica;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoTecnica;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoUsuario;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.Marco;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.Mitre;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.Requisito;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Calcula las métricas desde las alertas guardadas. Función pura: no consulta nada ni lee el reloj.
 *
 * <p>Una alerta cuenta UNA vez por cada táctica, técnica, marco y control que toca (aunque la regla lo repita), y una vez
 * por IP, usuario, regla, agente y nivel. Los empates se ordenan por nombre.
 */
public final class CalculoMetricasWazuh {

    /** Requisitos más afectados que se devuelven por marco. */
    static final int REQUISITOS_POR_MARCO = 3;

    private static final Comparator<String> NOMBRES = ((Comparator<String>) Collator.getInstance(Locale.forLanguageTag("es"))::compare);

    private CalculoMetricasWazuh() {
    }

    public static MetricasWazuh calcular(Collection<AlertaWazuh> alertas, long generadoEn, EstadoTheHive thehive, int dias,
                                         String desde, int topN) {
        List<AlertaWazuh> conBloque = alertas.stream().filter(AlertaWazuh::conBloque).toList();
        long sinBloque = alertas.size() - conBloque.size();

        Map<String, Long> tacticas = new HashMap<>();
        Map<String, Long> tecnicasPorId = new HashMap<>();
        Map<String, String> nombreTecnica = new HashMap<>();
        Map<String, Long> ips = new HashMap<>();
        Map<String, Long> usuarios = new HashMap<>();
        Map<String, Long> agentes = new HashMap<>();
        Map<Integer, Long> niveles = new HashMap<>();
        Map<String, Long> reglas = new HashMap<>();
        Map<String, String> descripcionRegla = new HashMap<>();
        Map<String, Integer> nivelRegla = new HashMap<>();
        Map<String, Long> alertasPorMarco = new HashMap<>();
        Map<String, Map<String, Long>> controlesPorMarco = new HashMap<>();

        for (AlertaWazuh a : conBloque) {
            Set<String> tacticasDeLaAlerta = new LinkedHashSet<>();
            a.tacticas().forEach(t -> {
                String clave = TacticasMitre.clave(t);
                if (clave != null) {
                    tacticasDeLaAlerta.add(clave);
                }
            });
            tacticasDeLaAlerta.forEach(t -> tacticas.merge(t, 1L, Long::sum));

            Set<String> tecnicasVistas = new HashSet<>();
            for (AlertaWazuh.Tecnica t : a.tecnicas()) {
                if (t.id() != null && tecnicasVistas.add(t.id())) {
                    tecnicasPorId.merge(t.id(), 1L, Long::sum);
                    if (t.nombre() != null) {
                        nombreTecnica.putIfAbsent(t.id(), t.nombre());
                    }
                }
            }

            for (var marco : a.controles().entrySet()) {
                alertasPorMarco.merge(marco.getKey(), 1L, Long::sum);
                Map<String, Long> controles = controlesPorMarco.computeIfAbsent(marco.getKey(), k -> new HashMap<>());
                for (String control : new LinkedHashSet<>(marco.getValue())) {
                    controles.merge(control, 1L, Long::sum);
                }
            }

            contar(ips, a.ip());
            contar(usuarios, a.usuario());
            contar(agentes, a.agente());
            if (a.reglaNivel() != null) {
                niveles.merge(a.reglaNivel(), 1L, Long::sum);
            }
            if (a.reglaId() != null) {
                reglas.merge(a.reglaId(), 1L, Long::sum);
                if (a.reglaDescripcion() != null) {
                    descripcionRegla.putIfAbsent(a.reglaId(), a.reglaDescripcion());
                }
                if (a.reglaNivel() != null) {
                    nivelRegla.putIfAbsent(a.reglaId(), a.reglaNivel());
                }
            }
        }

        List<ConteoTactica> listaTacticas = ordenar(tacticas).stream().map(e -> new ConteoTactica(e.getKey(), e.getValue())).toList();
        List<ConteoTecnica> listaTecnicas = ordenar(tecnicasPorId).stream().limit(topN)
                .map(e -> new ConteoTecnica(e.getKey(), nombreTecnica.get(e.getKey()), e.getValue())).toList();

        List<Marco> cumplimiento = new ArrayList<>();
        for (String marco : AlertaWazuh.MARCOS) {
            List<Requisito> requisitos = ordenar(controlesPorMarco.getOrDefault(marco, Map.of())).stream()
                    .limit(REQUISITOS_POR_MARCO).map(e -> new Requisito(e.getKey(), e.getValue())).toList();
            cumplimiento.add(new Marco(marco, alertasPorMarco.getOrDefault(marco, 0L), requisitos));
        }

        List<ConteoRegla> topReglas = ordenar(reglas).stream().limit(topN)
                .map(e -> new ConteoRegla(e.getKey(), descripcionRegla.get(e.getKey()), nivelRegla.get(e.getKey()), e.getValue())).toList();
        List<ConteoNivel> porNivel = niveles.entrySet().stream()
                .sorted(Map.Entry.<Integer, Long>comparingByKey().reversed())
                .map(e -> new ConteoNivel(e.getKey(), e.getValue())).toList();

        return new MetricasWazuh(generadoEn, MetricasWazuh.LISTO, 100, thehive, dias, desde, (long) conBloque.size(), sinBloque,
                new Mitre(listaTacticas, listaTecnicas), cumplimiento,
                ordenar(ips).stream().limit(topN).map(e -> new ConteoIp(e.getKey(), e.getValue())).toList(),
                ordenar(usuarios).stream().limit(topN).map(e -> new ConteoUsuario(e.getKey(), e.getValue())).toList(),
                topReglas,
                ordenar(agentes).stream().map(e -> new ConteoAgente(e.getKey(), e.getValue())).toList(),
                porNivel);
    }

    private static void contar(Map<String, Long> cuentas, String clave) {
        if (clave != null && !clave.isBlank()) {
            cuentas.merge(clave, 1L, Long::sum);
        }
    }

    /** De mayor a menor cantidad y, a igualdad, por nombre. */
    private static List<Map.Entry<String, Long>> ordenar(Map<String, Long> cuentas) {
        return cuentas.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey(NOMBRES)))
                .toList();
    }
}
