package co.edu.escuelaing.dashboard.dominio;

import static org.assertj.core.api.Assertions.assertThat;

import co.edu.escuelaing.dashboard.config.SlaMinutos;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class SlaDiasYCasosTest {

    private static final SlaMinutos SLA = new SlaMinutos(15, 30, 120, 240);
    private static final long AHORA = 1_793_800_000_000L;
    private static final long MIN = 60_000L;

    private static Alerta alerta(int severidad, String estado, long antiguedadMs) {
        return new Alerta("~1", AHORA - antiguedadMs, "wazuh", "wazuh", "r", "t", "", severidad, estado, List.of(), null);
    }

    // ---- SLA ----

    @Test
    void justoEnElLimiteTodaviaEstaDentro() {
        EstadoSla sla = EstadoSla.evaluar(alerta(4, "New", 15 * MIN), AHORA, SLA);

        assertThat(sla).isEqualTo(new EstadoSla("dentro", 15, null));
    }

    @Test
    void unMilisegundoDespuesDelLimiteEstaFuera() {
        EstadoSla sla = EstadoSla.evaluar(alerta(4, "New", 15 * MIN + 1), AHORA, SLA);

        assertThat(sla).isEqualTo(new EstadoSla("fuera", 15, 1L));
    }

    @Test
    void cadaSeveridadUsaSuLimite() {
        assertThat(EstadoSla.evaluar(alerta(4, "New", 0), AHORA, SLA).limiteMin()).isEqualTo(15);
        assertThat(EstadoSla.evaluar(alerta(3, "New", 0), AHORA, SLA).limiteMin()).isEqualTo(30);
        assertThat(EstadoSla.evaluar(alerta(2, "New", 0), AHORA, SLA).limiteMin()).isEqualTo(120);
        assertThat(EstadoSla.evaluar(alerta(1, "New", 0), AHORA, SLA).limiteMin()).isEqualTo(240);
    }

    @Test
    void elExcesoEsLaAntiguedadMenosElLimite() {
        EstadoSla sla = EstadoSla.evaluar(alerta(3, "New", 45 * MIN), AHORA, SLA);

        assertThat(sla.estado()).isEqualTo("fuera");
        assertThat(sla.excesoMs()).isEqualTo(15 * MIN);
    }

    @Test
    void soloAplicaALasSinAtender() {
        for (String estado : List.of("Imported", "InProgress", "Ignored")) {
            assertThat(EstadoSla.evaluar(alerta(4, estado, 999 * MIN), AHORA, SLA))
                    .as(estado).isEqualTo(new EstadoSla(null, 15, null));
        }
    }

    @Test
    void unaAlertaConFechaFuturaTieneAntiguedadCero() {
        Alerta futura = alerta(4, "New", -5 * MIN);

        assertThat(EstadoSla.antiguedadMs(futura, AHORA)).isZero();
        assertThat(EstadoSla.evaluar(futura, AHORA, SLA).estado()).isEqualTo("dentro");
    }

    // ---- Días de Bogotá ----

    @Test
    void elDiaCambiaALasCeroHorasDeBogotaNoDeUtc() {
        // 2026-11-04 04:59:59.999 UTC = 2026-11-03 23:59:59.999 en Bogotá (UTC−5)
        long ultimoMsDelTres = java.time.Instant.parse("2026-11-04T04:59:59.999Z").toEpochMilli();
        long primerMsDelCuatro = java.time.Instant.parse("2026-11-04T05:00:00Z").toEpochMilli();

        assertThat(DiasBogota.dia(ultimoMsDelTres)).isEqualTo(LocalDate.of(2026, 11, 3));
        assertThat(DiasBogota.dia(primerMsDelCuatro)).isEqualTo(LocalDate.of(2026, 11, 4));
        assertThat(DiasBogota.inicio(LocalDate.of(2026, 11, 4))).isEqualTo(primerMsDelCuatro);
    }

    @Test
    void ultimosDiasVanDelMasAntiguoAHoyYCruzanElMes() {
        long ahora = java.time.Instant.parse("2026-11-04T15:00:00Z").toEpochMilli();

        List<LocalDate> dias = DiasBogota.ultimos(ahora, 30);

        assertThat(dias).hasSize(30);
        assertThat(dias.get(0)).isEqualTo(LocalDate.of(2026, 10, 6));
        assertThat(dias.get(29)).isEqualTo(LocalDate.of(2026, 11, 4));
        assertThat(dias).isSorted();
    }

    @Test
    void lasOnceYMediaDeLaNocheEnBogotaSiguenSiendoElMismoDia() {
        // 2026-11-04 23:30 Bogotá = 2026-11-05 04:30 UTC: sigue siendo el 4 en Bogotá.
        long ahora = java.time.Instant.parse("2026-11-05T04:30:00Z").toEpochMilli();

        assertThat(DiasBogota.ultimos(ahora, 1)).containsExactly(LocalDate.of(2026, 11, 4));
    }

    // ---- Casos ----

    @Test
    void leeUnCasoCerradoConSuDuracion() {
        Caso caso = Caso.desde(FixturesTheHive.json("""
                {"_id":"~8196096","number":1,"_createdAt":1000000,"stage":"Closed","status":"TruePositive","endDate":4600000}"""));

        assertThat(caso.numero()).isEqualTo(1);
        assertThat(caso.etapa()).isEqualTo("Closed");
        assertThat(caso.estado()).isEqualTo("TruePositive");
        assertThat(caso.duracionMs()).isEqualTo(3_600_000L);
    }

    @Test
    void unCasoSinFechaDeCierreOIncoherenteNoTieneDuracion() {
        assertThat(Caso.desde(FixturesTheHive.json("{\"_createdAt\":1000,\"stage\":\"New\"}")).duracionMs()).isNull();
        assertThat(Caso.desde(FixturesTheHive.json("{\"_createdAt\":5000,\"endDate\":1000}")).duracionMs()).isNull();
        assertThat(Caso.desde(FixturesTheHive.json("{}")).numero()).isNull();
    }
}
