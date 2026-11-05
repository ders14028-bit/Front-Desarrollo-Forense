package co.edu.escuelaing.dashboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.edu.escuelaing.dashboard.PruebaDeApi;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@PruebaDeApi
class ConfiguracionControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void devuelveElSlaEnMinutosPorSeveridad() throws Exception {
        mvc.perform(get("/api/dashboard/configuracion"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"slaMinutos\":{\"1\":240,\"2\":120,\"3\":30,\"4\":15}}", true));
    }

    @Test
    void lasClavesVanDeBajaACritica() throws Exception {
        mvc.perform(get("/api/dashboard/configuracion"))
                .andExpect(content().string("{\"slaMinutos\":{\"1\":240,\"2\":120,\"3\":30,\"4\":15}}"));
    }

    @Test
    void laApiNoAceptaMetodosDeEscritura() throws Exception {
        mvc.perform(post("/api/dashboard/configuracion")).andExpect(status().isMethodNotAllowed());
        mvc.perform(put("/api/dashboard/configuracion")).andExpect(status().isMethodNotAllowed());
        mvc.perform(delete("/api/dashboard/configuracion")).andExpect(status().isMethodNotAllowed());
        mvc.perform(patch("/api/dashboard/configuracion")).andExpect(status().isMethodNotAllowed());
    }

    @Test
    void unaRutaInexistenteDa404SinDetallesInternos() throws Exception {
        mvc.perform(get("/api/dashboard/no-existe"))
                .andExpect(status().isNotFound())
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Exception"))));
    }
}
