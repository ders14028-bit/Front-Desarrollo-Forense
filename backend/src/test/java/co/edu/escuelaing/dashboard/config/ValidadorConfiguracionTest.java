package co.edu.escuelaing.dashboard.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class ValidadorConfiguracionTest {

    private static final String CLAVE = "CLAVE-SECRETA-QUE-NO-DEBE-SALIR";

    private static ConfiguracionTheHive theHive(String url, String clave, String org) {
        return new ConfiguracionTheHive(url, clave, org);
    }

    private static ValidadorConfiguracion validador(ConfiguracionTheHive theHive, List<String> origenes, SlaMinutos sla) {
        return new ValidadorConfiguracion(theHive, new OrigenesPermitidos(origenes), sla);
    }

    private static ValidadorConfiguracion valido() {
        return validador(theHive("https://servidor.prueba.invalid:8445", CLAVE, "escuelaing"),
                List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, 240));
    }

    @Test
    void unaConfiguracionCompletaEsValida() {
        assertThatCode(() -> valido().validar()).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void sinApiKeyNoArranca(String clave) {
        var v = validador(theHive("https://servidor.prueba.invalid", clave, "escuelaing"), List.of("http://localhost:5173"),
                new SlaMinutos(15, 30, 120, 240));

        assertThatThrownBy(v::validar)
                .isInstanceOf(ConfiguracionInvalidaException.class)
                .hasMessageContaining("THEHIVE_API_KEY");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  "})
    void sinUrlNoArranca(String url) {
        var v = validador(theHive(url, CLAVE, "escuelaing"), List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, 240));

        assertThatThrownBy(v::validar).isInstanceOf(ConfiguracionInvalidaException.class).hasMessageContaining("THEHIVE_URL");
    }

    @ParameterizedTest
    @ValueSource(strings = {"no es una url", "ftp://servidor.prueba.invalid", "servidor.prueba.invalid:8445", "https://"})
    void unaUrlQueNoEsHttpNoArranca(String url) {
        var v = validador(theHive(url, CLAVE, "escuelaing"), List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, 240));

        assertThatThrownBy(v::validar).isInstanceOf(ConfiguracionInvalidaException.class).hasMessageContaining("THEHIVE_URL");
    }

    @Test
    void unaUrlConUsuarioYClaveIncrustadosSeRechazaSinImprimirla() {
        var v = validador(theHive("https://usuario:contrasena-secreta@servidor.prueba.invalid", CLAVE, "escuelaing"),
                List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, 240));

        assertThatThrownBy(v::validar)
                .isInstanceOf(ConfiguracionInvalidaException.class)
                .hasMessageContaining("THEHIVE_URL")
                .satisfies(e -> assertThat(e.getMessage() + ((ConfiguracionInvalidaException) e).getAccion())
                        .doesNotContain("contrasena-secreta")
                        .doesNotContain("usuario:"));
    }

    @Test
    void sinOrganizacionNoArranca() {
        var v = validador(theHive("https://servidor.prueba.invalid", CLAVE, "  "), List.of("http://localhost:5173"),
                new SlaMinutos(15, 30, 120, 240));

        assertThatThrownBy(v::validar).isInstanceOf(ConfiguracionInvalidaException.class).hasMessageContaining("THEHIVE_ORG");
    }

    @Test
    void sinOrigenesNoArranca() {
        var v = validador(theHive("https://servidor.prueba.invalid", CLAVE, "escuelaing"), List.of(), new SlaMinutos(15, 30, 120, 240));

        assertThatThrownBy(v::validar).isInstanceOf(ConfiguracionInvalidaException.class).hasMessageContaining("DASHBOARD_ORIGINS");
    }

    @ParameterizedTest
    @ValueSource(strings = {"*", "http://*.ejemplo.test", "localhost:5173", "http://localhost:5173/app", "ftp://localhost",
            "http://usuario@localhost:5173", "http://localhost:5173?x=1"})
    void unOrigenInvalidoONoPreciso_NoArranca(String origen) {
        var v = validador(theHive("https://servidor.prueba.invalid", CLAVE, "escuelaing"), List.of("http://localhost:5173", origen),
                new SlaMinutos(15, 30, 120, 240));

        assertThatThrownBy(v::validar).isInstanceOf(ConfiguracionInvalidaException.class).hasMessageContaining("DASHBOARD_ORIGINS");
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:5173", "https://tablero.ejemplo.test", "http://127.0.0.1:3000", "http://localhost:5173/"})
    void losOrigenesBienFormadosSeAceptan(String origen) {
        var v = validador(theHive("https://servidor.prueba.invalid", CLAVE, "escuelaing"), List.of(origen),
                new SlaMinutos(15, 30, 120, 240));

        assertThatCode(v::validar).doesNotThrowAnyException();
    }

    @Test
    void unSlaCeroONegativoNoArranca() {
        assertThatThrownBy(() -> validador(theHive("https://servidor.prueba.invalid", CLAVE, "escuelaing"),
                List.of("http://localhost:5173"), new SlaMinutos(0, 30, 120, 240)).validar())
                .isInstanceOf(ConfiguracionInvalidaException.class);
        assertThatThrownBy(() -> validador(theHive("https://servidor.prueba.invalid", CLAVE, "escuelaing"),
                List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, -1)).validar())
                .isInstanceOf(ConfiguracionInvalidaException.class);
    }

    @Test
    void ningunMensajeDeErrorIncluyeLaApiKey() {
        var casos = List.of(
                validador(theHive("", CLAVE, "escuelaing"), List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, 240)),
                validador(theHive("no es una url", CLAVE, "escuelaing"), List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, 240)),
                validador(theHive("https://servidor.prueba.invalid", CLAVE, ""), List.of("http://localhost:5173"), new SlaMinutos(15, 30, 120, 240)),
                validador(theHive("https://servidor.prueba.invalid", CLAVE, "escuelaing"), List.of("*"), new SlaMinutos(15, 30, 120, 240)),
                validador(theHive("https://servidor.prueba.invalid", CLAVE, "escuelaing"), List.of("http://localhost:5173"), new SlaMinutos(0, 0, 0, 0)));

        for (var v : casos) {
            assertThatThrownBy(v::validar).satisfies(e -> {
                var cfg = (ConfiguracionInvalidaException) e;
                assertThat(cfg.getMessage()).doesNotContain(CLAVE);
                assertThat(cfg.getAccion()).doesNotContain(CLAVE);
            });
        }
    }
}
