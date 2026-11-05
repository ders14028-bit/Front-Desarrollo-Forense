package co.edu.escuelaing.dashboard.thehive.cliente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ConsultaTheHiveTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static Map<String, Object> op(String nombre) {
        return new LinkedHashMap<>(Map.of("_name", nombre));
    }

    // ------------------------------------------------------------------------------------------------------
    // Lista blanca
    // ------------------------------------------------------------------------------------------------------

    @Test
    void laListaBlancaSonExactamenteEstasOperacionesDeLectura() {
        assertThat(ConsultaTheHive.OPERACIONES_PERMITIDAS).containsExactlyInAnyOrder(
                "listAlert", "listCase", "listTask", "getAlert", "getCase", "tasks", "observables",
                "filter", "sort", "page", "count", "aggregation");
    }

    @Test
    void todasLasOperacionesPermitidasSePuedenConstruir() {
        assertThatCode(() -> {
            ConsultaTheHive.listAlert().filter(Filtro.eq("status", "New")).sort("_createdAt", Orden.ASCENDENTE).page(0, 1);
            ConsultaTheHive.listAlert().count();
            ConsultaTheHive.listCase().count();
            ConsultaTheHive.listTask().count();
            ConsultaTheHive.getAlert("~4513920").observables();
            ConsultaTheHive.getCase("~8196096").tasks();
            ConsultaTheHive.listAlert().agregarPorCampo("source");
            ConsultaTheHive.listAlert().promedioDe("_createdAt");
        }).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"createAlert", "deleteAlert", "updateAlert", "mergeAlert", "createCase", "deleteCase", "updateCase",
            "createTask", "deleteTask", "runAnalyzer", "invoke", "LISTALERT", "listalert", "listAlert; drop", "", "  "})
    void unaOperacionFueraDeLaListaBlancaSeRechazaAntesDeEnviar(String nombre) {
        var operaciones = List.of(op("listAlert"), op(nombre));

        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(operaciones))
                .isInstanceOf(ConsultaNoPermitidaException.class)
                .hasMessageContaining("solo lectura");
    }

    @Test
    void unaOperacionSinNombreONoTextoSeRechaza() {
        var sinNombre = new HashMap<String, Object>();
        var numero = new HashMap<String, Object>();
        numero.put("_name", 42);

        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("listAlert"), sinNombre)))
                .isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("listAlert"), numero)))
                .isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @Test
    void laOperacionProhibidaTambienSeRechazaSiEstaAlPrincipio() {
        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("deleteAlert"))))
                .isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @Test
    void unaConsultaDebeEmpezarConUnOrigen() {
        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("count")))).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of())).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("listAlert"), op("listCase"))))
                .isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @Test
    void unFiltroConHasSeRechazaTambienEnUnaConsultaArmadaAMano() {
        Map<String, Object> filtro = new LinkedHashMap<>(op("filter"));
        filtro.put("_has", "case");

        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("listAlert"), filtro)))
                .isInstanceOf(ConsultaNoPermitidaException.class)
                .hasMessageContaining("status = Imported");
    }

    // ------------------------------------------------------------------------------------------------------
    // Páginas, agregaciones e ids
    // ------------------------------------------------------------------------------------------------------

    @Test
    void laPaginaTieneLimites() {
        assertThatCode(() -> ConsultaTheHive.listAlert().page(0, 1000)).doesNotThrowAnyException();
        assertThatCode(() -> ConsultaTheHive.listAlert().page(500, 1000)).doesNotThrowAnyException();
        assertThatThrownBy(() -> ConsultaTheHive.listAlert().page(0, 1001)).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.listAlert().page(-1, 10)).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.listAlert().page(10, 10)).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.listAlert().page(20, 5)).isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @Test
    void unaAgregacionPorCampoSiempreLlevaSizeExplicito() {
        JsonNode operacion = JSON.valueToTree(ConsultaTheHive.listAlert().agregarPorCampo("tags").cuerpo()).path("query").get(1);

        assertThat(operacion.path("_name").asText()).isEqualTo("aggregation");
        assertThat(operacion.path("_agg").asText()).isEqualTo("field");
        assertThat(operacion.path("_field").asText()).isEqualTo("tags");
        assertThat(operacion.path("_size").asInt()).isEqualTo(1000);
        assertThat(operacion.path("_select").get(0).path("_agg").asText()).isEqualTo("count");
    }

    @Test
    void unaAgregacionSinSizeSeRechazaEnUnaConsultaArmadaAMano() {
        Map<String, Object> sinTamano = new LinkedHashMap<>(op("aggregation"));
        sinTamano.put("_agg", "field");
        sinTamano.put("_field", "source");
        sinTamano.put("_select", List.of(Map.of("_agg", "count")));

        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("listAlert"), sinTamano)))
                .isInstanceOf(ConsultaNoPermitidaException.class)
                .hasMessageContaining("_size")
                .hasMessageContaining("100");
    }

    @Test
    void elSizeTieneLimites() {
        assertThatCode(() -> ConsultaTheHive.listAlert().agregarPorCampo("source", 1)).doesNotThrowAnyException();
        assertThatCode(() -> ConsultaTheHive.listAlert().agregarPorCampo("source", 1000)).doesNotThrowAnyException();
        assertThatThrownBy(() -> ConsultaTheHive.listAlert().agregarPorCampo("source", 0)).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.listAlert().agregarPorCampo("source", 1001)).isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @Test
    void soloSePermitenLasAgregacionesConocidas() {
        Map<String, Object> suma = new LinkedHashMap<>(op("aggregation"));
        suma.put("_agg", "sum");
        suma.put("_field", "severity");

        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("listAlert"), suma)))
                .isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "~", "~1 OR 1=1", "../etc/passwd", "~12345678901234567890123456789012345678901234567890123456789012345", "a b", "~1\n2"})
    void unIdentificadorRaroSeRechaza(String id) {
        assertThatThrownBy(() -> ConsultaTheHive.getAlert(id)).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> ConsultaTheHive.getCase(id)).isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @Test
    void losIdentificadoresDeTheHiveSePermiten() {
        assertThatCode(() -> ConsultaTheHive.getAlert("~4513920")).doesNotThrowAnyException();
        assertThatCode(() -> ConsultaTheHive.getCase("~8196096")).doesNotThrowAnyException();
        assertThatCode(() -> ConsultaTheHive.getAlert("abc_DEF-123")).doesNotThrowAnyException();
    }

    // ------------------------------------------------------------------------------------------------------
    // Forma del JSON
    // ------------------------------------------------------------------------------------------------------

    @Test
    void elCuerpoTieneLaFormaQueEsperaTheHive() throws Exception {
        var consulta = ConsultaTheHive.listAlert()
                .filter(Filtro.and(Filtro.eq("status", "New"), Filtro.ne("type", "simulacion")))
                .count();

        JsonNode esperado = JSON.readTree("""
                {"query":[
                  {"_name":"listAlert"},
                  {"_name":"filter","_and":[
                      {"_eq":{"_field":"status","_value":"New"}},
                      {"_ne":{"_field":"type","_value":"simulacion"}}]},
                  {"_name":"count"}]}""");

        JsonNode real = JSON.valueToTree(consulta.cuerpo());
        assertThat(real).isEqualTo(esperado);
    }

    @Test
    void laOrdenacionYLaPaginaTienenLaFormaDeTheHive() throws Exception {
        var consulta = ConsultaTheHive.listAlert().sort("_createdAt", Orden.DESCENDENTE).page(0, 1000);

        JsonNode esperado = JSON.readTree("""
                {"query":[{"_name":"listAlert"},
                  {"_name":"sort","_fields":[{"_createdAt":"desc"}]},
                  {"_name":"page","from":0,"to":1000}]}""");

        JsonNode real = JSON.valueToTree(consulta.cuerpo());
        assertThat(real).isEqualTo(esperado);
    }

    @Test
    void lasTildesViajanEnUtf8() throws Exception {
        var consulta = ConsultaTheHive.listTask().filter(Filtro.eq("group", "Contención"));

        byte[] bytes = JSON.writeValueAsBytes(consulta.cuerpo());

        assertThat(new String(bytes, StandardCharsets.UTF_8)).contains("Contención");
        assertThat(bytes).containsSequence("Contenci".getBytes(StandardCharsets.UTF_8))
                .containsSequence((byte) 0xC3, (byte) 0xB3); // "ó" en UTF-8
    }

    @Test
    void laConsultaEsInmutable() {
        var base = ConsultaTheHive.listAlert();

        var conteo = base.count();
        var filtrada = base.filter(Filtro.eq("status", "New"));

        assertThat(((List<?>) base.cuerpo().get("query"))).hasSize(1);
        assertThat(((List<?>) conteo.cuerpo().get("query"))).hasSize(2);
        assertThat(((List<?>) filtrada.cuerpo().get("query"))).hasSize(2);
        assertThat(conteo.comoJson()).contains("count").doesNotContain("filter");
    }

    @Test
    void laListaDeOperacionesDeEntradaNoSePuedeAlterarDespues() {
        List<Map<String, Object>> original = new ArrayList<>();
        original.add(op("listAlert"));
        var consulta = ConsultaTheHive.deOperaciones(original);

        original.add(op("deleteAlert")); // alguien modifica la lista después de validar

        assertThat(((List<?>) consulta.cuerpo().get("query"))).hasSize(1);
        assertThatCode(consulta::validar).doesNotThrowAnyException();
    }

    @Test
    void elNombreDeUnaOperacionProhibidaSeMuestraLimpioYCorto() {
        var larga = op("x\nsospechoso" + "y".repeat(100));

        assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(op("listAlert"), larga)))
                .isInstanceOf(ConsultaNoPermitidaException.class)
                .satisfies(e -> {
                    assertThat(e.getMessage()).doesNotContain("\n");
                    assertThat(e.getMessage().length()).isLessThan(200);
                });
    }

    @Test
    void lasOperacionesPermitidasNoCambiaranSinQueFalleUnTest() {
        Set<String> escritura = Set.of("createAlert", "deleteAlert", "updateAlert", "createCase", "deleteCase", "updateCase");
        assertThat(ConsultaTheHive.OPERACIONES_PERMITIDAS).doesNotContainAnyElementsOf(escritura);
    }
}
