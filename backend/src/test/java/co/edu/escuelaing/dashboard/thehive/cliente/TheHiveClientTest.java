package co.edu.escuelaing.dashboard.thehive.cliente;

import static co.edu.escuelaing.dashboard.thehive.cliente.ClienteDePrueba.CLAVE;
import static co.edu.escuelaing.dashboard.thehive.cliente.ClienteDePrueba.ORGANIZACION;
import static co.edu.escuelaing.dashboard.thehive.cliente.ClienteDePrueba.RUTA;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.RequestMatcher;
import org.springframework.util.unit.DataSize;
import org.springframework.web.client.RestClient;

/** El cliente contra un servidor SIMULADO (MockRestServiceServer): cabeceras, UTF-8, errores y registros. */
class TheHiveClientTest {

    private static final MediaType JSON_SIN_CHARSET = MediaType.APPLICATION_JSON;

    private ClienteDePrueba prueba;

    @BeforeEach
    void preparar() {
        prueba = ClienteDePrueba.conLimitesPorDefecto();
    }

    private static ConsultaTheHive total() {
        return ConsultaTheHive.listAlert().count();
    }

    private static RequestMatcher cuerpoEnUtf8Contiene(String texto) {
        return peticion -> assertThat(((MockClientHttpRequest) peticion).getBodyAsBytes())
                .containsSequence(texto.getBytes(StandardCharsets.UTF_8));
    }

    // ------------------------------------------------------------------------------------------------------
    // Petición
    // ------------------------------------------------------------------------------------------------------

    @Test
    void soloHaceUnPostAlaRutaDeConsulta() {
        prueba.servidor.expect(requestTo(RUTA)).andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("23121", JSON_SIN_CHARSET));

        JsonNode respuesta = prueba.cliente.consultar(total());

        assertThat(respuesta.asLong()).isEqualTo(23121);
        prueba.servidor.verify();
    }

    @Test
    void enviaLaKeyYLaOrganizacionConfiguradasYElCuerpoEnUtf8() {
        prueba.servidor.expect(requestTo(RUTA))
                .andExpect(peticion -> {
                    HttpHeaders cabeceras = peticion.getHeaders();
                    assertThat(cabeceras.getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer " + CLAVE);
                    assertThat(cabeceras.get("X-Organisation")).containsExactly(ORGANIZACION);
                    assertThat(cabeceras.getContentType().isCompatibleWith(MediaType.APPLICATION_JSON)).isTrue();
                    assertThat(cabeceras.getContentType().getCharset()).isEqualTo(StandardCharsets.UTF_8);
                })
                .andExpect(cuerpoEnUtf8Contiene("Contención"))
                .andRespond(withSuccess("0", JSON_SIN_CHARSET));

        prueba.cliente.consultar(ConsultaTheHive.listTask().filter(Filtro.eq("group", "Contención")).count());

        prueba.servidor.verify();
    }

    @Test
    void laOrganizacionSiempreEsLaConfiguradaAunqueAlguienPongaOtra() {
        // Un constructor con cabeceras por defecto "ajenas": el cliente las SOBREESCRIBE en cada petición.
        var hostil = RestClient.builder()
                .defaultHeader("X-Organisation", "organizacion-ajena")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer clave-ajena");
        var ajeno = ClienteDePrueba.con(new LimitesTheHive(null, null, null, null), hostil);
        ajeno.servidor.expect(requestTo(RUTA))
                .andExpect(peticion -> {
                    assertThat(peticion.getHeaders().get("X-Organisation")).containsExactly(ORGANIZACION);
                    assertThat(peticion.getHeaders().get(HttpHeaders.AUTHORIZATION)).containsExactly("Bearer " + CLAVE);
                })
                .andRespond(withSuccess("1", JSON_SIN_CHARSET));

        ajeno.cliente.consultar(total());

        ajeno.servidor.verify();
    }

    @Test
    void unaConsultaProhibidaNoEnviaNada() {
        // El servidor simulado no espera ninguna petición: si el cliente enviara algo, fallaría.
        assertThatThrownBy(() -> prueba.cliente.consultar(ConsultaTheHive.deOperaciones(List.of(
                Map.of("_name", "listAlert"), Map.of("_name", "deleteAlert")))))
                .isInstanceOf(ConsultaNoPermitidaException.class);

        prueba.servidor.verify();
    }

    // ------------------------------------------------------------------------------------------------------
    // Respuesta y UTF-8
    // ------------------------------------------------------------------------------------------------------

    @Test
    void decodificaEnUtf8AunqueTheHiveNoDigaElCharset() {
        String json = "[{\"title\":\"[WAZUH] Ejecución de código\",\"description\":\"Intento de contraseña — ñandú, ¿qué más?\"}]";
        prueba.servidor.expect(requestTo(RUTA))
                .andRespond(withSuccess(json.getBytes(StandardCharsets.UTF_8), JSON_SIN_CHARSET));

        JsonNode respuesta = prueba.cliente.consultar(ConsultaTheHive.listAlert().page(0, 1));

        assertThat(respuesta.get(0).path("title").asText()).isEqualTo("[WAZUH] Ejecución de código");
        assertThat(respuesta.get(0).path("description").asText()).isEqualTo("Intento de contraseña — ñandú, ¿qué más?");
        assertThat(respuesta.get(0).path("title").asText()).doesNotContain("Ã"); // el clásico "ejecuciÃ³n"
    }

    @Test
    void ignoraUnCharsetIncorrectoEnLaCabecera() {
        String json = "[{\"description\":\"Contención y acción\"}]";
        prueba.servidor.expect(requestTo(RUTA)).andRespond(withSuccess(
                json.getBytes(StandardCharsets.UTF_8), MediaType.parseMediaType("application/json;charset=ISO-8859-1")));

        JsonNode respuesta = prueba.cliente.consultar(ConsultaTheHive.listAlert().page(0, 1));

        assertThat(respuesta.get(0).path("description").asText()).isEqualTo("Contención y acción");
    }

    @Test
    void unaRespuestaQueNoEsJsonSeRechaza() {
        prueba.servidor.expect(requestTo(RUTA)).andRespond(withSuccess("esto no es json", JSON_SIN_CHARSET));

        assertThatThrownBy(() -> prueba.cliente.consultar(total()))
                .isInstanceOf(TheHiveRespuestaInvalidaException.class)
                .hasMessageContaining("no es JSON válido");
    }

    // ------------------------------------------------------------------------------------------------------
    // Errores de TheHive
    // ------------------------------------------------------------------------------------------------------

    @Test
    void credencialesRechazadas() {
        for (HttpStatus estado : new HttpStatus[] {HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN}) {
            var p = ClienteDePrueba.conLimitesPorDefecto();
            p.servidor.expect(requestTo(RUTA)).andRespond(withStatus(estado)
                    .body("{\"type\":\"AuthenticationError\",\"message\":\"Authentication failure\"}").contentType(JSON_SIN_CHARSET));

            assertThatThrownBy(() -> p.cliente.consultar(total()))
                    .as(estado.toString())
                    .isInstanceOf(TheHiveCredencialesException.class)
                    .hasMessage("TheHive rechazó las credenciales (revisa THEHIVE_API_KEY y THEHIVE_ORG).");
        }
    }

    @Test
    void consultaInvalidaMuestraElMensajeDeTheHive() {
        prueba.servidor.expect(requestTo(RUTA)).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .body("{\"type\":\"InvalidFormatAttributeError\",\"message\":\"Invalid attribute caseId\\nvalid: case, status\"}")
                .contentType(JSON_SIN_CHARSET));

        assertThatThrownBy(() -> prueba.cliente.consultar(total()))
                .isInstanceOf(TheHiveConsultaInvalidaException.class)
                .hasMessage("TheHive rechazó la consulta (HTTP 400): InvalidFormatAttributeError: Invalid attribute caseId valid: case, status");
    }

    @Test
    void elMensajeDeUnErrorSeAcotaYNuncaTrae_LaKey() {
        String largo = "x".repeat(1000);
        prueba.servidor.expect(requestTo(RUTA)).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .body("{\"type\":\"Error\",\"message\":\"" + largo + " " + CLAVE + "\"}").contentType(JSON_SIN_CHARSET));

        assertThatThrownBy(() -> prueba.cliente.consultar(total()))
                .isInstanceOf(TheHiveConsultaInvalidaException.class)
                .satisfies(e -> {
                    assertThat(e.getMessage()).doesNotContain(CLAVE);
                    assertThat(e.getMessage().length()).isLessThan(400);
                });

        // Y si la key aparece "cerca" del principio, tampoco sale.
        var otro = ClienteDePrueba.conLimitesPorDefecto();
        otro.servidor.expect(requestTo(RUTA)).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .body("{\"type\":\"Error\",\"message\":\"token " + CLAVE + " inválido\"}").contentType(JSON_SIN_CHARSET));
        assertThatThrownBy(() -> otro.cliente.consultar(total()))
                .hasMessageContaining("token *** inválido")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(CLAVE));
    }

    @Test
    void unaConsultaInvalidaSinCuerpoUtilDiceSinDetalle() {
        prueba.servidor.expect(requestTo(RUTA)).andRespond(withStatus(HttpStatus.BAD_REQUEST).body("<html>").contentType(JSON_SIN_CHARSET));

        assertThatThrownBy(() -> prueba.cliente.consultar(total()))
                .isInstanceOf(TheHiveConsultaInvalidaException.class)
                .hasMessageContaining("sin detalle");
    }

    @Test
    void erroresDelServidorSonTheHiveNoResponde() {
        for (HttpStatus estado : new HttpStatus[] {HttpStatus.INTERNAL_SERVER_ERROR, HttpStatus.BAD_GATEWAY, HttpStatus.SERVICE_UNAVAILABLE}) {
            var p = ClienteDePrueba.conLimitesPorDefecto();
            p.servidor.expect(requestTo(RUTA)).andRespond(withStatus(estado));

            assertThatThrownBy(() -> p.cliente.consultar(total()))
                    .as(estado.toString())
                    .isInstanceOf(TheHiveNoRespondeException.class)
                    .hasMessageContaining("HTTP " + estado.value());
        }
    }

    @Test
    void otrosCodigosSonRespuestaInvalida() {
        prueba.servidor.expect(requestTo(RUTA)).andRespond(withStatus(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> prueba.cliente.consultar(total()))
                .isInstanceOf(TheHiveRespuestaInvalidaException.class).hasMessageContaining("HTTP 404");

        var redireccion = ClienteDePrueba.conLimitesPorDefecto();
        redireccion.servidor.expect(requestTo(RUTA))
                .andRespond(withStatus(HttpStatus.FOUND).header(HttpHeaders.LOCATION, "https://otro.example/api/v1/query"));
        assertThatThrownBy(() -> redireccion.cliente.consultar(total()))
                .isInstanceOf(TheHiveRespuestaInvalidaException.class).hasMessageContaining("redirección");
    }

    @Test
    void todosLosErroresSonExcepcionesPropias() {
        assertThat(TheHiveNoRespondeException.class).isAssignableTo(TheHiveException.class);
        assertThat(TheHiveCertificadoException.class).isAssignableTo(TheHiveNoRespondeException.class);
        assertThat(TheHiveCredencialesException.class).isAssignableTo(TheHiveException.class);
        assertThat(TheHiveConsultaInvalidaException.class).isAssignableTo(TheHiveException.class);
        assertThat(TheHiveRespuestaInvalidaException.class).isAssignableTo(TheHiveException.class);
    }

    // ------------------------------------------------------------------------------------------------------
    // Tope de tamaño
    // ------------------------------------------------------------------------------------------------------

    @Test
    void unaRespuestaMasGrandeQueElTopeSeDescarta() {
        var pequeno = ClienteDePrueba.con(new LimitesTheHive(null, null, DataSize.ofBytes(50), null));
        pequeno.servidor.expect(requestTo(RUTA)).andRespond(withSuccess("[" + "1,".repeat(100) + "1]", JSON_SIN_CHARSET));

        assertThatThrownBy(() -> pequeno.cliente.consultar(total()))
                .isInstanceOf(TheHiveRespuestaInvalidaException.class)
                .hasMessageContaining("supera el máximo");
    }

    @Test
    void unaRespuestaJustoEnElTopeSeAcepta() {
        String exacta = "[" + "1,".repeat(23) + "11]"; // 50 bytes, 24 elementos
        assertThat(exacta.getBytes(StandardCharsets.UTF_8)).hasSize(50);
        var justo = ClienteDePrueba.con(new LimitesTheHive(null, null, DataSize.ofBytes(50), null));
        justo.servidor.expect(requestTo(RUTA)).andRespond(withSuccess(exacta, JSON_SIN_CHARSET));

        assertThat(justo.cliente.consultar(total()).size()).isEqualTo(24);
    }

    // ------------------------------------------------------------------------------------------------------
    // Agregaciones
    // ------------------------------------------------------------------------------------------------------

    @Test
    void unaAgregacionQueLlegaAlTopeSeMarcaYSeAdvierte() {
        var registro = capturar(Level.INFO);
        try {
            prueba.servidor.expect(requestTo(RUTA)).andRespond(withSuccess("""
                    {"field_tags":[{"_key":"wazuh","count":10},{"_key":"regla:5710","count":7},{"_key":"_total","count":99}]}""",
                    JSON_SIN_CHARSET));

            ResultadoAgregacion resultado = prueba.cliente.consultarAgregacion(ConsultaTheHive.listAlert().agregarPorCampo("tags", 2));

            assertThat(resultado.truncada()).isTrue();
            assertThat(resultado.campo()).isEqualTo("tags");
            assertThat(resultado.cubetas()).hasSize(2);
            assertThat(resultado.total()).isEqualTo(99);
            assertThat(mensajes(registro, Level.WARN)).anyMatch(m -> m.contains("tags") && m.contains("tope") && m.contains("2"));
        } finally {
            descapturar(registro);
        }
    }

    @Test
    void unaAgregacionQueNoLlegaAlTopeNoSeMarcaNiAdvierte() {
        var registro = capturar(Level.INFO);
        try {
            prueba.servidor.expect(requestTo(RUTA)).andRespond(withSuccess("""
                    {"field_source":[{"_key":"wazuh","count":23091},{"_key":"misp-kali-rase","count":6},{"_key":"_total","count":23121}]}""",
                    JSON_SIN_CHARSET));

            ResultadoAgregacion resultado = prueba.cliente.consultarAgregacion(ConsultaTheHive.listAlert().agregarPorCampo("source"));

            assertThat(resultado.truncada()).isFalse();
            assertThat(resultado.cubetas()).extracting(ResultadoAgregacion.Cubeta::clave).containsExactly("wazuh", "misp-kali-rase");
            assertThat(resultado.cubetas()).extracting(ResultadoAgregacion.Cubeta::cantidad).containsExactly(23091L, 6L);
            assertThat(resultado.total()).isEqualTo(23121);
            assertThat(mensajes(registro, Level.WARN)).noneMatch(m -> m.contains("tope"));
        } finally {
            descapturar(registro);
        }
    }

    @Test
    void consultarAgregacionExigeUnaAgregacionPorCampo() {
        assertThatThrownBy(() -> prueba.cliente.consultarAgregacion(total())).isInstanceOf(ConsultaNoPermitidaException.class);
        prueba.servidor.verify();
    }

    @Test
    void laRespuestaDeUnaAgregacionDebeTenerSuForma() {
        prueba.servidor.expect(requestTo(RUTA)).andRespond(withSuccess("[1,2,3]", JSON_SIN_CHARSET));

        assertThatThrownBy(() -> prueba.cliente.consultarAgregacion(ConsultaTheHive.listAlert().agregarPorCampo("source")))
                .isInstanceOf(TheHiveRespuestaInvalidaException.class);
    }

    // ------------------------------------------------------------------------------------------------------
    // Registros: nunca cabeceras; el cuerpo solo en DEBUG
    // ------------------------------------------------------------------------------------------------------

    private static final Logger REGISTRO_CLIENTE = (Logger) LoggerFactory.getLogger(TheHiveClient.class);
    private Level nivelOriginal;

    private ListAppender<ILoggingEvent> capturar(Level nivel) {
        nivelOriginal = REGISTRO_CLIENTE.getLevel();
        REGISTRO_CLIENTE.setLevel(nivel);
        var lista = new ListAppender<ILoggingEvent>();
        lista.start();
        REGISTRO_CLIENTE.addAppender(lista);
        return lista;
    }

    private void descapturar(ListAppender<ILoggingEvent> lista) {
        REGISTRO_CLIENTE.detachAppender(lista);
        REGISTRO_CLIENTE.setLevel(nivelOriginal);
    }

    @AfterEach
    void restaurarNivel() {
        if (nivelOriginal != null) {
            REGISTRO_CLIENTE.setLevel(nivelOriginal);
        }
    }

    private static List<String> mensajes(ListAppender<ILoggingEvent> lista, Level nivel) {
        return lista.list.stream().filter(e -> e.getLevel() == nivel).map(ILoggingEvent::getFormattedMessage).toList();
    }

    private static List<String> todosLosMensajes(ListAppender<ILoggingEvent> lista) {
        return lista.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    @Test
    void enNivelInfoNoSeRegistraElCuerpoDeLaConsultaNiNingunaCabecera() {
        var registro = capturar(Level.INFO);
        try {
            prueba.servidor.expect(requestTo(RUTA)).andRespond(withSuccess("5", JSON_SIN_CHARSET));
            prueba.cliente.consultar(ConsultaTheHive.listAlert().filter(Filtro.eq("status", "New")).count());

            var errores = ClienteDePrueba.conLimitesPorDefecto();
            errores.servidor.expect(requestTo(RUTA)).andRespond(withStatus(HttpStatus.UNAUTHORIZED));
            assertThatThrownBy(() -> errores.cliente.consultar(total())).isInstanceOf(TheHiveCredencialesException.class);

            assertThat(registro.list).as("a INFO una consulta correcta no registra nada").noneMatch(e -> e.getLevel() == Level.INFO);
            assertThat(todosLosMensajes(registro)).noneMatch(m -> m.contains("_name") || m.contains("\"query\""));
            asegurarQueNoHayCabecerasNiClave(registro);
        } finally {
            descapturar(registro);
        }
    }

    @Test
    void enNivelDebugSeRegistraElCuerpoPeroNuncaLasCabecerasNiLaKey() {
        var registro = capturar(Level.DEBUG);
        try {
            prueba.servidor.expect(requestTo(RUTA)).andRespond(withSuccess("5", JSON_SIN_CHARSET));
            prueba.cliente.consultar(ConsultaTheHive.listAlert().filter(Filtro.eq("status", "New")).count());

            assertThat(mensajes(registro, Level.DEBUG)).anyMatch(m -> m.contains("\"_name\":\"listAlert\"") && m.contains("\"status\""));
            asegurarQueNoHayCabecerasNiClave(registro);
        } finally {
            descapturar(registro);
        }
    }

    @Test
    void losFallosSeRegistranConMensajesFijosSinCabecerasNiKey() {
        var registro = capturar(Level.DEBUG);
        try {
            for (HttpStatus estado : new HttpStatus[] {HttpStatus.UNAUTHORIZED, HttpStatus.BAD_REQUEST, HttpStatus.BAD_GATEWAY}) {
                var p = ClienteDePrueba.conLimitesPorDefecto();
                p.servidor.expect(requestTo(RUTA)).andRespond(withStatus(estado).body("{\"type\":\"E\",\"message\":\"m\"}"));
                assertThatThrownBy(() -> p.cliente.consultar(total())).isInstanceOf(TheHiveException.class);
            }

            assertThat(mensajes(registro, Level.WARN)).hasSize(3).allMatch(m -> m.startsWith("TheHive: "));
            asegurarQueNoHayCabecerasNiClave(registro);
        } finally {
            descapturar(registro);
        }
    }

    private static void asegurarQueNoHayCabecerasNiClave(ListAppender<ILoggingEvent> registro) {
        for (ILoggingEvent evento : registro.list) {
            String texto = evento.getFormattedMessage() + " " + evento.getThrowableProxy();
            assertThat(texto)
                    .doesNotContain(CLAVE)
                    .doesNotContainIgnoringCase("authorization")
                    .doesNotContainIgnoringCase("bearer")
                    .doesNotContainIgnoringCase("x-organisation")
                    .doesNotContain(ORGANIZACION);
        }
    }
}
