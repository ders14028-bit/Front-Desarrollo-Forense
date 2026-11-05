package co.edu.escuelaing.dashboard.dominio;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AlertaYTipoTest {

    private static Alerta conEtiquetas(String... etiquetas) {
        return new Alerta("~1", 0, "wazuh", "wazuh", "ref", "t", "", 1, "New", List.of(etiquetas), null);
    }

    // ---- Alerta ----

    @Test
    void leeUnaAlertaDeTheHive() {
        Alerta a = Alerta.desde(FixturesTheHive.json("""
                {"_id":"~4096","_createdAt":1793720786967,"type":"wazuh","source":"wazuh","sourceRef":"x:1",
                 "title":"[WAZUH] Ejecución de código","description":"d","severity":3,"status":"Imported",
                 "tags":["wazuh","regla:5501"],"caseId":"~8196096"}"""));

        assertThat(a.id()).isEqualTo("~4096");
        assertThat(a.creadaEn()).isEqualTo(1793720786967L);
        assertThat(a.titulo()).isEqualTo("[WAZUH] Ejecución de código");
        assertThat(a.severidad()).isEqualTo(3);
        assertThat(a.estado()).isEqualTo("Imported");
        assertThat(a.etiquetas()).containsExactly("wazuh", "regla:5501");
        assertThat(a.casoId()).isEqualTo("~8196096");
        assertThat(a.tieneCaso()).isTrue();
        assertThat(a.sinAtender()).isFalse();
    }

    @Test
    void unCampoAusenteEsComoNull() {
        Alerta a = Alerta.desde(FixturesTheHive.json("{\"_id\":\"~1\",\"status\":\"New\"}"));

        assertThat(a.casoId()).isNull();
        assertThat(a.tieneCaso()).isFalse();
        assertThat(a.sinAtender()).isTrue();
        assertThat(a.etiquetas()).isEmpty();
        assertThat(a.titulo()).isEmpty();
        assertThat(a.creadaEn()).isZero();
    }

    @Test
    void laSeveridadSeAcotaAlRango() {
        assertThat(Alerta.desde(FixturesTheHive.json("{\"severity\":9}")).severidad()).isEqualTo(4);
        assertThat(Alerta.desde(FixturesTheHive.json("{\"severity\":0}")).severidad()).isEqualTo(1);
        assertThat(Alerta.desde(FixturesTheHive.json("{}")).severidad()).isEqualTo(1);
    }

    @Test
    void unCaseIdVacioONoTextoNoCuentaComoCaso() {
        assertThat(Alerta.desde(FixturesTheHive.json("{\"caseId\":\"\"}")).tieneCaso()).isFalse();
        assertThat(Alerta.desde(FixturesTheHive.json("{\"caseId\":null}")).tieneCaso()).isFalse();
    }

    @Test
    void todosLosFixturesSeLeen() {
        var alertas = FixturesTheHive.alertas();

        assertThat(alertas).isNotEmpty().allSatisfy(a -> {
            assertThat(a.id()).startsWith("~");
            assertThat(a.creadaEn()).isPositive();
            assertThat(a.severidad()).isBetween(1, 4);
            assertThat(a.sinAtender()).isTrue();
            assertThat(a.tieneCaso()).isFalse();
        });
    }

    // ---- Tipo de amenaza ----

    @Test
    void elEscenarioGanaSobreLaTacticaMitre() {
        Alerta a = conEtiquetas("wazuh", "regla:5710", "escenario:phishing");

        String tipo = TipoAmenaza.tipoDe(a, regla -> Optional.of("acceso-a-credenciales"));

        assertThat(tipo).isEqualTo("phishing");
    }

    @Test
    void sinEscenarioSeUsaLaTacticaDeLaRegla() {
        Alerta a = conEtiquetas("wazuh", "regla:5710");

        String tipo = TipoAmenaza.tipoDe(a, regla -> regla.equals("5710") ? Optional.of("acceso-a-credenciales") : Optional.empty());

        assertThat(tipo).isEqualTo("acceso-a-credenciales");
    }

    @Test
    void sinEscenarioNiTacticaQuedaSinClasificar() {
        assertThat(TipoAmenaza.tipoDe(conEtiquetas("wazuh", "regla:60137"), regla -> Optional.empty())).isNull();
        assertThat(TipoAmenaza.tipoDe(conEtiquetas("misp"), regla -> Optional.of("no-debe-usarse"))).isNull();
        assertThat(TipoAmenaza.tipoDe(conEtiquetas(), regla -> Optional.of("no-debe-usarse"))).isNull();
    }

    @Test
    void elTipoNuncaSeDeduceDelTituloNiDelOrigen() {
        Alerta a = new Alerta("~1", 0, "wazuh", "phishing-scanner", "r", "Ataque de fuerza bruta SSH contra el servidor", "", 2, "New",
                List.of("integracion-real"), null);

        assertThat(TipoAmenaza.tipoDe(a, regla -> Optional.empty())).isNull();
    }

    @Test
    void unEscenarioVacioNoCuentaYSeUsaElSiguienteConValor() {
        assertThat(TipoAmenaza.escenarioDe(List.of("escenario:", "escenario:  ", "escenario:malware", "escenario:phishing")))
                .isEqualTo("malware");
        assertThat(TipoAmenaza.escenarioDe(List.of("escenario:"))).isNull();
        assertThat(TipoAmenaza.escenarioDe(List.of("Escenario:malware"))).isNull();   // distingue mayúsculas, como TheHive
    }

    @Test
    void laReglaSeLeeDeLaEtiqueta() {
        assertThat(TipoAmenaza.reglaDe(List.of("wazuh", "regla:5710"))).isEqualTo("5710");
        assertThat(TipoAmenaza.reglaDe(List.of("wazuh"))).isNull();
        assertThat(TipoAmenaza.reglaDe(List.of("regla:"))).isNull();
    }

    @Test
    void latacticaSaleDeLaDescripcionDeLaAlerta() {
        assertThat(TipoAmenaza.tacticaDe(FixturesTheHive.deRegla("60106").descripcion())).contains("evasion-de-defensas");
        assertThat(TipoAmenaza.tacticaDe(FixturesTheHive.deRegla("60137").descripcion())).isEmpty();
        assertThat(TipoAmenaza.tacticaDe("sin bloque")).isEmpty();
    }

    // ---- Tácticas ----

    @Test
    void lasTacticasDeMitreSeTraducenAlEspanol() {
        assertThat(TacticasMitre.clave("Credential Access")).isEqualTo("acceso-a-credenciales");
        assertThat(TacticasMitre.clave("Lateral Movement")).isEqualTo("movimiento-lateral");
        assertThat(TacticasMitre.clave("Defense Evasion")).isEqualTo("evasion-de-defensas");
        assertThat(TacticasMitre.clave("Command and Control")).isEqualTo("comando-y-control");
        assertThat(TacticasMitre.clave("  credential   access ")).isEqualTo("acceso-a-credenciales");
    }

    @Test
    void lasCatorceTacticasEstanTraducidas() {
        List<String> tacticas = List.of("Reconnaissance", "Resource Development", "Initial Access", "Execution", "Persistence",
                "Privilege Escalation", "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement", "Collection",
                "Command and Control", "Exfiltration", "Impact");

        assertThat(tacticas).allSatisfy(t -> assertThat(TacticasMitre.clave(t)).isNotEqualTo(t.toLowerCase().replace(' ', '-')));
        assertThat(tacticas.stream().map(TacticasMitre::clave).distinct()).hasSize(14);
    }

    @Test
    void lasClavesSonAsciiSinTildesNiEspacios() {
        List<String> tacticas = List.of("Reconnaissance", "Resource Development", "Initial Access", "Execution", "Persistence",
                "Privilege Escalation", "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement", "Collection",
                "Command and Control", "Exfiltration", "Impact", "Táctica Con Tildes ñ");

        assertThat(tacticas.stream().map(TacticasMitre::clave)).allMatch(c -> c.matches("[a-z0-9]+(-[a-z0-9]+)*"));
        assertThat(TacticasMitre.clave("Execution")).isEqualTo("ejecucion");
        assertThat(TacticasMitre.clave("Defense Evasion")).isEqualTo("evasion-de-defensas");
        assertThat(TacticasMitre.clave("Privilege Escalation")).isEqualTo("escalada-de-privilegios");
        assertThat(TacticasMitre.clave("Collection")).isEqualTo("recoleccion");
        assertThat(TacticasMitre.clave("Exfiltration")).isEqualTo("exfiltracion");
    }

    @Test
    void unaTacticaDesconocidaNoSeInventa() {
        assertThat(TacticasMitre.clave("Some New Tactic")).isEqualTo("some-new-tactic");
        assertThat(TacticasMitre.clave("")).isNull();
        assertThat(TacticasMitre.clave(null)).isNull();
        assertThat(TacticasMitre.clave("???")).isNull();
    }
}
