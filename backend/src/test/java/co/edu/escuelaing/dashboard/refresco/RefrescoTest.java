package co.edu.escuelaing.dashboard.refresco;

import static co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria.alerta;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.edu.escuelaing.dashboard.alertas.AlertasService;
import co.edu.escuelaing.dashboard.config.ConfiguracionTheHive;
import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import co.edu.escuelaing.dashboard.config.ReglasNegocio;
import co.edu.escuelaing.dashboard.config.SlaMinutos;
import co.edu.escuelaing.dashboard.resumen.ConteosPorDia;
import co.edu.escuelaing.dashboard.resumen.MuestreoDeTacticas;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial;
import co.edu.escuelaing.dashboard.resumen.ResumenService;
import co.edu.escuelaing.dashboard.resumen.TacticasPorRegla;
import co.edu.escuelaing.dashboard.resumen.TheHiveEnMemoria;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveNoRespondeException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** El refresco en segundo plano: se sirve desde memoria y, si TheHive cae, el último dato bueno con respondio=false. */
class RefrescoTest {

    static final long T = Instant.parse("2026-11-04T20:00:00Z").toEpochMilli();
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

    // ---------------------------------------------------------------------------------------------------------
    // FuenteEnSegundoPlano
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void sinNingunRefrescoNoHayDatos() {
        var fuente = new FuenteEnSegundoPlano<String>("prueba", () -> "x", new RelojAjustable());

        assertThat(fuente.actual()).isEmpty();
    }

    @Test
    void despuesDeUnRefrescoBuenoSeServeElDatoConRespondioTrue() {
        var reloj = new RelojAjustable();
        var fuente = new FuenteEnSegundoPlano<String>("prueba", () -> "dato", reloj);

        fuente.refrescar();

        var servido = fuente.actual().orElseThrow();
        assertThat(servido.valor()).isEqualTo("dato");
        assertThat(servido.respondio()).isTrue();
        assertThat(servido.consultadoEnMs()).isEqualTo(T);
    }

    @Test
    void siUnRefrescoFallaSeConservaElUltimoDatoBuenoConRespondioFalse() {
        var reloj = new RelojAjustable();
        var contador = new AtomicInteger();
        var fuente = new FuenteEnSegundoPlano<String>("prueba", () -> {
            if (contador.incrementAndGet() == 2) {
                throw new TheHiveNoRespondeException("TheHive no responde: se agotó el tiempo de espera.");
            }
            return "dato-" + contador.get();
        }, reloj);

        fuente.refrescar();
        reloj.ahora.addAndGet(30_000);
        fuente.refrescar();   // falla

        var servido = fuente.actual().orElseThrow();
        assertThat(servido.valor()).as("el último dato bueno").isEqualTo("dato-1");
        assertThat(servido.respondio()).isFalse();
        assertThat(servido.consultadoEnMs()).as("el instante del intento fallido").isEqualTo(T + 30_000);

        reloj.ahora.addAndGet(30_000);
        fuente.refrescar();   // se recupera

        servido = fuente.actual().orElseThrow();
        assertThat(servido.valor()).isEqualTo("dato-3");
        assertThat(servido.respondio()).isTrue();
        assertThat(servido.consultadoEnMs()).isEqualTo(T + 60_000);
    }

    @Test
    void siElPrimerRefrescoFallaNoHayDatos() {
        var fuente = new FuenteEnSegundoPlano<String>("prueba", () -> {
            throw new TheHiveNoRespondeException("TheHive no responde: no se pudo conectar (¿Tailscale activo?).");
        }, new RelojAjustable());

        fuente.refrescar();

        assertThat(fuente.actual()).isEmpty();
    }

    @Test
    void refrescarNuncaLanzaAunqueHayaUnErrorInesperado() {
        var fuente = new FuenteEnSegundoPlano<String>("prueba", () -> {
            throw new IllegalStateException("bug con datos sensibles");
        }, new RelojAjustable());

        fuente.refrescar();   // no debe lanzar

        assertThat(fuente.actual()).isEmpty();
    }

    @Test
    void unaPeticionQueLlegaAntesDelPrimerDatoEsperaAEsePrimerIntento() throws Exception {
        var fuente = new FuenteEnSegundoPlano<String>("prueba", () -> {
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return "listo";
        }, new RelojAjustable());
        Thread.ofVirtual().start(fuente::refrescar);

        fuente.esperarPrimerIntento(Duration.ofSeconds(5));

        assertThat(fuente.actual()).isPresent();
    }

    @Test
    void laEsperaDelPrimerIntentoTieneUnLimite() {
        var fuente = new FuenteEnSegundoPlano<String>("prueba", () -> "x", new RelojAjustable());

        long inicio = System.nanoTime();
        fuente.esperarPrimerIntento(Duration.ofMillis(100));   // nadie refresca nunca

        assertThat((System.nanoTime() - inicio) / 1_000_000).isLessThan(2000);
        assertThat(fuente.actual()).isEmpty();
    }

    // ---------------------------------------------------------------------------------------------------------
    // TableroEnSegundoPlano, con un TheHive en memoria
    // ---------------------------------------------------------------------------------------------------------

    TheHiveEnMemoria hive;
    RelojAjustable reloj;
    TableroEnSegundoPlano tablero;
    AlertasService alertasService;
    ResumenService resumenService;

    @BeforeEach
    void preparar() {
        hive = new TheHiveEnMemoria();
        reloj = new RelojAjustable();
        var reglas = new ReglasNegocio(null, null, null, null, null, null, null, false);
        var cliente = new TheHiveClient(new ConfiguracionTheHive(hive.url(), "CLAVE-DE-PRUEBA", "escuelaing-prueba"),
                new LimitesTheHive(Duration.ofSeconds(2), Duration.ofSeconds(10), null, null), JSON);
        var consultas = new ConsultasDashboard(reglas);
        var sla = new SlaMinutos(15, 30, 120, 240);
        var tacticas = new TacticasPorRegla(reloj);
        var resumen = new ResumenService(cliente, sla, reglas, reloj, new ConteosPorDia(), tacticas,
                new MuestreoDeTacticas(cliente, consultas, tacticas), consultas);
        var alertas = new AlertasService(cliente, consultas, sla, tacticas, reloj, JSON);
        resumenService = resumen;
        alertasService = alertas;
        tablero = new TableroEnSegundoPlano(resumen, alertas, reloj, new ConfiguracionRefresco(Duration.ofSeconds(30), Duration.ofMillis(100), true));
        hive.alertas.add(alerta("~1", T - 60_000, 4, "New", "wazuh", "wazuh", "x", "wazuh"));
    }

    @AfterEach
    void cerrar() {
        hive.close();
    }

    @Test
    void despuesDelRefrescoElResumenYLaListaSeSirvenDesdeMemoriaSinTocarATheHive() {
        tablero.refrescar();
        int consultas = hive.consultas.size();

        for (int i = 0; i < 20; i++) {
            assertThat(tablero.resumen().alertas().recibidas()).isEqualTo(1);
            assertThat(tablero.lista().alertas()).hasSize(1);
        }

        assertThat(hive.consultas).as("servir no consulta a TheHive").hasSize(consultas);
        assertThat(tablero.resumen().thehive().respondio()).isTrue();
        assertThat(tablero.lista().thehive().respondio()).isTrue();
    }

    @Test
    void siTheHiveCaeSeSirveElUltimoDatoConRespondioFalseYLuegoSeRecupera() {
        tablero.refrescar();
        ResumenGerencial bueno = tablero.resumen();

        hive.codigoForzado = 503;
        reloj.ahora.addAndGet(30_000);
        tablero.refrescar();

        ResumenGerencial conFallo = tablero.resumen();
        assertThat(conFallo.alertas()).as("los mismos datos").isEqualTo(bueno.alertas());
        assertThat(conFallo.generadoEn()).as("se calcularon antes").isEqualTo(T);
        assertThat(conFallo.thehive().respondio()).isFalse();
        assertThat(conFallo.thehive().consultadoEn()).isEqualTo(T + 30_000);
        assertThat(tablero.lista().thehive().respondio()).isFalse();
        assertThat(tablero.lista().alertas()).hasSize(1);

        hive.codigoForzado = 0;
        hive.alertas.add(alerta("~2", T, 1, "New", "wazuh", "wazuh", "x", "wazuh"));
        reloj.ahora.addAndGet(30_000);
        tablero.refrescar();

        assertThat(tablero.resumen().thehive().respondio()).isTrue();
        assertThat(tablero.resumen().alertas().recibidas()).isEqualTo(2);
        assertThat(tablero.lista().alertas()).hasSize(2);
        assertThat(tablero.resumen().generadoEn()).isEqualTo(T + 60_000);
    }

    @Test
    void siTheHiveNuncaRespondioNoHayDatosYSeDa503() {
        hive.codigoForzado = 502;
        tablero.refrescar();

        assertThatThrownBy(() -> tablero.resumen()).isInstanceOf(DatosNoDisponiblesException.class);
        assertThatThrownBy(() -> tablero.lista()).isInstanceOf(DatosNoDisponiblesException.class);
    }

    @Test
    void antesDelPrimerRefrescoUnaPeticionEsperaYSinDatosDa503() {
        long inicio = System.nanoTime();

        assertThatThrownBy(() -> tablero.resumen()).isInstanceOf(DatosNoDisponiblesException.class);

        assertThat((System.nanoTime() - inicio) / 1_000_000).as("esperó el tope configurado (100 ms) y no más").isLessThan(3000);
    }

    @Test
    void conLaListaEnSegundoPlanoApagadaElRefrescoNoCalculaLaListaYElEndpointLaCalculaBajoDemanda() {
        var sinLista = new TableroEnSegundoPlano(resumenService, alertasService, reloj,
                new ConfiguracionRefresco(Duration.ofSeconds(30), Duration.ofMillis(100), false));

        sinLista.refrescar();   // arranque en frío
        int antesSin = hive.consultas.size();
        sinLista.refrescar();
        int consultasSinLista = hive.consultas.size() - antesSin;
        assertThat(sinLista.resumen().alertas().recibidas()).isEqualTo(1);
        assertThat(hive.consultas).as("servir el resumen no consulta").hasSize(antesSin + consultasSinLista);

        // un ciclo igual con la lista activada hace MÁS consultas a TheHive
        var conLista = new TableroEnSegundoPlano(resumenService, alertasService, reloj,
                new ConfiguracionRefresco(Duration.ofSeconds(30), Duration.ofMillis(100), true));
        int antesCon = hive.consultas.size();
        conLista.refrescar();
        assertThat(hive.consultas.size() - antesCon).as("con la lista activada el refresco consulta más").isGreaterThan(consultasSinLista);

        int antesDeLista = hive.consultas.size();
        assertThat(sinLista.lista().alertas()).hasSize(1);
        assertThat(sinLista.lista().thehive().respondio()).isTrue();
        assertThat(hive.consultas.size()).as("la lista se calcula bajo demanda: consulta a TheHive").isGreaterThan(antesDeLista);
    }
}
