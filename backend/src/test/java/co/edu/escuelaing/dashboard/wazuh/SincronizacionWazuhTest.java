package co.edu.escuelaing.dashboard.wazuh;

import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.alerta;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.edu.escuelaing.dashboard.config.ConfiguracionTheHive;
import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import co.edu.escuelaing.dashboard.config.ReglasNegocio;
import co.edu.escuelaing.dashboard.dominio.FixturesTheHive;
import co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveNoRespondeException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** La sincronización contra un TheHive en memoria que entiende las consultas (filtros, orden y páginas). */
class SincronizacionWazuhTest {

    /** 2026-11-04 15:00 en Bogotá. La ventana de 7 días empieza el 29 de oct. a las 00:00 de Bogotá. */
    static final long T = Instant.parse("2026-11-04T20:00:00Z").toEpochMilli();
    static final long INICIO_VENTANA = Instant.parse("2026-10-29T05:00:00Z").toEpochMilli();
    static final long MIN = 60_000L;
    static final long DIA = 86_400_000L;
    private static final ObjectMapper JSON = new ObjectMapper();

    static final class RelojAjustable extends Clock {
        final AtomicLong ahora = new AtomicLong(T);

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zona) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(ahora.get());
        }
    }

    TheHiveEnMemoria hive;
    RelojAjustable reloj;
    SincronizacionWazuh sincronizacion;
    String bloque60106;

    @BeforeEach
    void preparar() {
        hive = new TheHiveEnMemoria();
        reloj = new RelojAjustable();
        sincronizacion = nueva(500);
        bloque60106 = FixturesTheHive.deRegla("60106").descripcion();
    }

    @AfterEach
    void cerrar() {
        hive.close();
    }

    private SincronizacionWazuh nueva(int tamanoPagina) {
        var reglas = new ReglasNegocio(null, null, null, null, null, null, null, null, false);
        var cliente = new TheHiveClient(new ConfiguracionTheHive(hive.url(), "CLAVE-DE-PRUEBA", "escuelaing-prueba"),
                new LimitesTheHive(Duration.ofSeconds(2), Duration.ofSeconds(10), null, null), JSON);
        return new SincronizacionWazuh(cliente, new ConsultasDashboard(reglas),
                new ConfiguracionWazuh(7, tamanoPagina, Duration.ofSeconds(60), 10, "wazuh"), reloj);
    }

    private ObjectNode wz(String id, long creada) {
        return alerta(id, creada, 1, "New", "wazuh", "wazuh", bloque60106, "wazuh", "regla:60106");
    }

    private void cargarSecuenciales(int cantidad) {
        for (int i = 0; i < cantidad; i++) {
            hive.alertas.add(wz("~w" + i, INICIO_VENTANA + 1000L * (i + 1)));
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // Carga inicial
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void antesDeSincronizarEstaCargandoYSinMetricas() {
        MetricasWazuh m = sincronizacion.actual();

        assertThat(m.estado()).isEqualTo("cargando");
        assertThat(m.progreso()).isNull();
        assertThat(m.mitre()).isNull();
        assertThat(m.cumplimiento()).isNull();
        assertThat(m.topIps()).isNull();
        assertThat(m.alertasAnalizadas()).isNull();
        assertThat(m.dias()).isEqualTo(7);
        assertThat(m.desde()).isEqualTo("2026-10-29");
    }

    @Test
    void laCargaInicialPaginaYGuardaTodas() {
        cargarSecuenciales(1200);

        sincronizacion.sincronizar();

        MetricasWazuh m = sincronizacion.actual();
        assertThat(sincronizacion.alertasGuardadas()).isEqualTo(1200);
        assertThat(m.estado()).isEqualTo("listo");
        assertThat(m.alertasAnalizadas()).isEqualTo(1200);
        assertThat(m.thehive().respondio()).isTrue();
        assertThat(m.mitre().tacticas().get(0).cantidad()).isEqualTo(1200);
        // count + 3 páginas (500, 500, 200)
        assertThat(hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "count"))).isEqualTo(1);
        assertThat(hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "page"))).isEqualTo(3);
    }

    @Test
    void siTheHiveCaeAMitadLaCargaContinuaDesdeDondeQuedoConProgreso() {
        cargarSecuenciales(1200);
        hive.fallarTrasConsultas = 2;   // el count y la primera página salen bien

        assertThatThrownBy(() -> sincronizacion.sincronizar()).isInstanceOf(TheHiveNoRespondeException.class);

        assertThat(sincronizacion.alertasGuardadas()).isEqualTo(500);
        MetricasWazuh cargando = sincronizacion.actual();
        assertThat(cargando.estado()).isEqualTo("cargando");
        assertThat(cargando.progreso()).as("500 de 1200").isEqualTo(41);
        assertThat(cargando.mitre()).isNull();

        hive.fallarTrasConsultas = -1;
        int antes = hive.consultas.size();
        sincronizacion.sincronizar();

        assertThat(sincronizacion.alertasGuardadas()).as("sin duplicados").isEqualTo(1200);
        assertThat(sincronizacion.actual().estado()).isEqualTo("listo");
        assertThat(sincronizacion.actual().alertasAnalizadas()).isEqualTo(1200);
        // La reanudación no volvió a leer desde el principio de la ventana.
        var primeraPagina = hive.consultas.get(antes + 1);
        assertThat(TheHiveEnMemoria.valoresNumericos(primeraPagina, "_gte", "_createdAt")).allMatch(v -> v > INICIO_VENTANA + 400_000L);
    }

    @Test
    void elProgresoNuncaEsCeroNiCien_MientrasCarga() {
        cargarSecuenciales(1200);
        hive.fallarTrasConsultas = 2;
        assertThatThrownBy(() -> sincronizacion.sincronizar()).isInstanceOf(TheHiveNoRespondeException.class);

        assertThat(sincronizacion.actual().progreso()).isBetween(1, 99);
    }

    @Test
    void sinTheHiveDesdeElInicioSigueCargandoConRespondioFalse() {
        hive.codigoForzado = 502;

        sincronizacion.sincronizarEnSegundoPlano();   // no lanza

        MetricasWazuh m = sincronizacion.actual();
        assertThat(m.estado()).isEqualTo("cargando");
        assertThat(m.thehive().respondio()).isFalse();
        assertThat(m.mitre()).isNull();
    }

    @Test
    void sinAlertasQuedaListoConCeros() {
        sincronizacion.sincronizar();

        MetricasWazuh m = sincronizacion.actual();
        assertThat(m.estado()).isEqualTo("listo");
        assertThat(m.alertasAnalizadas()).isZero();
        assertThat(m.mitre().tacticas()).isEmpty();
    }

    @Test
    void masAlertasQueUnaPaginaConElMismoInstanteNoSePierdenNiHacenUnBucle() {
        long instante = INICIO_VENTANA + 5 * MIN;
        for (int i = 0; i < 1100; i++) {
            hive.alertas.add(wz("~m" + i, instante));   // 1100 en el mismo milisegundo, páginas de 500
        }
        hive.alertas.add(wz("~despues", instante + 1000));

        sincronizacion.sincronizar();

        assertThat(sincronizacion.alertasGuardadas()).isEqualTo(1101);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Filtros: ventana, tipo y simulaciones
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void soloEntranLasDeWazuhDeLosUltimosSieteDiasYNoLasSimulaciones() {
        hive.alertas.add(wz("~dentro", INICIO_VENTANA));                       // el primer instante de la ventana
        hive.alertas.add(wz("~fuera", INICIO_VENTANA - 1));                    // 28 oct. 23:59:59.999 Bogotá
        hive.alertas.add(alerta("~misp", T - MIN, 2, "New", "misp-kali-rase", "misp", "Evento MISP", "misp"));
        hive.alertas.add(alerta("~sim", T - MIN, 4, "New", "wazuh-simulado", "simulacion", bloque60106, "simulacion", "regla:60106"));
        hive.alertas.add(alerta("~lab", T - MIN, 2, "New", "Laboratorio-Forense", "external", "PowerShell", "laboratorio"));

        sincronizacion.sincronizar();

        assertThat(sincronizacion.alertasGuardadas()).isEqualTo(1);
        assertThat(hive.consultas).allSatisfy(c -> {
            assertThat(TheHiveEnMemoria.usaValor(c, "_eq", "type", "wazuh")).isTrue();
            assertThat(TheHiveEnMemoria.usaValor(c, "_ne", "type", "simulacion")).isTrue();
        });
        assertThat(hive.consultasComoTexto()).noneMatch(c -> c.contains("_has") || c.contains("_between"));
    }

    @Test
    void todasLasConsultasSonDeLecturaYAcotadasAlInstanteDeLaPasada() {
        cargarSecuenciales(10);

        sincronizacion.sincronizar();

        assertThat(hive.consultas).allSatisfy(c -> {
            String primera = c.path("query").get(0).path("_name").asText();
            assertThat(primera).isEqualTo("listAlert");
            assertThat(TheHiveEnMemoria.valoresNumericos(c, "_lt", "_createdAt")).contains(T + 1);
        });
    }

    // ---------------------------------------------------------------------------------------------------------
    // Incremental
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void laIncrementalPideDesdeLaUltimaVistaMenosElSolapeYDescartaRepetidas() {
        cargarSecuenciales(100);
        sincronizacion.sincronizar();
        long ultima = INICIO_VENTANA + 1000L * 100;

        // Llegan 2 nuevas; el solape de 60 s vuelve a traer las 60 últimas, que se descartan por _id.
        hive.alertas.add(wz("~n1", ultima + 5_000));
        hive.alertas.add(wz("~n2", ultima + 10_000));
        reloj.ahora.addAndGet(30_000);
        int antes = hive.consultas.size();
        sincronizacion.sincronizar();

        assertThat(sincronizacion.alertasGuardadas()).as("100 + 2, sin duplicar el solape").isEqualTo(102);
        assertThat(sincronizacion.actual().alertasAnalizadas()).isEqualTo(102);
        var consulta = hive.consultas.get(antes);
        assertThat(TheHiveEnMemoria.valoresNumericos(consulta, "_gte", "_createdAt")).contains(ultima - 60_000L);
        assertThat(hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "count"))).as("la incremental no vuelve a contar").isEqualTo(1);
    }

    @Test
    void laIncrementalNoCambiaLasCifrasSiNoHayNada()  {
        cargarSecuenciales(50);
        sincronizacion.sincronizar();
        MetricasWazuh antes = sincronizacion.actual();

        reloj.ahora.addAndGet(30_000);
        sincronizacion.sincronizar();

        MetricasWazuh despues = sincronizacion.actual();
        assertThat(despues.mitre()).isEqualTo(antes.mitre());
        assertThat(despues.alertasAnalizadas()).isEqualTo(antes.alertasAnalizadas());
        assertThat(despues.topReglas()).isEqualTo(antes.topReglas());
    }

    @Test
    void siTheHiveFallaDespuesDeLaCargaSeSirvenLasUltimasMetricasConRespondioFalse() {
        cargarSecuenciales(30);
        sincronizacion.sincronizar();
        MetricasWazuh bueno = sincronizacion.actual();

        hive.codigoForzado = 503;
        reloj.ahora.addAndGet(30_000);
        sincronizacion.sincronizarEnSegundoPlano();

        MetricasWazuh m = sincronizacion.actual();
        assertThat(m.estado()).isEqualTo("listo");
        assertThat(m.mitre()).isEqualTo(bueno.mitre());
        assertThat(m.thehive().respondio()).isFalse();
        assertThat(m.thehive().consultadoEn()).isEqualTo(T + 30_000);

        hive.codigoForzado = 0;
        reloj.ahora.addAndGet(30_000);
        sincronizacion.sincronizarEnSegundoPlano();

        assertThat(sincronizacion.actual().thehive().respondio()).isTrue();
    }

    @Test
    void loQueSaleDeLaVentanaSeDescarta() {
        hive.alertas.add(wz("~vieja", INICIO_VENTANA + MIN));         // 29 oct.
        hive.alertas.add(wz("~nueva", T - MIN));
        sincronizacion.sincronizar();
        assertThat(sincronizacion.alertasGuardadas()).isEqualTo(2);

        reloj.ahora.addAndGet(DIA);   // la ventana avanzó un día: el 29 oct. ya no cuenta
        sincronizacion.sincronizar();

        assertThat(sincronizacion.alertasGuardadas()).isEqualTo(1);
        assertThat(sincronizacion.actual().desde()).isEqualTo("2026-10-30");
    }

    // ---------------------------------------------------------------------------------------------------------
    // Alertas raras
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void unaAlertaSinBloqueConJsonRotoOConCamposAusentesNoRompeLaSincronizacion() {
        hive.alertas.add(wz("~buena", T - 10 * MIN));
        hive.alertas.add(alerta("~sin-bloque", T - 9 * MIN, 1, "New", "wazuh", "wazuh", "Alerta recibida desde Wazuh Manager.", "wazuh"));
        hive.alertas.add(alerta("~roto", T - 8 * MIN, 1, "New", "wazuh", "wazuh", "```json\n{\"regla\": {\"id\": \"5710\", \n```", "wazuh"));
        hive.alertas.add(alerta("~vacio", T - 7 * MIN, 1, "New", "wazuh", "wazuh", "```json\n{}\n```", "wazuh"));
        hive.alertas.add(alerta("~numerico", T - 6 * MIN, 1, "New", "wazuh", "wazuh", "```json\n[1,2,3]\n```", "wazuh"));
        ObjectNode sinDescripcion = alerta("~sin-descripcion", T - 5 * MIN, 1, "New", "wazuh", "wazuh", "x", "wazuh");
        sinDescripcion.remove("description");
        hive.alertas.add(sinDescripcion);

        sincronizacion.sincronizar();

        MetricasWazuh m = sincronizacion.actual();
        assertThat(m.estado()).isEqualTo("listo");
        assertThat(sincronizacion.alertasGuardadas()).isEqualTo(6);
        assertThat(m.alertasAnalizadas()).as("la buena y la de {} vacío").isEqualTo(2);
        assertThat(m.sinBloque()).isEqualTo(4);
    }

    @Test
    void conLosFixturesAnonimizadosComoAlertasDeWazuh() {
        long creada = T - 60 * MIN;
        for (JsonNode crudo : FixturesTheHive.alertasCrudas()) {
            ObjectNode a = ((ObjectNode) crudo).deepCopy();
            a.put("_createdAt", creada -= 1000);
            a.put("type", "wazuh");   // todas pasan por Wazuh; las que no traen bloque cuentan como "sin bloque"
            if (a.path("tags").toString().contains("simulacion")) {
                continue;
            }
            hive.alertas.add(a);
        }

        sincronizacion.sincronizar();

        MetricasWazuh m = sincronizacion.actual();
        assertThat(m.estado()).isEqualTo("listo");
        assertThat(m.alertasAnalizadas()).isEqualTo(9);
        assertThat(m.sinBloque()).isEqualTo(5);   // lab (3) + MISP (2): la simulación se salta
        assertThat(m.mitre().tacticas()).isNotEmpty();
        assertThat(m.topIps()).extracting(MetricasWazuh.ConteoIp::ip).allMatch(ip -> ip.startsWith("192.0.2."));
    }

    @Test
    void loQueSeSirveNoTrae_ningunDatoSensibleNiLaKey() throws Exception {
        cargarSecuenciales(5);
        sincronizacion.sincronizar();

        String json = JSON.writeValueAsString(sincronizacion.actual());

        assertThat(json).doesNotContain("CLAVE-DE-PRUEBA").doesNotContain("Bearer").doesNotContain("description");
        List<String> campos = new java.util.ArrayList<>();
        JSON.readTree(json).fieldNames().forEachRemaining(campos::add);
        assertThat(campos).containsExactly("generadoEn", "estado", "progreso", "thehive", "dias", "desde", "alertasAnalizadas",
                "sinBloque", "mitre", "cumplimiento", "topIps", "topUsuarios", "topReglas", "agentes", "porNivel");
    }
}
