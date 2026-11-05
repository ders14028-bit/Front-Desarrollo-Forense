package co.edu.escuelaing.dashboard.resumen;

import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.alerta;
import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.caso;
import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.tarea;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import co.edu.escuelaing.dashboard.config.ConfiguracionTheHive;
import co.edu.escuelaing.dashboard.config.ReglasNegocio;
import co.edu.escuelaing.dashboard.config.SlaMinutos;
import co.edu.escuelaing.dashboard.dominio.FixturesTheHive;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorDia;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorOrigen;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorSeveridad;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorTipo;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveNoRespondeException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * El servicio contra un TheHive en memoria que entiende las consultas: las cifras salen de los datos, así que una
 * consulta mal armada (filtro equivocado, _has, _between, sin _size…) da un número incorrecto y la prueba falla.
 */
class ResumenServiceTest {

    /** 2026-11-04 15:00 en Bogotá. */
    static final long T = Instant.parse("2026-11-04T20:00:00Z").toEpochMilli();
    static final long MIN = 60_000L;
    static final long DIA = 86_400_000L;
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Reloj que las pruebas pueden mover. */
    static final class RelojAjustable extends Clock {
        final AtomicLong ahora;

        RelojAjustable(long ms) {
            ahora = new AtomicLong(ms);
        }

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
    ConteosPorDia conteos;
    TacticasPorRegla tacticas;
    ResumenService servicio;

    @BeforeEach
    void preparar() {
        hive = new TheHiveEnMemoria();
        reloj = new RelojAjustable(T);
        conteos = new ConteosPorDia();
        tacticas = new TacticasPorRegla(reloj);
        servicio = nuevoServicio(reglas(false));
    }

    @AfterEach
    void cerrar() {
        hive.close();
    }

    private ResumenService nuevoServicio(ReglasNegocio reglas) {
        var cliente = new TheHiveClient(new ConfiguracionTheHive(hive.url(), "CLAVE-DE-PRUEBA", "escuelaing-prueba"),
                new LimitesTheHive(Duration.ofSeconds(2), Duration.ofSeconds(5), null, null), JSON);
        var consultas = new ConsultasDashboard(reglas);
        return new ResumenService(cliente, new SlaMinutos(15, 30, 120, 240), reglas, reloj, conteos, tacticas,
                new MuestreoDeTacticas(cliente, consultas, tacticas), consultas);
    }

    private static ReglasNegocio reglas(boolean incluirSimulaciones) {
        return new ReglasNegocio(null, null, null, null, null, null, null, null, incluirSimulaciones);
    }

    private static String descripcionDeRegla(String regla) {
        return FixturesTheHive.deRegla(regla).descripcion();
    }

    /** El escenario descrito en el comentario de la clase: 8 alertas reales + 1 simulación que debe quedar fuera. */
    private void cargarAlertas() {
        String wazuh60106 = descripcionDeRegla("60106");   // táctica: Defense Evasion
        String wazuh5501 = descripcionDeRegla("5501");     // táctica: Defense Evasion
        String wazuh60137 = descripcionDeRegla("60137");   // sin MITRE
        hive.alertas.addAll(List.of(
                alerta("~1", T - 10 * MIN, 4, "New", "wazuh", "wazuh", "sin bloque", "wazuh", "escenario:phishing"),
                alerta("~2", T - 15 * MIN, 4, "New", "wazuh", "wazuh", wazuh60106, "wazuh", "regla:60106"),
                alerta("~3", T - 15 * MIN - 1, 4, "New", "wazuh", "wazuh", wazuh60106, "wazuh", "regla:60106"),
                alerta("~4", T - 31 * MIN, 3, "New", "wazuh", "wazuh", wazuh60137, "wazuh", "regla:60137"),
                alerta("~5", T - 60 * MIN, 2, "New", "misp-kali-rase", "misp", "Evento MISP: 2312", "misp"),
                alerta("~6", T - 3 * DIA, 1, "Imported", "wazuh", "wazuh", "x", "wazuh", "escenario:malware"),
                alerta("~7", T - 2 * DIA, 1, "InProgress", "wazuh", "wazuh", wazuh5501, "wazuh", "regla:5501"),
                alerta("~8", T - 5 * DIA, 1, "New", "wazuh", "wazuh", wazuh60106, "wazuh", "regla:60106", "escenario:phishing"),
                // Simulación de un playbook: NO debe contarse en nada.
                alerta("~9", T - 1 * MIN, 4, "New", "wazuh-simulado", "simulacion", "{}", "simulacion", "escenario:fuerza-bruta")));
        hive.alertas.get(5).put("caseId", "~c1");
    }

    // ---------------------------------------------------------------------------------------------------------
    // Alertas
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void lasCifrasDeLasAlertasSalenDeLosDatos() {
        cargarAlertas();

        var a = servicio.calcular().alertas();

        assertThat(a.recibidas()).isEqualTo(8);
        assertThat(a.sinAtender()).isEqualTo(6);
        assertThat(a.criticasYAltas()).isEqualTo(4);
        assertThat(a.fueraDeSla()).as("~3 (sev 4, +1 ms), ~4 (sev 3, 31 min) y ~8 (sev 1, 5 días)").isEqualTo(3);
    }

    @Test
    void justoEnElLimiteDelSlaTodaviaEstaDentro() {
        hive.alertas.add(alerta("~1", T - 15 * MIN, 4, "New", "wazuh", "wazuh", "x", "wazuh"));

        assertThat(servicio.calcular().alertas().fueraDeSla()).isZero();

        hive.alertas.add(alerta("~2", T - 15 * MIN - 1, 4, "New", "wazuh", "wazuh", "x", "wazuh"));
        assertThat(servicio.calcular().alertas().fueraDeSla()).isEqualTo(1);
    }

    @Test
    void laAlertaMasAntiguaYElPromedioSoloMiranLasSinAtender() {
        cargarAlertas();

        var a = servicio.calcular().alertas();

        assertThat(a.masAntiguaSinAtenderMs()).isEqualTo(5 * DIA);
        // (10 + 15 + 31 + 60) min + 15 min + 1 ms + 5 días, entre 6 alertas.
        long esperado = ((10 + 15 + 15 + 31 + 60) * MIN + 1 + 5 * DIA) / 6;
        assertThat(a.antiguedadPromedioSinAtenderMs()).isCloseTo(esperado, within(2L));
    }

    @Test
    void laSeveridadSiempreTieneLosCuatroNivelesDeCriticaABaja() {
        cargarAlertas();

        assertThat(servicio.calcular().alertas().porSeveridad()).containsExactly(
                new ConteoPorSeveridad(4, 3), new ConteoPorSeveridad(3, 1), new ConteoPorSeveridad(2, 1), new ConteoPorSeveridad(1, 3));
    }

    @Test
    void lasSeveridadesQueFaltanVanEnCero() {
        hive.alertas.add(alerta("~1", T - MIN, 2, "New", "wazuh", "wazuh", "x", "wazuh"));

        assertThat(servicio.calcular().alertas().porSeveridad()).containsExactly(
                new ConteoPorSeveridad(4, 0), new ConteoPorSeveridad(3, 0), new ConteoPorSeveridad(2, 1), new ConteoPorSeveridad(1, 0));
    }

    @Test
    void elOrigenVaDeMayorAMenorYElEmpateSeDesempataPorNombre() {
        cargarAlertas();
        hive.alertas.add(alerta("~20", T - MIN, 1, "New", "auditd", "wazuh", "x", "wazuh"));
        hive.alertas.add(alerta("~21", T - MIN, 1, "New", "Zeek", "wazuh", "x", "wazuh"));

        assertThat(servicio.calcular().alertas().porOrigen()).containsExactly(
                new ConteoPorOrigen("wazuh", 7), new ConteoPorOrigen("auditd", 1), new ConteoPorOrigen("misp-kali-rase", 1),
                new ConteoPorOrigen("Zeek", 1));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Tipo de amenaza
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void elTipoVaPorEscenarioLuegoPorTacticaMitreYSiNoSinClasificar() {
        cargarAlertas();

        var a = servicio.calcular().alertas();

        // ~1 y ~8 = phishing (~8 también trae regla:60106, pero el escenario gana); ~6 = malware;
        // ~2, ~3 (60106) y ~7 (5501) = Defense Evasion; ~4 (60137 sin MITRE) y ~5 (sin regla) = sin clasificar.
        assertThat(a.porTipoAmenaza()).containsExactly(
                new ConteoPorTipo("evasion-de-defensas", 3), new ConteoPorTipo("phishing", 2), new ConteoPorTipo("malware", 1));
        assertThat(a.sinClasificar()).isEqualTo(2);
        long suma = a.porTipoAmenaza().stream().mapToLong(ConteoPorTipo::cantidad).sum() + a.sinClasificar();
        assertThat(suma).as("cada alerta cuenta exactamente una vez").isEqualTo(a.recibidas());
    }

    @Test
    void elTipoNuncaSeDeduceDelTituloNiDelOrigen() {
        var a = alerta("~1", T - MIN, 2, "New", "phishing-gateway", "wazuh", "x", "wazuh");
        a.put("title", "Ataque de fuerza bruta SSH contra el servidor");
        hive.alertas.add(a);

        var resumen = servicio.calcular().alertas();

        assertThat(resumen.porTipoAmenaza()).isEmpty();
        assertThat(resumen.sinClasificar()).isEqualTo(1);
    }

    @Test
    void laTacticaDeUnaReglaSeMuestreaUnaVezYQuedaEnCache() {
        cargarAlertas();

        servicio.calcular();
        long muestrasLaPrimeraVez = hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "page")
                && TheHiveEnMemoria.usa(c, "_eq", "tags"));
        int antes = hive.consultas.size();
        servicio.calcular();
        long muestrasLaSegundaVez = hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "page")
                && TheHiveEnMemoria.usa(c, "_eq", "tags")) - muestrasLaPrimeraVez;

        assertThat(muestrasLaPrimeraVez).as("una por regla: 60106, 5501 y 60137").isEqualTo(3);
        assertThat(muestrasLaSegundaVez).isZero();
        assertThat(hive.consultas.size() - antes).as("la segunda vez hay muchas menos consultas").isLessThan(antes);
    }

    @Test
    void siLaMuestraNoTraeBloqueSeReintentaPronto() {
        // La regla 777 solo tiene una alerta sin bloque de Wazuh: no se sabe su táctica y se reintenta a los 10 min.
        hive.alertas.add(alerta("~1", T - MIN, 2, "New", "wazuh", "wazuh", "sin bloque", "wazuh", "regla:777"));

        servicio.calcular();
        assertThat(tacticas.sabe("777")).isTrue();
        assertThat(tacticas.tactica("777")).isEmpty();

        hive.alertas.set(0, alerta("~1", T - MIN, 2, "New", "wazuh", "wazuh", descripcionDeRegla("60106"), "wazuh", "regla:777"));
        reloj.ahora.addAndGet(11 * MIN);
        var resumen = servicio.calcular().alertas();

        assertThat(resumen.porTipoAmenaza()).containsExactly(new ConteoPorTipo("evasion-de-defensas", 1));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Simulaciones y datos de laboratorio
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void lasSimulacionesSeExcluyenPorDefectoConNeTypeEnTodasLasConsultasDeAlertas() {
        cargarAlertas();

        servicio.calcular();

        var consultasDeAlertas = hive.consultas.stream().filter(c -> "listAlert".equals(c.path("query").get(0).path("_name").asText())).toList();
        assertThat(consultasDeAlertas).isNotEmpty().allSatisfy(c ->
                assertThat(TheHiveEnMemoria.usaValor(c, "_ne", "type", "simulacion")).as(c.toString()).isTrue());
        // Los casos no tienen type: esas consultas no llevan el filtro.
        assertThat(hive.consultas.stream().filter(c -> "listCase".equals(c.path("query").get(0).path("_name").asText())))
                .noneMatch(c -> TheHiveEnMemoria.usa(c, "_ne", "type"));
    }

    @Test
    void siSePideIncluirSimulacionesEntranEnLasCifras() {
        cargarAlertas();
        var conSimulaciones = nuevoServicio(reglas(true));

        var a = conSimulaciones.calcular();

        assertThat(a.alertas().recibidas()).isEqualTo(9);
        assertThat(a.datosDeLaboratorio()).as("la simulación lleva el tag simulacion").isTrue();
        assertThat(hive.consultas.stream().filter(c -> "listAlert".equals(c.path("query").get(0).path("_name").asText())))
                .noneMatch(c -> TheHiveEnMemoria.usa(c, "_ne", "type"));
    }

    @Test
    void sinDatosDePruebaNoHayAvisoDeLaboratorio() {
        cargarAlertas();

        assertThat(servicio.calcular().datosDeLaboratorio()).isFalse();
    }

    @Test
    void unaAlertaConElTagSimulacionActivaElAviso() {
        hive.alertas.add(alerta("~1", T - MIN, 2, "New", "wazuh", "external", "x", "wazuh", "simulacion"));

        assertThat(servicio.calcular().datosDeLaboratorio()).isTrue();
    }

    @Test
    void unCasoConElTagSimulacionActivaElAviso() {
        hive.casos.add(caso("~c1", T - DIA, "New", "New", null, "simulacion"));

        assertThat(servicio.calcular().datosDeLaboratorio()).isTrue();
    }

    // ---------------------------------------------------------------------------------------------------------
    // Consultas: lo que dijo el sondeo
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void nuncaSeUsaHasCaseYLasConvertidasSonStatusImported() {
        cargarAlertas();

        var resumen = servicio.calcular();

        assertThat(hive.consultasComoTexto()).noneMatch(c -> c.contains("_has"));
        assertThat(hive.contarConsultas(c -> TheHiveEnMemoria.usaValor(c, "_eq", "status", "Imported") && TheHiveEnMemoria.es(c, "listAlert", "count")))
                .isEqualTo(1);
        assertThat(resumen.casos().alertasConvertidas().convertidas()).isEqualTo(1);
        assertThat(resumen.casos().alertasConvertidas().total()).isEqualTo(8);
        assertThat(resumen.casos().alertasConvertidas().porcentaje()).isEqualTo(12.5);
    }

    @Test
    void todasLasAgregacionesPorCampoPidenSizeMil() {
        cargarAlertas();

        servicio.calcular();

        var agregaciones = hive.consultas.stream().filter(TheHiveEnMemoria::esAgregacion)
                .filter(c -> !"avg".equals(c.path("query").get(c.path("query").size() - 1).path("_agg").asText())).toList();
        assertThat(agregaciones).hasSizeGreaterThanOrEqualTo(4);   // severity, source, tags (con escenario) y tags (sin escenario)
        assertThat(agregaciones).allSatisfy(c ->
                assertThat(c.path("query").get(c.path("query").size() - 1).path("_size").asInt()).as(c.toString()).isEqualTo(1000));
    }

    @Test
    void laAntiguedadPromedioUsaAvgSobreCreatedAtDeLasNewYSinSimulaciones() {
        cargarAlertas();

        servicio.calcular();

        var avg = hive.consultas.stream().filter(c -> "avg".equals(c.path("query").get(c.path("query").size() - 1).path("_agg").asText())).toList();
        assertThat(avg).hasSize(1);
        assertThat(avg.get(0).path("query").get(avg.get(0).path("query").size() - 1).path("_field").asText()).isEqualTo("_createdAt");
        assertThat(TheHiveEnMemoria.usaValor(avg.get(0), "_eq", "status", "New")).isTrue();
        assertThat(TheHiveEnMemoria.usaValor(avg.get(0), "_ne", "type", "simulacion")).isTrue();
    }

    @Test
    void elFueraDeSlaUsaMenorEstrictoConElLimiteDeCadaSeveridad() {
        cargarAlertas();

        servicio.calcular();

        for (int severidad = 1; severidad <= 4; severidad++) {
            int s = severidad;
            int limiteMin = new int[] {0, 240, 120, 30, 15}[s];
            var consultas = hive.consultas.stream().filter(c -> TheHiveEnMemoria.usaValor(c, "_eq", "severity", String.valueOf(s))
                    && TheHiveEnMemoria.usa(c, "_lt", "_createdAt") && TheHiveEnMemoria.es(c, "listAlert", "count")).toList();
            assertThat(consultas).as("severidad " + s).hasSize(1);
            assertThat(TheHiveEnMemoria.valoresNumericos(consultas.get(0), "_lt", "_createdAt")).contains(T - limiteMin * MIN);
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // Estabilidad de las cifras entre refrescos
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void todasLasConsultasDeAlertasMiranElMismoConjuntoCreadoAntesDelInstanteDelCalculo() {
        cargarAlertas();

        servicio.calcular();

        var deAlertas = hive.consultas.stream().filter(c -> "listAlert".equals(c.path("query").get(0).path("_name").asText())
                && !TheHiveEnMemoria.usa(c, "_eq", "tags") || TheHiveEnMemoria.es(c, "listAlert", "count")).toList();
        assertThat(deAlertas).isNotEmpty().allSatisfy(c ->
                assertThat(TheHiveEnMemoria.valoresNumericos(c, "_lt", "_createdAt")).as(c.toString()).contains(T + 1));
    }

    @Test
    void lasAlertasQueLleganDespuesDelInstanteDelCalculoNoEntranEnEseCalculo() {
        cargarAlertas();
        hive.alertas.add(alerta("~futura", T + 5, 4, "New", "wazuh", "wazuh", "x", "wazuh", "escenario:phishing"));

        var a = servicio.calcular().alertas();

        assertThat(a.recibidas()).isEqualTo(8);
        assertThat(a.porTipoAmenaza().stream().mapToLong(ConteoPorTipo::cantidad).sum() + a.sinClasificar()).isEqualTo(8);
    }

    @Test
    void conMuchasReglasElMuestreoEsCompletoYSinClasificarNoCambiaEntreRefrescos() {
        // 150 reglas distintas (más que las 80 del primer diseño), cada una con una alerta con táctica MITRE.
        String conTactica = descripcionDeRegla("60106");
        for (int i = 0; i < 150; i++) {
            hive.alertas.add(alerta("~m" + i, T - (i + 1) * MIN, 1, "New", "wazuh", "wazuh", conTactica, "wazuh", "regla:9" + i));
        }
        // Y 20 de una regla sin MITRE, 5 sin regla.
        for (int i = 0; i < 20; i++) {
            hive.alertas.add(alerta("~s" + i, T - (i + 1) * MIN, 1, "New", "wazuh", "wazuh", descripcionDeRegla("60137"), "wazuh", "regla:60137"));
        }
        for (int i = 0; i < 5; i++) {
            hive.alertas.add(alerta("~n" + i, T - (i + 1) * MIN, 1, "New", "wazuh", "wazuh", "x", "wazuh"));
        }

        var primera = servicio.calcular().alertas();
        var segunda = servicio.calcular().alertas();
        reloj.ahora.addAndGet(30_000);
        var tercera = servicio.calcular().alertas();

        assertThat(primera.sinClasificar()).as("20 de la regla sin MITRE + 5 sin regla; ninguna regla con táctica queda sin muestrear").isEqualTo(25);
        assertThat(primera.porTipoAmenaza()).containsExactly(new ConteoPorTipo("evasion-de-defensas", 150));
        assertThat(segunda.sinClasificar()).isEqualTo(primera.sinClasificar());
        assertThat(tercera.sinClasificar()).isEqualTo(primera.sinClasificar());
        assertThat(tercera.porTipoAmenaza()).isEqualTo(primera.porTipoAmenaza());
    }

    @Test
    void siUnaMuestraVencidaYaNoTraeElBloqueSeConservaLaTacticaConocida() {
        hive.alertas.add(alerta("~1", T - MIN, 1, "New", "wazuh", "wazuh", descripcionDeRegla("60106"), "wazuh", "regla:5710"));
        var antes = servicio.calcular().alertas();

        hive.alertas.set(0, alerta("~1", T - MIN, 1, "New", "wazuh", "wazuh", "sin bloque", "wazuh", "regla:5710"));
        reloj.ahora.addAndGet(7 * 60 * MIN);   // la táctica (vigente 6 h) venció
        var despues = servicio.calcular().alertas();

        assertThat(antes.porTipoAmenaza()).containsExactly(new ConteoPorTipo("evasion-de-defensas", 1));
        assertThat(despues.porTipoAmenaza()).as("sigue igual").isEqualTo(antes.porTipoAmenaza());
        assertThat(despues.sinClasificar()).isZero();
    }

    @Test
    void unDatoVencidoDeLaCacheSeSigueUsandoMientrasNoSePuedaRenovar() {
        tacticas.guardar("5710", java.util.Optional.of("acceso-a-credenciales"));
        reloj.ahora.addAndGet(7 * 60 * MIN);

        assertThat(tacticas.sabe("5710")).as("vencido: hay que renovarlo").isFalse();
        assertThat(tacticas.tactica("5710")).as("pero mientras tanto se usa el último").contains("acceso-a-credenciales");
    }

    @Test
    void ningunaConsultaUsaBetween() {
        cargarAlertas();

        servicio.calcular();

        assertThat(hive.consultasComoTexto()).noneMatch(c -> c.contains("_between"));
    }

    @Test
    void siNoHayAlertasSinAtenderLaMasAntiguaYElPromedioSonNull() {
        hive.alertas.add(alerta("~1", T - MIN, 2, "Imported", "wazuh", "wazuh", "x", "wazuh"));

        var a = servicio.calcular().alertas();

        assertThat(a.antiguedadPromedioSinAtenderMs()).isNull();
        assertThat(a.masAntiguaSinAtenderMs()).isNull();
    }

    @Test
    void elPromedioReconoceVariasFormasDeLaRespuestaDeAvg() {
        assertThat(ResumenService.primerNumero(num("1793800000000.5")).getAsDouble()).isEqualTo(1793800000000.5);
        assertThat(ResumenService.primerNumero(json("{\"avg_createdAt\": 12.5}")).getAsDouble()).isEqualTo(12.5);
        assertThat(ResumenService.primerNumero(json("{\"avg\": {\"_createdAt\": 7}}")).getAsDouble()).isEqualTo(7);
        assertThat(ResumenService.primerNumero(json("[{\"_key\":\"x\",\"avg\":3.5}]")).getAsDouble()).isEqualTo(3.5);
        assertThat(ResumenService.primerNumero(json("{\"k\":\"texto\"}"))).isEmpty();
        assertThat(ResumenService.primerNumero(json("null"))).isEmpty();
    }

    private static JsonNode num(String texto) {
        return json(texto);
    }

    private static JsonNode json(String texto) {
        try {
            return JSON.readTree(texto);
        } catch (Exception e) {
            throw new IllegalArgumentException(e);
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // Alertas por día (Bogotá)
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void porDiaTieneTreintaDiasConCerosDelMasAntiguoAHoy() {
        cargarAlertas();

        List<ConteoPorDia> dias = servicio.calcular().alertas().porDia();

        assertThat(dias).hasSize(30);
        assertThat(dias.get(0).dia()).isEqualTo("2026-10-06");
        assertThat(dias.get(29).dia()).isEqualTo("2026-11-04");
        assertThat(dias.stream().filter(d -> d.cantidad() > 0).map(ConteoPorDia::dia).toList())
                .containsExactly("2026-10-30", "2026-11-01", "2026-11-02", "2026-11-04");
        assertThat(dias.get(29).cantidad()).isEqualTo(5);   // ~1 a ~5 (la simulación queda fuera)
        assertThat(dias.stream().mapToLong(ConteoPorDia::cantidad).sum()).isEqualTo(8);
    }

    @Test
    void elDiaCambiaALasCeroHorasDeBogotaConGteYLt() {
        long inicioDelCuatro = Instant.parse("2026-11-04T05:00:00Z").toEpochMilli();
        hive.alertas.add(alerta("~1", inicioDelCuatro, 1, "New", "wazuh", "wazuh", "x", "wazuh"));        // hoy, justo a las 00:00
        hive.alertas.add(alerta("~2", inicioDelCuatro - 1, 1, "New", "wazuh", "wazuh", "x", "wazuh"));    // 23:59:59.999 de ayer

        List<ConteoPorDia> dias = servicio.calcular().alertas().porDia();

        assertThat(dias.get(29)).isEqualTo(new ConteoPorDia("2026-11-04", 1));
        assertThat(dias.get(28)).isEqualTo(new ConteoPorDia("2026-11-03", 1));
    }

    private long consultasDeDia() {
        return hive.contarConsultas(c -> TheHiveEnMemoria.es(c, "listAlert", "count")
                && TheHiveEnMemoria.usa(c, "_gte", "_createdAt") && TheHiveEnMemoria.usa(c, "_lt", "_createdAt"));
    }

    @Test
    void losDiasPasadosSeGuardanYSoloSeRecuentaHoy() {
        cargarAlertas();

        servicio.calcular();
        long primera = consultasDeDia();
        servicio.calcular();
        long segunda = consultasDeDia() - primera;

        assertThat(primera).as("30 días la primera vez").isEqualTo(30);
        assertThat(segunda).as("después, solo hoy").isEqualTo(1);
    }

    @Test
    void alCambiarDeDiaLaCacheCaducaALaMedianoche() {
        cargarAlertas();
        servicio.calcular();
        long antes = consultasDeDia();

        reloj.ahora.addAndGet(DIA);   // mañana a la misma hora
        var dias = servicio.calcular().alertas().porDia();
        long despues = consultasDeDia() - antes;

        assertThat(despues).as("la ventana avanzó y lo guardado caducó a medianoche").isEqualTo(30);
        assertThat(dias.get(29).dia()).isEqualTo("2026-11-05");
    }

    @Test
    void ayerSeRecuentaDuranteLosPrimerosDiezMinutosDelDiaNuevo() {
        cargarAlertas();
        // 00:03 del 5 de noviembre en Bogotá: "ayer" (4 de nov.) acaba de terminar.
        reloj.ahora.set(Instant.parse("2026-11-05T05:03:00Z").toEpochMilli());
        servicio.calcular();
        long primera = consultasDeDia();
        servicio.calcular();
        long segunda = consultasDeDia() - primera;

        assertThat(segunda).as("hoy y ayer, que todavía se recuenta").isEqualTo(2);

        // 00:11: pasó la gracia; ayer se recuenta una última vez y se guarda.
        reloj.ahora.set(Instant.parse("2026-11-05T05:11:00Z").toEpochMilli());
        servicio.calcular();
        long antes = consultasDeDia();
        servicio.calcular();
        long despues = consultasDeDia() - antes;

        assertThat(despues).as("ahora solo hoy").isEqualTo(1);
    }

    @Test
    void unaAlertaTardiaDeAyerSeVeEnLosPrimerosDiezMinutos() {
        reloj.ahora.set(Instant.parse("2026-11-05T05:03:00Z").toEpochMilli());
        long ayer = Instant.parse("2026-11-05T04:59:00Z").toEpochMilli();
        assertThat(servicio.calcular().alertas().porDia().get(28).cantidad()).isZero();

        hive.alertas.add(alerta("~1", ayer, 1, "New", "wazuh", "wazuh", "x", "wazuh"));

        assertThat(servicio.calcular().alertas().porDia().get(28).cantidad()).isEqualTo(1);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Casos
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void lasCifrasDeLosCasosSalenDeLosDatos() {
        long h = 60 * MIN;
        hive.casos.addAll(List.of(
                caso("~c1", T - 5 * DIA, "New", "New", null),
                caso("~c2", T - 4 * DIA, "InProgress", "InProgress", null),
                caso("~c3", T - 3 * DIA, "Closed", "TruePositive", T - 3 * DIA + h),
                caso("~c4", T - 3 * DIA, "Closed", "FalsePositive", T - 3 * DIA + 3 * h),
                caso("~c5", T - 2 * DIA, "Closed", "TruePositive", null)));
        hive.tareas.addAll(List.of(
                tarea("~t1", "Contención", "Completed"), tarea("~t2", "Contención", "Completed"),
                tarea("~t3", "Contención", "Waiting"), tarea("~t4", "Erradicación", "Completed")));

        var c = servicio.calcular().casos();

        assertThat(c.reportados()).isEqualTo(5);
        assertThat(c.abiertos()).isEqualTo(1);
        assertThat(c.enProgreso()).isEqualTo(1);
        assertThat(c.cerrados()).isEqualTo(3);
        assertThat(c.confirmadosYCerrados()).isEqualTo(2);
        assertThat(c.contencionesHechas()).isEqualTo(2);
        assertThat(c.tiempoPromedioCierreMs()).as("(1 h + 3 h) / 2; el caso sin fecha de cierre no cuenta").isEqualTo(2 * h);
    }

    @Test
    void sinCasosTodoVaEnCeroYElPromedioEsNull() {
        var resumen = servicio.calcular();

        assertThat(resumen.casos().reportados()).isZero();
        assertThat(resumen.casos().cerrados()).isZero();
        assertThat(resumen.casos().contencionesHechas()).isZero();
        assertThat(resumen.casos().confirmadosYCerrados()).isZero();
        assertThat(resumen.casos().tiempoPromedioCierreMs()).isNull();
        assertThat(resumen.casos().alertasConvertidas().porcentaje()).isNull();
        assertThat(resumen.casos().alertasConvertidas().total()).isZero();
        assertThat(hive.consultas.stream().filter(c -> TheHiveEnMemoria.es(c, "listCase", "page"))).as("sin cerrados no se piden").isEmpty();
    }

    @Test
    void losNombresDeContencionYTruePositiveSalenDeLaConfiguracion() {
        hive.tareas.add(tarea("~t1", "Containment", "Done"));
        hive.casos.add(caso("~c1", T - DIA, "Cerrado", "Confirmado", T));
        var propias = nuevoServicio(new ReglasNegocio("Containment", "Confirmado", "Done", null, null, "Cerrado", null, null, false));

        var c = propias.calcular().casos();

        assertThat(c.contencionesHechas()).isEqualTo(1);
        assertThat(c.cerrados()).isEqualTo(1);
        assertThat(c.confirmadosYCerrados()).isEqualTo(1);
        // Y con los nombres por defecto no cuentan.
        var porDefecto = servicio.calcular().casos();
        assertThat(porDefecto.contencionesHechas()).isZero();
        assertThat(porDefecto.confirmadosYCerrados()).isZero();
    }

    // ---------------------------------------------------------------------------------------------------------
    // Forma, vacío y fallos
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void sinNingunDatoTodoVaEnCeroConNullExplicitos() throws Exception {
        var resumen = servicio.calcular();
        JsonNode json = JSON.valueToTree(resumen);

        assertThat(json.path("alertas").path("recibidas").asLong()).isZero();
        assertThat(json.path("alertas").has("masAntiguaSinAtenderMs")).isTrue();
        assertThat(json.path("alertas").path("masAntiguaSinAtenderMs").isNull()).isTrue();
        assertThat(json.path("alertas").path("antiguedadPromedioSinAtenderMs").isNull()).isTrue();
        assertThat(json.path("casos").path("tiempoPromedioCierreMs").isNull()).isTrue();
        assertThat(json.path("casos").path("alertasConvertidas").path("porcentaje").isNull()).isTrue();
        assertThat(json.path("alertas").path("porSeveridad")).hasSize(4);
        assertThat(json.path("alertas").path("porDia")).hasSize(30);
        assertThat(json.path("alertas").path("porTipoAmenaza")).isEmpty();
        assertThat(json.path("alertas").path("sinClasificar").asLong()).isZero();
        assertThat(json.path("datosDeLaboratorio").asBoolean()).isFalse();
    }

    @Test
    void elJsonTieneExactamenteLaFormaDelContratoMasThehive() {
        cargarAlertas();
        hive.casos.add(caso("~c1", T - DIA, "Closed", "TruePositive", T));

        JsonNode json = JSON.valueToTree(servicio.calcular());

        assertThat(nombres(json)).containsExactly("generadoEn", "datosDeLaboratorio", "alertas", "casos", "thehive");
        assertThat(nombres(json.path("alertas"))).containsExactly("recibidas", "sinAtender", "criticasYAltas", "masAntiguaSinAtenderMs",
                "antiguedadPromedioSinAtenderMs", "fueraDeSla", "porSeveridad", "porTipoAmenaza", "sinClasificar", "porOrigen", "porDia");
        assertThat(nombres(json.path("casos"))).containsExactly("reportados", "abiertos", "enProgreso", "cerrados", "alertasConvertidas",
                "contencionesHechas", "confirmadosYCerrados", "tiempoPromedioCierreMs");
        assertThat(nombres(json.path("casos").path("alertasConvertidas"))).containsExactly("convertidas", "total", "porcentaje");
        assertThat(nombres(json.path("alertas").path("porSeveridad").get(0))).containsExactly("severidad", "cantidad");
        assertThat(nombres(json.path("alertas").path("porTipoAmenaza").get(0))).containsExactly("tipo", "cantidad");
        assertThat(nombres(json.path("alertas").path("porOrigen").get(0))).containsExactly("origen", "cantidad");
        assertThat(nombres(json.path("alertas").path("porDia").get(0))).containsExactly("dia", "cantidad");
        assertThat(nombres(json.path("thehive"))).containsExactly("respondio", "consultadoEn");
        assertThat(json.path("thehive").path("respondio").asBoolean()).isTrue();
        assertThat(json.path("thehive").path("consultadoEn").asLong()).isEqualTo(T);
        assertThat(json.path("generadoEn").asLong()).isEqualTo(T);
        // Los números son números y los textos, textos.
        assertThat(json.path("alertas").path("recibidas").isIntegralNumber()).isTrue();
        assertThat(json.path("alertas").path("porDia").get(0).path("dia").isTextual()).isTrue();
        assertThat(json.path("casos").path("alertasConvertidas").path("porcentaje").isFloatingPointNumber()).isTrue();
    }

    private static List<String> nombres(JsonNode objeto) {
        var lista = new java.util.ArrayList<String>();
        objeto.fieldNames().forEachRemaining(lista::add);
        return lista;
    }

    @Test
    void siTheHiveFallaSePropagaLaExcepcionOriginal() {
        hive.codigoForzado = 502;

        assertThatThrownBy(() -> servicio.calcular()).isInstanceOf(TheHiveNoRespondeException.class);
    }
}
