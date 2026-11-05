package co.edu.escuelaing.dashboard.alertas;

import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.alerta;
import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.caso;
import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.tareaDeCaso;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.edu.escuelaing.dashboard.alertas.ListaAlertas.AlertaFila;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas.CasoResumen;
import co.edu.escuelaing.dashboard.config.ConfiguracionTheHive;
import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import co.edu.escuelaing.dashboard.config.ReglasNegocio;
import co.edu.escuelaing.dashboard.config.SlaMinutos;
import co.edu.escuelaing.dashboard.dominio.EstadoSla;
import co.edu.escuelaing.dashboard.dominio.FixturesTheHive;
import co.edu.escuelaing.dashboard.resumen.TacticasPorRegla;
import co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveNoRespondeException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AlertasServiceTest {

    /** 2026-11-04 15:00 en Bogotá. La ventana de 30 días empieza el 6 de oct. a las 00:00 de Bogotá. */
    static final long T = Instant.parse("2026-11-04T20:00:00Z").toEpochMilli();
    static final long MIN = 60_000L;
    static final long DIA = 86_400_000L;
    static final long INICIO_VENTANA = Instant.parse("2026-10-06T05:00:00Z").toEpochMilli();
    private static final ObjectMapper JSON = new ObjectMapper();

    TheHiveEnMemoria hive;
    TacticasPorRegla tacticas;
    AlertasService servicio;

    @BeforeEach
    void preparar() {
        hive = new TheHiveEnMemoria();
        Clock reloj = Clock.fixed(Instant.ofEpochMilli(T), ZoneOffset.UTC);
        tacticas = new TacticasPorRegla(reloj);
        servicio = nuevo(reloj, new ReglasNegocio(null, null, null, null, null, null, null, false));
    }

    @AfterEach
    void cerrar() {
        hive.close();
    }

    private AlertasService nuevo(Clock reloj, ReglasNegocio reglas) {
        var cliente = new TheHiveClient(new ConfiguracionTheHive(hive.url(), "CLAVE-DE-PRUEBA", "escuelaing-prueba"),
                new LimitesTheHive(Duration.ofSeconds(2), Duration.ofSeconds(10), null, null), JSON);
        return new AlertasService(cliente, new ConsultasDashboard(reglas), new SlaMinutos(15, 30, 120, 240), tacticas, reloj, JSON);
    }

    private static com.fasterxml.jackson.databind.node.ObjectNode a(String id, long creada, int sev, String estado, String... tags) {
        return alerta(id, creada, sev, estado, "wazuh", "wazuh", "sin bloque", tags);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Lista
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void conPocasAlertasVienenTodasDeLaMasRecienteALaMasAntigua() {
        hive.alertas.add(a("~2", T - 2 * DIA, 1, "New", "wazuh"));
        hive.alertas.add(a("~1", T - 10 * MIN, 4, "New", "wazuh"));
        hive.alertas.add(a("~3", T - 20 * DIA, 2, "InProgress", "wazuh"));

        ListaAlertas lista = servicio.calcularLista();

        assertThat(lista.alertas()).extracting(AlertaFila::id).containsExactly("~1", "~2", "~3");
        assertThat(lista.total()).isEqualTo(3);
        assertThat(lista.truncado()).isFalse();
        assertThat(lista.composicion()).isEqualTo(new ListaAlertas.Composicion(3, 0));
        assertThat(lista.generadoEn()).isEqualTo(T);
    }

    @Test
    void laVentanaSonLosUltimosTreintaDiasDeBogotaConElPrimerDiaCompleto() {
        hive.alertas.add(a("~dentro", INICIO_VENTANA, 1, "New"));          // 6 oct. 00:00 Bogotá: el primer instante de la ventana
        hive.alertas.add(a("~fuera", INICIO_VENTANA - 1, 1, "New"));       // 5 oct. 23:59:59.999
        hive.alertas.add(a("~hoy", T, 1, "New"));

        ListaAlertas lista = servicio.calcularLista();

        assertThat(lista.alertas()).extracting(AlertaFila::id).containsExactly("~hoy", "~dentro");
        assertThat(lista.total()).isEqualTo(2);
    }

    @Test
    void lasSimulacionesNoEntran() {
        hive.alertas.add(alerta("~sim", T - MIN, 4, "New", "wazuh-simulado", "simulacion", "{}", "simulacion"));
        hive.alertas.add(a("~real", T - MIN, 1, "New"));

        ListaAlertas lista = servicio.calcularLista();

        assertThat(lista.alertas()).extracting(AlertaFila::id).containsExactly("~real");
        assertThat(lista.total()).isEqualTo(1);
        assertThat(lista.datosDeLaboratorio()).isFalse();
    }

    @Test
    void unaAlertaConTagSimulacionPeroTypeWazuhNoActivaElAviso() {
        hive.alertas.add(alerta("~1", T - MIN, 1, "New", "wazuh", "wazuh", "x", "simulacion"));

        ListaAlertas lista = servicio.calcularLista();

        assertThat(lista.total()).isEqualTo(1);
        assertThat(lista.datosDeLaboratorio()).isFalse();
    }

    @Test
    void cadaFilaTraeTipoSlaYAntiguedadCalculados() {
        hive.alertas.add(alerta("~1", T - 16 * MIN, 4, "New", "wazuh", "wazuh", "sin bloque", "escenario:phishing"));
        hive.alertas.add(alerta("~2", T - 60 * MIN, 2, "New", "misp-kali-rase", "misp", "Evento MISP", "misp"));
        hive.alertas.add(alerta("~3", T - 2 * DIA, 1, "InProgress", "wazuh", "wazuh", FixturesTheHive.deRegla("60106").descripcion(), "regla:60106"));

        List<AlertaFila> filas = servicio.calcularLista().alertas();

        AlertaFila f1 = filas.get(0);
        assertThat(f1.tipo()).isEqualTo("phishing");
        assertThat(f1.severidad()).isEqualTo(4);
        assertThat(f1.estado()).isEqualTo("New");
        assertThat(f1.origen()).isEqualTo("wazuh");
        assertThat(f1.antiguedadMs()).isEqualTo(16 * MIN);
        assertThat(f1.sla()).isEqualTo(new EstadoSla("fuera", 15, MIN));
        assertThat(f1.caso()).isNull();

        AlertaFila f2 = filas.get(1);
        assertThat(f2.tipo()).as("sin escenario ni regla: sin clasificar").isNull();
        assertThat(f2.sla()).isEqualTo(new EstadoSla("dentro", 120, null));

        AlertaFila f3 = filas.get(2);
        assertThat(f3.tipo()).as("táctica MITRE de su propio bloque, en ASCII").isEqualTo("evasion-de-defensas");
        assertThat(f3.sla()).as("no está New: el SLA no aplica").isEqualTo(new EstadoSla(null, 240, null));
    }

    @Test
    void elTipoDeUnaAlertaSinBloquePropioUsaLaTacticaDeSuReglaEnCache() {
        tacticas.guardar("5710", java.util.Optional.of("acceso-a-credenciales"));
        hive.alertas.add(a("~1", T - MIN, 1, "New", "regla:5710"));

        assertThat(servicio.calcularLista().alertas().get(0).tipo()).isEqualTo("acceso-a-credenciales");
    }

    // ---- composición ----

    private void cargarMilRecientesYUnasCuantasAntiguas() {
        // 1005 alertas bajas "recientes" (hoy, una por segundo hacia atrás) ...
        for (int i = 0; i < 1005; i++) {
            hive.alertas.add(a("~r" + i, T - i * 1000L, 1, "New", "wazuh"));
        }
        // ... y alertas más antiguas que las 1000 más recientes:
        hive.alertas.add(a("~critica-antigua", T - 3 * DIA, 4, "New", "wazuh"));
        hive.alertas.add(a("~alta-antigua", T - 10 * DIA, 3, "New", "wazuh"));
        hive.alertas.add(a("~alta-antigua-atendida", T - 4 * DIA, 3, "InProgress", "wazuh"));
        hive.alertas.add(a("~alta-convertida", T - 5 * DIA, 3, "Imported", "wazuh"));
        hive.alertas.add(a("~media-antigua", T - 6 * DIA, 2, "New", "wazuh"));
        hive.alertas.add(a("~baja-antigua", T - 7 * DIA, 1, "New", "wazuh"));
        hive.alertas.add(a("~critica-fuera-de-ventana", T - 40 * DIA, 4, "New", "wazuh"));
    }

    @Test
    void conMasDeMilSeAgregaTodasLasCriticasYAltasSinAtenderMasAntiguas() {
        cargarMilRecientesYUnasCuantasAntiguas();

        ListaAlertas lista = servicio.calcularLista();

        List<String> ids = lista.alertas().stream().map(AlertaFila::id).toList();
        assertThat(ids).contains("~critica-antigua", "~alta-antigua");
        assertThat(ids).doesNotContain("~alta-antigua-atendida", "~alta-convertida", "~media-antigua", "~baja-antigua",
                "~critica-fuera-de-ventana");
        assertThat(lista.alertas()).hasSize(1002);
        assertThat(lista.composicion()).isEqualTo(new ListaAlertas.Composicion(1000, 2));
        assertThat(lista.total()).as("count de la ventana, no el largo de la lista: 1005 + 6").isEqualTo(1011);
        assertThat(lista.truncado()).isTrue();
        // La más reciente primero y las añadidas, al final por ser más antiguas.
        assertThat(ids.get(0)).isEqualTo("~r0");
        assertThat(ids.subList(1000, 1002)).containsExactly("~critica-antigua", "~alta-antigua");
        assertThat(lista.alertas()).isSortedAccordingTo((x, y) -> Long.compare(y.creadaEn(), x.creadaEn()));
        assertThat(ids).doesNotHaveDuplicates();
    }

    @Test
    void conMasDeMilSinCriticasAntiguasNoSeAgregaNada() {
        for (int i = 0; i < 1005; i++) {
            hive.alertas.add(a("~r" + i, T - i * 1000L, 1, "New", "wazuh"));
        }

        ListaAlertas lista = servicio.calcularLista();

        assertThat(lista.alertas()).hasSize(1000);
        assertThat(lista.composicion()).isEqualTo(new ListaAlertas.Composicion(1000, 0));
        assertThat(lista.total()).isEqualTo(1005);
        assertThat(lista.truncado()).isTrue();
    }

    @Test
    void unaCriticaConLaMismaFechaQueLaUltimaRecienteNoSeDuplica() {
        for (int i = 0; i < 999; i++) {
            hive.alertas.add(a("~r" + i, T - i * 1000L, 1, "New", "wazuh"));
        }
        long fechaDeLaMilesima = T - 999 * 1000L;
        hive.alertas.add(a("~critica-empatada", fechaDeLaMilesima, 4, "New", "wazuh"));
        hive.alertas.add(a("~baja-empatada", fechaDeLaMilesima, 1, "New", "wazuh"));
        hive.alertas.add(a("~baja-vieja", T - 5 * DIA, 1, "New", "wazuh"));

        ListaAlertas lista = servicio.calcularLista();

        List<String> ids = lista.alertas().stream().map(AlertaFila::id).toList();
        assertThat(ids).doesNotHaveDuplicates();
        assertThat(ids).contains("~critica-empatada");
        assertThat(lista.composicion().recientes() + lista.composicion().criticasYAltasAdicionales()).isEqualTo(lista.alertas().size());
    }

    @Test
    void lasConsultasDeLaListaUsanCountParaElTotalYNuncaBetweenNiHas() {
        cargarMilRecientesYUnasCuantasAntiguas();

        servicio.calcularLista();

        assertThat(hive.consultasComoTexto()).noneMatch(c -> c.contains("_between") || c.contains("_has"));
        assertThat(hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "count")
                && TheHiveEnMemoria.usa(c, "_gte", "_createdAt"))).isGreaterThanOrEqualTo(1);
        assertThat(hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "page"))).as("1000 recientes + 1 página de extras").isEqualTo(2);
    }

    // ---- casos en las filas ----

    @Test
    void laFilaDeUnaAlertaConvertidaTraeElResumenDeSuCaso() {
        var convertida = a("~1", T - DIA, 3, "Imported", "wazuh");
        convertida.put("caseId", "~c1");
        hive.alertas.add(convertida);
        hive.casos.add(caso("~c1", T - DIA, "Closed", "TruePositive", T));
        hive.casos.get(0).put("number", 7);

        AlertaFila fila = servicio.calcularLista().alertas().get(0);

        assertThat(fila.caso()).isEqualTo(new CasoResumen("~c1", 7, "Closed", "TruePositive"));
        assertThat(fila.estado()).isEqualTo("Imported");
        assertThat(fila.sla().estado()).isNull();
    }

    @Test
    void siElCasoNoEstaDisponibleLaAlertaIgualTieneCasoConSoloElId() {
        var convertida = a("~1", T - DIA, 3, "Imported", "wazuh");
        convertida.put("caseId", "~borrado");
        hive.alertas.add(convertida);

        AlertaFila fila = servicio.calcularLista().alertas().get(0);

        assertThat(fila.caso()).isEqualTo(new CasoResumen("~borrado", null, null, null));
    }

    @Test
    void unaAlertaSinCaseIdTieneCasoNull() {
        hive.alertas.add(a("~1", T - DIA, 3, "New", "wazuh"));

        assertThat(servicio.calcularLista().alertas().get(0).caso()).isNull();
    }

    // ---- forma ----

    @Test
    void laListaTieneLaFormaDelContratoMasComposicionYThehive() {
        hive.alertas.add(a("~1", T - MIN, 2, "New", "wazuh"));

        JsonNode json = JSON.valueToTree(servicio.calcularLista());

        assertThat(nombres(json)).containsExactly("generadoEn", "total", "truncado", "datosDeLaboratorio", "composicion", "thehive", "alertas");
        assertThat(nombres(json.path("composicion"))).containsExactly("recientes", "criticasYAltasAdicionales");
        assertThat(nombres(json.path("alertas").get(0))).containsExactly("id", "creadaEn", "titulo", "severidad", "estado", "origen",
                "tipo", "antiguedadMs", "sla", "caso");
        assertThat(nombres(json.path("alertas").get(0).path("sla"))).containsExactly("estado", "limiteMin", "excesoMs");
        assertThat(json.path("alertas").get(0).has("tipo")).isTrue();
        assertThat(json.path("alertas").get(0).path("tipo").isNull()).as("null explícito").isTrue();
        assertThat(json.path("alertas").get(0).path("caso").isNull()).isTrue();
        assertThat(json.path("alertas").get(0).path("sla").path("excesoMs").isNull()).isTrue();
        assertThat(json.path("thehive").path("respondio").asBoolean()).isTrue();
    }

    private static List<String> nombres(JsonNode objeto) {
        var lista = new ArrayList<String>();
        objeto.fieldNames().forEachRemaining(lista::add);
        return lista;
    }

    @Test
    void siTheHiveFallaSePropagaLaExcepcion() {
        hive.codigoForzado = 502;

        assertThatThrownBy(() -> servicio.calcularLista()).isInstanceOf(TheHiveNoRespondeException.class);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Detalle
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void elDetalleTraeLaAlertaCrudaYSuFila() {
        hive.alertas.add(alerta("~4096", T - 20 * MIN, 3, "New", "wazuh", "wazuh", FixturesTheHive.deRegla("60106").descripcion(), "regla:60106"));

        DetalleAlerta detalle = servicio.detalle("~4096").orElseThrow();

        assertThat(detalle.generadoEn()).isEqualTo(T);
        assertThat(detalle.alerta().path("_id").asText()).isEqualTo("~4096");
        assertThat(detalle.alerta().path("description").asText()).contains("```json");
        assertThat(detalle.fila().id()).isEqualTo("~4096");
        assertThat(detalle.fila().tipo()).isEqualTo("evasion-de-defensas");
        assertThat(detalle.fila().sla().estado()).as("20 min con SLA de 30: dentro").isEqualTo("dentro");
        assertThat(detalle.caso()).isNull();
    }

    @Test
    void unIdInexistenteEsVacioYPorLoTantoUn404() {
        hive.alertas.add(a("~1", T - MIN, 1, "New"));

        assertThat(servicio.detalle("~999")).isEmpty();
        // TheHive respondió 200 con una lista vacía: esa consulta sí se hizo.
        assertThat(hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "getAlert", "getAlert"))).isEqualTo(1);
    }

    @Test
    void unIdMalFormadoNoLlegaNiATheHive() {
        for (String id : List.of("", "a b", "~1; drop", "../../etc", "x".repeat(200))) {
            assertThat(servicio.detalle(id)).as(id).isEmpty();
        }
        assertThat(hive.consultas).isEmpty();
    }

    @Test
    void elDetalleDeUnaAlertaConvertidaTraeElCasoConSusTareas() {
        var convertida = a("~1", T - DIA, 3, "Imported", "wazuh");
        convertida.put("caseId", "~c1");
        hive.alertas.add(convertida);
        hive.casos.add(caso("~c1", T - DIA, "InProgress", "InProgress", null));
        hive.casos.add(caso("~c2", T - DIA, "New", "New", null));
        hive.tareas.addAll(List.of(
                tareaDeCaso("~t1", "~c1", "Contención", "Completed"),
                tareaDeCaso("~t2", "~c1", "Análisis", "Waiting"),
                tareaDeCaso("~t3", "~c2", "Contención", "Completed")));

        DetalleAlerta detalle = servicio.detalle("~1").orElseThrow();

        assertThat(detalle.caso().path("_id").asText()).isEqualTo("~c1");
        assertThat(detalle.caso().path("tareas")).as("solo las tareas de ese caso").hasSize(2);
        assertThat(detalle.caso().path("tareas").get(0).path("group").asText()).isEqualTo("Contención");
        assertThat(detalle.fila().caso()).isEqualTo(new CasoResumen("~c1", detalle.fila().caso().numero(), "InProgress", "InProgress"));
    }

    @Test
    void siElCasoNoEstaDisponibleElDetalleNoTraeCasoPeroLaFilaSiTieneCaso() {
        var convertida = a("~1", T - DIA, 3, "Imported", "wazuh");
        convertida.put("caseId", "~borrado");
        hive.alertas.add(convertida);

        DetalleAlerta detalle = servicio.detalle("~1").orElseThrow();

        assertThat(detalle.caso()).isNull();
        assertThat(detalle.fila().caso()).isEqualTo(new CasoResumen("~borrado", null, null, null));
    }

    @Test
    void elDetalleDeUnaSimulacionTambienSePuedeAbrir() {
        hive.alertas.add(alerta("~sim", T - MIN, 4, "New", "wazuh-simulado", "simulacion", "{}", "simulacion"));

        assertThat(servicio.detalle("~sim")).isPresent();
    }

    @Test
    void elDetalleUsaLaFormaDelContrato() {
        hive.alertas.add(a("~1", T - MIN, 1, "New"));

        JsonNode json = JSON.valueToTree(servicio.detalle("~1").orElseThrow());

        assertThat(nombres(json)).containsExactly("generadoEn", "alerta", "fila", "caso");
        assertThat(json.path("caso").isNull()).isTrue();
    }
}
