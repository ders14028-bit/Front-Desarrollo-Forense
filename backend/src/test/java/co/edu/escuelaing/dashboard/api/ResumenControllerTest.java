package co.edu.escuelaing.dashboard.api;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.AlertasConvertidas;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorDia;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorSeveridad;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ResumenAlertas;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ResumenCasos;
import co.edu.escuelaing.dashboard.resumen.ResumenService;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveCredencialesException;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveNoRespondeException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@PruebaDeApi
class ResumenControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    ResumenService servicio;

    private static ResumenGerencial vacio() {
        var alertas = new ResumenAlertas(0, 0, 0, null, null, 0,
                List.of(new ConteoPorSeveridad(4, 0), new ConteoPorSeveridad(3, 0), new ConteoPorSeveridad(2, 0), new ConteoPorSeveridad(1, 0)),
                List.of(), 0, List.of(), List.of(new ConteoPorDia("2026-11-04", 0)));
        var casos = new ResumenCasos(0, 0, 0, 0, new AlertasConvertidas(0, 0, null), 0, 0, null);
        return new ResumenGerencial(1793800000000L, false, alertas, casos, new EstadoTheHive(true, 1793800000000L));
    }

    @Test
    void devuelveElResumenConLosNullExplicitos() throws Exception {
        when(servicio.obtener()).thenReturn(vacio());

        mvc.perform(get("/api/dashboard/resumen"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.generadoEn").value(1793800000000L))
                .andExpect(jsonPath("$.datosDeLaboratorio").value(false))
                .andExpect(jsonPath("$.alertas.masAntiguaSinAtenderMs").value((Object) null))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"masAntiguaSinAtenderMs\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"antiguedadPromedioSinAtenderMs\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"tiempoPromedioCierreMs\":null")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"porcentaje\":null")))
                .andExpect(jsonPath("$.alertas.porSeveridad[0].severidad").value(4))
                .andExpect(jsonPath("$.thehive.respondio").value(true))
                .andExpect(jsonPath("$.thehive.consultadoEn").value(1793800000000L));
    }

    @Test
    void siTheHiveNoRespondeDa503SinCuerpo() throws Exception {
        when(servicio.obtener()).thenThrow(new TheHiveNoRespondeException("TheHive no responde: se agotó el tiempo de espera."));

        mvc.perform(get("/api/dashboard/resumen"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().string(""));
    }

    @Test
    void siTheHiveRechazaLaKeyElFrontendSoloVeUn503SinDetalles() throws Exception {
        when(servicio.obtener()).thenThrow(new TheHiveCredencialesException());

        mvc.perform(get("/api/dashboard/resumen"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().string(""));
    }

    @Test
    void soloAceptaGet() throws Exception {
        mvc.perform(post("/api/dashboard/resumen")).andExpect(status().isMethodNotAllowed());
        mvc.perform(put("/api/dashboard/resumen")).andExpect(status().isMethodNotAllowed());
        mvc.perform(delete("/api/dashboard/resumen")).andExpect(status().isMethodNotAllowed());
    }
}
