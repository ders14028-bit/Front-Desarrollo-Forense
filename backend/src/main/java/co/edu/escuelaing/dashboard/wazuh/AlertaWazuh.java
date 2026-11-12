package co.edu.escuelaing.dashboard.wazuh;

import co.edu.escuelaing.dashboard.dominio.Alerta;
import co.edu.escuelaing.dashboard.dominio.DatosWazuh;
import co.edu.escuelaing.dashboard.dominio.ExtractorWazuh;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Lo que se guarda en memoria de cada alerta de Wazuh: solo los campos que usan las métricas, no la descripción
 * completa. Una alerta sin bloque legible se guarda igual ({@code conBloque = false}, resto vacío): así no se vuelve a
 * pedir ni a procesar, y se cuenta como "sin bloque".
 *
 * @param tacticas  tácticas MITRE de la regla, tal como las manda Wazuh (en inglés)
 * @param tecnicas  técnicas MITRE (id y nombre)
 * @param controles controles de cumplimiento por marco, solo los cinco marcos del dashboard
 * @param activo    de dónde viene la alerta (origen, agente, equipo, log y grupos de la regla); nunca null
 */
public record AlertaWazuh(String id, long creadaEn, boolean conBloque, String reglaId, Integer reglaNivel,
                          String reglaDescripcion, List<String> tacticas, List<Tecnica> tecnicas,
                          Map<String, List<String>> controles, String ip, String usuario, String agente, Activo activo) {

    /** Marcos de cumplimiento del dashboard, en el orden en que se muestran (nombres de los campos de Wazuh). */
    public static final List<String> MARCOS = List.of("pci_dss", "nist_800_53", "gdpr", "hipaa", "tsc");

    /** @param nombre puede ser null si Wazuh no lo manda alineado con el id */
    public record Tecnica(String id, String nombre) {
    }

    /**
     * El activo de la alerta. Todo puede ser null salvo {@code grupos}.
     *
     * @param origen    {@code source} de TheHive (wazuh, sysmon, auditd…)
     * @param agenteId  {@code agente.id} de Wazuh
     * @param equipo    {@code datos.win.system.computer} (eventos de Windows/Sysmon)
     * @param ubicacion {@code ubicacion}: el log de origen (EventChannel, journald, /var/log/auth.log…)
     * @param grupos    {@code regla.groups}, sin espacios sobrantes
     * @param severidad {@code severity} de TheHive (1 baja, 2 media, 3 alta, 4 crítica)
     */
    public record Activo(String origen, String agenteId, String equipo, String ubicacion, List<String> grupos, int severidad) {
        public static final Activo VACIO = new Activo(null, null, null, null, List.of(), 1);

        public Activo {
            grupos = grupos == null ? List.of() : List.copyOf(grupos);
            severidad = Math.max(1, Math.min(4, severidad));
        }

        /** Con severidad baja (las pruebas que no la necesitan). */
        public Activo(String origen, String agenteId, String equipo, String ubicacion, List<String> grupos) {
            this(origen, agenteId, equipo, ubicacion, grupos, 1);
        }

        /** "Altas y críticas" = severidad 3 o 4. */
        public boolean altaOCritica() {
            return severidad >= 3;
        }
    }

    public AlertaWazuh {
        tacticas = List.copyOf(tacticas);
        tecnicas = List.copyOf(tecnicas);
        controles = Map.copyOf(controles);
        activo = activo == null ? Activo.VACIO : activo;
    }

    /** Sin datos del activo (las pruebas de métricas no los necesitan). */
    public AlertaWazuh(String id, long creadaEn, boolean conBloque, String reglaId, Integer reglaNivel,
                       String reglaDescripcion, List<String> tacticas, List<Tecnica> tecnicas,
                       Map<String, List<String>> controles, String ip, String usuario, String agente) {
        this(id, creadaEn, conBloque, reglaId, reglaNivel, reglaDescripcion, tacticas, tecnicas, controles, ip, usuario, agente,
                Activo.VACIO);
    }

    public static AlertaWazuh de(Alerta alerta) {
        Optional<DatosWazuh> datos;
        try {
            datos = ExtractorWazuh.extraer(alerta.descripcion());
        } catch (RuntimeException e) {
            datos = Optional.empty(); // una alerta rara nunca rompe la sincronización
        }
        if (datos.isEmpty()) {
            return new AlertaWazuh(alerta.id(), alerta.creadaEn(), false, null, null, null, List.of(), List.of(), Map.of(), null, null, null,
                    new Activo(origenDe(alerta), null, null, null, List.of(), alerta.severidad()));
        }
        DatosWazuh d = datos.get();
        Map<String, List<String>> controles = new LinkedHashMap<>();
        for (String marco : MARCOS) {
            List<String> valores = d.cumplimiento().get(marco);
            if (valores != null && !valores.isEmpty()) {
                controles.put(marco, valores);
            }
        }
        return new AlertaWazuh(alerta.id(), alerta.creadaEn(), true, d.reglaId(), d.reglaNivel(), d.reglaDescripcion(),
                d.tacticas(), tecnicasDe(d), controles, d.datos().get("srcip"), d.datos().get("srcuser"), d.agenteNombre(),
                new Activo(origenDe(alerta), d.agenteId(), d.equipoWindows(), d.ubicacion(), d.grupos(),
                        alerta.severidad()));
    }

    private static String origenDe(Alerta alerta) {
        return alerta.origen() == null || alerta.origen().isBlank() ? null : alerta.origen().strip();
    }

    /** Une cada id con su nombre cuando las dos listas vienen alineadas; si no, solo ids. */
    private static List<Tecnica> tecnicasDe(DatosWazuh d) {
        List<Tecnica> tecnicas = new ArrayList<>();
        boolean alineadas = d.idsMitre().size() == d.tecnicas().size();
        for (int i = 0; i < d.idsMitre().size(); i++) {
            tecnicas.add(new Tecnica(d.idsMitre().get(i), alineadas ? d.tecnicas().get(i) : null));
        }
        return tecnicas;
    }
}
