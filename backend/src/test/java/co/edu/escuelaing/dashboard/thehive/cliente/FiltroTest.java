package co.edu.escuelaing.dashboard.thehive.cliente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class FiltroTest {

    @Test
    void comparacionesLlevanCampoYValor() {
        assertThat(Filtro.eq("status", "New").comoMapa()).isEqualTo(Map.of("_eq", Map.of("_field", "status", "_value", "New")));
        assertThat(Filtro.ne("type", "simulacion").comoMapa()).isEqualTo(Map.of("_ne", Map.of("_field", "type", "_value", "simulacion")));
        assertThat(Filtro.gte("_createdAt", 1793404800000L).comoMapa())
                .isEqualTo(Map.of("_gte", Map.of("_field", "_createdAt", "_value", 1793404800000L)));
        assertThat(Filtro.lt("severity", 3).comoMapa()).isEqualTo(Map.of("_lt", Map.of("_field", "severity", "_value", 3)));
        assertThat(Filtro.like("tags", "regla:*").comoMapa()).isEqualTo(Map.of("_like", Map.of("_field", "tags", "_value", "regla:*")));
    }

    @Test
    void operadoresLogicos() {
        var filtro = Filtro.and(Filtro.eq("status", "New"), Filtro.not(Filtro.eq("type", "simulacion")));

        assertThat(filtro.comoMapa()).isEqualTo(Map.of("_and", List.of(
                Map.of("_eq", Map.of("_field", "status", "_value", "New")),
                Map.of("_not", Map.of("_eq", Map.of("_field", "type", "_value", "simulacion"))))));
    }

    @Test
    void unAndOUnOrVaciosSeRechazan() {
        assertThatThrownBy(Filtro::and).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(Filtro::or).isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "1abc", "tags; drop", "a b", "campo-con-guion",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"})
    void unNombreDeCampoRaroSeRechaza(String campo) {
        assertThatThrownBy(() -> Filtro.eq(campo, "x")).isInstanceOf(ConsultaNoPermitidaException.class);
    }

    @Test
    void losNombresDeCampoDeTheHiveSePermiten() {
        for (String campo : List.of("_createdAt", "status", "tags", "computed.handlingDuration", "slaStates.status", "case")) {
            assertThat(Filtro.eq(campo, "x")).isNotNull();
        }
    }

    @Test
    void soloSeAceptanValoresSimples() {
        assertThatThrownBy(() -> Filtro.eq("status", List.of("New"))).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThatThrownBy(() -> Filtro.eq("status", null)).isInstanceOf(ConsultaNoPermitidaException.class);
        assertThat(Filtro.eq("follow", true)).isNotNull();
    }

    /**
     * Documenta el hallazgo del sondeo (4–5 nov. 2026): en este TheHive {@code {"_has":"case"}} devuelve TODAS las
     * alertas (23168) aunque haya 0 casos. NO se usa: las alertas convertidas se cuentan con status = Imported.
     */
    @Test
    void elOperadorHasNoSeUsaPorqueDevuelveTodasLasAlertas() {
        assertThat(Filtro.OPERADORES).doesNotContain("_has");

        // Ni siquiera existe un constructor para él.
        List<String> metodos = Arrays.stream(Filtro.class.getDeclaredMethods()).map(Method::getName).toList();
        assertThat(metodos).noneMatch(nombre -> nombre.equalsIgnoreCase("has") || nombre.equalsIgnoreCase("tiene")
                || nombre.toLowerCase().contains("hascase"));

        // Y si alguien lo cuela en una consulta armada a mano, se rechaza explicando el porqué y la alternativa.
        assertThatThrownBy(() -> Filtro.validarMapa(Map.of("_has", "case")))
                .isInstanceOf(ConsultaNoPermitidaException.class)
                .hasMessageContaining("_has")
                .hasMessageContaining("TODAS las alertas")
                .hasMessageContaining("status = Imported");
    }

    @Test
    void unOperadorDesconocidoSeRechaza() {
        for (String operador : List.of("_regex", "_wildcard", "_script", "_in", "_any")) {
            assertThatThrownBy(() -> Filtro.validarMapa(Map.of(operador, Map.of("_field", "title", "_value", "x"))))
                    .as(operador)
                    .isInstanceOf(ConsultaNoPermitidaException.class);
        }
    }

    @Test
    void alAnidarSeValidaTodoElArbol() {
        Map<String, Object> malo = Map.of("_and", List.of(
                Map.of("_eq", Map.of("_field", "status", "_value", "New")),
                Map.of("_not", Map.of("_has", "case"))));

        assertThatThrownBy(() -> Filtro.validarMapa(malo)).isInstanceOf(ConsultaNoPermitidaException.class);
    }
}
