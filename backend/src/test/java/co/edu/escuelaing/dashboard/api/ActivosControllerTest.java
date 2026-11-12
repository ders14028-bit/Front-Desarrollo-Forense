package co.edu.escuelaing.dashboard.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import co.edu.escuelaing.dashboard.activos.CalculoActivosTest;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh;
import co.edu.escuelaing.dashboard.wazuh.CalculoMetricasWazuh;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh;
import co.edu.escuelaing.dashboard.wazuh.SincronizacionWazuh;
import java.util.List;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@PruebaDeApi
class ActivosControllerTest {

    static final long T = 1793800000000L;

    @Autowired
    MockMvc mvc;

    @Autowired
    ConfiguracionActivos configuracion;

    @Autowired
    co.edu.escuelaing.dashboard.wazuh.ConfiguracionWazuh wazuh;

    @Test
    void laVentanaPorDefectoEsDe14Dias() {
        assertThat(wazuh.ventanaDias()).isEqualTo(14);
    }

    @MockitoBean
    SincronizacionWazuh sincronizacion;

    @Test
    void application_ymlTraeElInventarioYLaTablaDeComponentes() {
        assertThat(configuracion.inventario()).extracting(ConfiguracionActivos.Entrada::agenteId)
                .containsExactly("000", "003", "004", "001", "002", "005");
        assertThat(configuracion.inventario().get(0).nombreVisible()).isEqualTo("Servidor de monitoreo (Wazuh)");
        assertThat(configuracion.inventario().get(4).sistema()).isEqualTo("Windows");
        assertThat(configuracion.componentes()).containsExactlyElementsOf(CalculoActivosTest.COMPONENTES);
        assertThat(configuracion.gruposGenericos()).containsExactlyInAnyOrderElementsOf(CalculoActivosTest.GENERICOS);
    }

    @Test
    void mientrasCargaActivosVaEnNullNoVacio() throws Exception {
        when(sincronizacion.actual()).thenReturn(MetricasWazuh.cargando(T, 41, new EstadoTheHive(true, T), 7, "2026-10-29"));

        mvc.perform(get("/api/dashboard/activos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("cargando"))
                .andExpect(jsonPath("$.progreso").value(41))
                .andExpect(jsonPath("$.ventanaDias").value(7))
                .andExpect(content().string(Matchers.containsString("\"activos\":null")))
                .andExpect(content().string(Matchers.containsString("\"alertasSinActivo\":null")));
    }

    @Test
    void listoTraeLosActivosSinIpsNiUsuarios() throws Exception {
        when(sincronizacion.actual()).thenReturn(CalculoMetricasWazuh.calcular(List.of(), T, new EstadoTheHive(true, T), 7, "2026-10-29", 10));
        when(sincronizacion.instantanea()).thenReturn(List.of(new AlertaWazuh("a", T, true, "1", 12, "x", List.of(), List.of(), Map.of(),
                "192.0.2.77", "usuario-77", "ip-172-31-20-112",
                new AlertaWazuh.Activo("wazuh", "003", null, "journald", List.of("mariadb_lab"), 4))));

        mvc.perform(get("/api/dashboard/activos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("listo"))
                .andExpect(jsonPath("$.thehive.respondio").value(true))
                .andExpect(jsonPath("$.alertasSinActivo").value(0))
                .andExpect(jsonPath("$.activos.length()").value(6))
                .andExpect(jsonPath("$.activos[0].agenteId").value("003"))
                .andExpect(jsonPath("$.activos[0].nombreVisible").value("Servidor de base de datos"))
                .andExpect(jsonPath("$.activos[0].tipo").value("base-de-datos"))
                .andExpect(jsonPath("$.activos[0].altasYCriticas").value(1))
                .andExpect(jsonPath("$.activos[0].componentePrincipal").value("base-de-datos"))
                .andExpect(jsonPath("$.activos[0].componentes[0].clave").value("base-de-datos"))
                .andExpect(content().string(Matchers.not(Matchers.containsString("192.0.2.77"))))
                .andExpect(content().string(Matchers.not(Matchers.containsString("usuario-77"))));
    }

    @Test
    void soloAceptaGet() throws Exception {
        mvc.perform(post("/api/dashboard/activos")).andExpect(status().isMethodNotAllowed());
    }
}
