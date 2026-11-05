package co.edu.escuelaing.dashboard.dominio;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ExtractorWazuhTest {

    private static DatosWazuh de(String reglaId) {
        return ExtractorWazuh.extraer(FixturesTheHive.deRegla(reglaId).descripcion()).orElseThrow();
    }

    @Test
    void leeUnaAlertaDeWindowsConMitre() {
        DatosWazuh d = de("60106");

        assertThat(d.reglaId()).isEqualTo("60106");
        assertThat(d.reglaNivel()).isEqualTo(3);
        assertThat(d.reglaDescripcion()).isEqualTo("Windows Logon Success");
        assertThat(d.idsMitre()).containsExactly("T1078");
        assertThat(d.tacticas()).containsExactly("Defense Evasion", "Persistence", "Privilege Escalation", "Initial Access");
        assertThat(d.tecnicas()).containsExactly("Valid Accounts");
        assertThat(d.primeraTactica()).isEqualTo("Defense Evasion");
        assertThat(d.cumplimiento()).containsKeys("pci_dss", "gdpr", "hipaa", "nist_800_53", "tsc", "gpg13");
        assertThat(d.cumplimiento().get("nist_800_53")).containsExactly("AU.14", "AC.7");
        assertThat(d.agenteNombre()).startsWith("equipo-");
        assertThat(d.agenteIp()).startsWith("192.0.2.");
        assertThat(d.ubicacion()).isEqualTo("EventChannel");
        assertThat(d.fechaWazuh()).isEqualTo("2026-11-03T15:50:41.035+0000");
    }

    @Test
    void leeUnaAlertaDeLinuxConIpYUsuario() {
        DatosWazuh d = de("5710");

        assertThat(d.datos()).containsKey("srcip");
        assertThat(d.datos().get("srcip")).startsWith("192.0.2.").isNotEmpty();
        assertThat(d.datos().get("srcuser")).startsWith("usuario-");
        assertThat(d.agenteNombre()).startsWith("equipo-");
        assertThat(d.agenteIp()).isNull();           // el servidor Wazuh no trae ip
        assertThat(d.ubicacion()).isEqualTo("journald");
    }

    @Test
    void unaReglaSinMitreQuedaConListasVacias() {
        DatosWazuh d = de("60137");

        assertThat(d.tacticas()).isEmpty();
        assertThat(d.idsMitre()).isEmpty();
        assertThat(d.primeraTactica()).isNull();
        assertThat(d.reglaId()).isEqualTo("60137");
    }

    @Test
    void losEspaciosSobrantesSeQuitan() {
        // Wazuh manda " WEF" (con espacio) en algunos grupos.
        assertThat(de("67023").grupos()).containsExactly("windows", "WEF");
    }

    @Test
    void sinBloqueJsonNoHayDatos() {
        assertThat(ExtractorWazuh.extraer("Se detectó ejecución de PowerShell con parámetros codificados.")).isEmpty();
        assertThat(ExtractorWazuh.extraer("Evento MISP: 2312\nUUID: x")).isEmpty();
        assertThat(ExtractorWazuh.extraer("")).isEmpty();
        assertThat(ExtractorWazuh.extraer(null)).isEmpty();
    }

    @Test
    void conJsonRotoNoHayDatosYNoSeLanzaNada() {
        assertThat(ExtractorWazuh.extraer("Alerta\n```json\n{\"regla\": {\"id\": \"5710\", \n```")).isEmpty();
        assertThat(ExtractorWazuh.extraer("```json\nesto no es json\n```")).isEmpty();
        assertThat(ExtractorWazuh.extraer("```json\n```")).isEmpty();
    }

    @Test
    void unJsonQueNoEsUnObjetoNoSirve() {
        assertThat(ExtractorWazuh.extraer("```json\n[1,2,3]\n```")).isEmpty();
        assertThat(ExtractorWazuh.extraer("```json\n\"hola\"\n```")).isEmpty();
    }

    @Test
    void conCamposAusentesDevuelveLoQueHay() {
        DatosWazuh d = ExtractorWazuh.extraer("```json\n{\"regla\":{\"id\":\"999\"}}\n```").orElseThrow();

        assertThat(d.reglaId()).isEqualTo("999");
        assertThat(d.reglaNivel()).isNull();
        assertThat(d.reglaDescripcion()).isNull();
        assertThat(d.tacticas()).isEmpty();
        assertThat(d.cumplimiento()).isEmpty();
        assertThat(d.agenteNombre()).isNull();
        assertThat(d.datos()).isEmpty();
    }

    @Test
    void unObjetoVacioDaDatosVacios() {
        DatosWazuh d = ExtractorWazuh.extraer("```json\n{}\n```").orElseThrow();

        assertThat(d.reglaId()).isNull();
        assertThat(d.grupos()).isEmpty();
    }

    @Test
    void toleraTiposInesperados() {
        // id numérico, nivel como texto, mitre.tactic como texto y no lista, nulls explícitos.
        String descripcion = "```json\n{\"regla\":{\"id\":5710,\"level\":\"5\",\"mitre\":{\"tactic\":\"Credential Access\",\"id\":null},"
                + "\"groups\":[\"a\",null,3,{\"x\":1}]},\"agente\":null,\"datos\":{\"srcip\":null,\"srcport\":33293,\"srcuser\":{\"a\":1}}}\n```";

        DatosWazuh d = ExtractorWazuh.extraer(descripcion).orElseThrow();

        assertThat(d.reglaId()).isEqualTo("5710");
        assertThat(d.reglaNivel()).isNull();                       // "5" (texto) no es un número: se ignora
        assertThat(d.tacticas()).isEmpty();                        // no es una lista
        assertThat(d.grupos()).containsExactly("a", "3");
        assertThat(d.agenteNombre()).isNull();
        assertThat(d.datos()).containsOnlyKeys("srcport").containsEntry("srcport", "33293");
    }

    @Test
    void conVariosBloquesUsaElPrimero() {
        String descripcion = "```json\n{\"regla\":{\"id\":\"1\"}}\n```\n\n```json\n{\"regla\":{\"id\":\"2\"}}\n```";

        assertThat(ExtractorWazuh.extraer(descripcion).orElseThrow().reglaId()).isEqualTo("1");
    }

    @Test
    void todasLasAlertasDeLosFixturesSeLeenSinFallar() {
        for (var alerta : FixturesTheHive.alertas()) {
            var datos = ExtractorWazuh.extraer(alerta.descripcion());
            if ("wazuh".equals(alerta.origen())) {
                assertThat(datos).as(alerta.id()).isPresent();
            } else {
                assertThat(datos).as(alerta.id()).isEmpty();   // lab, misp, simulación: sin bloque de Wazuh
            }
        }
    }
}
