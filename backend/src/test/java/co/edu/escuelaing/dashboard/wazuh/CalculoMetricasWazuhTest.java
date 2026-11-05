package co.edu.escuelaing.dashboard.wazuh;

import static org.assertj.core.api.Assertions.assertThat;

import co.edu.escuelaing.dashboard.dominio.FixturesTheHive;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh.Tecnica;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoIp;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoNivel;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoRegla;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoTactica;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.ConteoTecnica;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.Marco;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh.Requisito;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CalculoMetricasWazuhTest {

    private static final EstadoTheHive OK = new EstadoTheHive(true, 1L);

    /** Una alerta de Wazuh armada a mano. */
    private static AlertaWazuh aw(String id, String regla, Integer nivel, String descripcion, List<String> tacticas, List<Tecnica> tecnicas,
                                  Map<String, List<String>> controles, String ip, String usuario, String agente) {
        return new AlertaWazuh(id, 1L, true, regla, nivel, descripcion, tacticas, tecnicas, controles, ip, usuario, agente);
    }

    private static AlertaWazuh simple(String id) {
        return aw(id, "5710", 5, "sshd", List.of(), List.of(), Map.of(), null, null, null);
    }

    private static MetricasWazuh calcular(List<AlertaWazuh> alertas) {
        return CalculoMetricasWazuh.calcular(alertas, 100L, OK, 7, "2026-10-29", 10);
    }

    // ---- MITRE ----

    @Test
    void cadaAlertaCuentaUnaVezPorTacticaAunqueLaReglaLaRepita() {
        var a = aw("1", "60106", 3, "x", List.of("Defense Evasion", "Persistence", "Defense Evasion"), List.of(), Map.of(), null, null, null);
        var b = aw("2", "5710", 5, "x", List.of("Credential Access", "Persistence"), List.of(), Map.of(), null, null, null);

        var mitre = calcular(List.of(a, b)).mitre();

        assertThat(mitre.tacticas()).containsExactly(
                new ConteoTactica("persistencia", 2), new ConteoTactica("acceso-a-credenciales", 1), new ConteoTactica("evasion-de-defensas", 1));
    }

    @Test
    void lasTecnicasSeAgrupanPorIdYUsanElNombreSiVienenAlineadas() {
        var a = aw("1", "1", 3, "x", List.of(), List.of(new Tecnica("T1110.001", "Password Guessing"), new Tecnica("T1021.004", "SSH")), Map.of(), null, null, null);
        var b = aw("2", "1", 3, "x", List.of(), List.of(new Tecnica("T1110.001", "Password Guessing"), new Tecnica("T1110.001", "Password Guessing")), Map.of(), null, null, null);
        var c = aw("3", "1", 3, "x", List.of(), List.of(new Tecnica("T1078", null)), Map.of(), null, null, null);

        var tecnicas = calcular(List.of(a, b, c)).mitre().tecnicas();

        assertThat(tecnicas).containsExactly(
                new ConteoTecnica("T1110.001", "Password Guessing", 2), new ConteoTecnica("T1021.004", "SSH", 1), new ConteoTecnica("T1078", null, 1));
    }

    // ---- cumplimiento ----

    @Test
    void elCumplimientoCuentaAlertasPorMarcoYLosTresRequisitosMasAfectados() {
        Map<String, List<String>> uno = new LinkedHashMap<>();
        uno.put("pci_dss", List.of("10.2.4", "10.2.5", "10.2.4"));   // repetido en la misma alerta: cuenta una vez
        uno.put("gdpr", List.of("IV_35.7.d"));
        Map<String, List<String>> dos = Map.of("pci_dss", List.of("10.2.5", "10.6.1"));
        Map<String, List<String>> tres = Map.of("pci_dss", List.of("10.2.5", "11.4", "10.6.1"));
        var alertas = List.of(
                aw("1", "1", 3, "x", List.of(), List.of(), uno, null, null, null),
                aw("2", "1", 3, "x", List.of(), List.of(), dos, null, null, null),
                aw("3", "1", 3, "x", List.of(), List.of(), tres, null, null, null),
                simple("4"));

        List<Marco> cumplimiento = calcular(alertas).cumplimiento();

        assertThat(cumplimiento).extracting(Marco::marco).containsExactly("pci_dss", "nist_800_53", "gdpr", "hipaa", "tsc");
        Marco pci = cumplimiento.get(0);
        assertThat(pci.alertas()).as("3 de las 4 alertas tocan controles de PCI DSS").isEqualTo(3);
        assertThat(pci.requisitos()).containsExactly(new Requisito("10.2.5", 3), new Requisito("10.6.1", 2), new Requisito("10.2.4", 1));
        assertThat(cumplimiento.get(2).alertas()).isEqualTo(1);
        assertThat(cumplimiento.get(1)).as("sin alertas del marco: 0 y sin requisitos, pero el marco sigue ahí").isEqualTo(new Marco("nist_800_53", 0, List.of()));
    }

    @Test
    void gpg13NoEsUnMarcoDelDashboard() {
        assertThat(AlertaWazuh.MARCOS).doesNotContain("gpg13");
    }

    // ---- rankings ----

    @Test
    void losRankingsVanDeMayorAMenorConTopNYEmpatesPorNombre() {
        List<AlertaWazuh> alertas = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            alertas.add(aw("a" + i, "5710", 5, "sshd: usuario inexistente", List.of(), List.of(), Map.of(), "203.0.113.9", "root", "equipo-01"));
        }
        for (int i = 0; i < 2; i++) {
            alertas.add(aw("b" + i, "5503", 5, "PAM: fallo", List.of(), List.of(), Map.of(), "198.51.100.7", "admin", "equipo-02"));
            alertas.add(aw("c" + i, "60106", 3, "Windows Logon Success", List.of(), List.of(), Map.of(), "192.0.2.5", "admin", "equipo-02"));
        }

        var m = CalculoMetricasWazuh.calcular(alertas, 1L, OK, 7, "2026-10-29", 2);

        assertThat(m.topIps()).containsExactly(new ConteoIp("203.0.113.9", 5), new ConteoIp("192.0.2.5", 2));
        assertThat(m.topUsuarios()).extracting(u -> u.usuario() + ":" + u.cantidad()).containsExactly("root:5", "admin:4");
        assertThat(m.topReglas()).containsExactly(
                new ConteoRegla("5710", "sshd: usuario inexistente", 5, 5), new ConteoRegla("5503", "PAM: fallo", 5, 2));
        assertThat(m.agentes()).extracting(g -> g.nombre() + ":" + g.cantidad()).containsExactly("equipo-01:5", "equipo-02:4");
        assertThat(m.porNivel()).containsExactly(new ConteoNivel(5, 7), new ConteoNivel(3, 2));
    }

    @Test
    void ipsYUsuariosAusentesOEnBlancoNoCuentan() {
        var a = aw("1", "1", 3, "x", List.of(), List.of(), Map.of(), " ", "", null);

        var m = calcular(List.of(a));

        assertThat(m.topIps()).isEmpty();
        assertThat(m.topUsuarios()).isEmpty();
        assertThat(m.agentes()).isEmpty();
    }

    // ---- sin bloque y vacío ----

    @Test
    void lasAlertasSinBloqueSeCuentanAparteYNoEntranEnLasMetricas() {
        var sinBloque = new AlertaWazuh("x", 1L, false, null, null, null, List.of(), List.of(), Map.of(), null, null, null);

        var m = calcular(List.of(simple("1"), sinBloque, sinBloque));

        assertThat(m.alertasAnalizadas()).isEqualTo(1);
        assertThat(m.sinBloque()).isEqualTo(2);
        assertThat(m.topReglas()).hasSize(1);
    }

    @Test
    void sinAlertasEstaListoConListasVaciasNoEnEstadoCargando() {
        var m = calcular(List.of());

        assertThat(m.estado()).isEqualTo("listo");
        assertThat(m.progreso()).isEqualTo(100);
        assertThat(m.alertasAnalizadas()).isZero();
        assertThat(m.mitre().tacticas()).isEmpty();
        assertThat(m.topIps()).isEmpty();
        assertThat(m.cumplimiento()).hasSize(5).allSatisfy(marco -> assertThat(marco.alertas()).isZero());
    }

    // ---- con los fixtures anonimizados ----

    @Test
    void conLosFixturesAnonimizados() {
        List<AlertaWazuh> alertas = FixturesTheHive.alertas().stream().map(AlertaWazuh::de).toList();

        var m = calcular(alertas);

        assertThat(m.alertasAnalizadas() + m.sinBloque()).isEqualTo(alertas.size());
        assertThat(m.sinBloque()).as("laboratorio, MISP y simulación no traen bloque de Wazuh").isEqualTo(6);
        assertThat(m.alertasAnalizadas()).isEqualTo(9);
        assertThat(m.mitre().tacticas()).extracting(ConteoTactica::clave).contains("evasion-de-defensas")
                .allSatisfy(clave -> assertThat(clave).matches("[a-z0-9]+(-[a-z0-9]+)*"));
        assertThat(m.mitre().tecnicas()).extracting(ConteoTecnica::id).contains("T1078");
        assertThat(m.cumplimiento().get(0).marco()).isEqualTo("pci_dss");
        assertThat(m.cumplimiento().get(0).alertas()).isPositive();
        assertThat(m.cumplimiento().get(0).requisitos()).hasSizeLessThanOrEqualTo(3);
        assertThat(m.topIps()).allSatisfy(ip -> assertThat(ip.ip()).startsWith("192.0.2."));
        assertThat(m.topUsuarios()).allSatisfy(u -> assertThat(u.usuario()).startsWith("usuario-"));
        assertThat(m.agentes()).allSatisfy(g -> assertThat(g.nombre()).startsWith("equipo-"));
        assertThat(m.topReglas()).extracting(ConteoRegla::id).contains("60106", "5710");
        assertThat(m.topReglas().stream().filter(r -> r.id().equals("60106")).findFirst().orElseThrow().nivel()).isEqualTo(3);
    }

    @Test
    void unaAlertaConTodosLosCamposAusentesSeLeeSinFallar() {
        var alerta = co.edu.escuelaing.dashboard.dominio.Alerta.desde(FixturesTheHive.json(
                "{\"_id\":\"~1\",\"_createdAt\":5,\"description\":\"```json\\n{}\\n```\"}"));

        var aw = AlertaWazuh.de(alerta);

        assertThat(aw.conBloque()).isTrue();
        assertThat(aw.tacticas()).isEmpty();
        assertThat(aw.controles()).isEmpty();
        assertThat(aw.ip()).isNull();
    }

    @Test
    void unaAlertaConJsonRotoOSinBloqueSeGuardaComoSinBloque() {
        for (String descripcion : List.of("Evento MISP", "```json\n{\"regla\": {\n```", "")) {
            var alerta = new co.edu.escuelaing.dashboard.dominio.Alerta("~1", 5, "wazuh", "wazuh", "r", "t", descripcion, 1, "New", List.of(), null);

            assertThat(AlertaWazuh.de(alerta).conBloque()).as(descripcion).isFalse();
        }
    }
}
