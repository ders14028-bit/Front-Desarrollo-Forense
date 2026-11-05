package co.edu.escuelaing.dashboard.api;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.wazuh.CalculoMetricasWazuh;
import co.edu.escuelaing.dashboard.wazuh.MetricasWazuh;
import co.edu.escuelaing.dashboard.wazuh.SincronizacionWazuh;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@PruebaDeApi
class WazuhControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    SincronizacionWazuh sincronizacion;

    @Test
    void mientrasCargaTodasLasMetricasVanEnNullExplicitoConElProgreso() throws Exception {
        when(sincronizacion.actual()).thenReturn(MetricasWazuh.cargando(1793800000000L, 41, new EstadoTheHive(true, 1793800000000L), 7, "2026-10-29"));

        mvc.perform(get("/api/dashboard/wazuh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("cargando"))
                .andExpect(jsonPath("$.progreso").value(41))
                .andExpect(jsonPath("$.dias").value(7))
                .andExpect(jsonPath("$.desde").value("2026-10-29"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"mitre\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"cumplimiento\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"topIps\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"alertasAnalizadas\":null")));
    }

    @Test
    void listoTraeLasMetricas() throws Exception {
        when(sincronizacion.actual()).thenReturn(CalculoMetricasWazuh.calcular(List.of(), 1793800000000L,
                new EstadoTheHive(false, 1793800030000L), 7, "2026-10-29", 10));

        mvc.perform(get("/api/dashboard/wazuh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("listo"))
                .andExpect(jsonPath("$.progreso").value(100))
                .andExpect(jsonPath("$.alertasAnalizadas").value(0))
                .andExpect(jsonPath("$.mitre.tacticas").isEmpty())
                .andExpect(jsonPath("$.cumplimiento.length()").value(5))
                .andExpect(jsonPath("$.cumplimiento[0].marco").value("pci_dss"))
                .andExpect(jsonPath("$.thehive.respondio").value(false));
    }

    @Test
    void soloAceptaGet() throws Exception {
        mvc.perform(post("/api/dashboard/wazuh")).andExpect(status().isMethodNotAllowed());
        mvc.perform(delete("/api/dashboard/wazuh")).andExpect(status().isMethodNotAllowed());
    }
}
