package co.edu.escuelaing.dashboard.wazuh;

import static org.assertj.core.api.Assertions.assertThat;

import co.edu.escuelaing.dashboard.dominio.FixturesTheHive;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh.Activo;
import co.edu.escuelaing.dashboard.wazuh.DiagnosticoActivos.Agente;
import co.edu.escuelaing.dashboard.wazuh.DiagnosticoActivos.Conteo;
import co.edu.escuelaing.dashboard.wazuh.DiagnosticoActivos.GruposDeAgente;
import co.edu.escuelaing.dashboard.wazuh.DiagnosticoActivos.Origen;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DiagnosticoActivosTest {

    private static AlertaWazuh conActivo(String id, String agente, Activo activo) {
        return new AlertaWazuh(id, 1L, true, "1", 3, "x", List.of(), List.of(), Map.of(), "192.0.2.9", "usuario-09", agente, activo);
    }

    @Test
    void conLasAlertasRealesSacaAgentesEquiposGruposYUbicaciones() {
        List<AlertaWazuh> alertas = FixturesTheHive.alertas().stream()
                .filter(a -> "wazuh".equals(a.tipo())).map(AlertaWazuh::de).toList();

        DiagnosticoActivos d = DiagnosticoActivos.calcular(alertas, true);

        assertThat(d.alertasEnCache()).isEqualTo(alertas.size());
        assertThat(d.cargaInicialLista()).isTrue();
        assertThat(d.agentes()).extracting(Agente::id, Agente::nombre)
                .contains(org.assertj.core.groups.Tuple.tuple("005", "equipo-02"), org.assertj.core.groups.Tuple.tuple("000", "equipo-03"));
        assertThat(d.equiposWindows()).extracting(Conteo::nombre).containsExactly("equipo-02");
        assertThat(d.gruposRegla()).extracting(Conteo::nombre).contains("windows", "sshd", "WEF");   // " WEF" sin espacio
        assertThat(d.ubicaciones()).extracting(Conteo::nombre).contains("EventChannel", "journald");
        assertThat(d.porOrigen()).extracting(Origen::origen).containsExactly("wazuh");
        Origen wazuh = d.porOrigen().get(0);
        assertThat(wazuh.conAgenteOEquipo() + wazuh.sinAgenteNiEquipo()).isEqualTo(wazuh.total());
    }

    @Test
    void cuentaPorOrigenConYSinAgenteOEquipo() {
        List<AlertaWazuh> alertas = List.of(
                conActivo("a", "srv-db", new Activo("sysmon", "007", "SRV-DB", "EventChannel", List.of("sysmon"))),
                conActivo("b", null, new Activo("sysmon", null, "SRV-DB", "EventChannel", List.of("sysmon"))),
                conActivo("c", null, new Activo("auditd", null, null, "/var/log/audit/audit.log", List.of("audit"))),
                new AlertaWazuh("d", 1L, false, null, null, null, List.of(), List.of(), Map.of(), null, null, null,
                        new Activo("auditd", null, null, null, List.of())));

        DiagnosticoActivos d = DiagnosticoActivos.calcular(alertas, false);

        assertThat(d.porOrigen()).containsExactly(new Origen("auditd", 2, 0, 2), new Origen("sysmon", 2, 2, 0));
        assertThat(d.agentes()).containsExactly(new Agente("007", "srv-db", 1));
        assertThat(d.equiposWindows()).containsExactly(new Conteo("SRV-DB", 2));
        assertThat(d.sinBloque()).isEqualTo(1);
        assertThat(d.ubicaciones()).extracting(Conteo::nombre).doesNotContain(DiagnosticoActivos.SIN_VALOR);
        assertThat(d.cargaInicialLista()).isFalse();
    }

    @Test
    void recortaLosTopsYOrdenaDeMayorAMenor() {
        List<AlertaWazuh> alertas = new ArrayList<>();
        for (int g = 0; g < 50; g++) {
            for (int n = 0; n <= g; n++) {
                alertas.add(conActivo(g + "-" + n, null,
                        new Activo("wazuh", null, null, "log-" + g, List.of("grupo-" + g))));
            }
        }

        DiagnosticoActivos d = DiagnosticoActivos.calcular(alertas, true);

        assertThat(d.gruposRegla()).hasSize(DiagnosticoActivos.TOP_GRUPOS);
        assertThat(d.gruposRegla().get(0)).isEqualTo(new Conteo("grupo-49", 50));
        assertThat(d.ubicaciones()).hasSize(DiagnosticoActivos.TOP_UBICACIONES);
        assertThat(d.ubicaciones().get(0).nombre()).isEqualTo("log-49");
    }

    @Test
    void cruzaCadaAgenteConSusGruposMasFrecuentes() {
        List<AlertaWazuh> alertas = new ArrayList<>();
        for (int g = 0; g < 20; g++) {
            for (int n = 0; n <= g; n++) {
                alertas.add(conActivo("w" + g + "-" + n, "srv-web", new Activo("wazuh", "001", null, "x", List.of("grupo-" + g))));
            }
        }
        alertas.add(conActivo("db1", "srv-db", new Activo("wazuh", "002", null, "x", List.of("mariadb_lab", "syslog"))));
        alertas.add(conActivo("db2", "srv-db", new Activo("wazuh", "002", null, "x", List.of("mariadb_lab"))));
        alertas.add(conActivo("db3", "srv-db", new Activo("wazuh", "002", null, "x", List.of())));
        alertas.add(conActivo("sin", null, new Activo("wazuh", null, null, "x", List.of("huerfano"))));   // sin agente: fuera del cruce

        DiagnosticoActivos d = DiagnosticoActivos.calcular(alertas, true);

        assertThat(d.gruposPorAgente()).extracting(GruposDeAgente::nombre).containsExactly("srv-web", "srv-db");
        GruposDeAgente web = d.gruposPorAgente().get(0);
        assertThat(web.id()).isEqualTo("001");
        assertThat(web.grupos()).hasSize(DiagnosticoActivos.TOP_GRUPOS_POR_AGENTE);
        assertThat(web.grupos().get(0)).isEqualTo(new Conteo("grupo-19", 20));
        GruposDeAgente db = d.gruposPorAgente().get(1);
        assertThat(db.cantidad()).isEqualTo(3);
        assertThat(db.grupos()).containsExactly(new Conteo("mariadb_lab", 2), new Conteo("syslog", 1));
        assertThat(d.gruposPorAgente()).flatExtracting(GruposDeAgente::grupos).extracting(Conteo::nombre).doesNotContain("huerfano");
    }

    @Test
    void nuncaSaleUnaIpNiUnUsuario() throws Exception {
        List<AlertaWazuh> alertas = List.of(
                conActivo("a", "10.1.2.3", new Activo("wazuh", "001", null, "192.168.1.20->/var/log/syslog", List.of())),
                conActivo("b", "srv", new Activo("wazuh", "002", "fe80::1:2", "journald", List.of("grupo-10.9.8.7"))));

        String json = new ObjectMapper().writeValueAsString(DiagnosticoActivos.calcular(alertas, true));

        assertThat(json).doesNotContain("10.1.2.3", "192.168.1.20", "fe80::1:2", "10.9.8.7", "192.0.2.9", "usuario-09")
                .contains("<ip>->/var/log/syslog");
    }
}
